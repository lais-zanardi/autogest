import { Refuel, CreateRefuelDTO } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';

export class RefuelRepository {
  private static TABLE = 'local_refuels';

  static async listByVehicle(vehicleId: string): Promise<Refuel[]> {
    const all = await db.find<Refuel>(
      this.TABLE,
      r => r.vehicleId === vehicleId && !(r as any).deletedAt && !(r as any).excluido_em,
    );
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  static async findById(id: string): Promise<Refuel | null> {
    const item = await db.findById<Refuel>(this.TABLE, id);
    if (!item || (item as any).deletedAt || (item as any).excluido_em) return null;
    return item;
  }

  static async create(dto: CreateRefuelDTO, calculatedKml?: number | null): Promise<Refuel> {
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
      calculatedKml: calculatedKml || null,
      receiptImageUrl: dto.receiptImageUrl || null,
      stationName: dto.stationName || null,
      createdAt: new Date().toISOString(),
    };

    await db.insert(this.TABLE, newRefuel);
    return newRefuel;
  }

  static async findLastFullTank(vehicleId: string, beforeOdometer: number): Promise<Refuel | null> {
    const refuels = await this.listByVehicle(vehicleId);
    const fullTanks = refuels.filter(r => r.isFullTank && r.odometer < beforeOdometer);
    return fullTanks.length > 0 ? fullTanks[0] : null;
  }

  static async delete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const updated = await db.update<Refuel>(this.TABLE, id, {
      deletedAt: now,
      excluido_em: now,
    } as any);
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
