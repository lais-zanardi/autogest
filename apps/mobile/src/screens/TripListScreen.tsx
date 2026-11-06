import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Trip, TripSummary } from '@autogest/shared-types';
import { useTheme, typography } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { TripService } from '../services/tripService';
import { TripFormModal } from '../components/TripFormModal';
import { TripSummaryModal } from '../components/TripSummaryModal';
import { VehicleHeaderSelector } from '../components/VehicleHeaderSelector';

interface TripListScreenProps {
  onClose?: () => void;
  onNavigateToExpense?: () => void;
}

export const TripListScreen: React.FC<TripListScreenProps> = ({
  onClose,
  onNavigateToExpense,
}) => {
  const { colors } = useTheme();
  const selectedVehicle = useAppStore(state => state.selectedVehicle);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [tripFormVisible, setTripFormVisible] = useState(false);

  // Modal de resumo
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<TripSummary | null>(null);

  const carregarViagens = useCallback(async () => {
    if (!selectedVehicle?.id) {
      setTrips([]);
      return;
    }
    setLoading(true);
    try {
      const list = await TripService.listarViagens(selectedVehicle.id);
      setTrips(list);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar as viagens.');
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle?.id]);

  useEffect(() => {
    carregarViagens();
  }, [carregarViagens]);

  const handleVerResumo = async (trip: Trip) => {
    try {
      const { resumo } = await TripService.obterResumoViagem(trip.id);
      setSelectedTrip(trip);
      setSelectedSummary(resumo);
      setSummaryModalVisible(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o resumo da viagem.');
    }
  };

  const handleFinalizarViagemPrompt = (trip: Trip) => {
    const kmSugestao = selectedVehicle?.currentOdometer || trip.startOdometer || 0;
    Alert.prompt(
      'Finalizar Viagem',
      `Informe o odômetro final ao chegar em ${trip.destination} (Km inicial: ${trip.startOdometer} km):`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async text => {
            const numKm = Number(text?.replace(',', '.'));
            if (isNaN(numKm) || numKm <= trip.startOdometer) {
              Alert.alert('Erro', `Km final deve ser maior que ${trip.startOdometer} km.`);
              return;
            }
            try {
              await TripService.finalizarViagem(trip.id, numKm);
              await carregarViagens();
              // Abre resumo da viagem finalizada
              const { resumo } = await TripService.obterResumoViagem(trip.id);
              setSelectedTrip(trip);
              setSelectedSummary(resumo);
              setSummaryModalVisible(true);
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Falha ao finalizar viagem.');
            }
          },
        },
      ],
      'plain-text',
      String(kmSugestao > trip.startOdometer ? kmSugestao : trip.startOdometer + 50),
      'numeric',
    );
  };

  const viagemAtiva = trips.find(t => t.status === 'em_andamento');

  const renderItem = ({ item }: { item: Trip }) => {
    const isAtiva = item.status === 'em_andamento';

    return (
      <View
        style={[
          styles.tripCard,
          {
            backgroundColor: colors.card,
            borderColor: isAtiva ? colors.lime : colors.border,
            borderWidth: isAtiva ? 2 : 1,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>
              {item.origin} ➔ {item.destination}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              Iniciada em {new Date(item.startDate).toLocaleDateString('pt-BR')} • {item.startOdometer} km
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isAtiva ? colors.limeDim || 'rgba(198,255,77,0.15)' : colors.surfaceRaised },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isAtiva ? colors.lime : colors.textSecondary },
              ]}
            >
              {isAtiva ? 'EM ANDAMENTO' : 'FINALIZADA'}
            </Text>
          </View>
        </View>

        {/* Ações do Card */}
        <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border }]}
            onPress={() => handleVerResumo(item)}
          >
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>📊 Resumo & Custos</Text>
          </TouchableOpacity>

          {isAtiva && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.lime, borderColor: colors.lime }]}
              onPress={() => handleFinalizarViagemPrompt(item)}
            >
              <Text style={[styles.actionBtnText, { color: colors.black, fontWeight: '700' }]}>
                🏁 Finalizar Viagem
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topHeader, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>Modo Viagem</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Acompanhe rendimento e custos de trajetos e viagens
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.closeBtnText, { color: colors.textPrimary }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <VehicleHeaderSelector />

      {/* Faixa no Topo com Ação se houver viagem ativa (US07.3) */}
      {viagemAtiva && (
        <View style={[styles.activeBanner, { backgroundColor: colors.surfaceRaised, borderColor: colors.lime }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.lime, fontWeight: '700' }]}>
              🛣️ VIAGEM EM ANDAMENTO
            </Text>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              {viagemAtiva.origin} ➔ {viagemAtiva.destination}
            </Text>
          </View>
          {onNavigateToExpense && (
            <TouchableOpacity
              style={[styles.bannerBtn, { backgroundColor: colors.lime }]}
              onPress={onNavigateToExpense}
            >
              <Text style={styles.bannerBtnText}>+ Despesa</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Botão para iniciar nova viagem se não houver ativa */}
      {!viagemAtiva && selectedVehicle && (
        <View style={styles.startBtnContainer}>
          <TouchableOpacity
            style={[styles.newTripBtn, { backgroundColor: colors.lime }]}
            onPress={() => setTripFormVisible(true)}
          >
            <Text style={styles.newTripBtnText}>+ Iniciar Nova Viagem</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.lime} />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛣️</Text>
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 8 }]}>
            Nenhuma viagem registrada
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 32 }]}>
            Cadastre seu ponto de partida e destino para acompanhar consumo da rota e pedágios.
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal de Iniciar Viagem */}
      <TripFormModal
        visible={tripFormVisible}
        vehicle={selectedVehicle}
        onClose={() => setTripFormVisible(false)}
        onSuccess={() => {
          carregarViagens();
        }}
      />

      {/* Modal de Resumo da Viagem */}
      <TripSummaryModal
        visible={summaryModalVisible}
        trip={selectedTrip}
        summary={selectedSummary}
        onClose={() => setSummaryModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  activeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  bannerBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 12,
  },
  startBtnContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newTripBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  newTripBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  tripCard: {
    borderRadius: 12,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnText: {
    ...typography.caption,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 48,
  },
});
