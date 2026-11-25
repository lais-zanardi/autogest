import {
  LocalPriceHistoryRecord,
  PriceTrendDirection,
  PriceTrendSummary,
} from '@autogest/shared-types';

/**
 * US35.2 — Função pura de avaliação de alerta de preço-limite.
 * Dispara quando `precoAtual <= precoLimite` (incluindo igual ao limite).
 * Valores inválidos (<= 0 ou não finitos) nunca disparam.
 */
export function avaliarAlertaPreco(precoAtual: number, precoLimite: number): boolean {
  if (
    !Number.isFinite(precoAtual) ||
    !Number.isFinite(precoLimite) ||
    precoAtual <= 0 ||
    precoLimite <= 0
  ) {
    return false;
  }
  return precoAtual <= precoLimite;
}

/**
 * US35.4 — Valida que o preço-limite informado é estritamente maior que zero.
 */
export function validarPrecoLimiteCentavos(precoLimiteCentavos: number): {
  valido: boolean;
  erro?: string;
} {
  if (
    typeof precoLimiteCentavos !== 'number' ||
    !Number.isFinite(precoLimiteCentavos) ||
    precoLimiteCentavos <= 0
  ) {
    return {
      valido: false,
      erro: 'O preço-limite deve ser maior que zero.',
    };
  }
  return { valido: true };
}

/**
 * US35.3 — Calcula tendência de alta, queda ou estabilidade no período (30 ou 90 dias).
 * Lida com segurança com série vazia ou série de um único ponto (sem NaN / divisão por zero).
 */
export function calcularTendenciaPrecos(
  historico: LocalPriceHistoryRecord[],
  periodoDias: 30 | 90 = 30,
  dataReferencia: Date = new Date(),
): PriceTrendSummary {
  if (!Array.isArray(historico) || historico.length === 0) {
    return {
      periodoDias,
      direcao: 'dados_insuficientes',
      pontos: [],
      precoInicialCentavos: null,
      precoAtualCentavos: null,
      variacaoCentavos: 0,
      variacaoPercentual: 0,
    };
  }

  const limiteMs = dataReferencia.getTime() - periodoDias * 24 * 60 * 60 * 1000;
  const filtrados = historico
    .filter(p => {
      const ms = new Date(`${p.data_coleta}T12:00:00.000Z`).getTime();
      return Number.isFinite(ms) && ms >= limiteMs && p.preco_centavos > 0;
    })
    .sort((a, b) => a.data_coleta.localeCompare(b.data_coleta));

  if (filtrados.length === 0) {
    return {
      periodoDias,
      direcao: 'dados_insuficientes',
      pontos: [],
      precoInicialCentavos: null,
      precoAtualCentavos: null,
      variacaoCentavos: 0,
      variacaoPercentual: 0,
    };
  }

  const primeiro = filtrados[0];
  const ultimo = filtrados[filtrados.length - 1];

  if (filtrados.length === 1) {
    return {
      periodoDias,
      direcao: 'estavel',
      pontos: filtrados,
      precoInicialCentavos: primeiro.preco_centavos,
      precoAtualCentavos: ultimo.preco_centavos,
      variacaoCentavos: 0,
      variacaoPercentual: 0,
    };
  }

  const variacaoCentavos = ultimo.preco_centavos - primeiro.preco_centavos;
  const variacaoPercentual =
    primeiro.preco_centavos > 0
      ? Number(((variacaoCentavos / primeiro.preco_centavos) * 100).toFixed(2))
      : 0;

  let direcao: PriceTrendDirection = 'estavel';
  if (variacaoCentavos > 0) direcao = 'alta';
  else if (variacaoCentavos < 0) direcao = 'queda';

  return {
    periodoDias,
    direcao,
    pontos: filtrados,
    precoInicialCentavos: primeiro.preco_centavos,
    precoAtualCentavos: ultimo.preco_centavos,
    variacaoCentavos,
    variacaoPercentual,
  };
}
