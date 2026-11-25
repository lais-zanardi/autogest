import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { GroupedVisitedPlace } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { VisitedPlacesService } from '../services/visitedPlacesService';
import {
  LEGENDA_MAPA_LOCAIS,
  MENSAGEM_MAPA_VAZIO,
} from '../services/visitedPlacesDomain';
import { montarUrlMapaRota } from '../services/cheapestStationsDomain';
import { formatarDataColeta } from '../utils/formatters';

interface VisitedPlacesMapScreenProps {
  onClose: () => void;
}

const MAP_HEIGHT = 240;

export const VisitedPlacesMapScreen: React.FC<VisitedPlacesMapScreenProps> = ({ onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [locais, setLocais] = useState<GroupedVisitedPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const agrupados = await VisitedPlacesService.listarLocaisAgrupados();
        if (!active) return;
        setLocais(agrupados);
        setSelectedId(agrupados[0]?.id || null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedPlace = useMemo(
    () => locais.find(l => l.id === selectedId) || locais[0] || null,
    [locais, selectedId],
  );

  // Projeção relativa proporcional dos marcadores no quadro do mapa
  const projectedMarkers = useMemo(() => {
    if (locais.length === 0) return [];
    const lats = locais.map(l => l.latitude);
    const lons = locais.map(l => l.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latSpan = maxLat - minLat || 0.01;
    const lonSpan = maxLon - minLon || 0.01;

    return locais.map(local => {
      const xPct =
        locais.length === 1 ? 50 : 12 + ((local.longitude - minLon) / lonSpan) * 76;
      const yPct =
        locais.length === 1 ? 50 : 88 - ((local.latitude - minLat) / latSpan) * 76;
      return { local, xPct, yPct };
    });
  }, [locais]);

  const handleAbrirNoMapa = async (place: GroupedVisitedPlace) => {
    const url = montarUrlMapaRota(place.latitude, place.longitude, place.nome);
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
        <Text style={styles.headerTitle}>Mapa de locais</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Legenda acessível com ícone e cor distintos (US36.3 & US36.5) */}
        <View style={styles.legendRow}>
          {(['posto', 'oficina'] as const).map(tipo => {
            const item = LEGENDA_MAPA_LOCAIS[tipo];
            return (
              <View key={tipo} style={styles.legendItem}>
                <View style={[styles.legendBadge, { backgroundColor: item.cor }]}>
                  <Icon name={item.icone} size={13} color={colors.background} />
                </View>
                <Text style={styles.legendText}>{item.rotulo}</Text>
              </View>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.lime} />
            <Text style={styles.mutedText}>Carregando locais visitados...</Text>
          </View>
        ) : locais.length === 0 ? (
          /* Estado vazio com texto exato da US36.4 */
          <View style={styles.emptyCard}>
            <Icon name="MapPin" size={28} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Nenhum local registrado</Text>
            <Text style={styles.emptyDescription}>{MENSAGEM_MAPA_VAZIO}</Text>
          </View>
        ) : (
          <>
            {/* Área de mapa com marcadores tocáveis */}
            <View style={styles.mapCanvas}>
              <View style={styles.gridLineH1} />
              <View style={styles.gridLineH2} />
              <View style={styles.gridLineV1} />
              <View style={styles.gridLineV2} />

              {projectedMarkers.map(({ local, xPct, yPct }) => {
                const cfg = LEGENDA_MAPA_LOCAIS[local.tipo];
                const isSelected = selectedPlace?.id === local.id;
                return (
                  <TouchableOpacity
                    key={local.id}
                    style={[
                      styles.marker,
                      {
                        left: `${xPct}%`,
                        top: `${yPct}%`,
                        backgroundColor: cfg.cor,
                        borderColor: isSelected ? colors.textPrimary : colors.background,
                      },
                    ]}
                    onPress={() => setSelectedId(local.id)}
                    accessibilityLabel={`${cfg.rotulo}: ${local.nome}`}
                  >
                    <Icon name={cfg.icone} size={14} color={colors.background} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Cartão do marcador selecionado: nome, número de visitas e última data */}
            {selectedPlace ? (
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <View
                    style={[
                      styles.legendBadge,
                      { backgroundColor: LEGENDA_MAPA_LOCAIS[selectedPlace.tipo].cor },
                    ]}
                  >
                    <Icon
                      name={LEGENDA_MAPA_LOCAIS[selectedPlace.tipo].icone}
                      size={14}
                      color={colors.background}
                    />
                  </View>
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailTitle}>{selectedPlace.nome}</Text>
                    <Text style={styles.mutedText}>
                      {LEGENDA_MAPA_LOCAIS[selectedPlace.tipo].rotulo}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.sectionLabel}>VISITAS</Text>
                    <Text style={styles.statValue}>{selectedPlace.visitas}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.sectionLabel}>ÚLTIMA DATA</Text>
                    <Text style={styles.statValue}>
                      {formatarDataColeta(selectedPlace.ultimaData)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.routeBtn}
                  onPress={() => handleAbrirNoMapa(selectedPlace)}
                  activeOpacity={0.8}
                >
                  <Icon name="Navigation" size={15} color={colors.background} />
                  <Text style={styles.routeBtnText}>Abrir no mapa</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Lista resumida de locais agrupados */}
            <Text style={styles.sectionLabel}>LOCAIS VISITADOS ({locais.length})</Text>
            <View style={styles.listCard}>
              {locais.map((local, idx) => {
                const cfg = LEGENDA_MAPA_LOCAIS[local.tipo];
                const isSelected = selectedPlace?.id === local.id;
                return (
                  <TouchableOpacity
                    key={local.id}
                    style={[
                      styles.listRow,
                      idx === locais.length - 1 && styles.listRowLast,
                      isSelected && styles.listRowSelected,
                    ]}
                    onPress={() => setSelectedId(local.id)}
                  >
                    <View style={[styles.legendBadge, { backgroundColor: cfg.cor }]}>
                      <Icon name={cfg.icone} size={13} color={colors.background} />
                    </View>
                    <View style={styles.detailInfo}>
                      <Text style={styles.rowTitle}>{local.nome}</Text>
                      <Text style={styles.mutedText}>
                        {local.visitas} {local.visitas === 1 ? 'visita' : 'visitas'} · Última em{' '}
                        {formatarDataColeta(local.ultimaData)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: { ...typography.caption, color: colors.textPrimary },
  centerBox: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
  mutedText: { ...typography.caption, color: colors.textSecondary },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  emptyDescription: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  mapCanvas: {
    height: MAP_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  gridLineH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33%',
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  gridLineH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66%',
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  gridLineV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33%',
    width: 1,
    backgroundColor: colors.borderSubtle,
  },
  gridLineV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66%',
    width: 1,
    backgroundColor: colors.borderSubtle,
  },
  marker: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: radius.full,
    marginLeft: -16,
    marginTop: -16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  detailCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailInfo: { flex: 1, gap: 2 },
  detailTitle: { ...typography.bodyBold, color: colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  sectionLabel: { ...typography.sectionLabel, color: colors.textMuted },
  statValue: { ...typography.h3, color: colors.textPrimary },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    height: 42,
  },
  routeBtnText: { ...typography.captionBold, color: colors.background },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  listRowLast: { borderBottomWidth: 0 },
  listRowSelected: { opacity: 1 },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
});
