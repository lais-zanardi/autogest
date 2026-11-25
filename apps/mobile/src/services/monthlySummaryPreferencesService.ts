import { MonthlySummaryPreferenceRecord } from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';

const TABLE_NAME = 'preferencias_resumo';
const DEFAULT_PREFERENCE_ID = 'pref_resumo_local';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SalvarPreferenciaResumoInput {
  receberResumo: boolean;
  emailDestino: string;
}

export function validarEmailResumo(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export const MonthlySummaryPreferencesService = {
  async obterPreferencia(): Promise<MonthlySummaryPreferenceRecord> {
    const db = DatabaseConnection.getInstance();
    const rows = await db.getTableData<MonthlySummaryPreferenceRecord>(TABLE_NAME);
    const active = rows.find((item) => !item.excluido_em);

    if (active) {
      return {
        ...active,
        receber_resumo: Boolean(active.receber_resumo),
        email_destino: active.email_destino || '',
      };
    }

    const now = new Date().toISOString();
    return {
      id: DEFAULT_PREFERENCE_ID,
      receber_resumo: false,
      email_destino: '',
      criado_em: now,
      atualizado_em: now,
      excluido_em: null,
    };
  },

  async salvarPreferencia(
    input: SalvarPreferenciaResumoInput,
  ): Promise<MonthlySummaryPreferenceRecord> {
    const emailLimpo = (input.emailDestino || '').trim().toLowerCase();

    if (input.receberResumo && !validarEmailResumo(emailLimpo)) {
      throw new Error('Informe um e-mail válido para receber o resumo mensal.');
    }

    const db = DatabaseConnection.getInstance();
    const existingRows = await db.getTableData<MonthlySummaryPreferenceRecord>(TABLE_NAME);
    const existing = existingRows.find((item) => !item.excluido_em);
    const now = new Date().toISOString();

    const record: MonthlySummaryPreferenceRecord = {
      id: existing?.id || DEFAULT_PREFERENCE_ID,
      receber_resumo: Boolean(input.receberResumo),
      email_destino: emailLimpo,
      criado_em: existing?.criado_em || now,
      atualizado_em: now,
      excluido_em: null,
    };

    if (existing) {
      await db.update(TABLE_NAME, record.id, record as any);
    } else {
      await db.insert(TABLE_NAME, record as any);
    }

    await SyncQueueRepository.enqueue(
      'UPSERT_SUMMARY_PREFERENCE',
      '/api/v1/sync/preferencias_resumo',
      {
        id: record.id,
        receber_resumo: record.receber_resumo,
        email_destino: record.email_destino,
        atualizado_em: record.atualizado_em,
      },
    );

    return record;
  },
};
