import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';

export const ReportsScreen: React.FC = () => {
  const { stats, selectedVehicle } = useAppStore();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ANÁLISE FINANCEIRA</Text>
          <Text style={styles.title}>Relatórios & Despesas</Text>
          <Text style={styles.subtitle}>
            {selectedVehicle
              ? `Veículo ativo: ${selectedVehicle.model} (${selectedVehicle.plate})`
              : 'Nenhum veículo ativo selecionado'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Distribuição por Combustível</Text>
          {stats?.fuelDistribution && Object.keys(stats.fuelDistribution).length > 0 ? (
            Object.entries(stats.fuelDistribution).map(([fuel, value]) => (
              <View key={fuel} style={styles.row}>
                <Text style={styles.fuelLabel}>{fuel}</Text>
                <Text style={styles.fuelValue}>{formatCurrency(value)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Sem dados de abastecimento no período.</Text>
          )}
        </View>
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
  content: {
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  fuelLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  fuelValue: {
    ...typography.bodyBold,
    color: colors.lime,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
