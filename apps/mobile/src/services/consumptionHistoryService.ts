import { Refuel, ConsumptionUnit } from '@autogest/shared-types';
import { formatarConsumo } from './preferencesService';
import { LineChartPoint } from '../components/charts/InteractiveCharts';

export type ConsumoGranularidade = 'diaria' | 'semanal' | 'mensal';

export interface ConsumoPeriodoAgrupado {
  chave: string; // Ex: '2026-03-10' | '2026-W45' | '2026-11'
  rotuloCurto: string; // Ex: '10/03' | 'Sem 45' | 'Nov/26'
  dataInicioIso: string;
  consumoMedioKml: number;
  totalLitros: number;
  qtdAbastecimentos: number;
}

export interface ConsumoPontoGrafico extends LineChartPoint {
  chavePeriodo: string;
  litros?: number;
}

/**
 * US25.1: Calcula a média móvel de uma série de números com uma janela fixa (padrão 5).
 * Se houver menos de 5 pontos acumulados até a posição atual, utiliza os pontos disponíveis.
 */
export function mediaMovel(valores: number[], janela: number = 5): number[] {
  if (!valores || valores.length === 0) return [];
  if (valores.length === 1) return [Number(valores[0].toFixed(2))];

  const resultado: number[] = [];
  for (let i = 0; i < valores.length; i++) {
    const inicio = Math.max(0, i - janela + 1);
    const sub = valores.slice(inicio, i + 1);
    const soma = sub.reduce((acc, curr) => acc + curr, 0);
    const media = soma / sub.length;
    resultado.push(Number(media.toFixed(2)));
  }

  return resultado;
}

/**
 * Converte data ISO para número de semana ISO (segunda a domingo, conforme ISO 8601).
 */
export function getIsoWeekKey(date: Date): { chave: string; rotulo: string } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // O dia 0 é domingo; na semana ISO domingo é 7
  const dayNum = d.getUTCDay() || 7;
  // Move para a quinta-feira da mesma semana para definir o ano ISO
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekStr = String(weekNo).padStart(2, '0');
  return {
    chave: `${d.getUTCFullYear()}-W${weekStr}`,
    rotulo: `Sem ${weekStr}`,
  };
}

/**
 * US25.1: Agrupa abastecimentos que possuem consumo apurado (calculatedKml > 0)
 * por granularidade: diária, semanal (semana ISO iniciando na segunda) ou mensal.
 */
export function agruparConsumoPorPeriodo(
  abastecimentos: Refuel[],
  granularidade: ConsumoGranularidade,
): ConsumoPeriodoAgrupado[] {
  if (!abastecimentos || abastecimentos.length === 0) return [];

  // Filtra apenas registros válidos com consumo numérico > 0 e ordena cronologicamente
  const validos = abastecimentos
    .filter(
      r =>
        !r.deletedAt &&
        r.calculatedKml !== null &&
        r.calculatedKml !== undefined &&
        Number.isFinite(r.calculatedKml) &&
        r.calculatedKml > 0,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (validos.length === 0) return [];

  const grupos = new Map<
    string,
    {
      chave: string;
      rotuloCurto: string;
      dataInicioIso: string;
      consumos: number[];
      litros: number;
    }
  >();

  for (const item of validos) {
    const d = new Date(item.date);
    let chave = '';
    let rotuloCurto = '';

    if (granularidade === 'diaria') {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      chave = `${yyyy}-${mm}-${dd}`;
      rotuloCurto = `${dd}/${mm}`;
    } else if (granularidade === 'semanal') {
      const isoInfo = getIsoWeekKey(d);
      chave = isoInfo.chave;
      rotuloCurto = isoInfo.rotulo;
    } else {
      // mensal
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      chave = `${yyyy}-${mm}`;
      const shortYear = String(yyyy).slice(-2);
      const nomesMes = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ];
      rotuloCurto = `${nomesMes[d.getUTCMonth()]}/${shortYear}`;
    }

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        rotuloCurto,
        dataInicioIso: item.date,
        consumos: [item.calculatedKml!],
        litros: item.liters || 0,
      });
    } else {
      const g = grupos.get(chave)!;
      g.consumos.push(item.calculatedKml!);
      g.litros += item.liters || 0;
    }
  }

  const agrupados: ConsumoPeriodoAgrupado[] = [];
  for (const g of grupos.values()) {
    const media = g.consumos.reduce((a, b) => a + b, 0) / g.consumos.length;
    agrupados.push({
      chave: g.chave,
      rotuloCurto: g.rotuloCurto,
      dataInicioIso: g.dataInicioIso,
      consumoMedioKml: Number(media.toFixed(2)),
      totalLitros: Number(g.litros.toFixed(2)),
      qtdAbastecimentos: g.consumos.length,
    });
  }

  // Ordena cronologicamente pela data de início
  return agrupados.sort(
    (a, b) => new Date(a.dataInicioIso).getTime() - new Date(b.dataInicioIso).getTime(),
  );
}

/**
 * US25.3: Limite máximo padrão da janela de pontos visíveis por granularidade:
 * - diária: 30 dias
 * - semanal: 12 semanas
 * - mensal: 12 meses
 */
export const JANELAS_PADRAO_PONTOS: Record<ConsumoGranularidade, number> = {
  diaria: 30,
  semanal: 12,
  mensal: 12,
};

/**
 * US25.2, US25.3 & US25.4: Transforma os abastecimentos na série completa de pontos
 * pronta para o componente `InteractiveLineChart`, integrando `formatarConsumo` e `mediaMovel`.
 */
export function gerarPontosGraficoConsumo(
  abastecimentos: Refuel[],
  granularidade: ConsumoGranularidade = 'diaria',
  unidadePrincipal?: ConsumptionUnit,
): ConsumoPontoGrafico[] {
  const agrupados = agruparConsumoPorPeriodo(abastecimentos, granularidade);
  if (agrupados.length === 0) return [];

  // Aplica a janela padrão (pega os N mais recentes)
  const maxJanela = JANELAS_PADRAO_PONTOS[granularidade] || 30;
  const selecionados =
    agrupados.length > maxJanela ? agrupados.slice(agrupados.length - maxJanela) : agrupados;

  const valoresKml = selecionados.map(s => s.consumoMedioKml);
  const mmValores = mediaMovel(valoresKml, 5);

  return selecionados.map((item, index) => {
    const kml = item.consumoMedioKml;
    const mm = mmValores[index];

    return {
      id: `pt_${granularidade}_${item.chave}`,
      chavePeriodo: item.chave,
      label: item.rotuloCurto,
      value: kml,
      movingAverage: mm,
      formattedValue: formatarConsumo(kml, unidadePrincipal),
      formattedMovingAverage: formatarConsumo(mm, unidadePrincipal),
      litros: item.totalLitros,
    };
  });
}
