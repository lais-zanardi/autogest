import { query } from './db';
import { Vehicle, CreateVehicleDTO, UpdateVehicleDTO } from '@autogest/shared-types';

export class VehicleModel {
  static async findByUserId(userId: string): Promise<Vehicle[]> {
    try {
      const res = await query(
        `SELECT id, usuario_id as "userId", nome as name, marca as brand, modelo as model, ano as year, placa as plate, 
                combustivel_preferencial as "fuelType", capacidade_tanque_l as "tankCapacityL", 
                combustivel_preferencial as "preferredFuel", odometro_inicial as "initialOdometer", 
                odometro_atual as "currentOdometer", valor_fipe as "fipeValue", criado_em as "createdAt", 
                atualizado_em as "updatedAt", excluido_em as "deletedAt"
         FROM veiculos 
         WHERE usuario_id = $1 AND excluido_em IS NULL 
         ORDER BY criado_em DESC`,
        [userId],
      );
      if (res.rows.length > 0 || res.rowCount !== null) return res.rows;
    } catch {
      // Fallback para tabela legada se ainda não migrado
    }

    try {
      const res = await query(
        `SELECT id, user_id as "userId", name, brand, model, year, plate, fuel_type as "fuelType", 
                COALESCE(tank_capacity_l, 50) as "tankCapacityL", COALESCE(preferred_fuel, fuel_type) as "preferredFuel",
                initial_odometer as "initialOdometer", current_odometer as "currentOdometer", 
                fipe_value as "fipeValue", created_at as "createdAt", updated_at as "updatedAt",
                deleted_at as "deletedAt"
         FROM vehicles 
         WHERE user_id = $1 AND deleted_at IS NULL 
         ORDER BY created_at DESC`,
        [userId],
      );
      return res.rows;
    } catch {
      return [];
    }
  }

  static async findById(id: string): Promise<Vehicle | null> {
    try {
      const res = await query(
        `SELECT id, usuario_id as "userId", nome as name, marca as brand, modelo as model, ano as year, placa as plate, 
                combustivel_preferencial as "fuelType", capacidade_tanque_l as "tankCapacityL", 
                combustivel_preferencial as "preferredFuel", odometro_inicial as "initialOdometer", 
                odometro_atual as "currentOdometer", valor_fipe as "fipeValue", criado_em as "createdAt", 
                atualizado_em as "updatedAt", excluido_em as "deletedAt"
         FROM veiculos 
         WHERE id = $1 AND excluido_em IS NULL`,
        [id],
      );
      if (res.rows[0]) return res.rows[0];
    } catch {
      // Fallback
    }

    try {
      const res = await query(
        `SELECT id, user_id as "userId", name, brand, model, year, plate, fuel_type as "fuelType", 
                COALESCE(tank_capacity_l, 50) as "tankCapacityL", COALESCE(preferred_fuel, fuel_type) as "preferredFuel",
                initial_odometer as "initialOdometer", current_odometer as "currentOdometer", 
                fipe_value as "fipeValue", created_at as "createdAt", updated_at as "updatedAt",
                deleted_at as "deletedAt"
         FROM vehicles 
         WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  static async create(userId: string, data: CreateVehicleDTO): Promise<Vehicle> {
    const fuelType = data.fuelType || data.preferredFuel || 'Gasolina';
    const preferredFuel = data.preferredFuel || data.fuelType || 'Gasolina';
    const tankCapacity = data.tankCapacityL || 50;
    const initialOdo = data.initialOdometer || 0;
    const brand = data.brand || '';
    const name = data.name || data.model;

    try {
      const res = await query(
        `INSERT INTO veiculos (usuario_id, nome, marca, modelo, ano, placa, capacidade_tanque_l, combustivel_preferencial, odometro_inicial, odometro_atual)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING id, usuario_id as "userId", nome as name, marca as brand, modelo as model, ano as year, placa as plate, 
                   combustivel_preferencial as "fuelType", capacidade_tanque_l as "tankCapacityL", 
                   combustivel_preferencial as "preferredFuel", odometro_inicial as "initialOdometer", 
                   odometro_atual as "currentOdometer", valor_fipe as "fipeValue", criado_em as "createdAt", 
                   atualizado_em as "updatedAt", excluido_em as "deletedAt"`,
        [
          userId,
          name,
          brand,
          data.model,
          data.year,
          data.plate,
          tankCapacity,
          preferredFuel,
          initialOdo,
        ],
      );
      if (res.rows[0]) return res.rows[0];
    } catch {
      // Fallback
    }

    const res = await query(
      `INSERT INTO vehicles (user_id, name, brand, model, year, plate, fuel_type, initial_odometer, current_odometer, tank_capacity_l, preferred_fuel)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
       RETURNING id, user_id as "userId", name, brand, model, year, plate, fuel_type as "fuelType", 
                 initial_odometer as "initialOdometer", current_odometer as "currentOdometer", 
                 fipe_value as "fipeValue", tank_capacity_l as "tankCapacityL", preferred_fuel as "preferredFuel",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        userId,
        name,
        brand,
        data.model,
        data.year,
        data.plate,
        fuelType,
        initialOdo,
        tankCapacity,
        preferredFuel,
      ],
    );
    return res.rows[0];
  }

  static async update(id: string, data: UpdateVehicleDTO): Promise<Vehicle | null> {
    try {
      const res = await query(
        `UPDATE veiculos
         SET modelo = COALESCE($1, modelo),
             ano = COALESCE($2, ano),
             placa = COALESCE($3, placa),
             capacidade_tanque_l = COALESCE($4, capacidade_tanque_l),
             combustivel_preferencial = COALESCE($5, combustivel_preferencial),
             nome = COALESCE($6, nome),
             marca = COALESCE($7, marca),
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $8 AND excluido_em IS NULL
         RETURNING id, usuario_id as "userId", nome as name, marca as brand, modelo as model, ano as year, placa as plate, 
                   combustivel_preferencial as "fuelType", capacidade_tanque_l as "tankCapacityL", 
                   combustivel_preferencial as "preferredFuel", odometro_inicial as "initialOdometer", 
                   odometro_atual as "currentOdometer", valor_fipe as "fipeValue", criado_em as "createdAt", 
                   atualizado_em as "updatedAt", excluido_em as "deletedAt"`,
        [
          data.model,
          data.year,
          data.plate,
          data.tankCapacityL,
          data.preferredFuel || data.fuelType,
          data.name,
          data.brand,
          id,
        ],
      );
      if (res.rows[0]) return res.rows[0];
    } catch {
      // Fallback
    }

    try {
      const res = await query(
        `UPDATE vehicles
         SET model = COALESCE($1, model),
             year = COALESCE($2, year),
             plate = COALESCE($3, plate),
             tank_capacity_l = COALESCE($4, tank_capacity_l),
             fuel_type = COALESCE($5, fuel_type),
             preferred_fuel = COALESCE($5, preferred_fuel),
             name = COALESCE($6, name),
             brand = COALESCE($7, brand),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 AND deleted_at IS NULL
         RETURNING id, user_id as "userId", name, brand, model, year, plate, fuel_type as "fuelType", 
                   initial_odometer as "initialOdometer", current_odometer as "currentOdometer", 
                   fipe_value as "fipeValue", created_at as "createdAt", updated_at as "updatedAt"`,
        [
          data.model,
          data.year,
          data.plate,
          data.tankCapacityL,
          data.preferredFuel || data.fuelType,
          data.name,
          data.brand,
          id,
        ],
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  static async softDelete(id: string): Promise<boolean> {
    try {
      const res = await query(
        'UPDATE veiculos SET excluido_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE id = $1 AND excluido_em IS NULL',
        [id],
      );
      if ((res.rowCount ?? 0) > 0) return true;
    } catch {
      // Fallback
    }

    try {
      const res = await query(
        'UPDATE vehicles SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL',
        [id],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  static async updateCurrentOdometer(vehicleId: string, newOdometer: number): Promise<void> {
    try {
      await query(
        'UPDATE veiculos SET odometro_atual = GREATEST(odometro_atual, $1), atualizado_em = CURRENT_TIMESTAMP WHERE id = $2',
        [newOdometer, vehicleId],
      );
    } catch {
      await query(
        'UPDATE vehicles SET current_odometer = GREATEST(current_odometer, $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newOdometer, vehicleId],
      );
    }
  }

  static async updateFipeValue(vehicleId: string, fipeValue: number): Promise<void> {
    try {
      await query(
        'UPDATE veiculos SET valor_fipe = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2',
        [fipeValue, vehicleId],
      );
    } catch {
      await query(
        'UPDATE vehicles SET fipe_value = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [fipeValue, vehicleId],
      );
    }
  }
}
