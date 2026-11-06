import { db } from '../database/DatabaseConnection';
import {
  MaintenanceSchedule,
  CreateMaintenanceScheduleDTO,
  UpdateMaintenanceScheduleDTO,
} from '@autogest/shared-types';

export class MaintenanceScheduleRepository {
  private static readonly TABLE = 'agendamentos_manutencao';

  private static mapFromRow(row: any): MaintenanceSchedule {
    return {
      id: row.id,
      vehicleId: row.veiculo_id || row.vehicleId,
      veiculo_id: row.veiculo_id || row.vehicleId,
      date: row.data || row.date,
      data: row.data || row.date,
      reminderTime: row.hora_lembrete || row.reminderTime || '09:00',
      hora_lembrete: row.hora_lembrete || row.reminderTime || '09:00',
      serviceType: row.tipo_servico || row.serviceType,
      tipo_servico: row.tipo_servico || row.serviceType,
      description: row.descricao || row.description,
      descricao: row.descricao || row.description,
      status: row.status || 'agendado',
      maintenanceId: row.manutencao_id || row.maintenanceId || null,
      manutencao_id: row.manutencao_id || row.maintenanceId || null,
      createdAt: row.criado_em || row.createdAt,
      criado_em: row.criado_em || row.createdAt,
      updatedAt: row.atualizado_em || row.updatedAt,
      atualizado_em: row.atualizado_em || row.updatedAt,
      deletedAt: row.excluido_em || row.deletedAt || null,
      excluido_em: row.excluido_em || row.deletedAt || null,
    };
  }

  static async listByVehicle(vehicleId: string): Promise<MaintenanceSchedule[]> {
    const rows = await db.getTableData<any>(this.TABLE);
    return rows
      .filter(
        r =>
          (r.veiculo_id === vehicleId || r.vehicleId === vehicleId) &&
          !r.deletedAt &&
          !r.excluido_em
      )
      .map(this.mapFromRow)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  static async findById(id: string): Promise<MaintenanceSchedule | null> {
    const rows = await db.getTableData<any>(this.TABLE);
    const found = rows.find(r => r.id === id && !r.deletedAt && !r.excluido_em);
    return found ? this.mapFromRow(found) : null;
  }

  static async create(dto: CreateMaintenanceScheduleDTO): Promise<MaintenanceSchedule> {
    const now = new Date().toISOString();
    const id = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newRecord: MaintenanceSchedule = {
      id,
      vehicleId: dto.vehicleId,
      veiculo_id: dto.vehicleId,
      date: dto.date,
      data: dto.date,
      reminderTime: dto.reminderTime || '09:00',
      hora_lembrete: dto.reminderTime || '09:00',
      serviceType: dto.serviceType,
      tipo_servico: dto.serviceType,
      description: dto.description.trim(),
      descricao: dto.description.trim(),
      status: 'agendado',
      maintenanceId: null,
      manutencao_id: null,
      createdAt: now,
      criado_em: now,
      updatedAt: now,
      atualizado_em: now,
      deletedAt: null,
      excluido_em: null,
    };

    await db.insert(this.TABLE, newRecord as any);
    return newRecord;
  }

  static async update(
    id: string,
    updates: UpdateMaintenanceScheduleDTO
  ): Promise<MaintenanceSchedule | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updatedRecord: MaintenanceSchedule = {
      ...existing,
      date: updates.date ?? existing.date,
      data: updates.date ?? existing.date,
      reminderTime: updates.reminderTime ?? existing.reminderTime,
      hora_lembrete: updates.reminderTime ?? existing.reminderTime,
      serviceType: updates.serviceType ?? existing.serviceType,
      tipo_servico: updates.serviceType ?? existing.serviceType,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      descricao: updates.description !== undefined ? updates.description.trim() : existing.description,
      status: updates.status ?? existing.status,
      maintenanceId: updates.maintenanceId !== undefined ? updates.maintenanceId : existing.maintenanceId,
      manutencao_id: updates.maintenanceId !== undefined ? updates.maintenanceId : existing.maintenanceId,
      updatedAt: now,
      atualizado_em: now,
    };

    await db.update(this.TABLE, id, updatedRecord as any);
    return updatedRecord;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    await db.update(this.TABLE, id, {
      excluido_em: now,
      deletedAt: now,
      atualizado_em: now,
      updatedAt: now,
    } as any);

    return true;
  }
}
