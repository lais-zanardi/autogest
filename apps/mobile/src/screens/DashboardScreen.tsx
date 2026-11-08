import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { VehicleService } from '../services/vehicleService';
import { MaintenanceService } from '../services/maintenanceService';
import { TireAndFluidService } from '../services/tireAndFluidService';
import { DashboardIndicatorsService } from '../services/dashboardIndicators';
import {
  VehicleHeaderSelector,
  UpdateOdometerModal,
  ExpenseFormModal,
  FixedCostFormModal,
  MaintenanceFormModal,
  MaintenanceHistoryCard,
  MaintenanceAlertsCard,
  MaintenanceRuleModal,
  UsageAndCostIndicatorsCard,
  TireAndFluidModal,
  TireAndFluidCard,
  TireFluidTab,
  CoachMarkTarget,
  ConfirmModal,
  BudgetCard,
  BudgetModal,
} from '../components';
import { EfficiencyGoalCard } from '../components/EfficiencyGoalCard';
import { formatCurrency, formatKml, formatDecimal } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';
import { Maintenance, TireRecord, FluidRecord, Trip, EfficiencyGoal, GoalStatusResult, EcoTip } from '@autogest/shared-types';
import { TripService } from '../services/tripService';
import { EfficiencyGoalRepository } from '../repositories/EfficiencyGoalRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { statusDaMeta, perfilDeRodagem, recomendar } from '../services/efficiencyGoalService';
import catalogJson from '../assets/eco_tips_catalog.json';

export const DashboardScreen: React.FC = () => {
  const { user, selectedVehicle, dashboardIndicators, isLoadingDashboard } = useAppStore();
  const navigation = useNavigation<any>();
  const [odometerModalVisible, setOdometerModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [fixedCostModalVisible, setFixedCostModalVisible] = useState(false);
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [maintenanceToEdit, setMaintenanceToEdit] = useState<Maintenance | null>(null);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<Maintenance | null>(null);
  const [refreshMaintTrigger, setRefreshMaintTrigger] = useState(0);
  const [rulesModalVisible, setRulesModalVisible] = useState(false);
  const [refreshAlertsTrigger, setRefreshAlertsTrigger] = useState(0);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [refreshBudgetTrigger, setRefreshBudgetTrigger] = useState(0);
  const [tireFluidModalVisible, setTireFluidModalVisible] = useState(false);
  const [tireFluidTab, setTireFluidTab] = useState<TireFluidTab>('pneu');
  const [tireToEdit, setTireToEdit] = useState<TireRecord | null>(null);
  const [fluidToEdit, setFluidToEdit] = useState<FluidRecord | null>(null);
  const [tireToDelete, setTireToDelete] = useState<TireRecord | null>(null);
  const [fluidToDelete, setFluidToDelete] = useState<FluidRecord | null>(null);
  const [refreshTireFluidTrigger, setRefreshTireFluidTrigger] = useState(0);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [efficiencyGoal, setEfficiencyGoal] = useState<EfficiencyGoal | null>(null);
  const [goalStatus, setGoalStatus] = useState<GoalStatusResult>({
    progresso: 0,
    situacao: 'sem_dados',
    percentual: 0,
  });
  const [topEcoTip, setTopEcoTip] = useState<EcoTip | undefined>(undefined);

  useEffect(() => {
    if (selectedVehicle?.id) {
      const loadGoalData = async () => {
        try {
          const g = await EfficiencyGoalRepository.findByVehicle(selectedVehicle.id);
          setEfficiencyGoal(g);
          const refuels = await RefuelRepository.listByVehicle(selectedVehicle.id);
          const profile = perfilDeRodagem(refuels, g?.targetKml);
          const st = statusDaMeta(profile.consumoMedioKml, g?.targetKml);
          setGoalStatus(st);
          const catalog = (catalogJson as any)?.dicas || [];
          const tips = recomendar(profile, catalog);
          setTopEcoTip(tips[0]);
        } catch (e) {
          console.error('Erro ao carregar meta de eficiência no dashboard:', e);
        }
      };
      loadGoalData();
    } else {
      setEfficiencyGoal(null);
      setGoalStatus({ progresso: 0, situacao: 'sem_dados', percentual: 0 });
      setTopEcoTip(undefined);
    }
  }, [selectedVehicle?.id, refreshAlertsTrigger, refreshMaintTrigger]);

  useEffect(() => {
    if (selectedVehicle?.id) {
      TripService.obterViagemAtiva(selectedVehicle.id)
        .then(setActiveTrip)
        .catch(() => setActiveTrip(null));
    } else {
      setActiveTrip(null);
    }
  }, [selectedVehicle?.id]);

  useEffect(() => {
    VehicleService.listVehicles();
    let cleanup: (() => void) | undefined;
    import('../services/maintenanceAlertService').then(({ MaintenanceAlertService }) => {
      MaintenanceAlertService.startPeriodicEvaluation();
      cleanup = () => MaintenanceAlertService.stopPeriodicEvaluation();
    });
    return () => {
      cleanup?.();
    };
  }, []);

  // US13.3 & US10.5: Recalcula indicadores globais e reavalia regras preventivas ao abrir / alternar veículo
  useEffect(() => {
    if (selectedVehicle?.id) {
      DashboardIndicatorsService.refreshForVehicle(selectedVehicle.id).catch(() => {});
    }
  }, [selectedVehicle?.id, refreshAlertsTrigger, refreshMaintTrigger]);

  const nextMaint = dashboardIndicators?.nextMaintenance || null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Seletor de Veículo Ativo no Cabeçalho (US04.5) */}
        <VehicleHeaderSelector onAddNewPress={() => navigation.navigate('Garage')} />

        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.greeting}>
                Olá, {user?.name ? user.name.split(' ')[0] : 'Motorista'}!
              </Text>
              <Text style={styles.vehicleSubtitle}>
                {selectedVehicle
                  ? `${selectedVehicle.model} • ${selectedVehicle.plate}`
                  : 'Nenhum veículo ativo selecionado'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => navigation.navigate('MaintenanceScheduleModal', { vehicleId: selectedVehicle?.id })}
                accessibilityLabel="Agendamentos de Manutenção"
              >
                <Icon name="Calendar" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => navigation.navigate('TripModal')}
                accessibilityLabel="Modo Viagem"
              >
                <Icon name="Navigation" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => navigation.navigate('SearchModal')}
                accessibilityLabel="Buscar registros do veículo"
              >
                <Icon name="Search" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* US07.3: Banner de Viagem Ativa no Topo do Dashboard */}
        {activeTrip && (
          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.lime,
              borderWidth: 1.5,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onPress={() => navigation.navigate('TripModal')}
            activeOpacity={0.8}
            accessibilityLabel="Ver viagem em andamento"
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="Navigation" size={14} color={colors.lime} />
                <Text style={{ ...typography.caption, color: colors.lime, fontWeight: '700' }}>
                  VIAGEM EM ANDAMENTO
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary }}>
                  {activeTrip.origin}
                </Text>
                <Icon name="ArrowRight" size={12} color={colors.textSecondary} />
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary }}>
                  {activeTrip.destination}
                </Text>
              </View>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Km inicial: {activeTrip.startOdometer} km
              </Text>
            </View>
            <View style={{ backgroundColor: colors.lime, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}>
              <Text style={{ color: colors.black, fontWeight: '700', fontSize: 11 }}>Ver Viagem</Text>
            </View>
          </TouchableOpacity>
        )}

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
        ) : isLoadingDashboard && !dashboardIndicators ? (
          /* US13.4: Estado de Carregamento do Dashboard */
          <View style={styles.loadingCard} accessibilityLabel="Carregando indicadores do painel">
            <ActivityIndicator size="large" color={colors.lime} />
            <Text style={styles.loadingTitle}>Calculando indicadores em tempo real...</Text>
            <Text style={styles.loadingDesc}>
              Consolidando gastos do mês, consumo médio, autonomia e alertas preventivos.
            </Text>
          </View>
        ) : (
          <>
            {/* US13.4: Banner de Estado Vazio (sem lançamentos registrados para o veículo) */}
            {dashboardIndicators && !dashboardIndicators.hasData && (
              <View style={styles.noDataBanner} accessibilityLabel="Veículo sem registros">
                <Text style={styles.noDataEyebrow}>PAINEL SEM LANÇAMENTOS</Text>
                <Text style={styles.noDataTitle}>Comece a registrar os dados do veículo</Text>
                <Text style={styles.noDataDesc}>
                  Ainda não há abastecimentos, despesas ou manutenções para {selectedVehicle.model}.
                  Registre seu primeiro lançamento para calcular consumo médio, custo/km e autonomia
                  projetada em tempo real.
                </Text>
                <View style={styles.noDataActions}>
                  <TouchableOpacity
                    style={styles.noDataPrimaryBtn}
                    onPress={() => setExpenseModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.noDataPrimaryBtnText}>+ Lançar Despesa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.noDataSecondaryBtn}
                    onPress={() => setOdometerModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.noDataSecondaryBtnText}>Atualizar Km</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* US13.1, US13.2 & US13.4: Cartões Consolidados de Indicadores do Dashboard */}
            <CoachMarkTarget targetId="tour-target-dashboard-metrics">
              <View style={styles.grid}>
                {/* 1. Gasto Total do Mês */}
                <TouchableOpacity
                  style={[styles.card, styles.cardHighlight]}
                  onPress={() => navigation.navigate('Reports')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardEyebrow}>RESUMO FINANCEIRO</Text>
                  <Text style={styles.cardLabel}>Gasto Total do Mês</Text>
                  <Text style={styles.cardValue}>
                    {formatCurrency(dashboardIndicators?.monthTotalSpent || 0)}
                  </Text>
                  <Text style={styles.cardSubtext}>Toque para ver detalhes →</Text>
                </TouchableOpacity>

                {/* 2. Custo Médio / Km */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => navigation.navigate('Reports')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardEyebrow}>EFICIÊNCIA</Text>
                  <Text style={styles.cardLabel}>Custo Médio / Km</Text>
                  <Text style={styles.cardValue}>
                    {dashboardIndicators && dashboardIndicators.averageCostPerKm > 0
                      ? `${formatCurrency(dashboardIndicators.averageCostPerKm)}/km`
                      : 'R$ 0,00/km'}
                  </Text>
                  <Text style={styles.cardSubtext}>Variáveis + fixos</Text>
                </TouchableOpacity>

                {/* 3. Consumo Médio (Toque abre tela de Consumo e Média Móvel US25) */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => navigation.navigate('ConsumptionModal')}
                  activeOpacity={0.8}
                  accessibilityLabel="Ver gráfico e média móvel de consumo"
                >
                  <Text style={styles.cardEyebrow}>RENDIMENTO</Text>
                  <Text style={styles.cardLabel}>Consumo Médio</Text>
                  <Text style={styles.cardValue}>
                    {formatKml(dashboardIndicators?.averageConsumptionKml)}
                  </Text>
                  <Text style={styles.cardSubtext}>
                    Toque para ver histórico e média móvel
                  </Text>
                </TouchableOpacity>

                {/* 4. Autonomia Projetada (US13.2) */}
                <View style={styles.card}>
                  <Text style={styles.cardEyebrow}>TANQUE ({selectedVehicle.tankCapacityL} L)</Text>
                  <Text style={styles.cardLabel}>Autonomia Projetada</Text>
                  <Text style={styles.cardValue}>
                    {formatDecimal(dashboardIndicators?.projectedAutonomyKm || 0, 0)} km
                  </Text>
                  <Text style={styles.cardSubtext}>Estimativa restante</Text>
                </View>

                {/* 5. Quilometragem Total */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => setOdometerModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardEyebrow}>HODÔMETRO</Text>
                  <Text style={styles.cardLabel}>Quilometragem Total</Text>
                  <Text style={styles.cardValueWhite}>
                    {(
                      dashboardIndicators?.totalMileageKm ||
                      selectedVehicle.currentOdometer ||
                      selectedVehicle.initialOdometer ||
                      0
                    ).toLocaleString('pt-BR')}{' '}
                    km
                  </Text>
                  <Text style={styles.cardSubtext}>Toque para atualizar km</Text>
                </TouchableOpacity>

                {/* 6. Próxima Manutenção (US10.6) */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    nextMaint?.status === 'vencido'
                      ? styles.cardAlertOverdue
                      : nextMaint?.status === 'proximo'
                        ? styles.cardAlertUpcoming
                        : null,
                  ]}
                  onPress={() => setRulesModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon
                      name={nextMaint?.status === 'vencido' ? 'AlertTriangle' : 'Bell'}
                      size={12}
                      color={
                        nextMaint?.status === 'vencido'
                          ? colors.error
                          : nextMaint?.status === 'proximo'
                            ? colors.amber
                            : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.cardEyebrow,
                        nextMaint?.status === 'vencido'
                          ? { color: colors.error }
                          : nextMaint?.status === 'proximo'
                            ? { color: colors.amber }
                            : null,
                      ]}
                    >
                      {nextMaint?.status === 'vencido'
                        ? 'MANUTENÇÃO VENCIDA'
                        : 'PRÓXIMA MANUTENÇÃO'}
                    </Text>
                  </View>
                  <Text style={styles.cardLabel} numberOfLines={1}>
                    {nextMaint ? nextMaint.serviceName : 'Revisões em Dia'}
                  </Text>
                  <Text
                    style={[
                      styles.cardMaintValue,
                      nextMaint?.status === 'vencido'
                        ? { color: colors.error }
                        : nextMaint?.status === 'proximo'
                          ? { color: colors.amber }
                          : { color: colors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {nextMaint
                      ? nextMaint.remainingKm !== null && nextMaint.remainingKm !== undefined
                        ? `${nextMaint.remainingKm} km`
                        : nextMaint.remainingDays !== null && nextMaint.remainingDays !== undefined
                          ? `${nextMaint.remainingDays} dias`
                          : nextMaint.status.toUpperCase()
                      : 'Sem alertas'}
                  </Text>
                  <Text style={styles.cardSubtext} numberOfLines={1}>
                    {nextMaint ? nextMaint.message : 'Configurar alertas →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </CoachMarkTarget>

            <View style={styles.detailsCard}>
              <View style={styles.detailsHeader}>
                <Text style={styles.detailsTitle}>Ficha do Veículo Ativo</Text>
                <View style={styles.detailsHeaderActions}>
                  <TouchableOpacity
                    style={[styles.actionHeaderBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => setExpenseModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Icon name="Receipt" size={13} color={colors.textPrimary} />
                    <Text style={styles.actionHeaderBtnText}>Despesa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionHeaderBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => setFixedCostModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Icon name="Pin" size={13} color={colors.textPrimary} />
                    <Text style={styles.actionHeaderBtnText}>Fixo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionHeaderBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => {
                      setMaintenanceToEdit(null);
                      setMaintenanceModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon name="Wrench" size={13} color={colors.textPrimary} />
                    <Text style={styles.actionHeaderBtnText}>Manutenção</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.updateOdoBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => setOdometerModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Icon name="Gauge" size={13} color={colors.black} />
                    <Text style={styles.updateOdoBtnText}>Atualizar km</Text>
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
                    {dashboardIndicators?.totalMileageKm ||
                      selectedVehicle.currentOdometer ||
                      selectedVehicle.initialOdometer ||
                      0}{' '}
                    km
                  </Text>
                </View>
              </View>
            </View>

            {selectedVehicle.fipeValue ? (
              <TouchableOpacity
                style={styles.fipeBox}
                onPress={() => navigation.navigate('VehicleMarketValueModal')}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="TrendingDown" size={14} color={colors.lime} />
                    <Text style={styles.fipeTitle}>Cotação de Mercado (Tabela FIPE)</Text>
                  </View>
                  <Text style={{ color: colors.lime, fontSize: 12 }}>Histórico ›</Text>
                </View>
                <Text style={styles.fipeValue}>{formatCurrency(selectedVehicle.fipeValue)}</Text>
              </TouchableOpacity>
            ) : null}

            {/* US08.6: Cartão de Metas de Eficiência e Dicas */}
            <EfficiencyGoalCard
              goal={efficiencyGoal}
              status={goalStatus}
              averageKml={dashboardIndicators?.averageConsumptionKml || null}
              topTip={topEcoTip}
              onPressManage={() => navigation.navigate('EfficiencyGoalsModal')}
            />

            {/* Cartão de Teto Orçamentário Mensal (US15.6) */}
            <BudgetCard
              vehicle={selectedVehicle}
              onConfigurePress={() => setBudgetModalVisible(true)}
              refreshTrigger={
                refreshBudgetTrigger +
                refreshAlertsTrigger +
                refreshMaintTrigger +
                (dashboardIndicators?.monthTotalSpent || 0)
              }
            />

            {/* Indicadores de Uso (km/dia, semana, mês) e Custo/Km Detalhado (US24.1, US24.2, US24.3) */}
            <UsageAndCostIndicatorsCard
              vehicle={selectedVehicle}
              refreshTrigger={
                refreshAlertsTrigger +
                refreshMaintTrigger +
                (dashboardIndicators?.monthTotalSpent || 0)
              }
            />

            {/* Alertas Preventivos e Próximas Revisões (US10.6) */}
            <MaintenanceAlertsCard
              vehicle={selectedVehicle}
              onOpenRulesPress={() => setRulesModalVisible(true)}
              onRegisterMaintenancePress={() => {
                setMaintenanceToEdit(null);
                setMaintenanceModalVisible(true);
              }}
              refreshTrigger={refreshAlertsTrigger + refreshMaintTrigger}
            />

            {/* Controle de Pneus e Fluidos (US11.2, US11.3, US11.4) */}
            <TireAndFluidCard
              vehicle={selectedVehicle}
              onAddNewPress={tab => {
                setTireToEdit(null);
                setFluidToEdit(null);
                setTireFluidTab(tab);
                setTireFluidModalVisible(true);
              }}
              onEditTirePress={record => {
                setFluidToEdit(null);
                setTireToEdit(record);
                setTireFluidModalVisible(true);
              }}
              onDeleteTirePress={record => setTireToDelete(record)}
              onEditFluidPress={record => {
                setTireToEdit(null);
                setFluidToEdit(record);
                setTireFluidModalVisible(true);
              }}
              onDeleteFluidPress={record => setFluidToDelete(record)}
              refreshTrigger={refreshTireFluidTrigger + refreshAlertsTrigger}
            />

            {/* Histórico e Ações de Manutenção (US09.7) */}
            <MaintenanceHistoryCard
              vehicle={selectedVehicle}
              onAddNewPress={() => {
                setMaintenanceToEdit(null);
                setMaintenanceModalVisible(true);
              }}
              onEditPress={m => {
                setMaintenanceToEdit(m);
                setMaintenanceModalVisible(true);
              }}
              onDeletePress={m => setMaintenanceToDelete(m)}
              refreshTrigger={refreshMaintTrigger}
            />

            <TireAndFluidModal
              visible={tireFluidModalVisible}
              vehicle={selectedVehicle}
              initialTab={tireFluidTab}
              tireToEdit={tireToEdit}
              fluidToEdit={fluidToEdit}
              onClose={() => setTireFluidModalVisible(false)}
              onSuccess={() => {
                setRefreshTireFluidTrigger(prev => prev + 1);
                setRefreshAlertsTrigger(prev => prev + 1);
              }}
            />

            <ConfirmModal
              visible={!!tireToDelete}
              title="Excluir Registro de Pneu"
              message="Deseja realmente excluir este registro de pneu? Esta ação ocultará o registro do histórico."
              onConfirm={async () => {
                if (tireToDelete) {
                  await TireAndFluidService.deleteTireRecord(tireToDelete.id);
                  setTireToDelete(null);
                  setRefreshTireFluidTrigger(prev => prev + 1);
                  setRefreshAlertsTrigger(prev => prev + 1);
                }
              }}
              onCancel={() => setTireToDelete(null)}
            />

            <ConfirmModal
              visible={!!fluidToDelete}
              title="Excluir Registro de Fluido"
              message="Deseja realmente excluir este registro de fluido? Esta ação ocultará o registro do histórico."
              onConfirm={async () => {
                if (fluidToDelete) {
                  await TireAndFluidService.deleteFluidRecord(fluidToDelete.id);
                  setFluidToDelete(null);
                  setRefreshTireFluidTrigger(prev => prev + 1);
                  setRefreshAlertsTrigger(prev => prev + 1);
                }
              }}
              onCancel={() => setFluidToDelete(null)}
            />

            <UpdateOdometerModal
              visible={odometerModalVisible}
              vehicle={selectedVehicle}
              onClose={() => setOdometerModalVisible(false)}
              onSuccess={() => setRefreshAlertsTrigger(prev => prev + 1)}
            />

            <ExpenseFormModal
              visible={expenseModalVisible}
              vehicle={selectedVehicle}
              onClose={() => setExpenseModalVisible(false)}
              onSuccess={() => setRefreshAlertsTrigger(prev => prev + 1)}
            />

            <FixedCostFormModal
              visible={fixedCostModalVisible}
              vehicle={selectedVehicle}
              onClose={() => setFixedCostModalVisible(false)}
              onSuccess={() => setRefreshAlertsTrigger(prev => prev + 1)}
            />

            <MaintenanceFormModal
              visible={maintenanceModalVisible}
              vehicle={selectedVehicle}
              maintenanceToEdit={maintenanceToEdit}
              onClose={() => setMaintenanceModalVisible(false)}
              onSuccess={() => {
                setRefreshMaintTrigger(prev => prev + 1);
                setRefreshAlertsTrigger(prev => prev + 1);
              }}
            />

            <MaintenanceRuleModal
              visible={rulesModalVisible}
              vehicle={selectedVehicle}
              onClose={() => setRulesModalVisible(false)}
              onSuccess={() => setRefreshAlertsTrigger(prev => prev + 1)}
            />

            <BudgetModal
              visible={budgetModalVisible}
              vehicle={selectedVehicle}
              onClose={() => setBudgetModalVisible(false)}
              onSuccess={() => setRefreshBudgetTrigger(prev => prev + 1)}
            />

            <ConfirmModal
              visible={!!maintenanceToDelete}
              title="Excluir Manutenção"
              message="Deseja realmente excluir este registro de manutenção? Esta ação ocultará o registro do histórico."
              onConfirm={async () => {
                if (maintenanceToDelete) {
                  await MaintenanceService.deleteMaintenance(maintenanceToDelete.id);
                  setMaintenanceToDelete(null);
                  setRefreshMaintTrigger(prev => prev + 1);
                  setRefreshAlertsTrigger(prev => prev + 1);
                }
              }}
              onCancel={() => setMaintenanceToDelete(null)}
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
  loadingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  loadingTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  loadingDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  noDataBanner: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(198, 255, 77, 0.3)',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noDataEyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    fontSize: 10,
    marginBottom: 4,
  },
  noDataTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  noDataDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  noDataActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noDataPrimaryBtn: {
    backgroundColor: colors.lime,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  noDataPrimaryBtnText: {
    ...typography.captionBold,
    color: colors.black,
    fontWeight: '700',
  },
  noDataSecondaryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  noDataSecondaryBtnText: {
    ...typography.captionBold,
    color: colors.textPrimary,
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
  cardHighlight: {
    borderColor: 'rgba(198, 255, 77, 0.35)',
  },
  cardAlertOverdue: {
    borderColor: 'rgba(224, 90, 90, 0.45)',
  },
  cardAlertUpcoming: {
    borderColor: 'rgba(245, 200, 66, 0.4)',
  },
  cardEyebrow: {
    ...typography.sectionLabel,
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 2,
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
  cardValueWhite: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 6,
  },
  cardMaintValue: {
    ...typography.h3,
    marginTop: 6,
  },
  cardSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
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
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  detailsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    marginBottom: spacing.md,
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
