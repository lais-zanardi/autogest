import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {
  Vehicle,
  IndicatorPeriodPreset,
  CategoryDistributionItem,
  CategoryDistributionResult,
} from '@autogest/shared-types';
import {
  distribuicaoPorCategoria,
  obterDetalhamentoGastosDoPeriodo,
  GastosDetalhadosPeriodo,
} from '../services/expenseAggregation';
import { FixedCostService } from '../services/fixedCostService';
import { resolverIntervaloPeriodo } from '../services/usageAndCostIndicators';
import { InteractivePieChart, InteractiveBarChart } from './charts/InteractiveCharts';
import { formatCurrency } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';

export type CategoryChartMode = 'setores' | 'barras';

export interface ExpenseCategoryChartCardProps {
  vehicle: Vehicle | null;
  externalRange?: {
    inicio: string;
    fim: string;
    label?: string;
  };
  refreshTrigger?: number;
  onOpenFullScreen?: () => void;
}

const PERIOD_OPTIONS: { key: IndicatorPeriodPreset; label: string }[] = [
  { key: 'mes_atual', label: 'Mês Atual' },
  { key: 'mes_anterior', label: 'Mês Anterior' },
  { key: 'personalizado', label: 'Personalizado' },
];

export const ExpenseCategoryChartCard: React.FC<ExpenseCategoryChartCardProps> = ({
  vehicle,
  externalRange,
  refreshTrigger = 0,
  onOpenFullScreen,
}) => {
  const defaultRange = useMemo(() => resolverIntervaloPeriodo('mes_atual', new Date()), []);

  const [selectedPreset, setSelectedPreset] = useState<IndicatorPeriodPreset>('mes_atual');
  const [customStart, setCustomStart] = useState<string>(defaultRange.inicio);
  const [customEnd, setCustomEnd] = useState<string>(defaultRange.fim);

  const [chartMode, setChartMode] = useState<CategoryChartMode>('setores');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [rawBreakdown, setRawBreakdown] = useState<GastosDetalhadosPeriodo | null>(null);
  const [rawFixedCosts, setRawFixedCosts] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const resolvedRange = useMemo(() => {
    if (selectedPreset === 'mes_atual' && externalRange) {
      return {
        inicio: externalRange.inicio,
        fim: externalRange.fim,
        label: externalRange.label || 'Mês Atual',
      };
    }
    return resolverIntervaloPeriodo(selectedPreset, new Date(), {
      inicio: customStart,
      fim: customEnd,
    });
  }, [selectedPreset, externalRange, customStart, customEnd]);

  const loadPeriodExpenses = useCallback(async () => {
    if (!vehicle) {
      setRawBreakdown(null);
      setRawFixedCosts(0);
      return;
    }

    setLoading(true);
    try {
      const [detalhamento, custoFixoPeriodo] = await Promise.all([
        obterDetalhamentoGastosDoPeriodo(vehicle.id, resolvedRange.inicio, resolvedRange.fim),
        FixedCostService.getPeriodTotalByVehicle(
          vehicle.id,
          resolvedRange.inicio,
          resolvedRange.fim,
        ),
      ]);
      setRawBreakdown(detalhamento);
      setRawFixedCosts(custoFixoPeriodo);
    } catch (err) {
      console.error('Erro ao carregar gastos por categoria:', err);
    } finally {
      setLoading(false);
    }
  }, [vehicle, resolvedRange.inicio, resolvedRange.fim]);

  useEffect(() => {
    loadPeriodExpenses();
  }, [loadPeriodExpenses, refreshTrigger]);

  // US14.5: Memoização para não recalcular distribuicaoPorCategoria a cada render (ex.: alternância de aba ou toque)
  const distribuicao: CategoryDistributionResult = useMemo(() => {
    if (!rawBreakdown) {
      return { total: 0, somaPercentuais: 0, itens: [] };
    }
    return distribuicaoPorCategoria(rawBreakdown.porCategoria, {
      custosFixos: rawFixedCosts,
    });
  }, [rawBreakdown, rawFixedCosts]);

  // Categoria destacada (primeira categoria por padrão quando houver itens)
  const highlightedItem: CategoryDistributionItem | null = useMemo(() => {
    if (distribuicao.itens.length === 0) return null;
    if (selectedCategoryId) {
      const found = distribuicao.itens.find(item => item.id === selectedCategoryId);
      if (found) return found;
    }
    return distribuicao.itens[0];
  }, [distribuicao.itens, selectedCategoryId]);

  if (!vehicle) {
    return null;
  }

  return (
    <View style={styles.container} accessibilityLabel="gastos-por-categoria-card">
      {/* Cabeçalho e alternador de tipo de gráfico (US14.2) */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>DISTRIBUIÇÃO PERCENTUAL</Text>
          <Text style={styles.title}>Gastos por categoria</Text>
        </View>

        <View style={styles.chartToggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, chartMode === 'setores' && styles.toggleBtnActive]}
            onPress={() => setChartMode('setores')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: chartMode === 'setores' }}
            accessibilityLabel="Visualizar gráfico de setores"
          >
            <Text
              style={[styles.toggleBtnText, chartMode === 'setores' && styles.toggleBtnTextActive]}
            >
              Setores
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, chartMode === 'barras' && styles.toggleBtnActive]}
            onPress={() => setChartMode('barras')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: chartMode === 'barras' }}
            accessibilityLabel="Visualizar gráfico de barras"
          >
            <Text
              style={[styles.toggleBtnText, chartMode === 'barras' && styles.toggleBtnTextActive]}
            >
              Barras
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Seletor de Período reaproveitado da US24 (US14.3: mês atual, mês anterior e personalizado) */}
      <View style={styles.filterRow}>
        {PERIOD_OPTIONS.map(option => {
          const isSelected = selectedPreset === option.key;
          const displayLabel =
            option.key === 'mes_atual' && externalRange?.label ? externalRange.label : option.label;

          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => setSelectedPreset(option.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Período ${displayLabel}`}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                {displayLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Campos de intervalo personalizado (US14.3) */}
      {selectedPreset === 'personalizado' && (
        <View style={styles.customPeriodBox}>
          <View style={styles.customDateCol}>
            <Text style={styles.customDateLabel}>Início (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.customDateInput}
              value={customStart}
              onChangeText={setCustomStart}
              placeholder="2026-05-01"
              placeholderTextColor={colors.textMuted}
              maxLength={10}
              accessibilityLabel="Data inicial do período personalizado"
            />
          </View>
          <View style={styles.customDateCol}>
            <Text style={styles.customDateLabel}>Fim (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.customDateInput}
              value={customEnd}
              onChangeText={setCustomEnd}
              placeholder="2026-05-31"
              placeholderTextColor={colors.textMuted}
              maxLength={10}
              accessibilityLabel="Data final do período personalizado"
            />
          </View>
        </View>
      )}

      {/* Total do período (US14.2) */}
      <View style={styles.totalPeriodBanner}>
        <View>
          <Text style={styles.totalPeriodLabel}>
            Total do período ({resolvedRange.inicio} a {resolvedRange.fim})
          </Text>
          <Text style={styles.totalPeriodValue}>{formatCurrency(distribuicao.total)}</Text>
        </View>
        {onOpenFullScreen && (
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={onOpenFullScreen}
            activeOpacity={0.75}
            accessibilityLabel="Expandir tela Gastos por categoria"
          >
            <Text style={styles.expandBtnText}>Expandir</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Estados de carregamento e vazio (US14.5) */}
      {loading ? (
        <View style={styles.loadingBox} accessibilityLabel="category-chart-loading">
          <ActivityIndicator size="small" color={colors.lime} />
          <Text style={styles.loadingText}>Calculando distribuição por categoria...</Text>
        </View>
      ) : distribuicao.itens.length === 0 ? (
        <View style={styles.emptyStateBox} accessibilityLabel="category-chart-empty">
          <Text style={styles.emptyStateTitle}>Nenhum gasto registrado neste período</Text>
          <Text style={styles.emptyStateText}>
            Registre abastecimentos, manutenções, despesas ou custos fixos para visualizar a
            distribuição percentual por categoria.
          </Text>
        </View>
      ) : (
        <>
          {/* Painel de destaque interativo ao tocar em setor ou barra (US14.4) */}
          {highlightedItem && (
            <View
              style={[styles.highlightBanner, { borderColor: highlightedItem.cor }]}
              accessibilityLabel={`destaque-categoria-${highlightedItem.categoria}`}
            >
              <View style={styles.highlightLeft}>
                <View
                  style={[styles.highlightColorBadge, { backgroundColor: highlightedItem.cor }]}
                />
                <View>
                  <Text style={styles.highlightCategoryLabel}>CATEGORIA SELECIONADA</Text>
                  <Text style={styles.highlightCategoryName}>{highlightedItem.categoria}</Text>
                </View>
              </View>
              <View style={styles.highlightRight}>
                <Text style={styles.highlightValue}>{highlightedItem.valorFormatado}</Text>
                <Text style={[styles.highlightPercent, { color: highlightedItem.cor }]}>
                  {highlightedItem.percentual}% do total
                </Text>
              </View>
            </View>
          )}

          {/* Gráfico interativo alternável: Setores ou Barras (US14.2 & US14.4) */}
          {chartMode === 'setores' ? (
            <InteractivePieChart
              data={distribuicao.itens}
              totalFormatted={formatCurrency(distribuicao.total)}
              selectedId={highlightedItem?.id ?? null}
              onSelectSlice={slice => setSelectedCategoryId(slice.id)}
            />
          ) : (
            <InteractiveBarChart
              data={distribuicao.itens}
              selectedId={highlightedItem?.id ?? null}
              onSelectBar={bar => setSelectedCategoryId(bar.id)}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
  },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    marginBottom: 4,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  chartToggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  toggleBtnActive: {
    backgroundColor: colors.lime,
  },
  toggleBtnText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  toggleBtnTextActive: {
    color: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: colors.limeGlow,
    borderColor: colors.lime,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  filterChipTextActive: {
    ...typography.captionBold,
    color: colors.lime,
    fontSize: 12,
  },
  customPeriodBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  customDateCol: {
    flex: 1,
  },
  customDateLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 4,
  },
  customDateInput: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 13,
  },
  totalPeriodBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  totalPeriodLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  totalPeriodValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  expandBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lime,
    backgroundColor: colors.limeGlow,
  },
  expandBtnText: {
    ...typography.captionBold,
    color: colors.lime,
    fontSize: 11,
  },
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyStateBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emptyStateTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  highlightBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  highlightLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  highlightColorBadge: {
    width: 14,
    height: 36,
    borderRadius: radius.sm,
  },
  highlightCategoryLabel: {
    ...typography.sectionLabel,
    color: colors.textMuted,
    fontSize: 10,
  },
  highlightCategoryName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  highlightRight: {
    alignItems: 'flex-end',
  },
  highlightValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  highlightPercent: {
    ...typography.captionBold,
    fontSize: 12,
    marginTop: 2,
  },
});
