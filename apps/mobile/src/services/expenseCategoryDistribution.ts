import {
  CategoryDistributionItem,
  CategoryDistributionResult,
  ExpenseCategoryChartName,
} from '@autogest/shared-types';
import { getCategoryChartColor } from './chartSpike';
import { obterDetalhamentoGastosDoPeriodo, GastosDetalhadosPeriodo } from './expenseAggregation';
import { formatCurrency } from '../utils/formatters';

export type GastosPorCategoriaInput =
  Record<string, number> | GastosDetalhadosPeriodo | Array<{ categoria: string; valor: number }>;

export interface DistribuicaoPorCategoriaOptions {
  /** Valor de custos fixos do período (proporcional ou integral no mês) a incluir na categoria "Custos fixos" */
  custosFixos?: number;
}

function isGastosDetalhadosPeriodo(input: unknown): input is GastosDetalhadosPeriodo {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'porCategoria' in input &&
    typeof (input as GastosDetalhadosPeriodo).porCategoria === 'object'
  );
}

/**
 * US14.1: Calcula a distribuição percentual de gastos por categoria pelo
 * Método do Maior Resto (Largest Remainder / Método de Hamilton), garantindo
 * que a soma dos percentuais inteiros seja exatamente 100% quando há gastos.
 *
 * Categorias sem valor (<= 0) ficam de fora.
 * Custos fixos aparecem como a categoria "Custos fixos" quando > 0 (Decisão #6 / US14).
 */
export function distribuicaoPorCategoria(
  gastos: GastosPorCategoriaInput,
  opcoes?: DistribuicaoPorCategoriaOptions,
): CategoryDistributionResult {
  const mapaValores = new Map<string, number>();

  if (Array.isArray(gastos)) {
    for (const item of gastos) {
      if (item && typeof item.categoria === 'string' && Number.isFinite(item.valor)) {
        const atual = mapaValores.get(item.categoria) || 0;
        mapaValores.set(item.categoria, atual + item.valor);
      }
    }
  } else if (isGastosDetalhadosPeriodo(gastos)) {
    for (const [categoria, valor] of Object.entries(gastos.porCategoria)) {
      if (Number.isFinite(valor)) {
        mapaValores.set(categoria, (mapaValores.get(categoria) || 0) + valor);
      }
    }
  } else if (typeof gastos === 'object' && gastos !== null) {
    for (const [categoria, valor] of Object.entries(gastos)) {
      if (Number.isFinite(valor)) {
        mapaValores.set(categoria, (mapaValores.get(categoria) || 0) + valor);
      }
    }
  }

  if (
    opcoes?.custosFixos !== undefined &&
    Number.isFinite(opcoes.custosFixos) &&
    opcoes.custosFixos > 0
  ) {
    const atualCustosFixos = mapaValores.get('Custos fixos') || 0;
    mapaValores.set('Custos fixos', atualCustosFixos + opcoes.custosFixos);
  }

  // Filtrar categorias sem valor (<= 0) e arredondar valores monetários para 2 casas
  const entradasPositivas: Array<{
    categoria: ExpenseCategoryChartName;
    valor: number;
    ordemOriginal: number;
  }> = [];

  let idx = 0;
  for (const [categoria, valorBruto] of mapaValores.entries()) {
    const valor = Number(valorBruto.toFixed(2));
    if (valor > 0) {
      entradasPositivas.push({
        categoria,
        valor,
        ordemOriginal: idx++,
      });
    }
  }

  if (entradasPositivas.length === 0) {
    return {
      total: 0,
      somaPercentuais: 0,
      itens: [],
    };
  }

  // Ordenar por maior valor (desempate pela ordem de entrada)
  entradasPositivas.sort((a, b) => {
    if (b.valor !== a.valor) {
      return b.valor - a.valor;
    }
    return a.ordemOriginal - b.ordemOriginal;
  });

  const total = Number(entradasPositivas.reduce((acc, item) => acc + item.valor, 0).toFixed(2));

  // Categoria única recebe 100% diretamente
  if (entradasPositivas.length === 1) {
    const unica = entradasPositivas[0];
    const cor = getCategoryChartColor(unica.categoria, 0);
    const valorFormatado = formatCurrency(unica.valor);
    return {
      total,
      somaPercentuais: 100,
      itens: [
        {
          id: `cat-${unica.categoria}`,
          categoria: unica.categoria,
          label: unica.categoria,
          valor: unica.valor,
          value: unica.valor,
          valueCents: Math.round(unica.valor * 100),
          percentual: 100,
          percentage: 100,
          cor,
          color: cor,
          valorFormatado,
          formattedValue: valorFormatado,
        },
      ],
    };
  }

  // Método do Maior Resto (Largest Remainder / Hamilton Method) para somar exatamente 100%
  const cotas = entradasPositivas.map((entrada, index) => {
    const quotaExata = (entrada.valor / total) * 100;
    const piso = Math.floor(quotaExata);
    const resto = quotaExata - piso;
    return {
      ...entrada,
      index,
      piso,
      resto,
      percentualFinal: piso,
    };
  });

  const somaPisos = cotas.reduce((acc, c) => acc + c.piso, 0);
  const unidadesRestantes = Math.max(0, 100 - somaPisos);

  // Ordenar índices pelo maior resto fracionário (desempate por maior valor e menor índice)
  const ordenadosPorResto = [...cotas].sort((a, b) => {
    if (Math.abs(b.resto - a.resto) > 1e-9) {
      return b.resto - a.resto;
    }
    if (b.valor !== a.valor) {
      return b.valor - a.valor;
    }
    return a.index - b.index;
  });

  for (let i = 0; i < unidadesRestantes && i < ordenadosPorResto.length; i++) {
    ordenadosPorResto[i].percentualFinal += 1;
  }

  const itens: CategoryDistributionItem[] = cotas.map((item, pos) => {
    const cor = getCategoryChartColor(item.categoria, pos);
    const valorFormatado = formatCurrency(item.valor);
    return {
      id: `cat-${item.categoria}`,
      categoria: item.categoria,
      label: item.categoria,
      valor: item.valor,
      value: item.valor,
      valueCents: Math.round(item.valor * 100),
      percentual: item.percentualFinal,
      percentage: item.percentualFinal,
      cor,
      color: cor,
      valorFormatado,
      formattedValue: valorFormatado,
    };
  });

  const somaPercentuais = itens.reduce((acc, item) => acc + item.percentual, 0);

  return {
    total,
    somaPercentuais,
    itens,
  };
}

/**
 * US14.1 & US22.4: Consulta gastosDoPeriodo / obterDetalhamentoGastosDoPeriodo e os
 * custos fixos do veículo no intervalo, retornando a distribuição percentual por categoria.
 */
export async function obterDistribuicaoGastosPorCategoriaDoPeriodo(
  veiculo: string | { id: string },
  inicio: string | Date,
  fim: string | Date,
  custoFixoOverride?: number,
): Promise<CategoryDistributionResult> {
  const vehicleId = typeof veiculo === 'string' ? veiculo : veiculo.id;
  const { FixedCostService } = await import('./fixedCostService');

  const [detalhamento, custoFixoPeriodo] = await Promise.all([
    obterDetalhamentoGastosDoPeriodo(vehicleId, inicio, fim),
    custoFixoOverride !== undefined
      ? Promise.resolve(custoFixoOverride)
      : FixedCostService.getPeriodTotalByVehicle(vehicleId, inicio, fim),
  ]);

  return distribuicaoPorCategoria(detalhamento.porCategoria, {
    custosFixos: custoFixoPeriodo,
  });
}
