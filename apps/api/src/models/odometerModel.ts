import { query } from './db';
import { OdometerReading, CreateOdometerReadingDTO } from '@autogest/shared-types';

export class OdometerModel {
  static async findByVehicleId(vehicleId: string): Promise<OdometerReading[]> {
    try {
      const res = await query(
        `SELECT id, veiculo_id as "vehicleId", km, data_hora as date, origem as origin,
                criado_em as "createdAt", atualizado_em as "updatedAt", excluido_em as "deletedAt"
         FROM leituras_hodometro
         WHERE veiculo_id = $1 AND excluido_em IS NULL
         ORDER BY data_hora DESC, km DESC`,
        [vehicleId],
      );
      return res.rows.map(row => ({
        id: row.id,
        vehicleId: row.vehicleId,
        km: Number(row.km),
        date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
        origin: row.origin,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
        deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
      }));
    } catch {
      return [];
    }
  }

  static async create(data: CreateOdometerReadingDTO): Promise<OdometerReading> {
    const res = await query(
      `INSERT INTO leituras_hodometro (veiculo_id, km, data_hora, origem)
       VALUES ($1, $2, $3, $4)
       RETURNING id, veiculo_id as "vehicleId", km, data_hora as date, origem as origin,
                 criado_em as "createdAt", atualizado_em as "updatedAt", excluido_em as "deletedAt"`,
      [data.vehicleId, data.km, data.date || new Date().toISOString(), data.origin],
    );
    const row = res.rows[0];
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      km: Number(row.km),
      date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      origin: row.origin,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
    };
  }

  static async softDeleteByVehicle(vehicleId: string): Promise<void> {
    try {
      await query(
        `UPDATE leituras_hodometro
         SET excluido_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
         WHERE veiculo_id = $1 AND excluido_em IS NULL`,
        [vehicleId],
      );
    } catch {
      // Ignora se tabela ainda não criada
    }
  }
}
