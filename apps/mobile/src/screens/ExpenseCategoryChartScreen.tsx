import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { VehicleHeaderSelector } from '../components/VehicleHeaderSelector';
import { ExpenseCategoryChartCard } from '../components/ExpenseCategoryChartCard';
import { colors, spacing, typography } from '../theme';

export interface ExpenseCategoryChartScreenProps {
  onBack?: () => void;
}

/**
 * US14.2: Tela "Gastos por categoria": gráfico de setores e de barras, alternáveis,
 * com o total do período, seletor de período (mês atual, mês anterior e personalizado),
 * destaque interativo ao toque e paleta acessível para daltônicos.
 */
export const ExpenseCategoryChartScreen: React.FC<ExpenseCategoryChartScreenProps> = ({
  onBack,
}) => {
  const { selectedVehicle } = useAppStore();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backBtn}
              activeOpacity={0.75}
              accessibilityLabel="Voltar"
            >
              <Text style={styles.backBtnText}>← Voltar</Text>
            </TouchableOpacity>
          )}
        </View>

        <VehicleHeaderSelector />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>ANÁLISE DE GASTOS</Text>
          <Text style={styles.title}>Gastos por categoria</Text>
          <Text style={styles.subtitle}>
            {selectedVehicle
              ? `${selectedVehicle.model} • ${selectedVehicle.plate}`
              : 'Selecione um veículo ativo para visualizar os gráficos'}
          </Text>
        </View>

        <ExpenseCategoryChartCard vehicle={selectedVehicle} />
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  backBtn: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backBtnText: {
    ...typography.bodyBold,
    color: colors.lime,
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    marginBottom: 4,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
