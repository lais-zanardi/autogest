import {
  TireRecord,
  CreateTireRecordDTO,
  UpdateTireRecordDTO,
  TireRecordType,
  FluidRecord,
  CreateFluidRecordDTO,
  UpdateFluidRecordDTO,
  FluidType,
  FluidLevel,
} from '@autogest/shared-types';
import { TireRecordRepository } from '../repositories/TireRecordRepository';
import { FluidRecordRepository } from '../repositories/FluidRecordRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { MaintenanceRuleRepository } from '../repositories/MaintenanceRuleRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { NotificationService } from './notificationService';
import { MaintenanceAlertService } from './maintenanceAlertService';
import { useAppStore } from '../store/useAppStore';

export const TIRE_TYPE_LABELS: Record<TireRecordType, string> = {
  calibragem: 'Calibragem',
  troca: 'Troca de Pneu',
};

export const FLUID_TYPE_LABELS: Record<FluidType, string> = {
  oleo_motor: 'Óleo do Motor',
  freio: 'Fluido de Freio',
  radiador: 'Água do Radiador',
};

export const FLUID_LEVEL_LABELS: Record<FluidLevel, string> = {
  normal: 'Normal',
  baixo: 'Nível Baixo',
};

/**
 * US11.2: Validação pura de registro de pneu (pressão obrigatória, sulco opcional, km > 0)
 */
export function validarRegistroPneu(dto: CreateTireRecordDTO): void {
  if (!dto.vehicleId) {
    throw new Error('Veículo é obrigatório.');
  }
  if (!dto.date || !dto.date.trim()) {
    throw new Error('Data do registro de pneu é obrigatória.');
  }
  if (!dto.type || !['calibragem', 'troca'].includes(dto.type)) {
    throw new Error('Tipo de registro de pneu inválido (use calibragem ou troca).');
  }
  if (dto.km === undefined || dto.km === null || isNaN(Number(dto.km)) || Number(dto.km) <= 0) {
    throw new Error('A quilometragem (km) deve ser maior que zero.');
  }
  if (
    dto.pressurePsi === undefined ||
    dto.pressurePsi === null ||
    isNaN(Number(dto.pressurePsi)) ||
    Number(dto.pressurePsi) <= 0 ||
    Number(dto.pressurePsi) > 120
  ) {
    throw new Error('A pressão dos pneus (PSI) deve estar entre 1 e 120 PSI.');
  }
  if (dto.treadDepthMm !== undefined && dto.treadDepthMm !== null) {
    const sulco = Number(dto.treadDepthMm);
    if (isNaN(sulco) || sulco < 0 || sulco > 30) {
      throw new Error('A profundidade do sulco (mm) deve estar entre 0 e 30 mm.');
    }
  }
}

/**
 * US11.3: Validação pura de registro de fluido (óleo do motor, fluido de freio, água do radiador)
 */
export function validarRegistroFluido(dto: CreateFluidRecordDTO): void {
  if (!dto.vehicleId) {
    throw new Error('Veículo é obrigatório.');
  }
  if (!dto.date || !dto.date.trim()) {
    throw new Error('Data do registro de fluido é obrigatória.');
  }
  if (!dto.fluidType || !['oleo_motor', 'freio', 'radiador'].includes(dto.fluidType)) {
    throw new Error('Tipo de fluido inválido (use oleo_motor, freio ou radiador).');
  }
  if (dto.km === undefined || dto.km === null || isNaN(Number(dto.km)) || Number(dto.km) <= 0) {
    throw new Error('A quilometragem (km) deve ser maior que zero.');
  }
  if (dto.level !== undefined && !['normal', 'baixo'].includes(dto.level)) {
    throw new Error('Nível do fluido inválido (use normal ou baixo).');
  }
}

export class TireAndFluidService {
  /**
   * Atualiza odômetro do veículo se o km registrado for superior ao atual
   */
  private static async syncVehicleOdometerIfNeeded(
    vehicleId: string,
    km: number,
    date: string,
  ): Promise<void> {
    const vehicle = await VehicleRepository.findById(vehicleId);
    if (vehicle && km > (vehicle.currentOdometer || 0)) {
      const updated = await VehicleRepository.updateOdometer(vehicleId, km);
      await OdometerRepository.create({
        vehicleId,
        km,
        date,
        origin: 'manutencao',
      });
      if (updated) {
        const store = useAppStore.getState();
        if (store.vehicles.length > 0) {
          store.setVehicles(store.vehicles.map(v => (v.id === updated.id ? updated : v)));
        }
      }
    }
  }

  /**
   * Reinicia ciclo de notificações para regras correspondentes e reavalia alertas (US11.5)
   */
  private static async refreshRulesAndDashboard(
    vehicleId: string,
    targetServiceType:
      'calibragem_pneus' | 'pneus' | 'troca_oleo' | 'fluido_freio' | 'agua_radiador',
  ): Promise<void> {
    try {
      const rules = await MaintenanceRuleRepository.listByVehicle(vehicleId);
      for (const r of rules) {
        if (r.serviceType === targetServiceType) {
          await NotificationService.clearNotificationCycleForRule(r.id);
        }
      }
      await MaintenanceAlertService.evaluateVehicleAlerts(vehicleId, undefined, false);
    } catch {
      // Ignora falhas de background em avaliação de alertas
    }

    try {
      const { DashboardIndicatorsService } = await import('./dashboardIndicators');
      await DashboardIndicatorsService.refreshForVehicle(vehicleId);
    } catch {
      // Ignora falhas de background
    }
  }

  /**
   * US11.2: Cria registro de pneu (calibragem ou troca)
   */
  static async createTireRecord(dto: CreateTireRecordDTO): Promise<TireRecord> {
    validarRegistroPneu(dto);

    const record = await TireRecordRepository.create(dto);
    await this.syncVehicleOdometerIfNeeded(dto.vehicleId, record.km, record.date);

    await SyncQueueRepository.enqueue('CREATE_TIRE_RECORD', '/sync/registros_pneu', {
      id: record.id,
      veiculo_id: record.vehicleId,
      data: record.date,
      km: record.km,
      tipo: record.type,
      pressao_psi: record.pressurePsi,
      sulco_mm: record.treadDepthMm,
      criado_em: record.createdAt,
      atualizado_em: record.updatedAt,
    }).catch(() => {});

    const serviceType = record.type === 'calibragem' ? 'calibragem_pneus' : 'pneus';
    await this.refreshRulesAndDashboard(record.vehicleId, serviceType);

    return record;
  }

  /**
   * US11.4: Atualiza registro de pneu
   */
  static async updateTireRecord(
    id: string,
    updates: UpdateTireRecordDTO,
  ): Promise<TireRecord | null> {
    const existing = await TireRecordRepository.findById(id);
    if (!existing) return null;

    validarRegistroPneu({
      vehicleId: existing.vehicleId,
      date: updates.date ?? existing.date,
      km: updates.km ?? existing.km,
      type: updates.type ?? existing.type,
      pressurePsi: updates.pressurePsi ?? existing.pressurePsi,
      treadDepthMm:
        updates.treadDepthMm !== undefined ? updates.treadDepthMm : existing.treadDepthMm,
    });

    const updated = await TireRecordRepository.update(id, updates);
    if (updated) {
      await this.syncVehicleOdometerIfNeeded(updated.vehicleId, updated.km, updated.date);

      await SyncQueueRepository.enqueue('UPDATE_TIRE_RECORD', `/sync/registros_pneu/${id}`, {
        id: updated.id,
        veiculo_id: updated.vehicleId,
        data: updated.date,
        km: updated.km,
        tipo: updated.type,
        pressao_psi: updated.pressurePsi,
        sulco_mm: updated.treadDepthMm,
        atualizado_em: updated.updatedAt,
      }).catch(() => {});

      const serviceType = updated.type === 'calibragem' ? 'calibragem_pneus' : 'pneus';
      await this.refreshRulesAndDashboard(updated.vehicleId, serviceType);
    }

    return updated;
  }

  /**
   * US11.4: Exclui logicamente um registro de pneu
   */
  static async deleteTireRecord(id: string): Promise<boolean> {
    const existing = await TireRecordRepository.findById(id);
    const deleted = await TireRecordRepository.delete(id);

    if (deleted && existing) {
      await SyncQueueRepository.enqueue('DELETE_TIRE_RECORD', `/sync/registros_pneu/${id}`, {
        id,
      }).catch(() => {});

      const serviceType = existing.type === 'calibragem' ? 'calibragem_pneus' : 'pneus';
      await this.refreshRulesAndDashboard(existing.vehicleId, serviceType);
    }

    return deleted;
  }

  /**
   * US11.4: Lista histórico de pneus por veículo
   */
  static async listTireRecordsByVehicle(
    vehicleId: string,
    type?: TireRecordType,
  ): Promise<TireRecord[]> {
    return TireRecordRepository.listByVehicle(vehicleId, type);
  }

  /**
   * US11.3: Cria registro de fluido (óleo do motor, fluido de freio, água do radiador)
   */
  static async createFluidRecord(dto: CreateFluidRecordDTO): Promise<FluidRecord> {
    validarRegistroFluido(dto);

    const record = await FluidRecordRepository.create(dto);
    await this.syncVehicleOdometerIfNeeded(dto.vehicleId, record.km, record.date);

    await SyncQueueRepository.enqueue('CREATE_FLUID_RECORD', '/sync/registros_fluido', {
      id: record.id,
      veiculo_id: record.vehicleId,
      tipo_fluido: record.fluidType,
      data: record.date,
      km: record.km,
      nivel: record.level,
      criado_em: record.createdAt,
      atualizado_em: record.updatedAt,
    }).catch(() => {});

    const serviceTypeMap: Record<FluidType, 'troca_oleo' | 'fluido_freio' | 'agua_radiador'> = {
      oleo_motor: 'troca_oleo',
      freio: 'fluido_freio',
      radiador: 'agua_radiador',
    };
    await this.refreshRulesAndDashboard(record.vehicleId, serviceTypeMap[record.fluidType]);

    return record;
  }

  /**
   * US11.4: Atualiza registro de fluido
   */
  static async updateFluidRecord(
    id: string,
    updates: UpdateFluidRecordDTO,
  ): Promise<FluidRecord | null> {
    const existing = await FluidRecordRepository.findById(id);
    if (!existing) return null;

    validarRegistroFluido({
      vehicleId: existing.vehicleId,
      fluidType: updates.fluidType ?? existing.fluidType,
      date: updates.date ?? existing.date,
      km: updates.km ?? existing.km,
      level: updates.level ?? existing.level,
    });

    const updated = await FluidRecordRepository.update(id, updates);
    if (updated) {
      await this.syncVehicleOdometerIfNeeded(updated.vehicleId, updated.km, updated.date);

      await SyncQueueRepository.enqueue('UPDATE_FLUID_RECORD', `/sync/registros_fluido/${id}`, {
        id: updated.id,
        veiculo_id: updated.vehicleId,
        tipo_fluido: updated.fluidType,
        data: updated.date,
        km: updated.km,
        nivel: updated.level,
        atualizado_em: updated.updatedAt,
      }).catch(() => {});

      const serviceTypeMap: Record<FluidType, 'troca_oleo' | 'fluido_freio' | 'agua_radiador'> = {
        oleo_motor: 'troca_oleo',
        freio: 'fluido_freio',
        radiador: 'agua_radiador',
      };
      await this.refreshRulesAndDashboard(updated.vehicleId, serviceTypeMap[updated.fluidType]);
    }

    return updated;
  }

  /**
   * US11.4: Exclui logicamente um registro de fluido
   */
  static async deleteFluidRecord(id: string): Promise<boolean> {
    const existing = await FluidRecordRepository.findById(id);
    const deleted = await FluidRecordRepository.delete(id);

    if (deleted && existing) {
      await SyncQueueRepository.enqueue('DELETE_FLUID_RECORD', `/sync/registros_fluido/${id}`, {
        id,
      }).catch(() => {});

      const serviceTypeMap: Record<FluidType, 'troca_oleo' | 'fluido_freio' | 'agua_radiador'> = {
        oleo_motor: 'troca_oleo',
        freio: 'fluido_freio',
        radiador: 'agua_radiador',
      };
      await this.refreshRulesAndDashboard(existing.vehicleId, serviceTypeMap[existing.fluidType]);
    }

    return deleted;
  }

  /**
   * US11.4: Lista histórico de fluidos por veículo
   */
  static async listFluidRecordsByVehicle(
    vehicleId: string,
    fluidType?: FluidType,
  ): Promise<FluidRecord[]> {
    return FluidRecordRepository.listByVehicle(vehicleId, fluidType);
  }
}
