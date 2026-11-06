import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import {
  CHART_LIBRARY_DECISION,
  CATEGORY_CHART_COLORS,
  getCategoryChartColor,
  PieChartSliceItem,
  BarChartItem,
  LineChartPoint,
} from '../../services/chartSpike';

export { CHART_LIBRARY_DECISION, CATEGORY_CHART_COLORS, getCategoryChartColor };
export type { PieChartSliceItem, BarChartItem, LineChartPoint };

export interface InteractivePieChartProps {
  data: PieChartSliceItem[];
  totalFormatted?: string;
  selectedId?: string | null;
  onSelectSlice?: (slice: PieChartSliceItem) => void;
}

export const InteractivePieChart: React.FC<InteractivePieChartProps> = ({
  data,
  totalFormatted,
  selectedId,
  onSelectSlice,
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedId ?? (data[0]?.id || null),
  );

  const activeId = selectedId !== undefined ? selectedId : internalSelectedId;
  const activeSlice = useMemo(
    () => data.find(item => item.id === activeId) || data[0] || null,
    [data, activeId],
  );

  const handlePress = (slice: PieChartSliceItem) => {
    setInternalSelectedId(slice.id);
    onSelectSlice?.(slice);
  };

  if (data.length === 0) {
    return (
      <View style={styles.emptyBox} accessibilityLabel="pie-chart-empty">
        <Text style={styles.emptyText}>Sem dados para exibir no gráfico de setores.</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartCard} accessibilityLabel="interactive-pie-chart">
      {/* Anel proporcional segmentado + Centro do Donut */}
      <View style={styles.pieHeaderRow}>
        <View
          style={[
            styles.donutSummaryCircle,
            activeSlice?.color ? { borderColor: activeSlice.color } : { borderColor: colors.lime },
          ]}
        >
          <Text style={styles.donutCenterLabel}>
            {activeSlice ? activeSlice.label.toUpperCase() : 'TOTAL'}
          </Text>
          <Text style={styles.donutCenterPercent}>
            {activeSlice ? `${activeSlice.percentage}%` : '100%'}
          </Text>
          {activeSlice?.formattedValue ? (
            <Text style={styles.donutCenterTotal}>{activeSlice.formattedValue}</Text>
          ) : totalFormatted ? (
            <Text style={styles.donutCenterTotal}>{totalFormatted}</Text>
          ) : null}
        </View>
      </View>

      {/* Barra de setores proporcionais interativa (toque por fatia) */}
      <View style={styles.segmentedRingBar}>
        {data.map((slice, idx) => {
          const sliceColor = slice.color || getCategoryChartColor(slice.label, idx);
          const isSelected = activeSlice?.id === slice.id;
          return (
            <TouchableOpacity
              key={slice.id}
              style={[
                styles.segmentSlice,
                {
                  flex: Math.max(slice.percentage, 3),
                  backgroundColor: sliceColor,
                  opacity: isSelected ? 1 : 0.68,
                  transform: [{ scaleY: isSelected ? 1.25 : 1 }],
                },
              ]}
              onPress={() => handlePress(slice)}
              activeOpacity={0.8}
              accessibilityLabel={`setor-${slice.label}-${slice.percentage}%`}
            />
          );
        })}
      </View>

      {/* Legenda interativa com destaque ao toque */}
      <View style={styles.legendGrid}>
        {data.map((slice, idx) => {
          const sliceColor = slice.color || getCategoryChartColor(slice.label, idx);
          const isSelected = activeSlice?.id === slice.id;
          return (
            <TouchableOpacity
              key={slice.id}
              style={[styles.legendItem, isSelected && styles.legendItemSelected]}
              onPress={() => handlePress(slice)}
              activeOpacity={0.75}
              accessibilityLabel={`legenda-${slice.label}`}
            >
              <View style={[styles.legendDot, { backgroundColor: sliceColor }]} />
              <View style={styles.legendTextCol}>
                <Text style={styles.legendLabel}>{slice.label}</Text>
                {slice.formattedValue ? (
                  <Text style={styles.legendValue}>{slice.formattedValue}</Text>
                ) : null}
                <Text style={styles.legendPercent}>{slice.percentage}%</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export interface InteractiveBarChartProps {
  data: BarChartItem[];
  selectedId?: string | null;
  onSelectBar?: (bar: BarChartItem) => void;
}

export const InteractiveBarChart: React.FC<InteractiveBarChartProps> = ({
  data,
  selectedId,
  onSelectBar,
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedId ?? (data[0]?.id || null),
  );

  const activeId = selectedId !== undefined ? selectedId : internalSelectedId;
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);

  const handlePress = (bar: BarChartItem) => {
    setInternalSelectedId(bar.id);
    onSelectBar?.(bar);
  };

  if (data.length === 0) {
    return (
      <View style={styles.emptyBox} accessibilityLabel="bar-chart-empty">
        <Text style={styles.emptyText}>Sem dados para exibir no gráfico de barras.</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartCard} accessibilityLabel="interactive-bar-chart">
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.barScrollContent}
      >
        {data.map((item, idx) => {
          const barColor = item.color || getCategoryChartColor(item.label, idx);
          const isSelected = activeId === item.id;
          const heightPercent = Math.max(Math.round((item.value / maxValue) * 100), 8);

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.barColumn, isSelected && styles.barColumnSelected]}
              onPress={() => handlePress(item)}
              activeOpacity={0.8}
              accessibilityLabel={`barra-${item.label}-${item.formattedValue}`}
            >
              <Text style={[styles.barTopValue, isSelected && styles.barTopValueSelected]}>
                {item.percentage !== undefined ? `${item.percentage}%` : item.formattedValue}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${heightPercent}%`,
                      backgroundColor: barColor,
                      opacity: isSelected ? 1 : 0.72,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barBottomLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Legenda interativa com cor fixa por categoria (acessível para daltônicos) */}
      <View style={styles.legendGrid}>
        {data.map((item, idx) => {
          const barColor = item.color || getCategoryChartColor(item.label, idx);
          const isSelected = activeId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.legendItem, isSelected && styles.legendItemSelected]}
              onPress={() => handlePress(item)}
              activeOpacity={0.75}
              accessibilityLabel={`legenda-barra-${item.label}`}
            >
              <View style={[styles.legendDot, { backgroundColor: barColor }]} />
              <View style={styles.legendTextCol}>
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendValue}>{item.formattedValue}</Text>
                {item.percentage !== undefined ? (
                  <Text style={styles.legendPercent}>{item.percentage}%</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export interface InteractiveLineChartProps {
  data: LineChartPoint[];
  selectedId?: string | null;
  onSelectPoint?: (point: LineChartPoint) => void;
}

export const InteractiveLineChart: React.FC<InteractiveLineChartProps> = ({
  data,
  selectedId,
  onSelectPoint,
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedId ?? (data[data.length - 1]?.id || null),
  );

  const activeId = selectedId !== undefined ? selectedId : internalSelectedId;
  const activePoint = useMemo(
    () => data.find(p => p.id === activeId) || data[data.length - 1] || null,
    [data, activeId],
  );

  const { minVal, maxVal } = useMemo(() => {
    if (data.length === 0) return { minVal: 0, maxVal: 1 };
    const allVals: number[] = [];
    for (const p of data) {
      allVals.push(p.value);
      if (typeof p.movingAverage === 'number') {
        allVals.push(p.movingAverage);
      }
    }
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    return {
      minVal: Math.max(0, min * 0.85),
      maxVal: max === min ? max + 1 : max * 1.1,
    };
  }, [data]);

  const handlePress = (point: LineChartPoint) => {
    setInternalSelectedId(point.id);
    onSelectPoint?.(point);
  };

  if (data.length === 0) {
    return (
      <View style={styles.emptyBox} accessibilityLabel="line-chart-empty">
        <Text style={styles.emptyText}>Sem dados para exibir no gráfico de linha.</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartCard} accessibilityLabel="interactive-line-chart">
      {/* Tooltip do ponto selecionado */}
      {activePoint && (
        <View style={styles.tooltipBanner} accessibilityLabel="line-chart-tooltip">
          <Text style={styles.tooltipDate}>{activePoint.label}</Text>
          <Text style={styles.tooltipPrimary}>Consumo: {activePoint.formattedValue}</Text>
          {activePoint.formattedMovingAverage && (
            <Text style={styles.tooltipSecondary}>
              Média móvel: {activePoint.formattedMovingAverage}
            </Text>
          )}
        </View>
      )}

      {/* Área rolável horizontalmente (otimizada para 360dp @ 120Hz no Samsung S20 FE) */}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lineScrollContent}
      >
        {data.map(point => {
          const isSelected = activePoint?.id === point.id;
          const span = Math.max(maxVal - minVal, 0.001);
          const pointBottomPct = Math.min(
            92,
            Math.max(8, Math.round(((point.value - minVal) / span) * 84 + 8)),
          );
          const maBottomPct =
            typeof point.movingAverage === 'number'
              ? Math.min(
                  92,
                  Math.max(8, Math.round(((point.movingAverage - minVal) / span) * 84 + 8)),
                )
              : null;

          return (
            <TouchableOpacity
              key={point.id}
              style={[styles.lineColumn, isSelected && styles.lineColumnSelected]}
              onPress={() => handlePress(point)}
              activeOpacity={0.75}
              accessibilityLabel={`ponto-${point.label}-${point.formattedValue}`}
            >
              <View style={styles.lineCanvasArea}>
                {/* Guia vertical sutil */}
                <View style={[styles.verticalGuide, isSelected && styles.verticalGuideActive]} />

                {/* Ponto da Média Móvel (série secundária) */}
                {maBottomPct !== null && (
                  <View style={[styles.movingAvgNode, { bottom: `${maBottomPct}%` }]} />
                )}

                {/* Ponto principal de Consumo (série primária em AutoGest Lime) */}
                <View
                  style={[
                    styles.primaryLineNode,
                    isSelected && styles.primaryLineNodeSelected,
                    { bottom: `${pointBottomPct}%` },
                  ]}
                />
              </View>
              <Text style={[styles.lineXLabel, isSelected && styles.lineXLabelSelected]}>
                {point.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pieHeaderRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  donutSummaryCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 6,
    borderColor: colors.lime,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  donutCenterLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  donutCenterPercent: {
    ...typography.h2,
    color: colors.lime,
    marginTop: 2,
  },
  donutCenterTotal: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 11,
    marginTop: 2,
  },
  segmentedRingBar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.md,
    gap: 2,
  },
  segmentSlice: {
    height: '100%',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  legendItemSelected: {
    borderColor: colors.lime,
    backgroundColor: colors.limeGlow,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendTextCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 12,
  },
  legendValue: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  legendPercent: {
    ...typography.captionBold,
    color: colors.lime,
    fontSize: 12,
  },
  barScrollContent: {
    alignItems: 'flex-end',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  barColumn: {
    width: 64,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  barColumnSelected: {
    backgroundColor: colors.limeGlow,
  },
  barTopValue: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 6,
  },
  barTopValueSelected: {
    ...typography.captionBold,
    color: colors.lime,
  },
  barTrack: {
    width: 28,
    height: 140,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: radius.sm,
  },
  barBottomLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 11,
    marginTop: 6,
  },
  tooltipBanner: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tooltipDate: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  tooltipPrimary: {
    ...typography.captionBold,
    color: colors.lime,
  },
  tooltipSecondary: {
    ...typography.caption,
    color: '#56B4E9',
  },
  lineScrollContent: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  lineColumn: {
    width: 54,
    alignItems: 'center',
  },
  lineColumnSelected: {
    backgroundColor: colors.limeGlow,
    borderRadius: radius.sm,
  },
  lineCanvasArea: {
    width: '100%',
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  verticalGuide: {
    width: 1,
    height: '100%',
    backgroundColor: colors.borderSubtle,
  },
  verticalGuideActive: {
    backgroundColor: colors.lime,
    width: 1.5,
  },
  primaryLineNode: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.lime,
  },
  primaryLineNodeSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  movingAvgNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#56B4E9',
  },
  lineXLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  lineXLabelSelected: {
    ...typography.captionBold,
    color: colors.lime,
  },
});
