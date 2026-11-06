import { Refuel, CreateRefuelDTO, UpdateRefuelDTO } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { calcularConsumo } from '../services/fuelingCalculations';
import { AuditRepository } from './AuditRepository';

export class RefuelRepository {
  private static TABLE = 'local_refuels';

  static async listByVehicle(vehicleId: string): Promise<Refuel[]> {
    const all = await db.findByVehicleIndex<Refuel>(this.TABLE, vehicleId);
    return all.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.odometer - a.odometer;
    });
  }

  static async listByVehicleAsc(vehicleId: string): Promise<Refuel[]> {
    const all = await db.findByVehicleIndex<Refuel>(this.TABLE, vehicleId);
    return all.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.odometer - b.odometer;
    });
  }

  static async findById(id: string): Promise<Refuel | null> {
    const item = await db.findById<Refuel>(this.TABLE, id);
    if (!item || (item as any).deletedAt || (item as any).excluido_em) return null;
    return item;
  }

  static async listByVehicleAndPeriod(
    vehicleId: string,
    inicio: string | Date,
    fim: string | Date,
  ): Promise<Refuel[]> {
    const startTime = new Date(inicio).getTime();
    const endTime = new Date(fim).getTime();

    return db.findByVehicleIndex<Refuel>(this.TABLE, vehicleId, startTime, endTime);
  }

  static async getPreviousRefuel(
    vehicleId: string,
    beforeOdometer: number,
  ): Promise<Refuel | null> {
    const ascList = await this.listByVehicleAsc(vehicleId);
    const priors = ascList.filter(r => r.odometer < beforeOdometer);
    return priors.length > 0 ? priors[priors.length - 1] : null;
  }

  static async create(dto: CreateRefuelDTO, calculatedKml?: number | null): Promise<Refuel> {
    const now = new Date().toISOString();
    const newRefuel: Refuel = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      vehicleId: dto.vehicleId,
      date: dto.date,
      odometer: dto.odometer,
      fuelType: dto.fuelType,
      pricePerLiter: dto.pricePerLiter,
      totalValue: dto.totalValue,
      liters: dto.liters,
      isFullTank: dto.isFullTank,
      calculatedKml: calculatedKml !== undefined ? calculatedKml : null,
      receiptImageUrl: dto.receiptImageUrl || null,
      stationName: dto.stationName || null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      routeType: dto.routeType || dto.tipo_percurso || null,
      notes: dto.notes ? dto.notes.trim() : dto.nota ? dto.nota.trim() : null,
      tipo_percurso: dto.tipo_percurso || dto.routeType || null,
      nota: dto.nota ? dto.nota.trim() : dto.notes ? dto.notes.trim() : null,
      tripId: dto.tripId || dto.viagem_id || null,
      viagem_id: dto.viagem_id || dto.tripId || null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.insert(this.TABLE, newRefuel);
    return newRefuel;
  }

  static async update(id: string, updates: UpdateRefuelDTO): Promise<Refuel | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated = await db.update<Refuel>(this.TABLE, id, {
      ...updates,
      routeType:
        updates.routeType !== undefined
          ? updates.routeType
          : updates.tipo_percurso !== undefined
            ? updates.tipo_percurso
            : existing.routeType,
      tipo_percurso:
        updates.tipo_percurso !== undefined
          ? updates.tipo_percurso
          : updates.routeType !== undefined
            ? updates.routeType
            : existing.tipo_percurso,
      notes:
        updates.notes !== undefined
          ? (updates.notes ? updates.notes.trim() : null)
          : updates.nota !== undefined
            ? (updates.nota ? updates.nota.trim() : null)
            : existing.notes,
      nota:
        updates.nota !== undefined
          ? (updates.nota ? updates.nota.trim() : null)
          : updates.notes !== undefined
            ? (updates.notes ? updates.notes.trim() : null)
            : existing.nota,
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
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      await AuditRepository.recordMutation({
        entidade: 'abastecimentos',
        entidade_id: id,
        acao: 'edicao',
        antes: existing as any,
        depois: updated as any,
      });
    }

    return updated;
  }

  static async recalculateAllForVehicle(vehicleId: string): Promise<void> {
    const all = await db.getTableData<Refuel>(this.TABLE);
    const activeVehicleRefuels = all
      .filter(r => r.vehicleId === vehicleId && !r.deletedAt && !(r as any).excluido_em)
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.odometer - b.odometer;
      });

    const updatedMap = new Map<string, Refuel>();

    for (let i = 0; i < activeVehicleRefuels.length; i++) {
      const current = activeVehicleRefuels[i];
      let kml: number | null = null;

      if (i > 0) {
        const prev = activeVehicleRefuels[i - 1];
        kml = calcularConsumo(current.odometer, prev.odometer, current.liters);
      }

      updatedMap.set(current.id, {
        ...current,
        calculatedKml: kml,
        updatedAt: new Date().toISOString(),
      });
    }

    const merged = all.map(r => updatedMap.get(r.id) || r);
    await db.saveTableData(this.TABLE, merged);
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    const now = new Date().toISOString();
    const updated = await db.update<Refuel>(this.TABLE, id, {
      deletedAt: now,
      excluido_em: now,
      updatedAt: now,
    } as any);

    if (updated && existing) {
      await AuditRepository.recordMutation({
        entidade: 'abastecimentos',
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
