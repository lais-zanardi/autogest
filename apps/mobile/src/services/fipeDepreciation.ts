import { FipeConsultation, FipeDepreciationResult } from '@autogest/shared-types';

/**
 * US18.7: Calcula a depreciação a partir do histórico de consultas FIPE de um veículo
 * - valor inicial e atual
 * - variação em R$ e em %
 * - percentual anualizado apenas com intervalo de pelo menos 90 dias (Decisão #32)
 */
export function calcularDepreciacao(
  consultas: FipeConsultation[]
): FipeDepreciationResult | null {
  if (!consultas || consultas.length < 2) {
    return null;
  }

  // Ordena cronologicamente por mês de referência e data de consulta
  const ordenadas = [...consultas].sort((a, b) => {
    const mesDiff = (a.referenceMonth || a.mes_referencia || '').localeCompare(
      b.referenceMonth || b.mes_referencia || ''
    );
    if (mesDiff !== 0) return mesDiff;
    const tA = new Date(a.consultedAt || a.consultado_em || a.createdAt || 0).getTime();
    const tB = new Date(b.consultedAt || b.consultado_em || b.createdAt || 0).getTime();
    return tA - tB;
  });

  const inicial = ordenadas[0];
  const atual = ordenadas[ordenadas.length - 1];

  const valorInicialCentavos = Number(inicial.valueCentavos ?? inicial.valor_centavos ?? 0);
  const valorAtualCentavos = Number(atual.valueCentavos ?? atual.valor_centavos ?? 0);

  if (valorInicialCentavos <= 0 || valorAtualCentavos <= 0) {
    return null;
  }

  const dataInicial = inicial.consultedAt || inicial.consultado_em || inicial.createdAt;
  const dataAtual = atual.consultedAt || atual.consultado_em || atual.createdAt;

  const msInicial = new Date(dataInicial).getTime();
  const msAtual = new Date(dataAtual).getTime();

  const diasDecorridos = Math.max(
    1,
    Math.round(Math.abs(msAtual - msInicial) / (1000 * 60 * 60 * 24))
  );
  const mesesDecorridos = Math.max(1, Math.round(diasDecorridos / 30.4375));

  const diffCentavos = valorAtualCentavos - valorInicialCentavos;
  const variacaoReais = Math.round(diffCentavos) / 100;

  const variacaoFracao = diffCentavos / valorInicialCentavos;
  const variacaoPercentual = Math.round(variacaoFracao * 1000) / 10; // 1 casa decimal

  let variacaoAnualizadaPercentual: number | null = null;

  // Só calcula taxa anualizada com intervalo de pelo menos 90 dias (US18.7)
  if (diasDecorridos >= 90) {
    const fatorAnual = 365 / diasDecorridos;
    const anualizada = variacaoFracao * fatorAnual * 100;
    variacaoAnualizadaPercentual = Math.round(anualizada * 10) / 10;
  }

  return {
    valorInicialCentavos,
    valorAtualCentavos,
    dataInicial,
    dataAtual,
    variacaoReais,
    variacaoPercentual,
    variacaoAnualizadaPercentual,
    mesesDecorridos,
    diasDecorridos,
  };
}
