import {
  TireRecord,
  CreateTireRecordDTO,
  UpdateTireRecordDTO,
  TireRecordType,
} from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';

/**
 * US11.1 & US11.4: Repositório de Registros de Pneu (registros_pneu).
 * Suporta persistência local, exclusão lógica, filtro por veículo/tipo e sincronização LWW.
 */
export class TireRecordRepository {
  private static TABLE = 'registros_pneu';
  private static LEGACY_TABLE = 'local_registros_pneu';

  static async create(dto: CreateTireRecordDTO): Promise<TireRecord> {
    const id = `tire_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: TireRecord = {
      id,
      vehicleId: dto.vehicleId,
      date: dto.date,
      km: Number(dto.km),
      type: dto.type,
      pressurePsi: Number(dto.pressurePsi),
      treadDepthMm:
        dto.treadDepthMm !== undefined && dto.treadDepthMm !== null
          ? Number(dto.treadDepthMm)
          : null,
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

  static async findById(id: string): Promise<TireRecord | null> {
    const records = await db.find<TireRecord>(
      this.TABLE,
      item => item.id === id && !item.deletedAt && !(item as any).excluido_em,
    );
    if (records.length > 0) return records[0];

    const fallback = await db.find<TireRecord>(
      this.LEGACY_TABLE,
      item => item.id === id && !item.deletedAt && !(item as any).excluido_em,
    );
    return fallback[0] || null;
  }

  static async listByVehicle(vehicleId: string, type?: TireRecordType): Promise<TireRecord[]> {
    const primary = await db.findByVehicleIndex<TireRecord>(this.TABLE, vehicleId);
    const legacy = await db.findByVehicleIndex<TireRecord>(this.LEGACY_TABLE, vehicleId);

    const map = new Map<string, TireRecord>();
    for (const item of [...legacy, ...primary]) {
      map.set(item.id, item);
    }

    let list = Array.from(map.values());
    if (type) {
      list = list.filter(item => item.type === type);
    }

    return list.sort((a, b) => {
      const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.km - a.km;
    });
  }

  static async update(id: string, updates: UpdateTireRecordDTO): Promise<TireRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: TireRecord = {
      ...existing,
      ...(updates.date !== undefined ? { date: updates.date } : {}),
      ...(updates.km !== undefined ? { km: Number(updates.km) } : {}),
      ...(updates.type !== undefined ? { type: updates.type } : {}),
      ...(updates.pressurePsi !== undefined ? { pressurePsi: Number(updates.pressurePsi) } : {}),
      ...(updates.treadDepthMm !== undefined
        ? {
            treadDepthMm: updates.treadDepthMm !== null ? Number(updates.treadDepthMm) : null,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    await db.update<TireRecord>(this.TABLE, id, updated);
    try {
      await db.update<TireRecord>(this.LEGACY_TABLE, id, updated);
    } catch {
      // Ignore
    }
    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const deleted: TireRecord = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    };

    await db.update<TireRecord>(this.TABLE, id, deleted);
    try {
      await db.update<TireRecord>(this.LEGACY_TABLE, id, deleted);
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
