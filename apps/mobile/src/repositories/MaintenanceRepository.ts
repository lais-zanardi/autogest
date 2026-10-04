import {
  Maintenance,
  CreateMaintenanceDTO,
  UpdateMaintenanceDTO,
  MaintenanceType,
} from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';

/**
 * US09.1 & US09.7: Repositório de Manutenções (manutencoes).
 * Suporta persistência local, exclusão lógica, filtros por veículo e tipo, e sincronização.
 */
export class MaintenanceRepository {
  private static TABLE = 'manutencoes';
  private static LEGACY_TABLE = 'local_manutencoes';

  static async create(dto: CreateMaintenanceDTO): Promise<Maintenance> {
    const id = `maint_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: Maintenance = {
      id,
      vehicleId: dto.vehicleId,
      date: dto.date,
      odometer: Number(dto.odometer),
      type: dto.type,
      serviceType: dto.serviceType,
      description: dto.description.trim(),
      replacedParts: dto.replacedParts ? dto.replacedParts.trim() : null,
      workshop: dto.workshop ? dto.workshop.trim() : null,
      mechanic: dto.mechanic ? dto.mechanic.trim() : null,
      executionTimeMin: dto.executionTimeMin ? Number(dto.executionTimeMin) : null,
      totalValue: Number(dto.totalValue),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.insert(this.TABLE, record);
    try {
      await db.insert(this.LEGACY_TABLE, record);
    } catch {
      // Ignore
    }

    return record;
  }

  static async findById(id: string): Promise<Maintenance | null> {
    const records = await db.find<Maintenance>(
      this.TABLE,
      item => item.id === id && !item.deletedAt,
    );
    if (records.length > 0) return records[0];

    const fallback = await db.find<Maintenance>(
      this.LEGACY_TABLE,
      item => item.id === id && !item.deletedAt,
    );
    return fallback[0] || null;
  }

  static async listByVehicle(
    vehicleId: string,
    filterType?: MaintenanceType,
  ): Promise<Maintenance[]> {
    const records = await db.find<Maintenance>(
      this.TABLE,
      item =>
        item.vehicleId === vehicleId &&
        !item.deletedAt &&
        (!filterType || item.type === filterType),
    );

    return records.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.odometer - a.odometer,
    );
  }

  static async listByVehicleAndPeriod(
    vehicleId: string,
    start: Date,
    end: Date,
  ): Promise<Maintenance[]> {
    const startTime = start.getTime();
    const endTime = end.getTime();

    const records = await db.find<Maintenance>(this.TABLE, item => {
      if (item.vehicleId !== vehicleId || item.deletedAt) return false;
      const itemTime = new Date(item.date).getTime();
      return itemTime >= startTime && itemTime <= endTime;
    });

    return records;
  }

  static async update(id: string, updates: UpdateMaintenanceDTO): Promise<Maintenance | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: Maintenance = {
      ...existing,
      ...(updates.date ? { date: updates.date } : {}),
      ...(updates.odometer !== undefined ? { odometer: Number(updates.odometer) } : {}),
      ...(updates.type ? { type: updates.type } : {}),
      ...(updates.serviceType ? { serviceType: updates.serviceType } : {}),
      ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
      ...(updates.replacedParts !== undefined
        ? { replacedParts: updates.replacedParts ? updates.replacedParts.trim() : null }
        : {}),
      ...(updates.workshop !== undefined
        ? { workshop: updates.workshop ? updates.workshop.trim() : null }
        : {}),
      ...(updates.mechanic !== undefined
        ? { mechanic: updates.mechanic ? updates.mechanic.trim() : null }
        : {}),
      ...(updates.executionTimeMin !== undefined
        ? { executionTimeMin: updates.executionTimeMin ? Number(updates.executionTimeMin) : null }
        : {}),
      ...(updates.totalValue !== undefined ? { totalValue: Number(updates.totalValue) } : {}),
      updatedAt: new Date().toISOString(),
    };

    await db.update<Maintenance>(this.TABLE, id, updated);
    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const deleted: Maintenance = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    };

    await db.update<Maintenance>(this.TABLE, id, deleted);
    return true;
  }

  static async saveAll(items: Maintenance[]): Promise<void> {
    await db.saveTableData(this.TABLE, items);
  }

  static async clear(): Promise<void> {
    await db.saveTableData(this.TABLE, []);
    await db.saveTableData(this.LEGACY_TABLE, []);
  }
}
