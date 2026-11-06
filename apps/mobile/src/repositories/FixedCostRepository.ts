import { FixedCost, CreateFixedCostDTO, UpdateFixedCostDTO } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { AuditRepository } from './AuditRepository';

/**
 * US23.1 & US23.2: Repositório de Custos Fixos Mensais (custos_fixos).
 * Suporta persistência local, exclusão lógica, filtro por veículo e sincronização LWW.
 */
export class FixedCostRepository {
  private static TABLE = 'custos_fixos';
  private static LEGACY_TABLE = 'local_custos_fixos';

  static async create(dto: CreateFixedCostDTO): Promise<FixedCost> {
    const id = `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: FixedCost = {
      id,
      vehicleId: dto.vehicleId,
      description: dto.description.trim(),
      monthlyAmount: Number(dto.monthlyAmount),
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

  static async findById(id: string): Promise<FixedCost | null> {
    const records = await db.find<FixedCost>(
      this.TABLE,
      item => item.id === id && !item.deletedAt && !(item as any).excluido_em,
    );
    if (records.length > 0) return records[0];

    const fallback = await db.find<FixedCost>(
      this.LEGACY_TABLE,
      item => item.id === id && !item.deletedAt && !(item as any).excluido_em,
    );
    return fallback[0] || null;
  }

  static async listByVehicle(vehicleId: string): Promise<FixedCost[]> {
    const primary = await db.findByVehicleIndex<FixedCost>(this.TABLE, vehicleId);
    const legacy = await db.findByVehicleIndex<FixedCost>(this.LEGACY_TABLE, vehicleId);

    const map = new Map<string, FixedCost>();
    for (const item of [...legacy, ...primary]) {
      map.set(item.id, item);
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  static async update(id: string, updates: UpdateFixedCostDTO): Promise<FixedCost | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: FixedCost = {
      ...existing,
      ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
      ...(updates.monthlyAmount !== undefined
        ? { monthlyAmount: Number(updates.monthlyAmount) }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    await db.update<FixedCost>(this.TABLE, id, updated);
    try {
      await db.update<FixedCost>(this.LEGACY_TABLE, id, updated);
    } catch {
      // Ignore
    }
    await AuditRepository.recordMutation({
      entidade: 'custos_fixos',
      entidade_id: id,
      acao: 'edicao',
      antes: existing as any,
      depois: updated as any,
    });
    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const deleted: FixedCost = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    };

    await db.update<FixedCost>(this.TABLE, id, deleted);
    try {
      await db.update<FixedCost>(this.LEGACY_TABLE, id, deleted);
    } catch {
      // Ignore
    }
    await AuditRepository.recordMutation({
      entidade: 'custos_fixos',
      entidade_id: id,
      acao: 'exclusao',
      antes: existing as any,
      depois: deleted as any,
    });
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
