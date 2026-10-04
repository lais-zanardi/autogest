import { query } from './db';
import { Refuel, CreateRefuelDTO } from '@autogest/shared-types';

export class RefuelModel {
  static async findByVehicleId(vehicleId: string): Promise<Refuel[]> {
    const res = await query(
      `SELECT id, vehicle_id as "vehicleId", date, odometer, fuel_type as "fuelType",
              price_per_liter as "pricePerLiter", total_value as "totalValue", liters,
              is_full_tank as "isFullTank", calculated_kml as "calculatedKml",
              receipt_image_url as "receiptImageUrl", station_name as "stationName",
              created_at as "createdAt"
       FROM refuels WHERE vehicle_id = $1 ORDER BY odometer DESC, date DESC`,
      [vehicleId],
    );
    return res.rows;
  }

  static async findLastFullTank(vehicleId: string, beforeOdometer: number): Promise<Refuel | null> {
    const res = await query(
      `SELECT id, vehicle_id as "vehicleId", date, odometer, fuel_type as "fuelType",
              price_per_liter as "pricePerLiter", total_value as "totalValue", liters,
              is_full_tank as "isFullTank", calculated_kml as "calculatedKml"
       FROM refuels 
       WHERE vehicle_id = $1 AND is_full_tank = TRUE AND odometer < $2
       ORDER BY odometer DESC LIMIT 1`,
      [vehicleId, beforeOdometer],
    );
    return res.rows[0] || null;
  }

  static async create(data: CreateRefuelDTO, calculatedKml?: number | null): Promise<Refuel> {
    const res = await query(
      `INSERT INTO refuels (vehicle_id, date, odometer, fuel_type, price_per_liter, total_value, liters, is_full_tank, calculated_kml, receipt_image_url, station_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, vehicle_id as "vehicleId", date, odometer, fuel_type as "fuelType",
                 price_per_liter as "pricePerLiter", total_value as "totalValue", liters,
                 is_full_tank as "isFullTank", calculated_kml as "calculatedKml",
                 receipt_image_url as "receiptImageUrl", station_name as "stationName",
                 created_at as "createdAt"`,
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
    return res.rows[0];
  }
}
