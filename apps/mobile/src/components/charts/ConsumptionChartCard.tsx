import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Refuel, ConsumptionUnit } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../../theme';
import { InteractiveLineChart, LineChartPoint } from './InteractiveCharts';
import {
  ConsumoGranularidade,
  gerarPontosGraficoConsumo,
} from '../../services/consumptionHistoryService';

export interface ConsumptionChartCardProps {
  refuels: Refuel[];
  unidadePrincipal?: ConsumptionUnit;
  isLoading?: boolean;
}

export const ConsumptionChartCard: React.FC<ConsumptionChartCardProps> = ({
  refuels,
  unidadePrincipal,
  isLoading = false,
}) => {
  const [granularidade, setGranularidade] = useState<ConsumoGranularidade>('diaria');
  const [pontoSelecionado, setPontoSelecionado] = useState<LineChartPoint | null>(null);

  // Calcula a série com memoização
  const seriesData = useMemo(() => {
    return gerarPontosGraficoConsumo(refuels, granularidade, unidadePrincipal);
  }, [refuels, granularidade, unidadePrincipal]);

  // Ponto ativo: se não selecionado manualmente, foca no último da série
  const activePoint = useMemo(() => {
    if (seriesData.length === 0) return null;
    if (pontoSelecionado) {
      const found = seriesData.find(p => p.id === pontoSelecionado.id);
      if (found) return found;
    }
    return seriesData[seriesData.length - 1];
  }, [seriesData, pontoSelecionado]);

  return (
    <View style={styles.cardContainer} accessibilityLabel="card-grafico-consumo">
      {/* Header do Card com Título e Seletor de Granularidade */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardEyebrow}>ANÁLISE DE EFICIÊNCIA</Text>
          <Text style={styles.cardTitle}>Evolução de Consumo</Text>
        </View>

        {/* Seletor Diária / Semanal / Mensal (US25.3) */}
        <View style={styles.granularityToggle}>
          <TouchableOpacity
            style={[
              styles.granularityButton,
              granularidade === 'diaria' && styles.granularityButtonActive,
            ]}
            onPress={() => {
              setGranularidade('diaria');
              setPontoSelecionado(null);
            }}
            accessibilityLabel="Granularidade diária"
          >
            <Text
              style={[
                styles.granularityText,
                granularidade === 'diaria' && styles.granularityTextActive,
              ]}
            >
              Diária
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.granularityButton,
              granularidade === 'semanal' && styles.granularityButtonActive,
            ]}
            onPress={() => {
              setGranularidade('semanal');
              setPontoSelecionado(null);
            }}
            accessibilityLabel="Granularidade semanal"
          >
            <Text
              style={[
                styles.granularityText,
                granularidade === 'semanal' && styles.granularityTextActive,
              ]}
            >
              Semanal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.granularityButton,
              granularidade === 'mensal' && styles.granularityButtonActive,
            ]}
            onPress={() => {
              setGranularidade('mensal');
              setPontoSelecionado(null);
            }}
            accessibilityLabel="Granularidade mensal"
          >
            <Text
              style={[
                styles.granularityText,
                granularidade === 'mensal' && styles.granularityTextActive,
              ]}
            >
              Mensal
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legenda Explicativa de Cores */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.lime }]} />
          <Text style={styles.legendLabelText}>Consumo do Período</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicatorDashed, { borderColor: colors.amber }]} />
          <Text style={styles.legendLabelText}>Média Móvel (5 períodos)</Text>
        </View>
      </View>

      {/* Estado de Carregamento (US25.4) */}
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.lime} />
          <Text style={styles.stateText}>Processando histórico de consumo...</Text>
        </View>
      ) : seriesData.length === 0 ? (
        /* Estado Vazio (US25.4) */
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>Nenhum dado de consumo suficiente</Text>
          <Text style={styles.emptySubtitle}>
            Cadastre pelo menos dois abastecimentos com tanque cheio para calcular o rendimento ao
            longo do tempo.
          </Text>
        </View>
      ) : (
        /* Gráfico de Linha com Toque e Média Móvel (US25.2 & US25.4) */
        <View style={styles.chartWrapper}>
          <InteractiveLineChart
            data={seriesData}
            selectedId={activePoint?.id}
            onSelectPoint={pt => setPontoSelecionado(pt)}
          />

          {/* Destaque do Ponto Selecionado */}
          {activePoint && (
            <View style={styles.pointDetailCard}>
              <View style={styles.pointDetailRow}>
                <Text style={styles.pointPeriodLabel}>PERÍODO: {activePoint.label}</Text>
                <Text style={styles.pointKmlHighlight}>{activePoint.formattedValue}</Text>
              </View>
              {activePoint.formattedMovingAverage && (
                <View style={styles.pointMaRow}>
                  <Text style={styles.pointMaLabel}>Média Móvel Suavizada:</Text>
                  <Text style={styles.pointMaValue}>{activePoint.formattedMovingAverage}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  cardEyebrow: {
    ...typography.caption,
    color: colors.lime,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 2,
  },
  granularityToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  granularityButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  granularityButtonActive: {
    backgroundColor: colors.lime,
  },
  granularityText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  granularityTextActive: {
    color: colors.black,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 12,
    height: 4,
    borderRadius: 2,
  },
  legendIndicatorDashed: {
    width: 12,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendLabelText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  chartWrapper: {
    marginTop: spacing.xs,
  },
  centerState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  pointDetailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  pointDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointPeriodLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  pointKmlHighlight: {
    ...typography.bodyBold,
    color: colors.lime,
  },
  pointMaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 4,
  },
  pointMaLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pointMaValue: {
    ...typography.caption,
    color: colors.amber,
    fontWeight: '600',
  },
});
