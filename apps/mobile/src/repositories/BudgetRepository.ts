import { DEFAULT_BUDGET_WARNING_PERCENTAGE, VehicleBudget } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { AuditRepository } from './AuditRepository';

/**
 * US15.1 & US15.2: Repositório local da tabela `orcamentos`.
 * Armazena o teto mensal em centavos (`teto_mensal`), o percentual de aviso (`percentual_aviso`, padrão 80%)
 * e o controle de notificação única por nível e por mês (`aviso_enviado_mes` e `critico_enviado_mes` no formato `AAAA-MM`).
 * As alterações de teto (criação, edição e exclusão) são auditadas via `AuditRepository.recordMutation` (US15.2 / US21.6).
 */
export class BudgetRepository {
  public static readonly TABLE = 'orcamentos';

  static async findById(id: string): Promise<VehicleBudget | null> {
    const item = await db.findById<VehicleBudget>(this.TABLE, id);
    if (!item || item.deletedAt || item.excluido_em) return null;
    return item;
  }

  static async findByVehicle(vehicleId: string): Promise<VehicleBudget | null> {
    const rows = await db.getTableData<VehicleBudget>(this.TABLE);
    const active = rows
      .filter(
        r =>
          (r.vehicleId === vehicleId || r.veiculo_id === vehicleId) &&
          !r.deletedAt &&
          !r.excluido_em,
      )
      .sort((a, b) => {
        const tA = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const tB = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return tA - tB;
      });
    return active[0] || null;
  }

  static async create(params: {
    id?: string;
    vehicleId: string;
    tetoMensalCentavos: number;
    percentualAviso?: number;
    avisoEnviadoMes?: string | null;
    criticoEnviadoMes?: string | null;
  }): Promise<VehicleBudget> {
    const now = new Date().toISOString();
    const tetoCentavos = Math.round(Number(params.tetoMensalCentavos));
    const percAviso =
      params.percentualAviso !== undefined
        ? Math.round(Number(params.percentualAviso))
        : DEFAULT_BUDGET_WARNING_PERCENTAGE;

    const record: VehicleBudget = {
      id: params.id || `orc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      vehicleId: params.vehicleId,
      veiculo_id: params.vehicleId,
      teto_mensal: tetoCentavos,
      monthlyLimitCents: tetoCentavos,
      percentual_aviso: percAviso,
      warningPercentage: percAviso,
      aviso_enviado_mes: params.avisoEnviadoMes ?? null,
      warningSentMonth: params.avisoEnviadoMes ?? null,
      critico_enviado_mes: params.criticoEnviadoMes ?? null,
      criticalSentMonth: params.criticoEnviadoMes ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      excluido_em: null,
    };

    await db.insert(this.TABLE, record);

    await AuditRepository.recordMutation({
      entidade: 'orcamentos',
      entidade_id: record.id,
      acao: 'criacao',
      antes: null,
      depois: { ...record },
    });

    return record;
  }

  static async update(
    id: string,
    updates: {
      tetoMensalCentavos?: number;
      percentualAviso?: number;
      avisoEnviadoMes?: string | null;
      criticoEnviadoMes?: string | null;
    },
    options?: { auditarAlteracaoTeto?: boolean },
  ): Promise<VehicleBudget | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const novoTeto =
      updates.tetoMensalCentavos !== undefined
        ? Math.round(Number(updates.tetoMensalCentavos))
        : existing.teto_mensal;
    const novoPerc =
      updates.percentualAviso !== undefined
        ? Math.round(Number(updates.percentualAviso))
        : existing.percentual_aviso;
    const novoAvisoMes =
      updates.avisoEnviadoMes !== undefined ? updates.avisoEnviadoMes : existing.aviso_enviado_mes;
    const novoCriticoMes =
      updates.criticoEnviadoMes !== undefined
        ? updates.criticoEnviadoMes
        : existing.critico_enviado_mes;

    const updated = await db.update<VehicleBudget>(this.TABLE, id, {
      teto_mensal: novoTeto,
      monthlyLimitCents: novoTeto,
      percentual_aviso: novoPerc,
      warningPercentage: novoPerc,
      aviso_enviado_mes: novoAvisoMes,
      warningSentMonth: novoAvisoMes,
      critico_enviado_mes: novoCriticoMes,
      criticalSentMonth: novoCriticoMes,
      updatedAt: now,
    });

    const mudouTetoOuPercentual =
      novoTeto !== existing.teto_mensal || novoPerc !== existing.percentual_aviso;
    const deveAuditar = options?.auditarAlteracaoTeto ?? mudouTetoOuPercentual;

    if (updated && deveAuditar) {
      await AuditRepository.recordMutation({
        entidade: 'orcamentos',
        entidade_id: id,
        acao: 'edicao',
        antes: { ...existing },
        depois: { ...updated },
      });
    }

    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const updated = await db.update<VehicleBudget>(this.TABLE, id, {
      deletedAt: now,
      excluido_em: now,
      updatedAt: now,
    });

    if (updated) {
      await AuditRepository.recordMutation({
        entidade: 'orcamentos',
        entidade_id: id,
        acao: 'exclusao',
        antes: { ...existing },
        depois: { ...updated },
      });
    }

    return !!updated;
  }

  static async softDeleteByVehicle(vehicleId: string): Promise<void> {
    const now = new Date().toISOString();
    const all = await db.getTableData<VehicleBudget>(this.TABLE);
    const updated = all.map(item => {
      if ((item.vehicleId === vehicleId || item.veiculo_id === vehicleId) && !item.deletedAt) {
        return { ...item, deletedAt: now, excluido_em: now, updatedAt: now };
      }
      return item;
    });
    await db.saveTableData(this.TABLE, updated);
  }
}
