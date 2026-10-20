import { MaintenanceRule, Maintenance, MaintenanceDueCalculation } from '@autogest/shared-types';

export interface LeituraHodometroInput {
  km: number;
  date?: string;
  data_hora?: string;
  data?: string;
}

/**
 * US10.4: Média de km/dia calculada a partir de leituras_hodometro.
 * Função pura reaproveitada na US24.
 *
 * Critério BDD Backlog:
 * "Dado 900 km rodados em 30 dias, quando consultar o painel, então exibe média de 30 km/dia."
 */
export function calcularMediaKmDia(
  leituras: LeituraHodometroInput[],
  _dataReferencia?: Date | string,
): number {
  if (!leituras || leituras.length < 2) {
    return 0;
  }

  // Sanitiza e ordena as leituras cronologicamente (mais antiga primeiro)
  const leiturasOrdenadas = [...leituras]
    .map(item => {
      const dataStr = item.date || item.data_hora || item.data;
      const timeMs = dataStr ? new Date(dataStr).getTime() : 0;
      return {
        km: Number(item.km),
        timeMs,
      };
    })
    .filter(item => !isNaN(item.km) && item.timeMs > 0)
    .sort((a, b) => a.timeMs - b.timeMs);

  if (leiturasOrdenadas.length < 2) {
    return 0;
  }

  const primeira = leiturasOrdenadas[0];
  const ultima = leiturasOrdenadas[leiturasOrdenadas.length - 1];

  const distanciaKm = ultima.km - primeira.km;
  if (distanciaKm <= 0) {
    return 0;
  }

  const diferencaMs = ultima.timeMs - primeira.timeMs;
  const dias = diferencaMs / (1000 * 60 * 60 * 24);

  if (dias <= 0) {
    return 0;
  }

  const media = distanciaKm / dias;
  return Number(media.toFixed(2));
}

export interface CalcularProximoVencimentoParams {
  regra: MaintenanceRule;
  ultimaManutencao?: Maintenance | { odometer: number; date: string } | null;
  kmAtual: number;
  mediaKmDia?: number;
  dataReferencia?: Date | string;
}

/**
 * US10.3: Função pura calcularProximoVencimento(regra, ultimaManutencao, kmAtual, mediaKmDia)
 *
 * Considera a manutenção mais recente do mesmo tipo (US09).
 * Sem histórico, utiliza a última troca (data e km) informada na própria regra.
 * Avalia antecedência configurável (padrão 500 km ou 15 dias) e status 'ok' | 'proximo' | 'vencido'.
 */
export function calcularProximoVencimento(
  params: CalcularProximoVencimentoParams,
): MaintenanceDueCalculation {
  const { regra, ultimaManutencao, kmAtual, mediaKmDia = 0, dataReferencia = new Date() } = params;

  const refDate = typeof dataReferencia === 'string' ? new Date(dataReferencia) : dataReferencia;

  // 1. Determina a base de cálculo (manutenção realizada mais recente ou dados manuais da regra)
  let baseKm = 0;
  let baseDate = regra.createdAt || new Date().toISOString();

  if (ultimaManutencao) {
    baseKm = Number(ultimaManutencao.odometer) || 0;
    baseDate = ultimaManutencao.date || baseDate;
  } else {
    baseKm =
      regra.lastServiceKm !== undefined && regra.lastServiceKm !== null
        ? Number(regra.lastServiceKm)
        : 0;
    baseDate = regra.lastServiceDate || baseDate;
  }

  const advanceKm = regra.advanceKm !== undefined ? Number(regra.advanceKm) : 500;
  const advanceDays = regra.advanceDays !== undefined ? Number(regra.advanceDays) : 15;

  let targetKm: number | null = null;
  let remainingKm: number | null = null;
  let vencePorKm = false;
  let vencidoPorKm = false;

  // 2. Vencimento por Quilometragem
  if (regra.intervalKm !== undefined && regra.intervalKm !== null && regra.intervalKm > 0) {
    targetKm = baseKm + Number(regra.intervalKm);
    remainingKm = targetKm - kmAtual;

    if (remainingKm < 0) {
      vencidoPorKm = true;
      vencePorKm = true;
    } else if (remainingKm <= advanceKm) {
      vencePorKm = true;
    }
  }

  let targetDate: string | null = null;
  let remainingDays: number | null = null;
  let vencePorDias = false;
  let vencidoPorDias = false;

  // 3. Vencimento por Dias/Tempo
  if (regra.intervalDays !== undefined && regra.intervalDays !== null && regra.intervalDays > 0) {
    const baseTimeMs = new Date(baseDate).getTime();
    const targetTimeMs = baseTimeMs + Number(regra.intervalDays) * 24 * 60 * 60 * 1000;
    targetDate = new Date(targetTimeMs).toISOString().split('T')[0];

    const diffMs = targetTimeMs - refDate.getTime();
    remainingDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (remainingDays < 0) {
      vencidoPorDias = true;
      vencePorDias = true;
    } else if (remainingDays <= advanceDays) {
      vencePorDias = true;
    }
  }

  // 4. Projeção de data estimada baseada na média diária de km (se km restante e mediaKmDia > 0)
  let estimatedDateByKm: string | null = null;
  if (remainingKm !== null && mediaKmDia > 0) {
    const diasEstimados = Math.round(remainingKm / mediaKmDia);
    const estimatedTimeMs = refDate.getTime() + diasEstimados * 24 * 60 * 60 * 1000;
    estimatedDateByKm = new Date(estimatedTimeMs).toISOString().split('T')[0];
  }

  // 5. Determina status consolidado
  let status: 'ok' | 'proximo' | 'vencido' = 'ok';
  let reason: string | undefined;

  if (vencidoPorKm || vencidoPorDias) {
    status = 'vencido';
    const reasons: string[] = [];
    if (vencidoPorKm && remainingKm !== null) {
      reasons.push(`Quilometragem ultrapassada em ${Math.abs(remainingKm)} km`);
    }
    if (vencidoPorDias && remainingDays !== null) {
      reasons.push(`Prazo ultrapassado em ${Math.abs(remainingDays)} dias`);
    }
    reason = reasons.join(' e ');
  } else if (vencePorKm || vencePorDias) {
    status = 'proximo';
    const reasons: string[] = [];
    if (vencePorKm && remainingKm !== null) {
      reasons.push(`Restam ${remainingKm} km`);
    }
    if (vencePorDias && remainingDays !== null) {
      reasons.push(`Restam ${remainingDays} dias`);
    }
    reason = `Revisão próxima: ${reasons.join(' ou ')}`;
  } else {
    status = 'ok';
  }

  return {
    status,
    vencePorKm: vencePorKm || vencidoPorKm,
    vencePorDias: vencePorDias || vencidoPorDias,
    baseKm,
    baseDate,
    targetKm,
    remainingKm,
    targetDate,
    remainingDays,
    estimatedDateByKm,
    reason,
  };
}
