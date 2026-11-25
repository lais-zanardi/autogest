import { Maintenance, WorkshopVisitRecord } from '@autogest/shared-types';

/**
 * US12.2 & US12.5: Validação pura de telefone brasileiro (opcional se vazio;
 * quando informado, exige 10 dígitos para fixo ou 11 dígitos para celular).
 */
export function validarTelefoneOficina(telefone?: string | null): {
  valido: boolean;
  digitos: string;
  erro?: string;
} {
  if (!telefone || !telefone.trim()) {
    return { valido: true, digitos: '' };
  }

  const trimmed = telefone.trim();
  if (/[a-zA-Z]/.test(trimmed)) {
    return {
      valido: false,
      digitos: '',
      erro: 'Telefone inválido. Use apenas números com DDD (10 ou 11 dígitos).',
    };
  }

  const digitos = trimmed.replace(/\D/g, '');
  if (digitos.length !== 10 && digitos.length !== 11) {
    return {
      valido: false,
      digitos,
      erro: 'Telefone inválido. Informe DDD + número com 10 ou 11 dígitos.',
    };
  }

  return { valido: true, digitos };
}

/**
 * Monta URI nativa para discagem no aparelho.
 */
export function montarUrlLigacaoTelefone(telefone?: string | null): string | null {
  const { valido, digitos } = validarTelefoneOficina(telefone);
  if (!valido || !digitos) return null;
  return `tel:${digitos}`;
}

/**
 * US12.4 & US12.5: Soma o total gasto em uma oficina com base nos atendimentos vinculados
 * às manutenções ativas (arredondado para 2 casas decimais sem erros de ponto flutuante).
 */
export function calcularTotalGastoOficina(
  atendimentos: WorkshopVisitRecord[],
  manutencoes: Maintenance[],
): number {
  if (!Array.isArray(atendimentos) || !atendimentos.length) {
    return 0;
  }

  const maintMap = new Map<string, Maintenance>();
  for (const m of manutencoes || []) {
    if (!m.deletedAt) {
      maintMap.set(m.id, m);
    }
  }

  let totalCentavos = 0;
  for (const att of atendimentos) {
    if (att.excluido_em) continue;
    const maint = maintMap.get(att.manutencao_id);
    if (maint && Number.isFinite(Number(maint.totalValue))) {
      totalCentavos += Math.round(Number(maint.totalValue) * 100);
    }
  }

  return Number((totalCentavos / 100).toFixed(2));
}
