import { Refuel } from '@autogest/shared-types';

/**
 * US26.2: Limiar padrão de 15% (0.15) definido em constante única de configuração.
 * Uma queda de rendimento estritamente superior a este limiar dispara o alerta de anomalia.
 */
export const LIMIAR_ANOMALIA_PADRAO = 0.15;

export interface AnomaliaConsumoResultado {
  isAnomalia: boolean;
  mediaAnterior: number | null;
  consumoNovo: number | null;
  percentualQueda: number | null; // em % com 1 casa decimal (ex: 25.0)
  mensagemAlerta: string | null;
}

/**
 * US26.1: Avalia se um novo consumo registrado representa uma anomalia mecânica em relação
 * aos 3 abastecimentos anteriores que possuíam consumo apurado.
 *
 * Fórmula:
 * - média simples dos 3 anteriores com consumo;
 * - queda = (média − novo) ÷ média;
 * - alerta apenas se queda > limiar.
 * - Com menos de 3 anteriores, ou consumo igual ou melhor que a média, NÃO alerta.
 */
export function avaliarAnomaliaConsumo(
  consumosAnteriores: Array<number | null | undefined>,
  consumoNovo: number | null | undefined,
  limiar: number = LIMIAR_ANOMALIA_PADRAO,
): AnomaliaConsumoResultado {
  if (
    consumoNovo === null ||
    consumoNovo === undefined ||
    typeof consumoNovo !== 'number' ||
    !Number.isFinite(consumoNovo) ||
    consumoNovo <= 0
  ) {
    return {
      isAnomalia: false,
      mediaAnterior: null,
      consumoNovo: null,
      percentualQueda: null,
      mensagemAlerta: null,
    };
  }

  // Filtra apenas consumos válidos > 0 dos abastecimentos anteriores
  const validosAnteriores = (consumosAnteriores || []).filter(
    (val): val is number => typeof val === 'number' && Number.isFinite(val) && val > 0,
  );

  // US26.1: Com menos de 3 abastecimentos anteriores com consumo, não alerta
  if (validosAnteriores.length < 3) {
    return {
      isAnomalia: false,
      mediaAnterior:
        validosAnteriores.length > 0
          ? Number(
              (
                validosAnteriores.reduce((a, b) => a + b, 0) / validosAnteriores.length
              ).toFixed(2),
            )
          : null,
      consumoNovo,
      percentualQueda: null,
      mensagemAlerta: null,
    };
  }

  // Seleciona exatamente os 3 abastecimentos imediatamente anteriores
  const ultimosTres = validosAnteriores.slice(validosAnteriores.length - 3);
  const soma = ultimosTres.reduce((a, b) => a + b, 0);
  const mediaSimples = soma / 3;
  const mediaArredondada = Number(mediaSimples.toFixed(2));

  // Consumo igual ou melhor que a média -> não alerta
  if (consumoNovo >= mediaSimples) {
    return {
      isAnomalia: false,
      mediaAnterior: mediaArredondada,
      consumoNovo,
      percentualQueda: consumoNovo === mediaSimples ? 0 : null,
      mensagemAlerta: null,
    };
  }

  // Queda relativa = (média − novo) ÷ média
  const quedaFracao = (mediaSimples - consumoNovo) / mediaSimples;
  const percentualQueda = Number((quedaFracao * 100).toFixed(1));

  // Alerta apenas se a queda superar estritamente o limiar (> limiar)
  const isAnomalia = quedaFracao > limiar;

  const percentualFormatadoPtBr = percentualQueda.toFixed(1).replace('.', ',');
  const mensagemAlerta = isAnomalia
    ? `Possível problema mecânico: consumo ${percentualFormatadoPtBr}% abaixo da média recente (${mediaArredondada.toFixed(1).replace('.', ',')} km/l). Deseja agendar uma revisão preventiva?`
    : null;

  return {
    isAnomalia,
    mediaAnterior: mediaArredondada,
    consumoNovo,
    percentualQueda,
    mensagemAlerta,
  };
}

/**
 * US26.4: Varre uma lista cronológica de abastecimentos e identifica dinamicamente
 * quais registros representam anomalia de consumo.
 *
 * Nada é persistido no banco de dados. Recalcula na hora, permitindo que a edição
 * ou exclusão de abastecimentos anteriores recalcule imediatamente os alertas.
 */
export function identificarAnomaliasNoHistorico(
  abastecimentos: Refuel[],
  limiar: number = LIMIAR_ANOMALIA_PADRAO,
): Map<string, AnomaliaConsumoResultado> {
  const anomaliasPorId = new Map<string, AnomaliaConsumoResultado>();
  if (!abastecimentos || abastecimentos.length === 0) return anomaliasPorId;

  // Ordena cronologicamente crescente para processar a linha do tempo
  const ordenados = [...abastecimentos]
    .filter(r => !r.deletedAt && !(r as any).excluido_em)
    .sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) return diff;
      return a.odometer - b.odometer;
    });

  const historicoConsumos: number[] = [];

  for (const item of ordenados) {
    const kml = item.calculatedKml;
    if (kml !== null && kml !== undefined && Number.isFinite(kml) && kml > 0) {
      const avaliacao = avaliarAnomaliaConsumo(historicoConsumos, kml, limiar);
      if (avaliacao.isAnomalia) {
        anomaliasPorId.set(item.id, avaliacao);
      }
      historicoConsumos.push(kml);
    }
  }

  return anomaliasPorId;
}
