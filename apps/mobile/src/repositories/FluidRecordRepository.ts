import {
  FluidRecord,
  CreateFluidRecordDTO,
  UpdateFluidRecordDTO,
  FluidType,
} from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';

/**
 * US11.1 & US11.4: Repositório de Registros de Fluido (registros_fluido).
 * Suporta persistência local, exclusão lógica, filtro por veículo/tipo de fluido e sincronização LWW.
 */
export class FluidRecordRepository {
  private static TABLE = 'registros_fluido';
  private static LEGACY_TABLE = 'local_registros_fluido';

  static async create(dto: CreateFluidRecordDTO): Promise<FluidRecord> {
    const id = `fluid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: FluidRecord = {
      id,
      vehicleId: dto.vehicleId,
      fluidType: dto.fluidType,
      date: dto.date,
      km: Number(dto.km),
      level: dto.level || 'normal',
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

  static async findById(id: string): Promise<FluidRecord | null> {
    const records = await db.find<FluidRecord>(
      this.TABLE,
      item => item.id === id && !item.deletedAt && !(item as any).excluido_em,
    );
    if (records.length > 0) return records[0];

    const fallback = await db.find<FluidRecord>(
      this.LEGACY_TABLE,
      item => item.id === id && !item.deletedAt && !(item as any).excluido_em,
    );
    return fallback[0] || null;
  }

  static async listByVehicle(vehicleId: string, fluidType?: FluidType): Promise<FluidRecord[]> {
    const primary = await db.findByVehicleIndex<FluidRecord>(this.TABLE, vehicleId);
    const legacy = await db.findByVehicleIndex<FluidRecord>(this.LEGACY_TABLE, vehicleId);

    const map = new Map<string, FluidRecord>();
    for (const item of [...legacy, ...primary]) {
      map.set(item.id, item);
    }

    let list = Array.from(map.values());
    if (fluidType) {
      list = list.filter(item => item.fluidType === fluidType);
    }

    return list.sort((a, b) => {
      const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.km - a.km;
    });
  }

  static async update(id: string, updates: UpdateFluidRecordDTO): Promise<FluidRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: FluidRecord = {
      ...existing,
      ...(updates.fluidType !== undefined ? { fluidType: updates.fluidType } : {}),
      ...(updates.date !== undefined ? { date: updates.date } : {}),
      ...(updates.km !== undefined ? { km: Number(updates.km) } : {}),
      ...(updates.level !== undefined ? { level: updates.level } : {}),
      updatedAt: new Date().toISOString(),
    };

    await db.update<FluidRecord>(this.TABLE, id, updated);
    try {
      await db.update<FluidRecord>(this.LEGACY_TABLE, id, updated);
    } catch {
      // Ignore
    }
    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const deleted: FluidRecord = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    };

    await db.update<FluidRecord>(this.TABLE, id, deleted);
    try {
      await db.update<FluidRecord>(this.LEGACY_TABLE, id, deleted);
    } catch {
      // Ignore
    }
    return true;
  }

  static async softDeleteByVehicle(vehicleId: string): Promise<void> {
    const now = new Date().toISOString();
    const all = await db.getTableData<any>(this.TABLE);
    const updated = all.map(item => {
      if (item.vehicleId === vehicleId) {
        return { ...item, deletedAt: now, excluido_em: now, updatedAt: now };
      }
      return item;
    });
    await db.saveTableData(this.TABLE, updated);

    const legacy = await db.getTableData<any>(this.LEGACY_TABLE);
    if (legacy && legacy.length > 0) {
      const updatedLegacy = legacy.map(item => {
        if (item.vehicleId === vehicleId) {
          return { ...item, deletedAt: now, excluido_em: now, updatedAt: now };
        }
        return item;
      });
      await db.saveTableData(this.LEGACY_TABLE, updatedLegacy);
    }
  }
}
