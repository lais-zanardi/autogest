/**
 * SPK.2 — Spike de Gráficos (Pizza/Setores, Barras e Linha com Média Móvel)
 * Dispositivo-alvo: Samsung Galaxy S20 FE (SM-G780G / SM-G780F)
 * Tela: 6.5" Super AMOLED FHD+ (1080×2400 px, viewport lógica 360×800 dp, taxa de atualização 120Hz, Android 13).
 *
 * Avalia e define a arquitetura única de gráficos para o React Native 0.72.6 (`InteractiveCharts` /
 * contrato compatível com `react-native-gifted-charts` + `react-native-svg`), garantindo:
 * 1. Renderização de gráficos de Pizza/Donut (US14), Barras (US14) e Linha dupla com Média Móvel (US25).
 * 2. Interação por toque em fatias, barras e pontos com feedback imediato.
 * 3. Rolagem horizontal fluida (`ScrollView horizontal` com `nestedScrollEnabled`) para séries temporais
 *    densas (30 dias, 12 semanas, 12 meses) na largura útil de 328dp (360dp - 32dp de padding) do S20 FE.
 * 4. Paleta fixa por categoria distinguível por daltônicos (escala Okabe-Ito adaptada ao tema escuro editorial).
 */

export const CHART_LIBRARY_DECISION = {
  chosenLibrary: 'react-native-gifted-charts + react-native-svg (encapsulada em InteractiveCharts)',
  reactNativeVersion: '0.72.6',
  targetDevice: 'Samsung Galaxy S20 FE (SM-G780G / 360x800 dp @ 120Hz)',
  viewportWidthDp: 360,
  viewportHeightDp: 800,
  usableCardWidthDp: 328,
  refreshRateHz: 120,
  supportedChartTypes: ['pie', 'bar', 'line'] as const,
  supportsTouch: true,
  supportsHorizontalScroll: true,
} as const;

/**
 * Paleta fixa por categoria, distinguível para deuteranopia/protanopia/tritanopia (Okabe-Ito + AutoGest Lime)
 */
export const CATEGORY_CHART_COLORS: Record<string, string> = {
  Combustível: '#C6FF4D', // AutoGest Lime (alto contraste em fundo #181B1D)
  Manutenção: '#56B4E9', // Sky Blue (Okabe-Ito)
  Imposto: '#E69F00', // Orange/Amber (Okabe-Ito)
  Seguro: '#009E73', // Bluish Green (Okabe-Ito)
  Lavagem: '#CC79A7', // Reddish Purple (Okabe-Ito)
  'Custos fixos': '#F0E442', // Yellow (Okabe-Ito)
  Outros: '#D55E00', // Vermilion (Okabe-Ito)
};

export function getCategoryChartColor(category: string, index = 0): string {
  if (CATEGORY_CHART_COLORS[category]) {
    return CATEGORY_CHART_COLORS[category];
  }
  if (category === 'Impostos') {
    return CATEGORY_CHART_COLORS['Imposto'];
  }
  const fallbackPalette = [
    '#C6FF4D',
    '#56B4E9',
    '#E69F00',
    '#009E73',
    '#CC79A7',
    '#F0E442',
    '#D55E00',
  ];
  return fallbackPalette[index % fallbackPalette.length];
}

export interface PieChartSliceItem {
  id: string;
  label: string;
  valueCents: number;
  value?: number;
  formattedValue?: string;
  percentage: number;
  color?: string;
}

export interface BarChartItem {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  percentage?: number;
  color?: string;
}

export interface LineChartPoint {
  id: string;
  label: string;
  value: number;
  movingAverage?: number | null;
  formattedValue: string;
  formattedMovingAverage?: string;
}

export interface S20FeScrollLayoutMetrics {
  itemCount: number;
  columnWidthDp: number;
  gapDp: number;
  totalContentWidthDp: number;
  requiresHorizontalScrollOnS20Fe: boolean;
}

/**
 * Calcula as métricas de rolagem horizontal para a largura útil do card no Samsung Galaxy S20 FE (328 dp).
 */
export function calculateS20FeHorizontalScrollMetrics(
  itemCount: number,
  columnWidthDp = 54,
  gapDp = 8,
): S20FeScrollLayoutMetrics {
  const count = Math.max(0, itemCount);
  const totalContentWidthDp =
    count === 0 ? 0 : count * columnWidthDp + Math.max(0, count - 1) * gapDp;
  return {
    itemCount: count,
    columnWidthDp,
    gapDp,
    totalContentWidthDp,
    requiresHorizontalScrollOnS20Fe: totalContentWidthDp > CHART_LIBRARY_DECISION.usableCardWidthDp,
  };
}
