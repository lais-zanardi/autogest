import { Trip, CreateTripDTO, UpdateTripDTO } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { AuditRepository } from './AuditRepository';

export class TripRepository {
  private static TABLE = 'viagens';

  static async listByVehicle(vehicleId: string): Promise<Trip[]> {
    const list = await db.getTableData<Trip>(this.TABLE);
    return list
      .filter(
        t =>
          (t.vehicleId === vehicleId || (t as any).veiculo_id === vehicleId) &&
          !t.deletedAt &&
          !(t as any).excluido_em,
      )
      .sort((a, b) => new Date(b.startDate || (b as any).inicio_em || 0).getTime() - new Date(a.startDate || (a as any).inicio_em || 0).getTime());
  }

  static async findById(id: string): Promise<Trip | null> {
    const item = await db.findById<Trip>(this.TABLE, id);
    if (!item || item.deletedAt || (item as any).excluido_em) return null;
    return item;
  }

  static async findActiveByVehicle(vehicleId: string): Promise<Trip | null> {
    const list = await this.listByVehicle(vehicleId);
    return list.find(t => t.status === 'em_andamento') || null;
  }

  static async create(dto: CreateTripDTO): Promise<Trip> {
    const now = new Date().toISOString();
    const id = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newTrip: Trip = {
      id,
      vehicleId: dto.vehicleId,
      veiculo_id: dto.vehicleId,
      origin: dto.origin.trim(),
      origem: dto.origin.trim(),
      destination: dto.destination.trim(),
      destino: dto.destination.trim(),
      startDate: dto.startDate || now,
      inicio_em: dto.startDate || now,
      endDate: null,
      fim_em: null,
      startOdometer: Number(dto.startOdometer || 0),
      km_inicio: Number(dto.startOdometer || 0),
      endOdometer: null,
      km_fim: null,
      status: 'em_andamento',
      createdAt: now,
      criado_em: now,
      updatedAt: now,
      atualizado_em: now,
      deletedAt: null,
      excluido_em: null,
    };

    await db.insert(this.TABLE, newTrip);
    return newTrip;
  }

  static async update(id: string, updates: UpdateTripDTO): Promise<Trip | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated = await db.update<any>(this.TABLE, id, {
      ...updates,
      updatedAt: now,
      atualizado_em: now,
    });

    if (updated) {
      await AuditRepository.recordMutation({
        entidade: 'viagens' as any,
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
    if (!existing) return false;

    const now = new Date().toISOString();
    await db.update<any>(this.TABLE, id, {
      deletedAt: now,
      excluido_em: now,
      updatedAt: now,
      atualizado_em: now,
    });

    await AuditRepository.recordMutation({
      entidade: 'viagens' as any,
      entidade_id: id,
      acao: 'exclusao',
      antes: existing as any,
      depois: null,
    });

    return true;
  }
}
