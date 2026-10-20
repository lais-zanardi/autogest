import { Refuel, CreateRefuelDTO, UpdateRefuelDTO } from '@autogest/shared-types';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { GPSService, Coordinates } from './gpsService';
import { calcularConsumo } from './fuelingCalculations';
import { useAppStore } from '../store/useAppStore';

export class FuelingService {
  /**
   * Registra um novo abastecimento completo (US05.1 - US05.6)
   */
  static async createRefuel(
    dto: CreateRefuelDTO,
    coordinatesOverride?: Coordinates | null,
  ): Promise<Refuel> {
    // US05.4: Captura coordenadas GPS se não fornecidas explicitamente (com fallback silencioso)
    let coords: Coordinates | null = null;
    if (coordinatesOverride !== undefined) {
      coords = coordinatesOverride;
    } else {
      coords = await GPSService.getCurrentLocation();
    }

    // US05.5: Obtém abastecimento anterior para cálculo de consumo
    const prevRefuel = await RefuelRepository.getPreviousRefuel(dto.vehicleId, dto.odometer);
    const kml = prevRefuel ? calcularConsumo(dto.odometer, prevRefuel.odometer, dto.liters) : null;

    // Persiste o registro de abastecimento no banco local
    const newRefuel = await RefuelRepository.create(
      {
        ...dto,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      },
      kml,
    );

    // US05.7: Recalcula abastecimentos subsequentes (caso este abastecimento seja retroativo)
    await RefuelRepository.recalculateAllForVehicle(dto.vehicleId);

    // Busca registro atualizado após recálculo
    const savedRefuel = (await RefuelRepository.findById(newRefuel.id)) || newRefuel;

    // US05.6: Grava leitura de hodômetro com origem 'abastecimento'
    await OdometerRepository.create({
      vehicleId: dto.vehicleId,
      km: dto.odometer,
      date: dto.date,
      origin: 'abastecimento',
    });

    // US05.6: Atualiza o km atual do veículo
    await VehicleRepository.updateOdometer(dto.vehicleId, dto.odometer);

    // Atualiza estado global do veículo
    const store = useAppStore.getState();
    const updatedVehicles = store.vehicles.map(v =>
      v.id === dto.vehicleId
        ? { ...v, currentOdometer: Math.max(v.currentOdometer || 0, dto.odometer) }
        : v,
    );
    store.setVehicles(updatedVehicles);

    // Enfileira na fila outbox de sincronização offline-first
    await SyncQueueRepository.enqueue('CREATE_REFUEL', '/api/v1/refuels', savedRefuel);

    // US10.5: Reavalia regras preventivas de manutenção ao salvar abastecimento
    const { MaintenanceAlertService } = await import('./maintenanceAlertService');
    MaintenanceAlertService.evaluateVehicleAlerts(dto.vehicleId).catch(() => {});

    // US13.3: Recalcula indicadores globais do dashboard ao salvar abastecimento
    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(dto.vehicleId).catch(() => {});

    return savedRefuel;
  }

  /**
   * Atualiza um abastecimento e recalcula o consumo dele e dos subsequentes (US05.7)
   */
  static async updateRefuel(id: string, updates: UpdateRefuelDTO): Promise<Refuel> {
    const existing = await RefuelRepository.findById(id);
    if (!existing) {
      throw new Error('Abastecimento não encontrado para atualização.');
    }

    const updated = await RefuelRepository.update(id, updates);
    if (!updated) {
      throw new Error('Falha ao atualizar abastecimento.');
    }

    // US05.7: Recalcula toda a cadeia de abastecimentos do veículo
    await RefuelRepository.recalculateAllForVehicle(existing.vehicleId);

    if (updates.odometer) {
      await VehicleRepository.updateOdometer(existing.vehicleId, updates.odometer);
    }

    const saved = (await RefuelRepository.findById(id)) || updated;

    // Enfileira na outbox de sincronização offline-first
    await SyncQueueRepository.enqueue('UPDATE_REFUEL', `/api/v1/refuels/${id}`, saved);

    // US13.3: Recalcula indicadores globais do dashboard ao editar abastecimento
    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(existing.vehicleId).catch(() => {});

    return saved;
  }

  /**
   * Exclui logicamente um abastecimento e recalcula o consumo do abastecimento seguinte (US05.7)
   */
  static async deleteRefuel(id: string): Promise<boolean> {
    const existing = await RefuelRepository.findById(id);
    if (!existing) return false;

    const success = await RefuelRepository.delete(id);
    if (!success) return false;

    // US05.7: Recalcula os abastecimentos do veículo, fazendo o posterior apontar para o anterior
    await RefuelRepository.recalculateAllForVehicle(existing.vehicleId);

    // Enfileira na outbox de sincronização offline-first
    await SyncQueueRepository.enqueue('DELETE_REFUEL', `/api/v1/refuels/${id}`, {
      id,
      vehicleId: existing.vehicleId,
    });

    // US13.3: Recalcula indicadores globais do dashboard ao excluir abastecimento
    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(existing.vehicleId).catch(() => {});

    return true;
  }

  /**
   * Lista todos os abastecimentos de um veículo ordenados cronologicamente (mais recente primeiro)
   */
  static async listRefuels(vehicleId: string): Promise<Refuel[]> {
    return RefuelRepository.listByVehicle(vehicleId);
  }
}
