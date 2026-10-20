import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Vehicle, IndicatorPeriodPreset, UsageAndCostIndicators } from '@autogest/shared-types';
import {
  obterIndicadoresUsoECustoDoPeriodo,
  resolverIntervaloPeriodo,
} from '../services/usageAndCostIndicators';
import { formatCurrency, formatDecimal } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';

interface UsageAndCostIndicatorsCardProps {
  vehicle: Vehicle | null;
  /**
   * Quando inicio e fim forem fornecidos externamente (ex.: navegador de mês da ReportsScreen),
   * o componente sincroniza com esse intervalo quando o filtro 'mes_atual' estiver ativo.
   */
  externalRange?: {
    inicio: string;
    fim: string;
    label?: string;
  };
  refreshTrigger?: number;
}

const PERIOD_OPTIONS: { key: IndicatorPeriodPreset; label: string }[] = [
  { key: 'mes_atual', label: 'Mês Atual' },
  { key: 'ultimos_30_dias', label: '30 Dias' },
  { key: 'ultimos_90_dias', label: '90 Dias' },
  { key: 'ano_atual', label: 'Ano Atual' },
];

export const UsageAndCostIndicatorsCard: React.FC<UsageAndCostIndicatorsCardProps> = ({
  vehicle,
  externalRange,
  refreshTrigger = 0,
}) => {
  // US24.2: Mês atual por padrão
  const [selectedPreset, setSelectedPreset] = useState<IndicatorPeriodPreset>('mes_atual');
  const [indicators, setIndicators] = useState<UsageAndCostIndicators | null>(null);
  const [loading, setLoading] = useState(false);

  const loadIndicators = useCallback(async () => {
    if (!vehicle) {
      setIndicators(null);
      return;
    }

    setLoading(true);
    try {
      let inicio: string;
      let fim: string;

      if (selectedPreset === 'mes_atual' && externalRange) {
        inicio = externalRange.inicio;
        fim = externalRange.fim;
      } else {
        const range = resolverIntervaloPeriodo(selectedPreset, new Date());
        inicio = range.inicio;
        fim = range.fim;
      }

      const data = await obterIndicadoresUsoECustoDoPeriodo(vehicle.id, inicio, fim);
      setIndicators(data);
    } catch (err) {
      console.error('Erro ao calcular indicadores de uso e custo:', err);
    } finally {
      setLoading(false);
    }
  }, [vehicle, selectedPreset, externalRange]);

  useEffect(() => {
    loadIndicators();
  }, [loadIndicators, refreshTrigger, vehicle?.currentOdometer]);

  if (!vehicle) {
    return null;
  }

  const formatCostPerKmDisplay = (value: number, semKmRodado: boolean): string => {
    if (semKmRodado) {
      return '-- /km';
    }
    return `${formatCurrency(value)}/km`;
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho e Seletor de Período (US24.2 - mês atual por padrão) */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>USO E EFICIÊNCIA FINANCEIRA</Text>
          <Text style={styles.title}>Indicadores de Rodagem e Custo/Km</Text>
        </View>
      </View>

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
              accessibilityLabel={`Filtrar por ${displayLabel}`}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                {displayLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.lime} />
        </View>
      ) : !indicators || indicators.semDados ? (
        /* US24.3: Estado sem dados no período */
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateTitle}>Sem dados registrados neste período</Text>
          <Text style={styles.emptyStateText}>
            Registre abastecimentos, leituras de hodômetro, manutenções ou despesas para visualizar
            a média de rodagem e o custo por quilômetro.
          </Text>
        </View>
      ) : (
        <>
          {/* Aviso de período sem km rodado (US24.3 - evita divisão por zero) */}
          {indicators.semKmRodado && (
            <View style={styles.zeroKmBanner}>
              <Text style={styles.zeroKmBannerTitle}>Período sem quilometragem percorrida</Text>
              <Text style={styles.zeroKmBannerDesc}>
                Como não há variação de hodômetro (0 km rodados) entre duas leituras no período, os
                custos por km estão exibidos como indisponíveis (-- /km) para evitar distorções.
              </Text>
            </View>
          )}

          {/* Bloco 1: Indicadores de Uso — km/dia, km/semana e km/mês (US24.1) */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionSubtitle}>Ritmo de Rodagem</Text>
              <Text style={styles.distanceBadge}>
                {formatDecimal(indicators.uso.kmRodados, 0)} km no período
              </Text>
            </View>

            <View style={styles.usageGrid}>
              <View style={styles.usageItem}>
                <Text style={styles.usageLabel}>Média / Dia</Text>
                <Text style={styles.usageValueLime}>
                  {formatDecimal(indicators.uso.kmPorDia, 1)}
                </Text>
                <Text style={styles.usageUnit}>km/dia</Text>
              </View>

              <View style={styles.usageItem}>
                <Text style={styles.usageLabel}>Média / Semana</Text>
                <Text style={styles.usageValue}>
                  {formatDecimal(indicators.uso.kmPorSemana, 1)}
                </Text>
                <Text style={styles.usageUnit}>km/sem</Text>
              </View>

              <View style={styles.usageItem}>
                <Text style={styles.usageLabel}>Média / Mês</Text>
                <Text style={styles.usageValue}>{formatDecimal(indicators.uso.kmPorMes, 0)}</Text>
                <Text style={styles.usageUnit}>km/mês</Text>
              </View>
            </View>
          </View>

          {/* Bloco 2: Custo/Km Total vs Combustível (US24.1) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionSubtitle}>Custo por Quilômetro (Total vs Combustível)</Text>

            <View style={styles.costComparisonRow}>
              <View style={[styles.costBox, styles.costBoxPrimary]}>
                <Text style={styles.costBoxLabel}>Custo/Km Total</Text>
                <Text style={styles.costBoxMainValue}>
                  {formatCostPerKmDisplay(indicators.custo.custoKmTotal, indicators.semKmRodado)}
                </Text>
                <Text style={styles.costBoxSubtext}>
                  Total: {formatCurrency(indicators.custo.custoTotal)}
                </Text>
                {indicators.custo.custoFixoProporcional > 0 && (
                  <Text style={styles.costBoxSubtext}>
                    Fixo incl.: {formatCurrency(indicators.custo.custoFixoProporcional)}
                  </Text>
                )}
              </View>

              <View style={styles.costBox}>
                <Text style={styles.costBoxLabel}>⛽ Custo/Km Combustível</Text>
                <Text style={styles.costBoxSecondaryValue}>
                  {formatCostPerKmDisplay(
                    indicators.custo.custoKmCombustivel,
                    indicators.semKmRodado,
                  )}
                </Text>
                <Text style={styles.costBoxSubtext}>
                  Gasto: {formatCurrency(indicators.custo.custoCombustivel)}
                </Text>
              </View>
            </View>
          </View>

          {/* Bloco 3: Custo/Km de Manutenção — Preventiva vs Corretiva (US24.1) */}
          <View style={styles.maintenanceBlock}>
            <View style={styles.maintenanceHeaderRow}>
              <Text style={styles.sectionSubtitle}>
                🛠️ Custo/Km de Manutenção (Preventiva vs Corretiva)
              </Text>
              <Text style={styles.maintenanceTotalBadge}>
                {formatCostPerKmDisplay(
                  indicators.custo.custoKmManutencaoTotal,
                  indicators.semKmRodado,
                )}
              </Text>
            </View>

            <View style={styles.maintenanceSplitRow}>
              <View style={[styles.maintSplitCard, styles.maintPreventivaBorder]}>
                <View style={styles.maintSplitHeader}>
                  <View style={[styles.dot, { backgroundColor: colors.lime }]} />
                  <Text style={styles.maintSplitTitle}>Preventiva</Text>
                </View>
                <Text style={styles.maintSplitCostKm}>
                  {formatCostPerKmDisplay(
                    indicators.custo.custoKmManutencaoPreventiva,
                    indicators.semKmRodado,
                  )}
                </Text>
                <Text style={styles.maintSplitTotal}>
                  {formatCurrency(indicators.custo.custoManutencaoPreventiva)}
                </Text>
              </View>

              <View style={[styles.maintSplitCard, styles.maintCorretivaBorder]}>
                <View style={styles.maintSplitHeader}>
                  <View style={[styles.dot, { backgroundColor: colors.amber }]} />
                  <Text style={styles.maintSplitTitle}>Corretiva</Text>
                </View>
                <Text style={styles.maintSplitCostKmAmber}>
                  {formatCostPerKmDisplay(
                    indicators.custo.custoKmManutencaoCorretiva,
                    indicators.semKmRodado,
                  )}
                </Text>
                <Text style={styles.maintSplitTotal}>
                  {formatCurrency(indicators.custo.custoManutencaoCorretiva)}
                </Text>
              </View>
            </View>
          </View>
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
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleBlock: {
    flex: 1,
  },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    fontSize: 10,
    marginBottom: 2,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.black,
    fontWeight: '700',
  },
  loadingBox: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyStateBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyStateTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  zeroKmBanner: {
    backgroundColor: colors.amberDim,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 66, 0.35)',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  zeroKmBannerTitle: {
    ...typography.captionBold,
    color: colors.amber,
    marginBottom: 2,
  },
  zeroKmBannerDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  sectionBlock: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 12,
  },
  distanceBadge: {
    ...typography.captionBold,
    color: colors.lime,
    fontSize: 11,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  usageGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  usageItem: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
    alignItems: 'center',
  },
  usageLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 4,
  },
  usageValueLime: {
    ...typography.h3,
    color: colors.lime,
  },
  usageValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  usageUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  costComparisonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  costBox: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
  },
  costBoxPrimary: {
    borderColor: 'rgba(201, 243, 29, 0.35)',
  },
  costBoxLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  costBoxMainValue: {
    ...typography.h3,
    color: colors.lime,
    marginVertical: 4,
  },
  costBoxSecondaryValue: {
    ...typography.h3,
    color: colors.textPrimary,
    marginVertical: 4,
  },
  costBoxSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  maintenanceBlock: {
    marginTop: 2,
  },
  maintenanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  maintenanceTotalBadge: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  maintenanceSplitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  maintSplitCard: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
  },
  maintPreventivaBorder: {
    borderColor: 'rgba(201, 243, 29, 0.25)',
  },
  maintCorretivaBorder: {
    borderColor: 'rgba(245, 200, 66, 0.3)',
  },
  maintSplitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  maintSplitTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  maintSplitCostKm: {
    ...typography.bodyBold,
    color: colors.lime,
    fontSize: 15,
    marginBottom: 2,
  },
  maintSplitCostKmAmber: {
    ...typography.bodyBold,
    color: colors.amber,
    fontSize: 15,
    marginBottom: 2,
  },
  maintSplitTotal: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
});
