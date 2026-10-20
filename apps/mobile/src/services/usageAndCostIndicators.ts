import {
  IndicatorPeriodPreset,
  UsageIndicators,
  CostPerKmIndicators,
  UsageAndCostIndicators,
  MaintenanceType,
} from '@autogest/shared-types';
import { calcularMediaKmDia, LeituraHodometroInput } from './maintenanceCalculation';
import { obterDetalhamentoGastosDoPeriodo } from './expenseAggregation';
import { OdometerRepository } from '../repositories/OdometerRepository';

export interface ManutencaoCustoInput {
  type: MaintenanceType;
  totalValue: number;
  odometer?: number;
  date?: string;
}

export interface AbastecimentoCustoInput {
  totalValue: number;
  odometer?: number;
  date?: string;
}

export interface DespesaCustoInput {
  amount: number;
  category?: string;
  date?: string;
}

export interface CalcularCustoPorKmParams {
  kmRodados: number;
  custoCombustivel: number;
  manutencoes: ManutencaoCustoInput[];
  custoOutrasDespesas?: number;
  custoFixoProporcional?: number;
}

export interface CalcularIndicadoresUsoECustoPuroParams {
  inicio: string;
  fim: string;
  leituras: LeituraHodometroInput[];
  abastecimentos: AbastecimentoCustoInput[];
  manutencoes: ManutencaoCustoInput[];
  despesas: DespesaCustoInput[];
  custoFixoProporcional?: number;
}

/**
 * US24.1 & US24.3: Função pura para calcular indicadores de uso (km por dia, semana e mês),
 * reaproveitando a função pura calcularMediaKmDia da US10.4.
 *
 * Critério BDD Backlog:
 * "Dado 900 km rodados em 30 dias, quando consultar o painel, então exibe média de 30 km/dia."
 */
export function calcularIndicadoresUso(leituras: LeituraHodometroInput[]): UsageIndicators {
  if (!leituras || leituras.length < 2) {
    return {
      kmRodados: 0,
      diasNoPeriodo: 0,
      kmPorDia: 0,
      kmPorSemana: 0,
      kmPorMes: 0,
      possuiKmRodado: false,
    };
  }

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
    .sort((a, b) => a.timeMs - b.timeMs || a.km - b.km);

  if (leiturasOrdenadas.length < 2) {
    return {
      kmRodados: 0,
      diasNoPeriodo: 0,
      kmPorDia: 0,
      kmPorSemana: 0,
      kmPorMes: 0,
      possuiKmRodado: false,
    };
  }

  const primeira = leiturasOrdenadas[0];
  const ultima = leiturasOrdenadas[leiturasOrdenadas.length - 1];
  const kmRodados = Math.max(0, Number((ultima.km - primeira.km).toFixed(2)));
  const diasBrutos = Math.max(0, (ultima.timeMs - primeira.timeMs) / (1000 * 60 * 60 * 24));
  const diasNoPeriodo = Number(diasBrutos.toFixed(2));

  if (kmRodados <= 0) {
    return {
      kmRodados: 0,
      diasNoPeriodo,
      kmPorDia: 0,
      kmPorSemana: 0,
      kmPorMes: 0,
      possuiKmRodado: false,
    };
  }

  // Reaproveita estritamente a função pura da US10.4 (para >= 1 dia) ou considera mínimo de 1 dia no mesmo dia civil
  const kmPorDia =
    diasBrutos >= 1 ? calcularMediaKmDia(leituras) : Number((kmRodados / 1).toFixed(2));

  const kmPorSemana = Number((kmPorDia * 7).toFixed(2));
  const kmPorMes = Number((kmPorDia * 30).toFixed(2));

  return {
    kmRodados,
    diasNoPeriodo: diasNoPeriodo > 0 ? diasNoPeriodo : 1,
    kmPorDia,
    kmPorSemana,
    kmPorMes,
    possuiKmRodado: true,
  };
}

/**
 * US24.1 & US24.3: Função pura para calcular o custo/km total, de combustível
 * e de manutenção (separando preventivas e corretivas).
 * Trata períodos sem km rodado evitando divisão por zero.
 */
export function calcularCustoPorKm(params: CalcularCustoPorKmParams): CostPerKmIndicators {
  const kmRodados = Math.max(0, Number(params.kmRodados) || 0);
  const custoCombustivel = Number((Number(params.custoCombustivel) || 0).toFixed(2));
  const custoOutrasDespesas = Number((Number(params.custoOutrasDespesas) || 0).toFixed(2));
  const custoFixoProporcional = Number((Number(params.custoFixoProporcional) || 0).toFixed(2));

  let somaPreventiva = 0;
  let somaCorretiva = 0;

  for (const m of params.manutencoes || []) {
    const val = Number(m.totalValue) || 0;
    if (m.type === 'corretiva') {
      somaCorretiva += val;
    } else {
      somaPreventiva += val;
    }
  }

  const custoManutencaoPreventiva = Number(somaPreventiva.toFixed(2));
  const custoManutencaoCorretiva = Number(somaCorretiva.toFixed(2));
  const custoManutencaoTotal = Number(
    (custoManutencaoPreventiva + custoManutencaoCorretiva).toFixed(2),
  );

  const custoTotal = Number(
    (custoCombustivel + custoManutencaoTotal + custoOutrasDespesas + custoFixoProporcional).toFixed(
      2,
    ),
  );

  // US24.3: Evita divisão por zero quando não há km rodado no período
  if (kmRodados <= 0) {
    return {
      custoTotal,
      custoCombustivel,
      custoManutencaoTotal,
      custoManutencaoPreventiva,
      custoManutencaoCorretiva,
      custoOutrasDespesas,
      custoFixoProporcional,
      custoKmTotal: 0,
      custoKmCombustivel: 0,
      custoKmManutencaoTotal: 0,
      custoKmManutencaoPreventiva: 0,
      custoKmManutencaoCorretiva: 0,
    };
  }

  return {
    custoTotal,
    custoCombustivel,
    custoManutencaoTotal,
    custoManutencaoPreventiva,
    custoManutencaoCorretiva,
    custoOutrasDespesas,
    custoFixoProporcional,
    custoKmTotal: Number((custoTotal / kmRodados).toFixed(2)),
    custoKmCombustivel: Number((custoCombustivel / kmRodados).toFixed(2)),
    custoKmManutencaoTotal: Number((custoManutencaoTotal / kmRodados).toFixed(2)),
    custoKmManutencaoPreventiva: Number((custoManutencaoPreventiva / kmRodados).toFixed(2)),
    custoKmManutencaoCorretiva: Number((custoManutencaoCorretiva / kmRodados).toFixed(2)),
  };
}

/**
 * US24.1 & US24.3: Consolida de forma pura os indicadores de uso e custo de um período,
 * unificando as leituras de hodômetro com eventuais hodômetros informados em abastecimentos e manutenções.
 */
export function calcularIndicadoresUsoECustoPuro(
  params: CalcularIndicadoresUsoECustoPuroParams,
): UsageAndCostIndicators {
  const {
    inicio,
    fim,
    leituras = [],
    abastecimentos = [],
    manutencoes = [],
    despesas = [],
    custoFixoProporcional = 0,
  } = params;

  const semDados =
    leituras.length === 0 &&
    abastecimentos.length === 0 &&
    manutencoes.length === 0 &&
    despesas.length === 0 &&
    custoFixoProporcional === 0;

  // Consolida leituras explícitas de hodômetro e leituras vindas de abastecimentos/manutenções no período
  const todasLeituras: LeituraHodometroInput[] = [...leituras];

  for (const ab of abastecimentos) {
    if (ab.odometer && ab.date) {
      todasLeituras.push({ km: ab.odometer, date: ab.date });
    }
  }
  for (const m of manutencoes) {
    if (m.odometer && m.date) {
      todasLeituras.push({ km: m.odometer, date: m.date });
    }
  }

  const uso = calcularIndicadoresUso(todasLeituras);

  const custoCombustivel = abastecimentos.reduce(
    (acc, curr) => acc + (Number(curr.totalValue) || 0),
    0,
  );

  // Soma despesas que não sejam Combustível nem Manutenção (para não duplicar)
  const custoOutrasDespesas = despesas
    .filter(d => d.category !== 'Combustível' && d.category !== 'Manutenção')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const custo = calcularCustoPorKm({
    kmRodados: uso.kmRodados,
    custoCombustivel,
    manutencoes,
    custoOutrasDespesas,
    custoFixoProporcional,
  });

  return {
    inicio,
    fim,
    uso,
    custo,
    semDados,
    semKmRodado: !uso.possuiKmRodado,
  };
}

/**
 * US24.2: Resolve o intervalo de datas (YYYY-MM-DD) para um filtro de período predefinido.
 * O padrão é 'mes_atual' (mês atual por padrão).
 */
export function resolverIntervaloPeriodo(
  preset: IndicatorPeriodPreset = 'mes_atual',
  dataReferencia: Date = new Date(),
): { inicio: string; fim: string; label: string } {
  const year = dataReferencia.getUTCFullYear();
  const month = dataReferencia.getUTCMonth(); // 0-11

  if (preset === 'mes_atual') {
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { inicio: startStr, fim: endStr, label: 'Mês Atual' };
  }

  const endStr = dataReferencia.toISOString().split('T')[0];

  if (preset === 'ultimos_30_dias') {
    const startMs = dataReferencia.getTime() - 30 * 24 * 60 * 60 * 1000;
    const startStr = new Date(startMs).toISOString().split('T')[0];
    return { inicio: startStr, fim: endStr, label: 'Últimos 30 dias' };
  }

  if (preset === 'ultimos_90_dias') {
    const startMs = dataReferencia.getTime() - 90 * 24 * 60 * 60 * 1000;
    const startStr = new Date(startMs).toISOString().split('T')[0];
    return { inicio: startStr, fim: endStr, label: 'Últimos 90 dias' };
  }

  // ano_atual
  const startStr = `${year}-01-01`;
  const endYearStr = `${year}-12-31`;
  return { inicio: startStr, fim: endYearStr, label: 'Ano Atual' };
}

function normalizeDateRange(inicio: string | Date, fim: string | Date): { start: Date; end: Date } {
  let start = new Date(inicio);
  let end = new Date(fim);

  if (typeof fim === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fim.trim())) {
    end = new Date(`${fim.trim()}T23:59:59.999Z`);
  }
  if (typeof inicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inicio.trim())) {
    start = new Date(`${inicio.trim()}T00:00:00.000Z`);
  }

  return { start, end };
}

/**
 * US24.1, US24.2 & US23.3: Serviço de aplicação que consulta os repositórios locais,
 * a camada de agregação da US22.4 (obterDetalhamentoGastosDoPeriodo) e os custos fixos
 * da US23 (valor cheio em período mensal ou proporcional aos dias em outros períodos)
 * para retornar os indicadores consolidados.
 */
export async function obterIndicadoresUsoECustoDoPeriodo(
  veiculo: string | { id: string },
  inicio: string | Date,
  fim: string | Date,
  custoFixoProporcionalOverride?: number,
): Promise<UsageAndCostIndicators> {
  const vehicleId = typeof veiculo === 'string' ? veiculo : veiculo.id;
  const { start, end } = normalizeDateRange(inicio, fim);

  const { FixedCostService } = await import('./fixedCostService');

  const [detalhamentoGastos, leiturasHodometro, custoFixoCalculado] = await Promise.all([
    obterDetalhamentoGastosDoPeriodo(vehicleId, inicio, fim),
    OdometerRepository.listByVehicleAndPeriod(vehicleId, start, end),
    custoFixoProporcionalOverride !== undefined
      ? Promise.resolve(custoFixoProporcionalOverride)
      : FixedCostService.getPeriodTotalByVehicle(vehicleId, inicio, fim),
  ]);

  const inicioStr = typeof inicio === 'string' ? inicio : start.toISOString().split('T')[0];
  const fimStr = typeof fim === 'string' ? fim : end.toISOString().split('T')[0];

  return calcularIndicadoresUsoECustoPuro({
    inicio: inicioStr,
    fim: fimStr,
    leituras: leiturasHodometro,
    abastecimentos: detalhamentoGastos.abastecimentos,
    manutencoes: detalhamentoGastos.manutencoes,
    despesas: detalhamentoGastos.despesas,
    custoFixoProporcional: custoFixoCalculado,
  });
}
