import { OdometerReading, CreateOdometerReadingDTO } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';

export class OdometerRepository {
  private static TABLE = 'local_leituras_hodometro';

  static async listByVehicle(vehicleId: string): Promise<OdometerReading[]> {
    const all = await db.find<OdometerReading>(
      this.TABLE,
      item => item.vehicleId === vehicleId && !item.deletedAt && !(item as any).excluido_em,
    );
    return all.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.km - a.km;
    });
  }

  static async getLatestReading(vehicleId: string): Promise<OdometerReading | null> {
    const list = await this.listByVehicle(vehicleId);
    return list.length > 0 ? list[0] : null;
  }

  static async create(dto: CreateOdometerReadingDTO): Promise<OdometerReading> {
    const now = new Date().toISOString();
    const newRecord: OdometerReading = {
      id: `odo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      vehicleId: dto.vehicleId,
      km: dto.km,
      date: dto.date || now,
      origin: dto.origin,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.insert(this.TABLE, newRecord);
    return newRecord;
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
