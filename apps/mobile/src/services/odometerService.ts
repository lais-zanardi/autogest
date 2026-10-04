import { OdometerReading } from '@autogest/shared-types';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { validarNovoKm } from './fuelingCalculations';
import { useAppStore } from '../store/useAppStore';

export class OdometerService {
  /**
   * US06.1 - US06.3: Atualização manual de hodômetro para um veículo.
   * Valida se novoKm > último consolidado, persiste a leitura com origem 'manual'
   * e atualiza o hodômetro do veículo no banco local e na store.
   */
  static async updateManualOdometer(
    vehicleId: string,
    newKm: number,
    date?: string,
  ): Promise<OdometerReading> {
    const vehicle = await VehicleRepository.findById(vehicleId);
    if (!vehicle) {
      throw new Error('Veículo não encontrado.');
    }

    // US06.2: Validação com validarNovoKm (deve ser estritamente maior que o último consolidado)
    const validation = validarNovoKm(newKm, vehicle.currentOdometer);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Quilometragem inválida.');
    }

    // US06.3: Grava leituras_hodometro (origem "manual")
    const reading = await OdometerRepository.create({
      vehicleId,
      km: newKm,
      date: date || new Date().toISOString(),
      origin: 'manual',
    });

    // US06.3: Atualiza o km atual do veículo
    await VehicleRepository.updateOdometer(vehicleId, newKm);

    // Atualiza estado global
    const store = useAppStore.getState();
    const updatedVehicles = store.vehicles.map(v =>
      v.id === vehicleId ? { ...v, currentOdometer: newKm } : v,
    );
    store.setVehicles(updatedVehicles);

    // Enfileira sincronização na fila outbox offline-first
    await SyncQueueRepository.enqueue('CREATE_ODOMETER_READING', '/api/v1/odometer', reading);

    return reading;
  }

  /**
   * Lista o histórico de leituras de hodômetro de um veículo
   */
  static async getHistory(vehicleId: string): Promise<OdometerReading[]> {
    return OdometerRepository.listByVehicle(vehicleId);
  }
}
