import { Vehicle, CreateVehicleDTO, UpdateVehicleDTO } from '@autogest/shared-types';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { useAppStore } from '../store/useAppStore';
import { validateVehicleForm } from './vehicleValidation';

export class VehicleService {
  /**
   * Lista todos os veículos ativos (não excluídos)
   */
  static async listVehicles(): Promise<Vehicle[]> {
    const list = await VehicleRepository.listAll();
    const store = useAppStore.getState();

    // Mantém a sincronização do estado global
    store.setVehicles(list);

    return list;
  }

  /**
   * Obtém os detalhes de um veículo ativo por ID
   */
  static async getVehicle(id: string): Promise<Vehicle | null> {
    return VehicleRepository.findById(id);
  }

  /**
   * Cadastra um novo veículo, valida os campos e enfileira sincronização
   */
  static async createVehicle(dto: CreateVehicleDTO): Promise<Vehicle> {
    const validation = validateVehicleForm({
      plate: dto.plate,
      model: dto.model,
      year: dto.year,
      tankCapacityL: dto.tankCapacityL,
      preferredFuel: dto.preferredFuel || dto.fuelType,
      name: dto.name,
      brand: dto.brand,
      initialOdometer: dto.initialOdometer,
    });

    if (!validation.isValid || !validation.data) {
      const errorMsg = Object.values(validation.errors).join(' ');
      throw new Error(errorMsg || 'Dados do veículo inválidos.');
    }

    const currentUserId = useAppStore.getState().user?.id || 'local_user';
    const newVehicle = await VehicleRepository.create(
      {
        ...dto,
        plate: validation.data.plate,
        model: validation.data.model,
        year: validation.data.year,
        tankCapacityL: validation.data.tankCapacityL,
        preferredFuel: validation.data.preferredFuel,
        initialOdometer: validation.data.initialOdometer,
      },
      currentUserId,
    );

    // Enfileira operação na fila outbox de sincronização offline-first
    await SyncQueueRepository.enqueue('CREATE_VEHICLE', '/api/v1/vehicles', newVehicle);

    // Atualiza estado global
    const store = useAppStore.getState();
    const updatedList = [...store.vehicles.filter(v => v.id !== newVehicle.id), newVehicle];
    store.setVehicles(updatedList);

    return newVehicle;
  }

  /**
   * Atualiza os metadados de um veículo existente
   */
  static async updateVehicle(id: string, updates: UpdateVehicleDTO): Promise<Vehicle> {
    const updated = await VehicleRepository.update(id, updates);
    if (!updated) {
      throw new Error('Veículo não encontrado para atualização.');
    }

    // Enfileira sincronização de atualização
    await SyncQueueRepository.enqueue('UPDATE_VEHICLE', `/api/v1/vehicles/${id}`, updated);

    const store = useAppStore.getState();
    const updatedList = store.vehicles.map(v => (v.id === id ? updated : v));
    store.setVehicles(updatedList);

    if (store.selectedVehicle?.id === id) {
      store.setSelectedVehicle(updated);
    }

    return updated;
  }

  /**
   * Exclusão lógica do veículo e cascata sobre seus registros vinculados (US04.6)
   */
  static async deleteVehicle(id: string): Promise<boolean> {
    const success = await VehicleRepository.delete(id);
    if (!success) return false;

    // US04.6: Ocultação lógica em cascata dos registros vinculados (abastecimentos, etc)
    await RefuelRepository.softDeleteByVehicle(id);

    // Enfileira sincronização de exclusão
    await SyncQueueRepository.enqueue('DELETE_VEHICLE', `/api/v1/vehicles/${id}`, { id });

    // Atualiza estado global
    const store = useAppStore.getState();
    const remaining = store.vehicles.filter(v => v.id !== id);
    store.setVehicles(remaining);

    return true;
  }

  /**
   * Seleciona o veículo ativo global
   */
  static selectVehicle(vehicleId: string): void {
    const store = useAppStore.getState();
    const found = store.vehicles.find(v => v.id === vehicleId);
    if (found) {
      store.setSelectedVehicle(found);
    }
  }
}
