import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { VehicleService } from '../services/vehicleService';
import { VehicleHeaderSelector, UpdateOdometerModal, ExpenseFormModal } from '../components';
import { formatCurrency, formatKml } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';

export const DashboardScreen: React.FC = () => {
  const { user, selectedVehicle, stats } = useAppStore();
  const navigation = useNavigation<any>();
  const [odometerModalVisible, setOdometerModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);

  useEffect(() => {
    VehicleService.listVehicles();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Seletor de Veículo Ativo no Cabeçalho (US04.5) */}
        <VehicleHeaderSelector onAddNewPress={() => navigation.navigate('Garage')} />

        <View style={styles.header}>
          <Text style={styles.greeting}>
            Olá, {user?.name ? user.name.split(' ')[0] : 'Motorista'}! 👋
          </Text>
          <Text style={styles.vehicleSubtitle}>
            {selectedVehicle
              ? `${selectedVehicle.model} • ${selectedVehicle.plate}`
              : 'Nenhum veículo ativo selecionado'}
          </Text>
        </View>

        {!selectedVehicle ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum veículo selecionado</Text>
            <Text style={styles.emptyDesc}>
              Acesse a Garagem para cadastrar ou selecionar um veículo ativo para acompanhar suas
              métricas e abastecimentos.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Garage')}>
              <Text style={styles.emptyBtnText}>Ir para Garagem</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Média Geral</Text>
                <Text style={styles.cardValue}>{formatKml(stats?.averageKml)}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Total Gasto</Text>
                <Text style={styles.cardValue}>{formatCurrency(stats?.totalSpent || 0)}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Custo por Km</Text>
                <Text style={styles.cardValue}>R$ {stats?.costPerKm || '0,00'}/km</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Distância Percorrida</Text>
                <Text style={styles.cardValue}>{stats?.totalDistance || 0} km</Text>
              </View>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.detailsHeader}>
                <Text style={styles.detailsTitle}>Ficha do Veículo Ativo</Text>
                <View style={styles.detailsHeaderActions}>
                  <TouchableOpacity
                    style={styles.actionHeaderBtn}
                    onPress={() => setExpenseModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionHeaderBtnText}>🧾 Despesa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.updateOdoBtn}
                    onPress={() => setOdometerModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.updateOdoBtnText}>⏱️ Atualizar km</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.detailsGrid}>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Ano</Text>
                  <Text style={styles.detailValue}>{selectedVehicle.year}</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Capacidade Tanque</Text>
                  <Text style={styles.detailValue}>{selectedVehicle.tankCapacityL} L</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Combustível Pref.</Text>
                  <Text style={styles.detailValue}>{selectedVehicle.preferredFuel}</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Odômetro Atual</Text>
                  <Text style={styles.detailValue}>
                    {selectedVehicle.currentOdometer || selectedVehicle.initialOdometer || 0} km
                  </Text>
                </View>
              </View>
            </View>

            {selectedVehicle.fipeValue && (
              <View style={styles.fipeBox}>
                <Text style={styles.fipeTitle}>💡 Cotação de Mercado (Tabela FIPE)</Text>
                <Text style={styles.fipeValue}>{formatCurrency(selectedVehicle.fipeValue)}</Text>
              </View>
            )}

            <UpdateOdometerModal
              visible={odometerModalVisible}
              vehicle={selectedVehicle}
              onClose={() => setOdometerModalVisible(false)}
            />

            <ExpenseFormModal
              visible={expenseModalVisible}
              vehicle={selectedVehicle}
              onClose={() => setExpenseModalVisible(false)}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  header: {
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  vehicleSubtitle: {
    ...typography.caption,
    color: colors.lime,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  card: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cardValue: {
    ...typography.h2,
    color: colors.lime,
    marginTop: 6,
  },
  detailsCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailsTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  actionHeaderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionHeaderBtnText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  updateOdoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  updateOdoBtnText: {
    ...typography.captionBold,
    color: colors.lime,
    fontSize: 11,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailCol: {
    flex: 1,
    minWidth: '45%',
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  detailValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  fipeBox: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fipeTitle: {
    ...typography.captionBold,
    color: colors.amber,
  },
  fipeValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  emptyBtn: {
    backgroundColor: colors.lime,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  emptyBtnText: {
    ...typography.bodyBold,
    color: colors.black,
  },
});
