import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { FuelType } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import {
  RegionalPricesService,
  RegionalPricesViewData,
} from '../services/regionalPricesService';
import { PreferencesService } from '../services/preferencesService';
import { formatarDataColeta, formatarMoeda } from '../utils/formatters';

interface RegionalPricesScreenProps {
  onClose: () => void;
}

const FUEL_OPTIONS: FuelType[] = ['Gasolina', 'Etanol', 'Diesel', 'GNV'];

export const RegionalPricesScreen: React.FC<RegionalPricesScreenProps> = ({ onClose }) => {
  const [combustivel, setCombustivel] = useState<FuelType>('Gasolina');
  const [municipio, setMunicipio] = useState<string>('São Paulo');
  const [municipioInput, setMunicipioInput] = useState<string>('São Paulo');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dados, setDados] = useState<RegionalPricesViewData | null>(null);

  const carregarDados = useCallback(
    async (
      targetMunicipio: string,
      targetCombustivel: FuelType,
      forceRefresh: boolean = false,
    ) => {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      try {
        const res = await RegionalPricesService.consultarPrecosRegiao({
          municipio: targetMunicipio,
          combustivel: targetCombustivel,
          forceRefresh,
        });
        setDados(res);
      } catch (err: any) {
        setDados(null);
        setErrorMsg(
          err?.response?.data?.error ||
            err?.message ||
            'Não foi possível carregar os preços da região no momento.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
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
      setMunicipioInput(cityPref);
      await carregarDados(cityPref, fuelPref, false);
    })();
    return () => {
      active = false;
    };
  }, [carregarDados]);

  const handleSelectFuel = async (fuel: FuelType) => {
    setCombustivel(fuel);
    await PreferencesService.definirCombustivelPrincipal(fuel).catch(() => {});
    await carregarDados(municipio, fuel, false);
  };

  const handleApplyMunicipio = async () => {
    const limpo = municipioInput.trim();
    if (!limpo) return;
    setMunicipio(limpo);
    await PreferencesService.definirMunicipioPadrao(limpo).catch(() => {});
    await carregarDados(limpo, combustivel, true);
  };

  const maxHistorico =
    dados?.historico_semana?.reduce((acc, item) => Math.max(acc, item.preco_centavos), 0) || 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.iconButton}
          accessibilityLabel="Voltar"
        >
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preços da região</Text>
        <TouchableOpacity
          onPress={() => carregarDados(municipio, combustivel, true)}
          style={styles.iconButton}
          disabled={refreshing || loading}
          accessibilityLabel="Atualizar preços"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.lime} />
          ) : (
            <Icon name="RefreshCw" size={18} color={colors.lime} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Seletor de Município */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Icon name="MapPin" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={municipioInput}
              onChangeText={setMunicipioInput}
              placeholder="Município (ex.: São Paulo)"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={handleApplyMunicipio}
            />
          </View>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApplyMunicipio}
            activeOpacity={0.8}
          >
            <Text style={styles.applyButtonText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {/* Combustível principal */}
        <Text style={styles.sectionLabel}>COMBUSTÍVEL PRINCIPAL</Text>
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

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.lime} />
            <Text style={styles.mutedText}>Consultando preços médios da região...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.stateCard}>
            <Icon name="AlertCircle" size={24} color={colors.error} />
            <Text style={styles.stateTitle}>Sem dados disponíveis</Text>
            <Text style={styles.stateDescription}>{errorMsg}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => carregarDados(municipio, combustivel, true)}
            >
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : dados ? (
          <>
            {/* Faixa offline quando exibindo última coleta salva */}
            {dados.offline && (
              <View style={styles.offlineBanner}>
                <Icon name="WifiOff" size={16} color={colors.amber} />
                <Text style={styles.offlineBannerText}>
                  Sem conexão. Exibindo última coleta salva localmente.
                </Text>
              </View>
            )}

            {/* Cartão principal de preço médio local */}
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroLabel}>
                  PREÇO MÉDIO · {dados.combustivel.toUpperCase()}
                </Text>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{dados.aviso_data}</Text>
                </View>
              </View>

              <Text style={styles.heroPrice}>
                {formatarMoeda(dados.preco_medio_centavos / 100)}
                <Text style={styles.heroUnit}> /L</Text>
              </Text>

              <Text style={styles.heroSubtitle}>
                {dados.municipio}
                {dados.uf ? ` — ${dados.uf}` : ''} · Fonte {dados.fonte}
              </Text>

              {dados.aviso_granularidade ? (
                <View style={styles.granularityBox}>
                  <Icon name="Info" size={14} color={colors.textSecondary} />
                  <Text style={styles.granularityText}>{dados.aviso_granularidade}</Text>
                </View>
              ) : null}
            </View>

            {/* Cartão discreto de clima */}
            {dados.clima ? (
              <View style={styles.weatherCard}>
                <View style={styles.weatherLeft}>
                  <Icon name="CloudSun" size={20} color={colors.textSecondary} />
                  <View>
                    <Text style={styles.weatherCondition}>{dados.clima.condicao}</Text>
                    <Text style={styles.weatherMeta}>
                      {dados.clima.municipio} · Mín {Math.round(dados.clima.temperatura_min)}° · Máx{' '}
                      {Math.round(dados.clima.temperatura_max)}°
                    </Text>
                  </View>
                </View>
                <Text style={styles.weatherTemp}>
                  {dados.clima.temperatura_atual !== null &&
                  dados.clima.temperatura_atual !== undefined
                    ? `${Math.round(dados.clima.temperatura_atual)}°C`
                    : `${Math.round(dados.clima.temperatura_max)}°C`}
                </Text>
              </View>
            ) : null}

            {/* Histórico simples da semana */}
            <Text style={styles.sectionLabel}>HISTÓRICO DA SEMANA</Text>
            <View style={styles.historyCard}>
              {dados.historico_semana.length === 0 ? (
                <Text style={styles.mutedText}>Ainda não há histórico suficiente na semana.</Text>
              ) : (
                dados.historico_semana.map((item, idx) => {
                  const pct = Math.max(15, Math.round((item.preco_centavos / maxHistorico) * 100));
                  return (
                    <View
                      key={`${item.data_coleta}-${idx}`}
                      style={[
                        styles.historyRow,
                        idx === dados.historico_semana.length - 1 && styles.historyRowLast,
                      ]}
                    >
                      <Text style={styles.historyDate}>
                        {formatarDataColeta(item.data_coleta)}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.historyPrice}>
                        {formatarMoeda(item.preco_centavos / 100)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : null}
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  searchInputWrap: {
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
  searchInput: {
    ...typography.body,
    flex: 1,
    color: colors.textPrimary,
  },
  applyButton: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
  },
  applyButtonText: {
    ...typography.captionBold,
    color: colors.background,
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
  centerBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  mutedText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  stateDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryButtonText: {
    ...typography.captionBold,
    color: colors.lime,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.amberDim,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  offlineBannerText: {
    ...typography.caption,
    color: colors.amber,
    flex: 1,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroLabel: {
    ...typography.sectionLabel,
    color: colors.textMuted,
  },
  dateBadge: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  dateBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  heroPrice: {
    ...typography.hero,
    color: colors.textPrimary,
  },
  heroUnit: {
    ...typography.body,
    color: colors.textSecondary,
  },
  heroSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  granularityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  granularityText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  weatherCondition: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  weatherMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  weatherTemp: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  historyRowLast: {
    borderBottomWidth: 0,
  },
  historyDate: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 82,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.lime,
  },
  historyPrice: {
    ...typography.captionBold,
    color: colors.textPrimary,
    width: 72,
    textAlign: 'right',
  },
});
