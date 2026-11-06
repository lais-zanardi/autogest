import { Vehicle, CreateVehicleDTO, UpdateVehicleDTO } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { validatePlate } from '../services/vehicleValidation';
import { AuditRepository } from './AuditRepository';

export class VehicleRepository {
  private static TABLE = 'local_vehicles';

  static async listAll(): Promise<Vehicle[]> {
    const all = await db.getTableData<Vehicle>(this.TABLE);
    return all.filter(v => !v.deletedAt && !(v as any).excluido_em);
  }

  static async findById(id: string): Promise<Vehicle | null> {
    const item = await db.findById<Vehicle>(this.TABLE, id);
    if (!item || item.deletedAt || (item as any).excluido_em) return null;
    return item;
  }

  static async create(dto: CreateVehicleDTO, userId = 'local_user'): Promise<Vehicle> {
    const sanitizedPlate =
      validatePlate(dto.plate).formattedPlate || dto.plate.toUpperCase().trim();
    const now = new Date().toISOString();

    const newVehicle: Vehicle = {
      id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      name: dto.name || dto.model,
      brand: dto.brand || '',
      model: dto.model,
      year: dto.year,
      plate: sanitizedPlate,
      fuelType: dto.fuelType || dto.preferredFuel || 'Gasolina',
      tankCapacityL: dto.tankCapacityL,
      preferredFuel: dto.preferredFuel || dto.fuelType || 'Gasolina',
      initialOdometer: dto.initialOdometer ?? 0,
      currentOdometer: dto.initialOdometer ?? 0,
      fipeValue: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.insert(this.TABLE, newVehicle);
    await AuditRepository.recordMutation({
      usuario_id: userId,
      entidade: 'veiculos',
      entidade_id: newVehicle.id,
      acao: 'criacao',
      antes: null,
      depois: newVehicle as any,
    });
    return newVehicle;
  }

  static async update(id: string, updates: UpdateVehicleDTO): Promise<Vehicle | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const sanitizedPlate = updates.plate
      ? validatePlate(updates.plate).formattedPlate || updates.plate.toUpperCase().trim()
      : existing.plate;

    const updated = await db.update<Vehicle>(this.TABLE, id, {
      ...updates,
      plate: sanitizedPlate,
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      await AuditRepository.recordMutation({
        usuario_id: existing.userId || 'local_user',
        entidade: 'veiculos',
        entidade_id: id,
        acao: 'edicao',
        antes: existing as any,
        depois: updated as any,
      });
    }

    return updated;
  }

  static async updateOdometer(id: string, newOdometer: number): Promise<Vehicle | null> {
    return db.update<Vehicle>(this.TABLE, id, {
      currentOdometer: newOdometer,
      updatedAt: new Date().toISOString(),
    });
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    const now = new Date().toISOString();
    const updated = await db.update<Vehicle>(this.TABLE, id, {
      deletedAt: now,
      excluido_em: now,
      updatedAt: now,
    } as any);

    if (updated && existing) {
      await AuditRepository.recordMutation({
        usuario_id: existing.userId || 'local_user',
        entidade: 'veiculos',
        entidade_id: id,
        acao: 'exclusao',
        antes: existing as any,
        depois: updated as any,
      });
    }

    return !!updated;
  }
}
