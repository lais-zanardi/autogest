import { AuditEntityName, AuditLogRecord } from '@autogest/shared-types';
import { AuditRepository } from '../repositories/AuditRepository';

export type AuditPeriodPreset = 'todos' | 'hoje' | '7dias' | '30dias';

/**
 * US21.8: Função pura para calcular o instante inicial do filtro de período do histórico de auditoria.
 */
export function resolverInicioPeriodoAuditoria(
  preset: AuditPeriodPreset,
  referencia: Date = new Date(),
): Date | undefined {
  if (preset === 'hoje') {
    return new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate(), 0, 0, 0);
  }
  if (preset === '7dias') {
    return new Date(referencia.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (preset === '30dias') {
    return new Date(referencia.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return undefined;
}

/**
 * US21.8: Serviço de domínio para consulta do histórico de alterações (trilha de auditoria),
 * desacoplando a camada de apresentação (`AuditHistoryScreen`) do repositório (`AuditRepository`).
 */
export class AuditService {
  static async listarHistorico(params?: {
    entidade?: AuditEntityName | 'todas';
    periodo?: AuditPeriodPreset;
    referencia?: Date;
    usuarioId?: string;
  }): Promise<AuditLogRecord[]> {
    const de = resolverInicioPeriodoAuditoria(
      params?.periodo ?? 'todos',
      params?.referencia ?? new Date(),
    );

    return AuditRepository.listFiltered({
      entidade: params?.entidade ?? 'todas',
      de,
      usuarioId: params?.usuarioId,
    });
  }
}
