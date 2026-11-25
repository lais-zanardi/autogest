import { InspectionCycleRecord, InspectionReminderRecord } from '@autogest/shared-types';

const DIA_MS = 24 * 60 * 60 * 1000;

export const ITENS_INSPECAO_PREDEFINIDOS = [
  'Faróis',
  'Pneus',
  'Limpadores',
  'Luzes',
  'Fluido do limpador',
  'Estepe',
] as const;

/**
 * Decisão #6 (US31.4): Repetição diária enquanto o ciclo permanecer aberto,
 * com limite de 7 tentativas para evitar fadiga de notificações.
 */
export const LIMITE_TENTATIVAS_REPETICAO_INSPECAO = 7;

export interface ProximoCicloResult {
  proximaDataIso: string;
  vencido: boolean;
  diasRestantes: number;
}

/**
 * US31.3: Função pura que calcula a data do próximo ciclo de inspeção
 * a partir da última inspeção (ou data de criação se nunca inspecionado).
 */
export function proximoCicloInspecao(
  lembrete: Pick<
    InspectionReminderRecord,
    'periodicidade_dias' | 'ultima_inspecao_em' | 'criado_em'
  >,
  dataReferencia: Date = new Date(),
): ProximoCicloResult {
  const periodicidade = Math.max(1, Math.round(Number(lembrete.periodicidade_dias) || 1));
  const baseIso = lembrete.ultima_inspecao_em || lembrete.criado_em || dataReferencia.toISOString();
  const baseMs = new Date(baseIso).getTime();
  const baseValida = Number.isFinite(baseMs) ? baseMs : dataReferencia.getTime();

  const proximaMs = baseValida + periodicidade * DIA_MS;
  const diffMs = proximaMs - dataReferencia.getTime();
  const diasRestantes = Math.ceil(diffMs / DIA_MS);

  return {
    proximaDataIso: new Date(proximaMs).toISOString(),
    vencido: diffMs <= 0,
    diasRestantes,
  };
}

/**
 * US31.4: Avalia se um ciclo aberto deve repetir a notificação diária,
 * respeitando o intervalo mínimo de 24h e o limite de tentativas.
 */
export function deveRepetirNotificacaoCiclo(
  ciclo: InspectionCycleRecord,
  dataReferencia: Date = new Date(),
  limiteTentativas: number = LIMITE_TENTATIVAS_REPETICAO_INSPECAO,
): boolean {
  if (ciclo.concluido_em || ciclo.excluido_em) {
    return false;
  }
  if (ciclo.tentativas >= limiteTentativas) {
    return false;
  }
  const ultimoIso = ciclo.ultimo_disparo_em || ciclo.disparado_em;
  const ultimoMs = new Date(ultimoIso).getTime();
  if (!Number.isFinite(ultimoMs)) return false;

  return dataReferencia.getTime() - ultimoMs >= DIA_MS;
}
