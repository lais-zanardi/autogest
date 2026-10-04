import { query } from './db';
import { Refuel, CreateRefuelDTO, UpdateRefuelDTO } from '@autogest/shared-types';

export class RefuelModel {
  static async findByVehicleId(vehicleId: string): Promise<Refuel[]> {
    try {
      const res = await query(
        `SELECT id, veiculo_id as "vehicleId", data_hora as date, km as odometer,
                tipo_combustivel as "fuelType", valor_litro as "pricePerLiter",
                valor_total as "totalValue", litros as liters, tanque_cheio as "isFullTank",
                consumo_kml as "calculatedKml", imagem_comprovante_url as "receiptImageUrl",
                posto as "stationName", latitude, longitude, criado_em as "createdAt",
                atualizado_em as "updatedAt", excluido_em as "deletedAt"
         FROM abastecimentos
         WHERE veiculo_id = $1 AND excluido_em IS NULL
         ORDER BY km DESC, data_hora DESC`,
        [vehicleId],
      );
      if (res.rows.length > 0 || res.rowCount !== null) {
        return res.rows.map(this.mapRowToRefuel);
      }
    } catch {
      // Fallback para tabela legada refuels
    }

    try {
      const res = await query(
        `SELECT id, vehicle_id as "vehicleId", date, odometer, fuel_type as "fuelType",
                price_per_liter as "pricePerLiter", total_value as "totalValue", liters,
                is_full_tank as "isFullTank", calculated_kml as "calculatedKml",
                receipt_image_url as "receiptImageUrl", station_name as "stationName",
                NULL as latitude, NULL as longitude, created_at as "createdAt"
         FROM refuels WHERE vehicle_id = $1 ORDER BY odometer DESC, date DESC`,
        [vehicleId],
      );
      return res.rows.map(this.mapRowToRefuel);
    } catch {
      return [];
    }
  }

  static async findById(id: string): Promise<Refuel | null> {
    try {
      const res = await query(
        `SELECT id, veiculo_id as "vehicleId", data_hora as date, km as odometer,
                tipo_combustivel as "fuelType", valor_litro as "pricePerLiter",
                valor_total as "totalValue", litros as liters, tanque_cheio as "isFullTank",
                consumo_kml as "calculatedKml", imagem_comprovante_url as "receiptImageUrl",
                posto as "stationName", latitude, longitude, criado_em as "createdAt",
                atualizado_em as "updatedAt", excluido_em as "deletedAt"
         FROM abastecimentos
         WHERE id = $1 AND excluido_em IS NULL`,
        [id],
      );
      if (res.rows[0]) return this.mapRowToRefuel(res.rows[0]);
    } catch {
      // Fallback
    }

    try {
      const res = await query(
        `SELECT id, vehicle_id as "vehicleId", date, odometer, fuel_type as "fuelType",
                price_per_liter as "pricePerLiter", total_value as "totalValue", liters,
                is_full_tank as "isFullTank", calculated_kml as "calculatedKml",
                receipt_image_url as "receiptImageUrl", station_name as "stationName",
                NULL as latitude, NULL as longitude, created_at as "createdAt"
         FROM refuels WHERE id = $1`,
        [id],
      );
      return res.rows[0] ? this.mapRowToRefuel(res.rows[0]) : null;
    } catch {
      return null;
    }
  }

  static async findLastFullTank(vehicleId: string, beforeOdometer: number): Promise<Refuel | null> {
    try {
      const res = await query(
        `SELECT id, veiculo_id as "vehicleId", data_hora as date, km as odometer,
                tipo_combustivel as "fuelType", valor_litro as "pricePerLiter",
                valor_total as "totalValue", litros as liters, tanque_cheio as "isFullTank",
                consumo_kml as "calculatedKml", imagem_comprovante_url as "receiptImageUrl",
                posto as "stationName", latitude, longitude, criado_em as "createdAt"
         FROM abastecimentos
         WHERE veiculo_id = $1 AND tanque_cheio = TRUE AND km < $2 AND excluido_em IS NULL
         ORDER BY km DESC LIMIT 1`,
        [vehicleId, beforeOdometer],
      );
      if (res.rows[0]) return this.mapRowToRefuel(res.rows[0]);
    } catch {
      // Fallback
    }

    try {
      const res = await query(
        `SELECT id, vehicle_id as "vehicleId", date, odometer, fuel_type as "fuelType",
                price_per_liter as "pricePerLiter", total_value as "totalValue", liters,
                is_full_tank as "isFullTank", calculated_kml as "calculatedKml"
         FROM refuels 
         WHERE vehicle_id = $1 AND is_full_tank = TRUE AND odometer < $2
         ORDER BY odometer DESC LIMIT 1`,
        [vehicleId, beforeOdometer],
      );
      return res.rows[0] ? this.mapRowToRefuel(res.rows[0]) : null;
    } catch {
      return null;
    }
  }

  static async create(data: CreateRefuelDTO, calculatedKml?: number | null): Promise<Refuel> {
    try {
      const res = await query(
        `INSERT INTO abastecimentos (
           veiculo_id, data_hora, km, tipo_combustivel, valor_litro, valor_total,
           litros, tanque_cheio, consumo_kml, imagem_comprovante_url, posto, latitude, longitude
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, veiculo_id as "vehicleId", data_hora as date, km as odometer,
                   tipo_combustivel as "fuelType", valor_litro as "pricePerLiter",
                   valor_total as "totalValue", litros as liters, tanque_cheio as "isFullTank",
                   consumo_kml as "calculatedKml", imagem_comprovante_url as "receiptImageUrl",
                   posto as "stationName", latitude, longitude, criado_em as "createdAt",
                   atualizado_em as "updatedAt", excluido_em as "deletedAt"`,
        [
          data.vehicleId,
          data.date || new Date().toISOString(),
          data.odometer,
          data.fuelType,
          data.pricePerLiter,
          data.totalValue,
          data.liters,
          data.isFullTank ?? true,
          calculatedKml ?? null,
          data.receiptImageUrl ?? null,
          data.stationName ?? null,
          data.latitude ?? null,
          data.longitude ?? null,
        ],
      );
      return this.mapRowToRefuel(res.rows[0]);
    } catch {
      // Fallback para refuels legada
      const res = await query(
        `INSERT INTO refuels (vehicle_id, date, odometer, fuel_type, price_per_liter, total_value, liters, is_full_tank, calculated_kml, receipt_image_url, station_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, vehicle_id as "vehicleId", date, odometer, fuel_type as "fuelType",
                   price_per_liter as "pricePerLiter", total_value as "totalValue", liters,
                   is_full_tank as "isFullTank", calculated_kml as "calculatedKml",
                   receipt_image_url as "receiptImageUrl", station_name as "stationName",
                   NULL as latitude, NULL as longitude, created_at as "createdAt"`,
        [
          data.vehicleId,
          data.date,
          data.odometer,
          data.fuelType,
          data.pricePerLiter,
          data.totalValue,
          data.liters,
          data.isFullTank,
          calculatedKml ?? null,
          data.receiptImageUrl ?? null,
          data.stationName ?? null,
        ],
      );
      return this.mapRowToRefuel(res.rows[0]);
    }
  }

  static async update(id: string, data: UpdateRefuelDTO): Promise<Refuel | null> {
    try {
      const existing = await this.findById(id);
      if (!existing) return null;

      const date = data.date ?? existing.date;
      const odometer = data.odometer ?? existing.odometer;
      const fuelType = data.fuelType ?? existing.fuelType;
      const pricePerLiter = data.pricePerLiter ?? existing.pricePerLiter;
      const totalValue = data.totalValue ?? existing.totalValue;
      const liters = data.liters ?? existing.liters;
      const isFullTank = data.isFullTank !== undefined ? data.isFullTank : existing.isFullTank;
      const receiptImageUrl =
        data.receiptImageUrl !== undefined ? data.receiptImageUrl : existing.receiptImageUrl;
      const stationName = data.stationName !== undefined ? data.stationName : existing.stationName;
      const latitude = data.latitude !== undefined ? data.latitude : existing.latitude;
      const longitude = data.longitude !== undefined ? data.longitude : existing.longitude;

      const res = await query(
        `UPDATE abastecimentos
         SET data_hora = $1, km = $2, tipo_combustivel = $3, valor_litro = $4,
             valor_total = $5, litros = $6, tanque_cheio = $7, imagem_comprovante_url = $8,
             posto = $9, latitude = $10, longitude = $11, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $12 AND excluido_em IS NULL
         RETURNING id, veiculo_id as "vehicleId", data_hora as date, km as odometer,
                   tipo_combustivel as "fuelType", valor_litro as "pricePerLiter",
                   valor_total as "totalValue", litros as liters, tanque_cheio as "isFullTank",
                   consumo_kml as "calculatedKml", imagem_comprovante_url as "receiptImageUrl",
                   posto as "stationName", latitude, longitude, criado_em as "createdAt",
                   atualizado_em as "updatedAt", excluido_em as "deletedAt"`,
        [
          date,
          odometer,
          fuelType,
          pricePerLiter,
          totalValue,
          liters,
          isFullTank,
          receiptImageUrl,
          stationName,
          latitude,
          longitude,
          id,
        ],
      );
      if (res.rows[0]) return this.mapRowToRefuel(res.rows[0]);
    } catch {
      // Fallback
    }

    try {
      const res = await query(
        `UPDATE refuels
         SET date = COALESCE($1, date), odometer = COALESCE($2, odometer),
             fuel_type = COALESCE($3, fuel_type), price_per_liter = COALESCE($4, price_per_liter),
             total_value = COALESCE($5, total_value), liters = COALESCE($6, liters),
             is_full_tank = COALESCE($7, is_full_tank)
         WHERE id = $8
         RETURNING id, vehicle_id as "vehicleId", date, odometer, fuel_type as "fuelType",
                   price_per_liter as "pricePerLiter", total_value as "totalValue", liters,
                   is_full_tank as "isFullTank", calculated_kml as "calculatedKml",
                   receipt_image_url as "receiptImageUrl", station_name as "stationName",
                   NULL as latitude, NULL as longitude, created_at as "createdAt"`,
        [
          data.date,
          data.odometer,
          data.fuelType,
          data.pricePerLiter,
          data.totalValue,
          data.liters,
          data.isFullTank,
          id,
        ],
      );
      return res.rows[0] ? this.mapRowToRefuel(res.rows[0]) : null;
    } catch {
      return null;
    }
  }

  static async updateCalculatedKml(id: string, calculatedKml: number | null): Promise<void> {
    try {
      await query(
        'UPDATE abastecimentos SET consumo_kml = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2',
        [calculatedKml, id],
      );
    } catch {
      try {
        await query('UPDATE refuels SET calculated_kml = $1 WHERE id = $2', [calculatedKml, id]);
      } catch {
        // Ignora
      }
    }
  }

  static async softDelete(id: string): Promise<boolean> {
    try {
      const res = await query(
        `UPDATE abastecimentos SET excluido_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $1 AND excluido_em IS NULL`,
        [id],
      );
      if (res.rowCount && res.rowCount > 0) return true;
    } catch {
      // Fallback
    }

    try {
      const res = await query('DELETE FROM refuels WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private static mapRowToRefuel(row: any): Refuel {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      odometer: Number(row.odometer),
      fuelType: row.fuelType,
      pricePerLiter: Number(row.pricePerLiter),
      totalValue: Number(row.totalValue),
      liters: Number(row.liters),
      isFullTank: Boolean(row.isFullTank),
      calculatedKml:
        row.calculatedKml !== null && row.calculatedKml !== undefined
          ? Number(row.calculatedKml)
          : null,
      receiptImageUrl: row.receiptImageUrl || null,
      stationName: row.stationName || null,
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
      longitude:
        row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
    };
  }
}
