import { db } from '../database/DatabaseConnection';
import { EfficiencyGoal } from '@autogest/shared-types';

export class EfficiencyGoalRepository {
  private static readonly TABLE = 'metas_eficiencia';

  /**
   * Converte registro do banco local para a interface EfficiencyGoal
   */
  private static mapFromRow(row: any): EfficiencyGoal {
    return {
      id: row.id,
      vehicleId: row.veiculo_id || row.vehicleId,
      targetKml: Number(row.meta_kml ?? row.targetKml),
      active: row.ativa === 1 || row.ativa === true || row.active === true,
      createdAt: row.criado_em || row.createdAt,
      updatedAt: row.atualizado_em || row.updatedAt,
    };
  }

  /**
   * Busca a meta de eficiência ativa de um veículo
   */
  static async findByVehicle(vehicleId: string): Promise<EfficiencyGoal | null> {
    const rows = await db.getTableData<any>(this.TABLE);
    const activeGoal = rows.find(
      r =>
        (r.veiculo_id === vehicleId || r.vehicleId === vehicleId) &&
        (r.ativa === 1 || r.ativa === true || r.active === true)
    );

    if (!activeGoal) {
      return null;
    }

    return this.mapFromRow(activeGoal);
  }

  /**
   * Define/atualiza a meta de consumo do veículo ativo.
   * Desativa quaisquer metas anteriores do mesmo veículo para manter unicidade ativa.
   */
  static async setGoal(
    vehicleId: string,
    targetKml: number
  ): Promise<EfficiencyGoal> {
    const now = new Date().toISOString();
    const rows = await db.getTableData<any>(this.TABLE);

    // Desativa metas ativas existentes para o veículo
    const updatedRows = rows.map(r => {
      if (
        (r.veiculo_id === vehicleId || r.vehicleId === vehicleId) &&
        (r.ativa === 1 || r.ativa === true || r.active === true)
      ) {
        return {
          ...r,
          ativa: 0,
          active: false,
          atualizado_em: now,
          updatedAt: now,
        };
      }
      return r;
    });

    const id = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newRecord = {
      id,
      veiculo_id: vehicleId,
      vehicleId,
      meta_kml: targetKml,
      targetKml,
      ativa: 1,
      active: true,
      criado_em: now,
      createdAt: now,
      atualizado_em: now,
      updatedAt: now,
    };

    updatedRows.push(newRecord);
    await db.saveTableData(this.TABLE, updatedRows);

    return this.mapFromRow(newRecord);
  }

  /**
   * Lista todas as metas cadastradas (incluindo históricas inativas)
   */
  static async listAll(): Promise<EfficiencyGoal[]> {
    const rows = await db.getTableData<any>(this.TABLE);
    return rows
      .sort((a, b) => {
        const tA = new Date(a.criado_em || a.createdAt || 0).getTime();
        const tB = new Date(b.criado_em || b.createdAt || 0).getTime();
        return tB - tA;
      })
      .map(this.mapFromRow);
  }
}

