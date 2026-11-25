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
  Linking,
  Alert,
} from 'react-native';
import { FuelType, RankedFuelStation } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { CheapestStationsService } from '../services/cheapestStationsService';
import { montarUrlMapaRota } from '../services/cheapestStationsDomain';
import { Coordinates, MENSAGEM_MOTIVO_PERMISSAO_LOCALIZACAO } from '../services/gpsService';
import { PreferencesService } from '../services/preferencesService';
import { formatarMoeda, formatDecimal } from '../utils/formatters';

interface CheapestStationsScreenProps {
  onClose: () => void;
}

const FUEL_OPTIONS: FuelType[] = ['Gasolina', 'Etanol', 'Diesel', 'GNV'];
const RADIUS_OPTIONS = [5, 10, 25];

export const CheapestStationsScreen: React.FC<CheapestStationsScreenProps> = ({ onClose }) => {
  const [combustivel, setCombustivel] = useState<FuelType>('Gasolina');
  const [raioKm, setRaioKm] = useState<number>(10);
  const [municipioInput, setMunicipioInput] = useState<string>('São Paulo');
  const [municipioAplicado, setMunicipioAplicado] = useState<string>('São Paulo');
  const [posicao, setPosicao] = useState<Coordinates | null>(null);
  const [permissaoNegada, setPermissaoNegada] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [postos, setPostos] = useState<RankedFuelStation[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const consultarPostos = useCallback(
    async (opts: {
      targetCombustivel: FuelType;
      targetRaioKm: number;
      targetMunicipio?: string;
      posicaoAtual?: Coordinates | null;
      usarPosicaoAtual?: boolean;
    }) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await CheapestStationsService.buscarPostosMaisBaratos({
          combustivel: opts.targetCombustivel,
          raioKm: opts.targetRaioKm,
          municipioFallback: opts.targetMunicipio,
          posicaoJaObtida: opts.usarPosicaoAtual ? opts.posicaoAtual : undefined,
        });
        setPosicao(res.posicao);
        setPermissaoNegada(res.permissaoNegada);
        setPostos(res.postos);
        if (res.municipioAplicado) {
          setMunicipioAplicado(res.municipioAplicado);
          setMunicipioInput(res.municipioAplicado);
        }
      } catch (err: any) {
        setPostos([]);
        setErrorMsg(err?.message || 'Não foi possível consultar os postos salvos localmente.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // US34.5: A posição é consultada apenas quando a tela é aberta, nunca em segundo plano.
  useEffect(() => {
    let active = true;
    (async () => {
      const prefs = await PreferencesService.obterPreferencias();
      const fuelPref = prefs.combustivel_principal || 'Gasolina';
      const cityPref = prefs.municipio_padrao || 'São Paulo';
      if (!active) return;
      setCombustivel(fuelPref);
      setMunicipioAplicado(cityPref);
      setMunicipioInput(cityPref);
      await consultarPostos({
        targetCombustivel: fuelPref,
        targetRaioKm: 10,
        targetMunicipio: cityPref,
        usarPosicaoAtual: false,
      });
    })();
    return () => {
      active = false;
    };
  }, [consultarPostos]);

  const handleSelectFuel = async (fuel: FuelType) => {
    setCombustivel(fuel);
    await PreferencesService.definirCombustivelPrincipal(fuel).catch(() => {});
    await consultarPostos({
      targetCombustivel: fuel,
      targetRaioKm: raioKm,
      targetMunicipio: municipioAplicado,
      posicaoAtual: posicao,
      usarPosicaoAtual: true,
    });
  };

  const handleSelectRadius = async (newRadius: number) => {
    setRaioKm(newRadius);
    await consultarPostos({
      targetCombustivel: combustivel,
      targetRaioKm: newRadius,
      targetMunicipio: municipioAplicado,
      posicaoAtual: posicao,
      usarPosicaoAtual: true,
    });
  };

  const handleBuscarMunicipio = async () => {
    const limpo = municipioInput.trim();
    if (!limpo) return;
    setMunicipioAplicado(limpo);
    await PreferencesService.definirMunicipioPadrao(limpo).catch(() => {});
    await consultarPostos({
      targetCombustivel: combustivel,
      targetRaioKm: raioKm,
      targetMunicipio: limpo,
      posicaoAtual: null,
      usarPosicaoAtual: true,
    });
  };

  const handleAbrirRota = async (posto: RankedFuelStation) => {
    const url = montarUrlMapaRota(posto.latitude, posto.longitude, posto.nome);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Mapas indisponível', 'Não foi possível abrir o aplicativo de mapas do aparelho.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Voltar">
          <Icon name="ChevronLeft" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Postos mais baratos</Text>
        <TouchableOpacity
          onPress={() =>
            consultarPostos({
              targetCombustivel: combustivel,
              targetRaioKm: raioKm,
              targetMunicipio: municipioAplicado,
              usarPosicaoAtual: false,
            })
          }
          style={styles.iconButton}
          accessibilityLabel="Atualizar posição e lista"
        >
          <Icon name="Crosshair" size={18} color={colors.lime} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Explicação de permissão negada + fallback por município (US34.3) */}
        {permissaoNegada ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionHeader}>
              <Icon name="MapPinOff" size={18} color={colors.amber} />
              <Text style={styles.permissionTitle}>Localização desativada</Text>
            </View>
            <Text style={styles.permissionText}>
              {MENSAGEM_MOTIVO_PERMISSAO_LOCALIZACAO} Sem a permissão, informe seu município para
              ordenar os postos pelo menor preço.
            </Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={municipioInput}
                onChangeText={setMunicipioInput}
                placeholder="Digite o município"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={handleBuscarMunicipio}
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleBuscarMunicipio}
                activeOpacity={0.8}
              >
                <Text style={styles.searchButtonText}>Buscar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.radiusSection}>
            <Text style={styles.sectionLabel}>RAIO DE BUSCA</Text>
            <View style={styles.chipRow}>
              {RADIUS_OPTIONS.map(r => {
                const selected = r === raioKm;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => handleSelectRadius(r)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      Até {r} km
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Combustível */}
        <Text style={styles.sectionLabel}>COMBUSTÍVEL</Text>
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
            <Text style={styles.mutedText}>Buscando postos no cache local...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.stateCard}>
            <Icon name="AlertCircle" size={24} color={colors.error} />
            <Text style={styles.stateTitle}>Erro ao carregar postos</Text>
            <Text style={styles.stateDescription}>{errorMsg}</Text>
          </View>
        ) : postos.length === 0 ? (
          <View style={styles.stateCard}>
            <Icon name="Fuel" size={24} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Nenhum posto encontrado</Text>
            <Text style={styles.stateDescription}>
              {permissaoNegada
                ? `Não há postos salvos para ${combustivel} em ${municipioAplicado}.`
                : `Nenhum posto com preço de ${combustivel} encontrado em até ${raioKm} km.`}
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {postos.map((posto, index) => (
              <View key={posto.id} style={styles.stationCard}>
                <View style={styles.stationTop}>
                  <View style={styles.stationInfo}>
                    <View style={styles.rankRow}>
                      {index === 0 ? (
                        <View style={styles.bestBadge}>
                          <Text style={styles.bestBadgeText}>Mais barato</Text>
                        </View>
                      ) : null}
                      <Text style={styles.stationFlag}>{posto.bandeira}</Text>
                    </View>
                    <Text style={styles.stationName}>{posto.nome}</Text>
                    <Text style={styles.stationAddress}>
                      {posto.endereco ? `${posto.endereco} · ` : ''}
                      {posto.municipio} — {posto.uf}
                    </Text>
                  </View>
                  <View style={styles.priceBox}>
                    <Text style={styles.stationPrice}>
                      {formatarMoeda(posto.preco_centavos / 100)}
                    </Text>
                    <Text style={styles.stationUnit}>/L</Text>
                  </View>
                </View>

                <View style={styles.stationFooter}>
                  <View style={styles.distanceWrap}>
                    <Icon name="Navigation" size={14} color={colors.textSecondary} />
                    <Text style={styles.distanceText}>
                      {posto.distancia_km !== null
                        ? `${formatDecimal(posto.distancia_km, 1)} km`
                        : 'Ordenado por preço'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.routeButton}
                    onPress={() => handleAbrirRota(posto)}
                    activeOpacity={0.8}
                  >
                    <Icon name="Map" size={14} color={colors.background} />
                    <Text style={styles.routeButtonText}>Abrir rota</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  permissionCard: {
    backgroundColor: colors.amberDim,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  permissionTitle: {
    ...typography.bodyBold,
    color: colors.amber,
  },
  permissionText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 42,
    color: colors.textPrimary,
  },
  searchButton: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: 42,
  },
  searchButtonText: {
    ...typography.captionBold,
    color: colors.background,
  },
  radiusSection: {
    gap: spacing.xs,
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
  listContainer: {
    gap: spacing.sm,
  },
  stationCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  stationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stationInfo: {
    flex: 1,
    gap: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bestBadge: {
    backgroundColor: colors.limeDim,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bestBadgeText: {
    ...typography.captionBold,
    color: colors.lime,
    fontSize: 11,
  },
  stationFlag: {
    ...typography.sectionLabel,
    color: colors.textMuted,
  },
  stationName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  stationAddress: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  priceBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  stationPrice: {
    ...typography.h2,
    color: colors.lime,
  },
  stationUnit: {
    ...typography.caption,
    color: colors.textMuted,
  },
  stationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  distanceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  routeButtonText: {
    ...typography.captionBold,
    color: colors.background,
  },
});
