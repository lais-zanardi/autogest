import { Expense, CreateExpenseDTO, UpdateExpenseDTO } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { AuditRepository } from './AuditRepository';

export class ExpenseRepository {
  private static TABLE = 'local_despesas';

  static async listByVehicle(vehicleId: string): Promise<Expense[]> {
    const all = await db.findByVehicleIndex<Expense>(this.TABLE, vehicleId);
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  static async listByVehicleAndMonth(
    vehicleId: string,
    year: number,
    month: number, // 1-12
  ): Promise<Expense[]> {
    const list = await this.listByVehicle(vehicleId);
    return list.filter(item => {
      const d = new Date(item.date);
      // month é 1-12, getUTCMonth/getMonth é 0-11
      const itemMonth = d.getMonth() + 1;
      const itemYear = d.getFullYear();
      return itemYear === year && itemMonth === month;
    });
  }

  static async listByVehicleAndPeriod(
    vehicleId: string,
    inicio: string | Date,
    fim: string | Date,
  ): Promise<Expense[]> {
    const startTime = new Date(inicio).getTime();
    const endTime = new Date(fim).getTime();

    return db.findByVehicleIndex<Expense>(this.TABLE, vehicleId, startTime, endTime);
  }

  static async findById(id: string): Promise<Expense | null> {
    const item = await db.findById<Expense>(this.TABLE, id);
    if (!item || item.deletedAt || (item as any).excluido_em) return null;
    return item;
  }

  static async create(dto: CreateExpenseDTO): Promise<Expense> {
    const now = new Date().toISOString();
    const newRecord: Expense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      vehicleId: dto.vehicleId,
      category: dto.category,
      amount: Number(dto.amount),
      date: dto.date || now,
      description: dto.description?.trim() || null,
      tripId: dto.tripId || dto.viagem_id || null,
      viagem_id: dto.viagem_id || dto.tripId || null,
      subtipoViagem: dto.subtipoViagem || dto.subtipo_viagem || null,
      subtipo_viagem: dto.subtipo_viagem || dto.subtipoViagem || null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.insert(this.TABLE, newRecord);
    return newRecord;
  }

  static async update(id: string, updates: UpdateExpenseDTO): Promise<Expense | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated = await db.update<Expense>(this.TABLE, id, {
      ...updates,
      amount: updates.amount !== undefined ? Number(updates.amount) : existing.amount,
      description:
        updates.description !== undefined
          ? updates.description?.trim() || null
          : existing.description,
      tripId:
        updates.tripId !== undefined
          ? updates.tripId
          : updates.viagem_id !== undefined
            ? updates.viagem_id
            : existing.tripId,
      viagem_id:
        updates.viagem_id !== undefined
          ? updates.viagem_id
          : updates.tripId !== undefined
            ? updates.tripId
            : existing.viagem_id,
      subtipoViagem:
        updates.subtipoViagem !== undefined
          ? updates.subtipoViagem
          : updates.subtipo_viagem !== undefined
            ? updates.subtipo_viagem
            : existing.subtipoViagem,
      subtipo_viagem:
        updates.subtipo_viagem !== undefined
          ? updates.subtipo_viagem
          : updates.subtipo_viagem !== undefined
            ? updates.subtipo_viagem
            : existing.subtipo_viagem,
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      await AuditRepository.recordMutation({
        entidade: 'despesas',
        entidade_id: id,
        acao: 'edicao',
        antes: existing as any,
        depois: updated as any,
      });
    }

    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    const now = new Date().toISOString();
    const updated = await db.update<Expense>(this.TABLE, id, {
      deletedAt: now,
      excluido_em: now,
      updatedAt: now,
    } as any);

    if (updated && existing) {
      await AuditRepository.recordMutation({
        entidade: 'despesas',
        entidade_id: id,
        acao: 'exclusao',
        antes: existing as any,
        depois: updated as any,
      });
    }

    return !!updated;
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
  }
}
