import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Expense } from '@autogest/shared-types';
import { useAppStore } from '../store/useAppStore';
import { ExpenseService } from '../services/expenseService';
import {
  obterDetalhamentoGastosDoPeriodo,
  GastosDetalhadosPeriodo,
} from '../services/expenseAggregation';
import {
  ExpenseFormModal,
  ConfirmModal,
  VehicleHeaderSelector,
  UsageAndCostIndicatorsCard,
} from '../components';
import { formatCurrency } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const ReportsScreen: React.FC = () => {
  const { selectedVehicle } = useAppStore();

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [breakdown, setBreakdown] = useState<GastosDetalhadosPeriodo | null>(null);
  const [loading, setLoading] = useState(false);

  // Modais de criação / edição / exclusão
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedVehicle) {
      setExpenses([]);
      setBreakdown(null);
      return;
    }

    setLoading(true);
    try {
      // Lista de despesas do mês selecionado
      const monthExpenses = await ExpenseService.listByMonth(
        selectedVehicle.id,
        selectedYear,
        selectedMonth,
      );
      setExpenses(monthExpenses);

      // Agregação de gastos do mês (despesas + abastecimentos)
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const details = await obterDetalhamentoGastosDoPeriodo(
        selectedVehicle.id,
        startDate,
        endDate,
      );
      setBreakdown(details);
    } catch (e) {
      console.error('Erro ao carregar despesas:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle, selectedYear, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleOpenCreate = () => {
    setExpenseToEdit(null);
    setFormModalVisible(true);
  };

  const handleOpenEdit = (expense: Expense) => {
    setExpenseToEdit(expense);
    setFormModalVisible(true);
  };

  const handleOpenDelete = (expense: Expense) => {
    setExpenseToDelete(expense);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await ExpenseService.deleteExpense(expenseToDelete.id);
      await loadData();
    } catch (e) {
      console.error('Erro ao excluir despesa:', e);
    } finally {
      setDeleteModalVisible(false);
      setExpenseToDelete(null);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Lavagem':
        return '🚿';
      case 'Seguro':
        return '🛡️';
      case 'Imposto':
        return '🏛️';
      case 'Combustível':
        return '⛽';
      case 'Manutenção':
        return '🔧';
      default:
        return '🏷️';
    }
  };

  const currentStartDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const currentLastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const currentEndDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(currentLastDay).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Seletor de Veículo Ativo */}
        <VehicleHeaderSelector />

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ANÁLISE FINANCEIRA</Text>
          <Text style={styles.title}>Relatórios & Despesas</Text>
          <Text style={styles.subtitle}>
            {selectedVehicle
              ? `${selectedVehicle.model} • ${selectedVehicle.plate}`
              : 'Selecione um veículo ativo'}
          </Text>
        </View>

        {/* Barra de Navegação de Mês */}
        <View style={styles.monthNavigator}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={styles.monthNavBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.monthNavBtnText}>◀</Text>
          </TouchableOpacity>
          <View style={styles.monthDisplay}>
            <Text style={styles.monthDisplayText}>
              {MONTH_NAMES[selectedMonth - 1]} / {selectedYear}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleNextMonth}
            style={styles.monthNavBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.monthNavBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        {!selectedVehicle ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Nenhum veículo selecionado</Text>
            <Text style={styles.emptySubtitle}>
              Selecione um veículo no topo para gerenciar suas despesas e relatórios mensais.
            </Text>
          </View>
        ) : (
          <>
            {/* Card de Indicadores de Uso e Custo (US24.1, US24.2, US24.3) */}
            <UsageAndCostIndicatorsCard
              vehicle={selectedVehicle}
              externalRange={{
                inicio: currentStartDate,
                fim: currentEndDate,
                label: `${MONTH_NAMES[selectedMonth - 1].substring(0, 3)}/${selectedYear}`,
              }}
              refreshTrigger={expenses.length + (breakdown?.total || 0)}
            />

            {/* Card de Resumo Agregado do Mês (US22.3 e US22.4) */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View>
                  <Text style={styles.summaryLabel}>Total Geral de Gastos no Mês</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(breakdown?.total || 0)}</Text>
                </View>
                <View style={styles.despesasBadge}>
                  <Text style={styles.despesasBadgeLabel}>Despesas Manuais</Text>
                  <Text style={styles.despesasBadgeValue}>
                    {formatCurrency(breakdown?.totalDespesas || 0)}
                  </Text>
                </View>
              </View>

              {/* Categorização por tipo */}
              <View style={styles.categoryPillsRow}>
                <View style={styles.pillItem}>
                  <Text style={styles.pillLabel}>⛽ Combustível</Text>
                  <Text style={styles.pillValue}>
                    {formatCurrency(breakdown?.porCategoria['Combustível'] || 0)}
                  </Text>
                </View>
                <View style={styles.pillItem}>
                  <Text style={styles.pillLabel}>🔧 Manutenção</Text>
                  <Text style={styles.pillValue}>
                    {formatCurrency(breakdown?.porCategoria['Manutenção'] || 0)}
                  </Text>
                </View>
                <View style={styles.pillItem}>
                  <Text style={styles.pillLabel}>🚿 Lavagem</Text>
                  <Text style={styles.pillValue}>
                    {formatCurrency(breakdown?.porCategoria['Lavagem'] || 0)}
                  </Text>
                </View>
                <View style={styles.pillItem}>
                  <Text style={styles.pillLabel}>🛡️ Seguro</Text>
                  <Text style={styles.pillValue}>
                    {formatCurrency(breakdown?.porCategoria['Seguro'] || 0)}
                  </Text>
                </View>
                <View style={styles.pillItem}>
                  <Text style={styles.pillLabel}>🏛️ Imposto</Text>
                  <Text style={styles.pillValue}>
                    {formatCurrency(breakdown?.porCategoria['Imposto'] || 0)}
                  </Text>
                </View>
                <View style={styles.pillItem}>
                  <Text style={styles.pillLabel}>🏷️ Outros / Pedágio</Text>
                  <Text style={styles.pillValue}>
                    {formatCurrency(breakdown?.porCategoria['Outros'] || 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Cabeçalho da Seção de Despesas com Botão + Nova Despesa */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Despesas Lançadas</Text>
                <Text style={styles.sectionSubtitle}>
                  {expenses.length === 1 ? '1 lançamento' : `${expenses.length} lançamentos`} no mês
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addExpenseBtn}
                onPress={handleOpenCreate}
                activeOpacity={0.8}
              >
                <Text style={styles.addExpenseBtnText}>+ Nova Despesa</Text>
              </TouchableOpacity>
            </View>

            {/* Lista de Despesas */}
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.lime} />
              </View>
            ) : expenses.length === 0 ? (
              <View style={styles.emptyExpensesBox}>
                <Text style={styles.emptyExpensesIcon}>🧾</Text>
                <Text style={styles.emptyExpensesTitle}>Nenhuma despesa neste mês</Text>
                <Text style={styles.emptyExpensesText}>
                  Registre lavagens, pedágios, seguros e impostos para consolidar seus custos.
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={handleOpenCreate}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyAddBtnText}>Registrar Primeira Despesa</Text>
                </TouchableOpacity>
              </View>
            ) : (
              expenses.map(item => {
                const itemDate = new Date(item.date).toLocaleDateString('pt-BR');
                return (
                  <View key={item.id} style={styles.expenseCard}>
                    <View style={styles.expenseLeft}>
                      <View style={styles.categoryIconCircle}>
                        <Text style={styles.categoryIconText}>
                          {getCategoryIcon(item.category)}
                        </Text>
                      </View>
                      <View style={styles.expenseInfo}>
                        <View style={styles.expenseCategoryRow}>
                          <Text style={styles.expenseCategory}>{item.category}</Text>
                          <Text style={styles.expenseDate}>{itemDate}</Text>
                        </View>
                        {item.description && (
                          <Text style={styles.expenseDesc} numberOfLines={1}>
                            {item.description}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.expenseRight}>
                      <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={styles.itemActionBtn}
                          onPress={() => handleOpenEdit(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.itemActionBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.itemActionBtn, styles.itemDeleteBtn]}
                          onPress={() => handleOpenDelete(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.itemActionBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* Modal de Formulário de Despesa (US22.2) */}
        <ExpenseFormModal
          visible={formModalVisible}
          vehicle={selectedVehicle}
          expenseToEdit={expenseToEdit}
          onClose={() => setFormModalVisible(false)}
          onSuccess={() => loadData()}
        />

        {/* Modal de Confirmação de Exclusão (US22.3) */}
        <ConfirmModal
          visible={deleteModalVisible}
          title="Excluir Despesa?"
          message={
            expenseToDelete
              ? `Tem certeza que deseja excluir a despesa de ${expenseToDelete.category} no valor de ${formatCurrency(expenseToDelete.amount)}?`
              : 'Tem certeza que deseja excluir esta despesa?'
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteModalVisible(false);
            setExpenseToDelete(null);
          }}
        />
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
    paddingBottom: 80,
  },
  header: {
    marginBottom: spacing.md,
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
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  monthNavBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  monthNavBtnText: {
    color: colors.lime,
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthDisplay: {
    paddingVertical: spacing.xs,
  },
  monthDisplayText: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: spacing.sm,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.lime,
    marginTop: 4,
  },
  despesasBadge: {
    alignItems: 'flex-end',
  },
  despesasBadgeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  despesasBadgeValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 2,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pillItem: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pillLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  pillValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addExpenseBtn: {
    backgroundColor: colors.lime,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  addExpenseBtnText: {
    ...typography.captionBold,
    color: colors.black,
    fontWeight: '700',
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyExpensesBox: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyExpensesIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  emptyExpensesTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyExpensesText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  emptyAddBtn: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  emptyAddBtnText: {
    ...typography.captionBold,
    color: colors.lime,
  },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  categoryIconText: {
    fontSize: 18,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  expenseCategory: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  expenseDate: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  expenseDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    ...typography.bodyBold,
    color: colors.lime,
    fontSize: 15,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  itemActionBtn: {
    padding: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  itemActionBtnText: {
    fontSize: 11,
  },
  itemDeleteBtn: {
    borderColor: 'rgba(224, 90, 90, 0.3)',
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
