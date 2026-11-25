import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  FuelComparisonItem,
  IndicatorPeriodPreset,
  VehicleComparisonItem,
} from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { InteractiveBarChart, BarChartItem } from '../components/charts/InteractiveCharts';
import { useAppStore } from '../store/useAppStore';
import {
  ComparisonService,
  PERIODO_PADRAO_COMPARATIVOS,
} from '../services/comparisonService';

interface ComparisonScreenProps {
  onClose: () => void;
}

type ComparisonMode = 'combustiveis' | 'veiculos';

const PERIODS: Array<{ key: IndicatorPeriodPreset; label: string }> = [
  { key: 'ultimos_30_dias', label: '30 dias' },
  { key: 'ultimos_90_dias', label: '90 dias' },
  { key: 'ano_atual', label: 'Ano atual' },
];

const BAR_PALETTE = [colors.lime, '#56B4E9', colors.amber, '#009E73', '#CC79A7'];

export const ComparisonScreen: React.FC<ComparisonScreenProps> = ({ onClose }) => {
  const { selectedVehicle, vehicles } = useAppStore();
  const [mode, setMode] = useState<ComparisonMode>('combustiveis');
  const [period, setPeriod] = useState<IndicatorPeriodPreset>(PERIODO_PADRAO_COMPARATIVOS);
  const [loading, setLoading] = useState<boolean>(true);
  const [fuelItems, setFuelItems] = useState<FuelComparisonItem[]>([]);
  const [vehicleItems, setVehicleItems] = useState<VehicleComparisonItem[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'combustiveis') {
        if (!selectedVehicle?.id) {
          setFuelItems([]);
        } else {
          const res = await ComparisonService.compararCombustiveisDoVeiculo(
            selectedVehicle.id,
            period,
          );
          setFuelItems(res.itens);
        }
      } else {
        const res = await ComparisonService.compararVeiculosDaFrota(period);
        setVehicleItems(res.itens);
      }
    } finally {
      setLoading(false);
    }
  }, [mode, period, selectedVehicle?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const consumoBars: BarChartItem[] = useMemo(() => {
    if (mode === 'combustiveis') {
      return fuelItems
        .filter(i => i.mediaKml !== null)
        .map((item, idx) => ({
          id: `fuel-cons-${item.combustivel}`,
          label: item.combustivel,
          value: item.mediaKml || 0,
          formattedValue: item.consumoFormatado,
          color: BAR_PALETTE[idx % BAR_PALETTE.length],
        }));
    }
    return vehicleItems
      .filter(i => i.consumoMedioKml !== null)
      .map((item, idx) => ({
        id: `veh-cons-${item.veiculoId}`,
        label: item.nome,
        value: item.consumoMedioKml || 0,
        formattedValue: item.consumoFormatado,
        color: BAR_PALETTE[idx % BAR_PALETTE.length],
      }));
  }, [mode, fuelItems, vehicleItems]);

  const custoKmBars: BarChartItem[] = useMemo(() => {
    if (mode === 'combustiveis') {
      return fuelItems
        .filter(i => i.custoPorKm !== null)
        .map((item, idx) => ({
          id: `fuel-cost-${item.combustivel}`,
          label: item.combustivel,
          value: item.custoPorKm || 0,
          formattedValue: item.custoPorKmFormatado,
          color: BAR_PALETTE[idx % BAR_PALETTE.length],
        }));
    }
    return vehicleItems
      .filter(i => i.custoPorKm !== null)
      .map((item, idx) => ({
        id: `veh-cost-${item.veiculoId}`,
        label: item.nome,
        value: item.custoPorKm || 0,
        formattedValue: item.custoPorKmFormatado,
        color: BAR_PALETTE[idx % BAR_PALETTE.length],
      }));
  }, [mode, fuelItems, vehicleItems]);

  const precisaMaisVeiculos = mode === 'veiculos' && vehicles.length < 2 && vehicleItems.length < 2;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Voltar">
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comparar</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Modo: Combustíveis vs Veículos */}
        <View style={styles.segmentedRow}>
          <TouchableOpacity
            style={[styles.segBtn, mode === 'combustiveis' && styles.segBtnActive]}
            onPress={() => setMode('combustiveis')}
          >
            <Text style={[styles.segText, mode === 'combustiveis' && styles.segTextActive]}>
              Combustíveis
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, mode === 'veiculos' && styles.segBtnActive]}
            onPress={() => setMode('veiculos')}
          >
            <Text style={[styles.segText, mode === 'veiculos' && styles.segTextActive]}>
              Veículos
            </Text>
          </TouchableOpacity>
        </View>

        {/* Período (padrão 90 dias — US28.4) */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => {
            const active = p.key === period;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodChip, active && styles.periodChipActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.lime} />
          </View>
        ) : precisaMaisVeiculos ? (
          <View style={styles.card}>
            <Icon name="Car" size={24} color={colors.textSecondary} />
            <Text style={styles.cardTitle}>Cadastre pelo menos dois veículos</Text>
            <Text style={styles.mutedText}>
              Para comparar desempenho e custo por km entre veículos, cadastre ao menos dois
              veículos na Garagem.
            </Text>
          </View>
        ) : (mode === 'combustiveis' && fuelItems.length === 0) ||
          (mode === 'veiculos' && vehicleItems.length === 0) ? (
          <View style={styles.card}>
            <Icon name="BarChart2" size={24} color={colors.textSecondary} />
            <Text style={styles.cardTitle}>Sem dados no período</Text>
            <Text style={styles.mutedText}>
              Não há registros suficientes no período selecionado para montar o comparativo.
            </Text>
          </View>
        ) : (
          <>
            {/* Gráfico comparativo de consumo médio */}
            {consumoBars.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>CONSUMO MÉDIO</Text>
                <InteractiveBarChart data={consumoBars} />
              </View>
            ) : null}

            {/* Gráfico comparativo de custo por km */}
            {custoKmBars.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>CUSTO POR KM</Text>
                <InteractiveBarChart data={custoKmBars} />
              </View>
            ) : null}

            {/* Legenda textual e rótulos explícitos (não depende só de cor — US28.3) */}
            <Text style={styles.sectionLabel}>DETALHAMENTO E LEGENDA</Text>
            <View style={styles.card}>
              {mode === 'combustiveis'
                ? fuelItems.map((item, idx) => (
                    <View
                      key={item.combustivel}
                      style={[styles.detailRow, idx === fuelItems.length - 1 && styles.rowLast]}
                    >
                      <View style={styles.rowLeft}>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: BAR_PALETTE[idx % BAR_PALETTE.length] },
                          ]}
                        />
                        <View>
                          <Text style={styles.rowTitle}>{item.combustivel}</Text>
                          <Text style={styles.mutedText}>
                            {item.totalRegistros}{' '}
                            {item.totalRegistros === 1 ? 'abastecimento' : 'abastecimentos'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={styles.rowValue}>{item.consumoFormatado}</Text>
                        <Text style={styles.mutedText}>{item.custoPorKmFormatado}</Text>
                      </View>
                    </View>
                  ))
                : vehicleItems.map((item, idx) => (
                    <View
                      key={item.veiculoId}
                      style={[styles.detailRow, idx === vehicleItems.length - 1 && styles.rowLast]}
                    >
                      <View style={styles.rowLeft}>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: BAR_PALETTE[idx % BAR_PALETTE.length] },
                          ]}
                        />
                        <View>
                          <Text style={styles.rowTitle}>{item.nome}</Text>
                          <Text style={styles.mutedText}>{item.placa}</Text>
                        </View>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={styles.rowValue}>{item.consumoFormatado}</Text>
                        <Text style={styles.mutedText}>{item.custoPorKmFormatado}</Text>
                      </View>
                    </View>
                  ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  segmentedRow: { flexDirection: 'row', gap: spacing.xs },
  segBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: colors.limeDim, borderColor: colors.lime },
  segText: { ...typography.caption, color: colors.textSecondary },
  segTextActive: { ...typography.captionBold, color: colors.lime },
  periodRow: { flexDirection: 'row', gap: spacing.xs },
  periodChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  periodChipActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.lime },
  periodText: { ...typography.caption, color: colors.textSecondary },
  periodTextActive: { ...typography.captionBold, color: colors.lime },
  centerBox: { paddingVertical: spacing.xl, alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary },
  sectionLabel: { ...typography.sectionLabel, color: colors.textMuted },
  mutedText: { ...typography.caption, color: colors.textSecondary },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowValue: { ...typography.captionBold, color: colors.textPrimary },
});
