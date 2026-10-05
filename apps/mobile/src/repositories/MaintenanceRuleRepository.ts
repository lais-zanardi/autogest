import {
  MaintenanceRule,
  CreateMaintenanceRuleDTO,
  UpdateMaintenanceRuleDTO,
  MaintenanceServiceType,
} from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';

/**
 * US10.1: Repositório de Regras de Manutenção (regras_manutencao).
 * Suporta persistência local, exclusão lógica, filtros por veículo e sincronização.
 */
export class MaintenanceRuleRepository {
  private static TABLE = 'regras_manutencao';
  private static LEGACY_TABLE = 'local_regras_manutencao';

  static async create(dto: CreateMaintenanceRuleDTO): Promise<MaintenanceRule> {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: MaintenanceRule = {
      id,
      vehicleId: dto.vehicleId,
      userId: dto.userId || 'local_user',
      serviceType: dto.serviceType,
      name: dto.name?.trim() || dto.serviceType,
      intervalKm:
        dto.intervalKm !== undefined && dto.intervalKm !== null ? Number(dto.intervalKm) : null,
      intervalDays:
        dto.intervalDays !== undefined && dto.intervalDays !== null
          ? Number(dto.intervalDays)
          : null,
      advanceKm:
        dto.advanceKm !== undefined && dto.advanceKm !== null ? Number(dto.advanceKm) : 500,
      advanceDays:
        dto.advanceDays !== undefined && dto.advanceDays !== null ? Number(dto.advanceDays) : 15,
      lastServiceDate: dto.lastServiceDate || null,
      lastServiceKm:
        dto.lastServiceKm !== undefined && dto.lastServiceKm !== null
          ? Number(dto.lastServiceKm)
          : null,
      active: dto.active !== undefined ? dto.active : true,
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

  static async findById(id: string): Promise<MaintenanceRule | null> {
    const records = await db.find<MaintenanceRule>(
      this.TABLE,
      item => item.id === id && !item.deletedAt,
    );
    if (records.length > 0) return records[0];

    const fallback = await db.find<MaintenanceRule>(
      this.LEGACY_TABLE,
      item => item.id === id && !item.deletedAt,
    );
    return fallback[0] || null;
  }

  static async listByVehicle(vehicleId: string, onlyActive = false): Promise<MaintenanceRule[]> {
    let records = await db.find<MaintenanceRule>(
      this.TABLE,
      item => item.vehicleId === vehicleId && !item.deletedAt,
    );

    if (records.length === 0) {
      records = await db.find<MaintenanceRule>(
        this.LEGACY_TABLE,
        item => item.vehicleId === vehicleId && !item.deletedAt,
      );
    }

    if (onlyActive) {
      records = records.filter(r => r.active);
    }

    return records;
  }

  static async findByVehicleAndServiceType(
    vehicleId: string,
    serviceType: MaintenanceServiceType,
  ): Promise<MaintenanceRule | null> {
    const records = await this.listByVehicle(vehicleId);
    const found = records.find(r => r.serviceType === serviceType && !r.deletedAt);
    return found || null;
  }

  static async update(
    id: string,
    updates: UpdateMaintenanceRuleDTO,
  ): Promise<MaintenanceRule | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: MaintenanceRule = {
      ...existing,
      serviceType: updates.serviceType !== undefined ? updates.serviceType : existing.serviceType,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      intervalKm:
        updates.intervalKm !== undefined
          ? updates.intervalKm !== null
            ? Number(updates.intervalKm)
            : null
          : existing.intervalKm,
      intervalDays:
        updates.intervalDays !== undefined
          ? updates.intervalDays !== null
            ? Number(updates.intervalDays)
            : null
          : existing.intervalDays,
      advanceKm: updates.advanceKm !== undefined ? Number(updates.advanceKm) : existing.advanceKm,
      advanceDays:
        updates.advanceDays !== undefined ? Number(updates.advanceDays) : existing.advanceDays,
      lastServiceDate:
        updates.lastServiceDate !== undefined ? updates.lastServiceDate : existing.lastServiceDate,
      lastServiceKm:
        updates.lastServiceKm !== undefined
          ? updates.lastServiceKm !== null
            ? Number(updates.lastServiceKm)
            : null
          : existing.lastServiceKm,
      active: updates.active !== undefined ? updates.active : existing.active,
      updatedAt: new Date().toISOString(),
    };

    await db.update(this.TABLE, id, updated);
    try {
      await db.update(this.LEGACY_TABLE, id, updated);
    } catch {
      // Ignore
    }

    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    const timestamp = new Date().toISOString();
    await db.update<MaintenanceRule>(this.TABLE, id, {
      deletedAt: timestamp,
      updatedAt: timestamp,
      active: false,
    });
    try {
      await db.update<MaintenanceRule>(this.LEGACY_TABLE, id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
        active: false,
      });
    } catch {
      // Ignore
    }

    return true;
  }
}
