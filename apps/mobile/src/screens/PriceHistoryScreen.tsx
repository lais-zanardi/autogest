import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { FuelType, PriceAlertRecord, PriceTrendSummary } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { InteractiveLineChart, LineChartPoint } from '../components/charts/InteractiveCharts';
import { PriceAlertService } from '../services/priceAlertService';
import { PreferencesService } from '../services/preferencesService';
import { useAppStore } from '../store/useAppStore';
import { formatarDataColeta, formatarMoeda, formatDecimal } from '../utils/formatters';

interface PriceHistoryScreenProps {
  onClose: () => void;
}

const FUEL_OPTIONS: FuelType[] = ['Gasolina', 'Etanol', 'Diesel', 'GNV'];
const PERIOD_OPTIONS: Array<30 | 90> = [30, 90];

function parseValorInputCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d.,]/g, '').replace(',', '.').trim();
  const num = Number(limpo);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num * 100);
}

export const PriceHistoryScreen: React.FC<PriceHistoryScreenProps> = ({ onClose }) => {
  const { selectedVehicle } = useAppStore();
  const [combustivel, setCombustivel] = useState<FuelType>('Gasolina');
  const [municipio, setMunicipio] = useState<string>('São Paulo');
  const [periodoDias, setPeriodoDias] = useState<30 | 90>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [tendencia, setTendencia] = useState<PriceTrendSummary | null>(null);
  const [alertaAtual, setAlertaAtual] = useState<PriceAlertRecord | null>(null);
  const [limiteInput, setLimiteInput] = useState<string>('');
  const [alertaAtivo, setAlertaAtivo] = useState<boolean>(true);
  const [savingAlert, setSavingAlert] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const carregarDados = useCallback(
    async (targetMunicipio: string, targetCombustivel: FuelType, targetPeriodo: 30 | 90) => {
      setLoading(true);
      try {
        const trend = await PriceAlertService.obterHistoricoETendencia({
          municipio: targetMunicipio,
          combustivel: targetCombustivel,
          periodoDias: targetPeriodo,
        });
        setTendencia(trend);

        const vehicleId = selectedVehicle?.id || 'default_vehicle';
        const alertas = await PriceAlertService.listarAlertas(vehicleId);
        const match = alertas.find(
          a => a.combustivel.toLowerCase() === targetCombustivel.toLowerCase(),
        );
        setAlertaAtual(match || null);
        if (match) {
          setLimiteInput((match.preco_limite_centavos / 100).toFixed(2).replace('.', ','));
          setAlertaAtivo(match.ativo);
        } else {
          setLimiteInput('');
          setAlertaAtivo(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedVehicle?.id],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const prefs = await PreferencesService.obterPreferencias();
      const fuelPref = prefs.combustivel_principal || 'Gasolina';
      const cityPref = prefs.municipio_padrao || 'São Paulo';
      if (!active) return;
      setCombustivel(fuelPref);
      setMunicipio(cityPref);
      await carregarDados(cityPref, fuelPref, 30);
    })();
    return () => {
      active = false;
    };
  }, [carregarDados]);

  const handleSelectFuel = async (fuel: FuelType) => {
    setCombustivel(fuel);
    setFeedbackMsg(null);
    setFeedbackError(null);
    await carregarDados(municipio, fuel, periodoDias);
  };

  const handleSelectPeriod = async (days: 30 | 90) => {
    setPeriodoDias(days);
    await carregarDados(municipio, combustivel, days);
  };

  const handleSalvarAlerta = async () => {
    setFeedbackMsg(null);
    setFeedbackError(null);

    const centavos = parseValorInputCentavos(limiteInput);
    if (centavos <= 0) {
      setFeedbackError('Informe um preço-limite maior que zero (ex.: 5,50).');
      return;
    }

    setSavingAlert(true);
    try {
      const vehicleId = selectedVehicle?.id || 'default_vehicle';
      const salvo = await PriceAlertService.salvarAlertaPreco({
        veiculoId: vehicleId,
        combustivel,
        precoLimiteCentavos: centavos,
        ativo: alertaAtivo,
      });
      setAlertaAtual(salvo);
      setFeedbackMsg(
        `Alerta salvo para ${combustivel} até ${formatarMoeda(salvo.preco_limite_centavos / 100)}.`,
      );
    } catch (err: any) {
      setFeedbackError(err?.message || 'Não foi possível salvar o alerta de preço.');
    } finally {
      setSavingAlert(false);
    }
  };

  const handleToggleAtivo = async (value: boolean) => {
    setAlertaAtivo(value);
    if (alertaAtual) {
      const atualizado = await PriceAlertService.alternarAtivoAlerta(alertaAtual.id, value);
      if (atualizado) setAlertaAtual(atualizado);
    }
  };

  const chartData: LineChartPoint[] = useMemo(() => {
    if (!tendencia?.pontos?.length) return [];
    return tendencia.pontos.map(ponto => ({
      id: `${ponto.data_coleta}-${ponto.id}`,
      label: formatarDataColeta(ponto.data_coleta).slice(0, 5),
      value: Number((ponto.preco_centavos / 100).toFixed(2)),
      formattedValue: formatarMoeda(ponto.preco_centavos / 100),
    }));
  }, [tendencia]);

  const trendBadge = useMemo(() => {
    if (!tendencia || tendencia.direcao === 'dados_insuficientes') {
      return { label: 'Sem histórico', color: colors.textSecondary, icon: 'Minus' as const };
    }
    if (tendencia.direcao === 'alta') {
      return {
        label: `Alta de ${formatDecimal(Math.abs(tendencia.variacaoPercentual), 1)}%`,
        color: colors.error,
        icon: 'TrendingUp' as const,
      };
    }
    if (tendencia.direcao === 'queda') {
      return {
        label: `Queda de ${formatDecimal(Math.abs(tendencia.variacaoPercentual), 1)}%`,
        color: colors.lime,
        icon: 'TrendingDown' as const,
      };
    }
    return { label: 'Preço estável', color: colors.textSecondary, icon: 'Minus' as const };
  }, [tendencia]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Voltar">
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de preços</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Seletor de combustível */}
        <Text style={styles.sectionLabel}>COMBUSTÍVEL · {municipio.toUpperCase()}</Text>
        <View style={styles.chipRow}>
          {FUEL_OPTIONS.map(fuel => {
            const selected = fuel === combustivel;
            return (
              <TouchableOpacity
                key={fuel}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => handleSelectFuel(fuel)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{fuel}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Seletor de período 30 / 90 dias */}
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map(days => {
            const selected = days === periodoDias;
            return (
              <TouchableOpacity
                key={days}
                style={[styles.periodBtn, selected && styles.periodBtnSelected]}
                onPress={() => handleSelectPeriod(days)}
                activeOpacity={0.8}
              >
                <Text style={[styles.periodText, selected && styles.periodTextSelected]}>
                  Últimos {days} dias
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.lime} />
            <Text style={styles.mutedText}>Carregando histórico de preços...</Text>
          </View>
        ) : (
          <>
            {/* Cartão de tendência e gráfico de linha (SPK.2) */}
            <View style={styles.card}>
              <View style={styles.trendHeader}>
                <View>
                  <Text style={styles.sectionLabel}>TENDÊNCIA ({periodoDias} DIAS)</Text>
                  <Text style={styles.currentPrice}>
                    {tendencia?.precoAtualCentavos
                      ? formatarMoeda(tendencia.precoAtualCentavos / 100)
                      : '--'}
                  </Text>
                </View>
                <View style={styles.trendPill}>
                  <Icon name={trendBadge.icon} size={15} color={trendBadge.color} />
                  <Text style={[styles.trendPillText, { color: trendBadge.color }]}>
                    {trendBadge.label}
                  </Text>
                </View>
              </View>

              {chartData.length === 0 ? (
                <Text style={styles.mutedText}>
                  Ainda não há histórico de preços salvo para {combustivel} neste período.
                </Text>
              ) : (
                <InteractiveLineChart data={chartData} />
              )}
            </View>

            {/* Configuração de Alerta de Preço-Limite (US35.4) */}
            <View style={styles.card}>
              <View style={styles.alertHeader}>
                <View>
                  <Text style={styles.sectionLabel}>ALERTA DE PREÇO-LIMITE</Text>
                  <Text style={styles.alertTitle}>Avisar quando baixar de</Text>
                </View>
                <Switch
                  value={alertaAtivo}
                  onValueChange={handleToggleAtivo}
                  trackColor={{ false: colors.surfaceRaised, true: colors.limeDim }}
                  thumbColor={alertaAtivo ? colors.lime : colors.textMuted}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.currencyWrap}>
                  <Text style={styles.currencyPrefix}>R$</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={limiteInput}
                    onChangeText={setLimiteInput}
                    keyboardType="decimal-pad"
                    placeholder="5,50"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSalvarAlerta}
                  disabled={savingAlert}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveButtonText}>
                    {savingAlert ? 'Salvando...' : 'Salvar limite'}
                  </Text>
                </TouchableOpacity>
              </View>

              {alertaAtual ? (
                <Text style={styles.mutedText}>
                  Limite ativo: {formatarMoeda(alertaAtual.preco_limite_centavos / 100)} /L ·{' '}
                  {alertaAtual.ativo ? 'Ativado' : 'Desativado'}
                </Text>
              ) : null}

              {feedbackMsg ? <Text style={styles.successText}>{feedbackMsg}</Text> : null}
              {feedbackError ? <Text style={styles.errorText}>{feedbackError}</Text> : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.limeDim,
    borderColor: colors.lime,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    ...typography.captionBold,
    color: colors.lime,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  periodBtnSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.lime,
  },
  periodText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  periodTextSelected: {
    ...typography.captionBold,
    color: colors.lime,
  },
  centerBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currentPrice: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: 4,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  trendPillText: {
    ...typography.captionBold,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  currencyWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  currencyPrefix: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  priceInput: {
    ...typography.body,
    flex: 1,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.captionBold,
    color: colors.background,
  },
  mutedText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  successText: {
    ...typography.caption,
    color: colors.lime,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
  },
});
