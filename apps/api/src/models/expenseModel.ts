import { query } from './db';
import { Expense, CreateExpenseDTO, UpdateExpenseDTO } from '@autogest/shared-types';

export class ExpenseModel {
  private static mapRowToExpense(row: any): Expense {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      category: row.category,
      amount: Number(row.amount),
      date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      description: row.description || null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
    };
  }

  static async findByVehicleId(vehicleId: string): Promise<Expense[]> {
    try {
      const res = await query(
        `SELECT id, veiculo_id as "vehicleId", categoria as category, valor as amount,
                data_hora as date, descricao as description,
                criado_em as "createdAt", atualizado_em as "updatedAt", excluido_em as "deletedAt"
         FROM despesas
         WHERE veiculo_id = $1 AND excluido_em IS NULL
         ORDER BY data_hora DESC, criado_em DESC`,
        [vehicleId],
      );
      return res.rows.map(row => this.mapRowToExpense(row));
    } catch {
      return [];
    }
  }

  static async findById(id: string): Promise<Expense | null> {
    try {
      const res = await query(
        `SELECT id, veiculo_id as "vehicleId", categoria as category, valor as amount,
                data_hora as date, descricao as description,
                criado_em as "createdAt", atualizado_em as "updatedAt", excluido_em as "deletedAt"
         FROM despesas
         WHERE id = $1 AND excluido_em IS NULL`,
        [id],
      );
      if (res.rows.length === 0) return null;
      return this.mapRowToExpense(res.rows[0]);
    } catch {
      return null;
    }
  }

  static async create(data: CreateExpenseDTO): Promise<Expense> {
    const res = await query(
      `INSERT INTO despesas (veiculo_id, categoria, valor, data_hora, descricao)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, veiculo_id as "vehicleId", categoria as category, valor as amount,
                 data_hora as date, descricao as description,
                 criado_em as "createdAt", atualizado_em as "updatedAt", excluido_em as "deletedAt"`,
      [
        data.vehicleId,
        data.category,
        Number(data.amount),
        data.date || new Date().toISOString(),
        data.description?.trim() || null,
      ],
    );
    return this.mapRowToExpense(res.rows[0]);
  }

  static async update(id: string, data: UpdateExpenseDTO): Promise<Expense | null> {
    try {
      const res = await query(
        `UPDATE despesas
         SET categoria = COALESCE($1, categoria),
             valor = COALESCE($2, valor),
             data_hora = COALESCE($3, data_hora),
             descricao = COALESCE($4, descricao),
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $5 AND excluido_em IS NULL
         RETURNING id, veiculo_id as "vehicleId", categoria as category, valor as amount,
                   data_hora as date, descricao as description,
                   criado_em as "createdAt", atualizado_em as "updatedAt", excluido_em as "deletedAt"`,
        [
          data.category || null,
          data.amount !== undefined ? Number(data.amount) : null,
          data.date || null,
          data.description !== undefined ? data.description?.trim() || null : null,
          id,
        ],
      );
      if (res.rows.length === 0) return null;
      return this.mapRowToExpense(res.rows[0]);
    } catch {
      return null;
    }
  }

  static async softDelete(id: string): Promise<boolean> {
    try {
      const res = await query(
        `UPDATE despesas
         SET excluido_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $1 AND excluido_em IS NULL
         RETURNING id`,
        [id],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  static async softDeleteByVehicle(vehicleId: string): Promise<void> {
    try {
      await query(
        `UPDATE despesas
         SET excluido_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
         WHERE veiculo_id = $1 AND excluido_em IS NULL`,
        [vehicleId],
      );
    } catch {
      // Ignora erro se tabela não existir
    }
  }
}
