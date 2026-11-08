import {
  DashboardIndicators,
  DashboardStats,
  FuelType,
  MaintenanceAlert,
} from '@autogest/shared-types';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';
import { TireRecordRepository } from '../repositories/TireRecordRepository';
import { FluidRecordRepository } from '../repositories/FluidRecordRepository';
import {
  obterIndicadoresUsoECustoDoPeriodo,
  resolverIntervaloPeriodo,
} from './usageAndCostIndicators';
import { MaintenanceAlertService } from './maintenanceAlertService';
import { useAppStore } from '../store/useAppStore';

export interface CalcularAutonomiaParams {
  capacidadeTanqueL: number;
  consumoMedioKml: number;
  kmAtual: number;
  kmUltimoAbastecimento?: number | null;
}

export interface CalcularQuilometragemTotalParams {
  currentOdometer?: number | null;
  initialOdometer?: number | null;
  leituras?: Array<{ km: number }>;
  abastecimentos?: Array<{ odometer: number }>;
  manutencoes?: Array<{ odometer: number }>;
}

export interface CalcularIndicadoresDashboardPuroParams {
  vehicleId: string;
  capacidadeTanqueL: number;
  currentOdometer?: number | null;
  initialOdometer?: number | null;
  gastoTotalMesVariavel: number;
  custoFixoMensal?: number;
  custoMedioPorKm: number | null;
  abastecimentos: Array<{
    odometer: number;
    calculatedKml?: number | null;
    totalValue?: number;
    date?: string;
  }>;
  despesasCount?: number;
  manutencoesCount?: number;
  pneusCount?: number;
  fluidosCount?: number;
  leituras?: Array<{ km: number; date?: string }>;
  alertasAtivos?: MaintenanceAlert[];
  loadDurationMs?: number;
}

/**
 * US13.2 (Decisão #5 confirmada):
 * Autonomia = capacidade do tanque × consumo médio − km desde o último abastecimento (mínimo 0),
 * supondo tanque cheio no último abastecimento.
 */
export function calcularAutonomiaProjetada(params: CalcularAutonomiaParams): number {
  const capacidadeTanqueL = Math.max(0, Number(params.capacidadeTanqueL) || 0);
  const consumoMedioKml = Math.max(0, Number(params.consumoMedioKml) || 0);

  if (capacidadeTanqueL <= 0 || consumoMedioKml <= 0) {
    return 0;
  }

  const kmAtual = Math.max(0, Number(params.kmAtual) || 0);
  const kmUltimo =
    params.kmUltimoAbastecimento !== null && params.kmUltimoAbastecimento !== undefined
      ? Math.max(0, Number(params.kmUltimoAbastecimento) || 0)
      : kmAtual;

  const kmDesdeUltimoAbastecimento = Math.max(0, kmAtual - kmUltimo);
  const autonomiaBruta = capacidadeTanqueL * consumoMedioKml - kmDesdeUltimoAbastecimento;

  return Math.max(0, Number(autonomiaBruta.toFixed(2)));
}

/**
 * US13.1: Selector puro de consumo médio (km/l) a partir dos abastecimentos com consumo apurado (US05.5).
 */
export function calcularConsumoMedioSelector(
  abastecimentos: Array<{ calculatedKml?: number | null; odometer?: number }>,
): number {
  if (!abastecimentos || abastecimentos.length === 0) {
    return 0;
  }

  const validKmls = abastecimentos
    .map(r =>
      r.calculatedKml !== null && r.calculatedKml !== undefined ? Number(r.calculatedKml) : 0,
    )
    .filter(val => !isNaN(val) && val > 0);

  if (validKmls.length === 0) {
    return 0;
  }

  const soma = validKmls.reduce((acc, curr) => acc + curr, 0);
  return Number((soma / validKmls.length).toFixed(2));
}

/**
 * US13.1: Selector puro de quilometragem total consolidada do veículo.
 */
export function calcularQuilometragemTotalSelector(
  params: CalcularQuilometragemTotalParams,
): number {
  let maxKm = Math.max(0, Number(params.currentOdometer) || 0, Number(params.initialOdometer) || 0);

  for (const l of params.leituras || []) {
    const val = Number(l.km) || 0;
    if (val > maxKm) maxKm = val;
  }

  for (const a of params.abastecimentos || []) {
    const val = Number(a.odometer) || 0;
    if (val > maxKm) maxKm = val;
  }

  for (const m of params.manutencoes || []) {
    const val = Number(m.odometer) || 0;
    if (val > maxKm) maxKm = val;
  }

  return Number(maxKm.toFixed(2));
}

/**
 * US13.1 & US10.6: Selector puro para obter a próxima manutenção prioritária a partir da lista de alertas ativos.
 * Ordena vencidos primeiro e depois o menor prazo restante (em dias ou km).
 */
export function selecionarProximaManutencao(alertas: MaintenanceAlert[]): MaintenanceAlert | null {
  if (!alertas || alertas.length === 0) {
    return null;
  }

  const ordenados = [...alertas].sort((a, b) => {
    if (a.status === 'vencido' && b.status !== 'vencido') return -1;
    if (a.status !== 'vencido' && b.status === 'vencido') return 1;

    const kmA = a.remainingKm ?? 999999;
    const kmB = b.remainingKm ?? 999999;
    const daysA = a.remainingDays ?? 999999;
    const daysB = b.remainingDays ?? 999999;

    if (daysA !== daysB) return daysA - daysB;
    return kmA - kmB;
  });

  return ordenados[0] || null;
}

/**
 * US13.1 & US13.2: Função pura consolidadora dos indicadores do Dashboard Principal:
 * - gasto total do mês (variáveis + custos fixos mensais)
 * - custo médio/km
 * - consumo médio
 * - quilometragem total
 * - autonomia projetada
 * - próxima manutenção (US10.6)
 */
export function calcularIndicadoresDashboardPuro(
  params: CalcularIndicadoresDashboardPuroParams,
): DashboardIndicators {
  const gastoVariavel = Math.max(0, Number(params.gastoTotalMesVariavel) || 0);
  const custoFixo = Math.max(0, Number(params.custoFixoMensal) || 0);
  const monthTotalSpent = Number((gastoVariavel + custoFixo).toFixed(2));

  // UX-01: Não faz fallback para zero; preserva null quando não houver km no período
  const averageCostPerKm =
    params.custoMedioPorKm !== null && params.custoMedioPorKm !== undefined
      ? Math.max(0, Number((Number(params.custoMedioPorKm) || 0).toFixed(2)))
      : null;
  const averageConsumptionKml = calcularConsumoMedioSelector(params.abastecimentos || []);

  const totalMileageKm = calcularQuilometragemTotalSelector({
    currentOdometer: params.currentOdometer,
    initialOdometer: params.initialOdometer,
    leituras: params.leituras,
    abastecimentos: params.abastecimentos,
  });

  // Encontra o último abastecimento (maior odômetro) para cálculo da autonomia restante (US13.2)
  const abastecimentosOrdenados = [...(params.abastecimentos || [])].sort(
    (a, b) => (Number(b.odometer) || 0) - (Number(a.odometer) || 0),
  );
  const ultimoAbastecimento = abastecimentosOrdenados[0] || null;

  const projectedAutonomyKm = ultimoAbastecimento
    ? calcularAutonomiaProjetada({
        capacidadeTanqueL: params.capacidadeTanqueL,
        consumoMedioKml: averageConsumptionKml,
        kmAtual: totalMileageKm,
        kmUltimoAbastecimento: ultimoAbastecimento.odometer,
      })
    : 0;

  const alertas = params.alertasAtivos || [];
  const nextMaintenance = selecionarProximaManutencao(alertas);

  const hasData =
    (params.abastecimentos?.length || 0) > 0 ||
    (params.despesasCount || 0) > 0 ||
    (params.manutencoesCount || 0) > 0 ||
    (params.pneusCount || 0) > 0 ||
    (params.fluidosCount || 0) > 0 ||
    custoFixo > 0 ||
    (params.leituras?.length || 0) > 0 ||
    alertas.length > 0;

  return {
    vehicleId: params.vehicleId,
    monthTotalSpent,
    averageCostPerKm,
    averageConsumptionKml,
    totalMileageKm,
    projectedAutonomyKm,
    nextMaintenance,
    activeAlertsCount: alertas.length,
    hasData,
    loadDurationMs: Number((params.loadDurationMs || 0).toFixed(2)),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * US13.1, US13.3 & US13.5: Camada de serviço e seletores sobre os repositórios locais,
 * mantendo o estado global (`useAppStore`) sincronizado em tempo real e medindo o tempo de carregamento (RNF01).
 */
export class DashboardIndicatorsService {
  /**
   * Calcula todos os indicadores do dashboard para um veículo e mede o tempo de carregamento (US13.5 / RNF01)
   */
  static async calculateForVehicle(
    vehicleId: string,
    dataReferencia: Date = new Date(),
  ): Promise<DashboardIndicators | null> {
    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const vehicle = await VehicleRepository.findById(vehicleId);
    if (!vehicle) {
      return null;
    }

    const { inicio, fim } = resolverIntervaloPeriodo('mes_atual', dataReferencia);

    const [
      indicadoresPeriodo,
      todosAbastecimentos,
      todasLeituras,
      todasDespesas,
      todasManutencoes,
      todosPneus,
      todosFluidos,
      alertasAtivos,
    ] = await Promise.all([
      obterIndicadoresUsoECustoDoPeriodo(vehicleId, inicio, fim),
      RefuelRepository.listByVehicle(vehicleId),
      OdometerRepository.listByVehicle(vehicleId),
      ExpenseRepository.listByVehicle(vehicleId),
      MaintenanceRepository.listByVehicle(vehicleId),
      TireRecordRepository.listByVehicle(vehicleId),
      FluidRecordRepository.listByVehicle(vehicleId),
      MaintenanceAlertService.evaluateVehicleAlerts(vehicleId, dataReferencia, false),
    ]);

    const gastoVariavelMes = Number(
      (
        indicadoresPeriodo.custo.custoCombustivel +
        indicadoresPeriodo.custo.custoManutencaoTotal +
        indicadoresPeriodo.custo.custoOutrasDespesas
      ).toFixed(2),
    );
    const custoFixoMes = indicadoresPeriodo.custo.custoFixoProporcional;

    const endMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const loadDurationMs = Math.max(0, Number((endMs - startMs).toFixed(2)));

    const indicators = calcularIndicadoresDashboardPuro({
      vehicleId: vehicle.id,
      capacidadeTanqueL: vehicle.tankCapacityL,
      currentOdometer: vehicle.currentOdometer,
      initialOdometer: vehicle.initialOdometer,
      gastoTotalMesVariavel: gastoVariavelMes,
      custoFixoMensal: custoFixoMes,
      custoMedioPorKm: indicadoresPeriodo.custo.custoKmTotal,
      abastecimentos: todosAbastecimentos,
      despesasCount: todasDespesas.length,
      manutencoesCount: todasManutencoes.length,
      pneusCount: todosPneus.length,
      fluidosCount: todosFluidos.length,
      leituras: todasLeituras,
      alertasAtivos,
      loadDurationMs,
    });

    // Sincroniza também stats legados e estado global (US13.3)
    const fuelDistribution: Record<FuelType, number> = {
      Gasolina: 0,
      Etanol: 0,
      Diesel: 0,
      GNV: 0,
      Flex: 0,
    };
    for (const r of todosAbastecimentos) {
      if (fuelDistribution[r.fuelType] !== undefined) {
        fuelDistribution[r.fuelType] += 1;
      }
    }

    const legacyStats: DashboardStats = {
      totalSpent: indicators.monthTotalSpent,
      totalDistance: indicators.totalMileageKm,
      averageKml: indicators.averageConsumptionKml,
      totalRefuels: todosAbastecimentos.length,
      costPerKm: indicators.averageCostPerKm,
      fuelDistribution,
    };

    const store = useAppStore.getState();
    if (!store.selectedVehicle || store.selectedVehicle.id === vehicleId) {
      store.setRefuels(todosAbastecimentos, legacyStats);
      store.setDashboardIndicators(indicators);
    }

    // US15.4: Reavalia teto orçamentário mensal com o mesmo monthTotalSpent do dashboard
    const { BudgetService } = await import('./budgetService');
    await BudgetService.reavaliarOrcamentoDoVeiculo(vehicleId, dataReferencia, {
      gastoMesReaisPreCalculado: indicators.monthTotalSpent,
    }).catch(() => {});

    return indicators;
  }

  /**
   * US13.3: Recalcula e atualiza o estado global para o veículo informado ou o veículo ativo atual.
   * Chamado automaticamente ao salvar, editar ou excluir qualquer registro ou ao trocar de veículo.
   */
  static async refreshForVehicle(vehicleId?: string | null): Promise<DashboardIndicators | null> {
    const store = useAppStore.getState();
    const targetId = vehicleId || store.selectedVehicle?.id;

    if (!targetId) {
      store.setDashboardIndicators(null);
      store.setIsLoadingDashboard(false);
      return null;
    }

    store.setIsLoadingDashboard(true);
    try {
      const result = await this.calculateForVehicle(targetId);
      return result;
    } finally {
      store.setIsLoadingDashboard(false);
    }
  }

  static async refreshForSelectedVehicle(): Promise<DashboardIndicators | null> {
    const selectedId = useAppStore.getState().selectedVehicle?.id;
    return this.refreshForVehicle(selectedId);
  }
}
