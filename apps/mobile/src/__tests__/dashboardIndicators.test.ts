// Polyfill para AsyncStorage em ambiente Node.js / testes
if (typeof (global as any).window === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  };
}

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularAutonomiaProjetada,
  calcularConsumoMedioSelector,
  calcularQuilometragemTotalSelector,
  selecionarProximaManutencao,
  calcularIndicadoresDashboardPuro,
  DashboardIndicatorsService,
} from '../services/dashboardIndicators';
import { VehicleService } from '../services/vehicleService';
import { FuelingService } from '../services/fuelingService';
import { ExpenseService } from '../services/expenseService';
import { MaintenanceService } from '../services/maintenanceService';
import { OdometerService } from '../services/odometerService';
import { FixedCostService } from '../services/fixedCostService';
import { MaintenanceAlertService } from '../services/maintenanceAlertService';
import { db } from '../database/DatabaseConnection';
import { localMigrator } from '../database/migrations/localMigrator';
import '../database/migrations/008_create_local_dashboard_indexes';
import { useAppStore } from '../store/useAppStore';
import { MaintenanceAlert } from '@autogest/shared-types';

describe('US13 — Dashboard Principal em Tempo Real', () => {
  beforeEach(async () => {
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('veiculos', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('abastecimentos', []);
    await db.saveTableData('local_leituras_hodometro', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('local_despesas', []);
    await db.saveTableData('despesas', []);
    await db.saveTableData('local_manutencoes', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('regras_manutencao', []);
    await db.saveTableData('local_regras_manutencao', []);
    await db.saveTableData('custos_fixos', []);
    await db.saveTableData('local_custos_fixos', []);
    await db.saveTableData('sync_queue', []);
    await db.saveTableData('fila_sync', []);
    await localMigrator.runMigrations();
    useAppStore.getState().logout();
  });

  describe('US13.1 & US13.2: Funções Puras e Selectors de Indicadores do Dashboard', () => {
    it('US13.2 (Decisão #5): Autonomia = capacidade do tanque × consumo médio − km desde o último abastecimento (mínimo 0)', () => {
      // Caso 1: Tanque de 50 L, consumo médio de 12,5 km/l (capacidade total = 625 km).
      // Último abastecimento aos 10.500 km, odômetro atual em 10.650 km (150 km rodados desde o último abastecimento).
      // Autonomia projetada = 50 * 12,5 - 150 = 625 - 150 = 475 km.
      const autonomia = calcularAutonomiaProjetada({
        capacidadeTanqueL: 50,
        consumoMedioKml: 12.5,
        kmAtual: 10650,
        kmUltimoAbastecimento: 10500,
      });
      assert.strictEqual(autonomia, 475);

      // Caso 2: Logo após abastecer (kmAtual === kmUltimoAbastecimento) -> 50 * 12,5 - 0 = 625 km
      const autonomiaTanqueCheio = calcularAutonomiaProjetada({
        capacidadeTanqueL: 50,
        consumoMedioKml: 12.5,
        kmAtual: 10500,
        kmUltimoAbastecimento: 10500,
      });
      assert.strictEqual(autonomiaTanqueCheio, 625);

      // Caso 3: Km percorrido desde o último abastecimento supera a autonomia teórica -> mínimo 0 (nunca negativo)
      const autonomiaExcedida = calcularAutonomiaProjetada({
        capacidadeTanqueL: 40,
        consumoMedioKml: 10, // 400 km total
        kmAtual: 11000,
        kmUltimoAbastecimento: 10500, // 500 km desde o último abastecimento
      });
      assert.strictEqual(autonomiaExcedida, 0);

      // Caso 4: Sem consumo médio apurado (ex.: primeiro abastecimento ou sem registros) -> retorna 0
      assert.strictEqual(
        calcularAutonomiaProjetada({
          capacidadeTanqueL: 50,
          consumoMedioKml: 0,
          kmAtual: 10000,
          kmUltimoAbastecimento: 10000,
        }),
        0,
      );
    });

    it('US13.1: Selectors puros de consumo médio, quilometragem total e próxima manutenção (US10.6)', () => {
      // Consumo médio sobre abastecimentos que possuem consumo calculado
      const consumoMedio = calcularConsumoMedioSelector([
        { calculatedKml: null, odometer: 10000 }, // 1º abastecimento (base)
        { calculatedKml: 12.0, odometer: 10480 },
        { calculatedKml: 13.0, odometer: 11000 },
      ]);
      assert.strictEqual(consumoMedio, 12.5);

      // Quilometragem total consolidada do veículo (maior valor entre odômetro atual, leituras e registros)
      const kmTotal = calcularQuilometragemTotalSelector({
        currentOdometer: 11200,
        initialOdometer: 10000,
        leituras: [{ km: 11250 }],
        abastecimentos: [{ odometer: 11000 }],
      });
      assert.strictEqual(kmTotal, 11250);

      // Próxima manutenção prioriza alerta vencido sobre próximo, e menor remainingDays / remainingKm
      const alertas: MaintenanceAlert[] = [
        {
          id: 'a1',
          ruleId: 'r1',
          vehicleId: 'v1',
          serviceType: 'filtros',
          serviceName: 'Filtros',
          status: 'proximo',
          vencePorKm: false,
          vencePorDias: true,
          remainingDays: 10,
          message: 'Filtros em 10 dias',
        },
        {
          id: 'a2',
          ruleId: 'r2',
          vehicleId: 'v1',
          serviceType: 'troca_oleo',
          serviceName: 'Troca de Óleo',
          status: 'vencido',
          vencePorKm: true,
          vencePorDias: false,
          remainingKm: -150,
          message: 'Troca de óleo vencida',
        },
      ];
      const proxima = selecionarProximaManutencao(alertas);
      assert.ok(proxima);
      assert.strictEqual(proxima?.id, 'a2');
      assert.strictEqual(proxima?.serviceName, 'Troca de Óleo');
    });

    it('US13.1 (Critério de Aceite Backlog): Consolidar métricas no painel analítico central (total gasto no mês, custo médio/km, autonomia projetada)', () => {
      const consolidado = calcularIndicadoresDashboardPuro({
        vehicleId: 'v1',
        capacidadeTanqueL: 50,
        currentOdometer: 10600,
        initialOdometer: 10000,
        gastoTotalMesVariavel: 700,
        custoFixoMensal: 300,
        custoMedioPorKm: 1.0,
        abastecimentos: [
          { odometer: 10000, calculatedKml: null, totalValue: 250 },
          { odometer: 10500, calculatedKml: 12.5, totalValue: 250 },
        ],
        despesasCount: 1,
        manutencoesCount: 0,
        leituras: [{ km: 10000 }, { km: 10500 }, { km: 10600 }],
        alertasAtivos: [],
      });

      // Gasto total no mês = R$ 700 variáveis + R$ 300 fixos = R$ 1.000,00
      assert.strictEqual(consolidado.monthTotalSpent, 1000);
      // Custo médio/km = R$ 1,00/km
      assert.strictEqual(consolidado.averageCostPerKm, 1.0);
      // Consumo médio = 12,5 km/l
      assert.strictEqual(consolidado.averageConsumptionKml, 12.5);
      // Quilometragem total = 10.600 km
      assert.strictEqual(consolidado.totalMileageKm, 10600);
      // Autonomia projetada = 50 L * 12,5 km/l - (10.600 - 10.500) = 625 - 100 = 525 km
      assert.strictEqual(consolidado.projectedAutonomyKm, 525);
      assert.strictEqual(consolidado.hasData, true);
    });
  });

  describe('US13.3 & US13.6: Estado Global Reativo — Recálculo ao Salvar, Editar, Excluir e Trocar de Veículo', () => {
    it('deve recalcular automaticamente os indicadores na store global após salvar, editar ou excluir abastecimento, despesa, manutenção, km e custo fixo, e ao trocar de veículo', async () => {
      // 1. Cria Veículo A (Tanque 50 L, Odômetro inicial 10.000 km)
      const vehicleA = await VehicleService.createVehicle({
        brand: 'Honda',
        model: 'Civic Touring',
        year: 2023,
        plate: 'CIV1A23',
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });

      // Estado inicial sem lançamentos -> hasData = false
      let dashState = useAppStore.getState().dashboardIndicators;
      assert.ok(dashState);
      assert.strictEqual(dashState?.vehicleId, vehicleA.id);
      assert.strictEqual(dashState?.hasData, false);
      assert.strictEqual(dashState?.monthTotalSpent, 0);

      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d1 = `${year}-${month}-02T10:00:00.000Z`;
      const d2 = `${year}-${month}-10T10:00:00.000Z`;
      const d3 = `${year}-${month}-15T10:00:00.000Z`;
      const d4 = `${year}-${month}-18T10:00:00.000Z`;

      // 2. Registra 1º abastecimento (base: 10.100 km, R$ 200) -> atualiza painel
      await FuelingService.createRefuel({
        vehicleId: vehicleA.id,
        date: d1,
        odometer: 10100,
        liters: 40,
        pricePerLiter: 5.0,
        totalValue: 200,
        fuelType: 'Gasolina',
        isFullTank: true,
      });

      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.hasData, true);
      assert.strictEqual(dashState?.monthTotalSpent, 200);
      assert.strictEqual(dashState?.totalMileageKm, 10100);

      // 3. Registra 2º abastecimento (10.600 km, 40 L, R$ 200) -> Consumo = (10600-10100)/40 = 12,5 km/l
      // Autonomia = 50 * 12,5 - (10600 - 10600) = 625 km
      const refuel2 = await FuelingService.createRefuel({
        vehicleId: vehicleA.id,
        date: d2,
        odometer: 10600,
        liters: 40,
        pricePerLiter: 5.0,
        totalValue: 200,
        fuelType: 'Gasolina',
        isFullTank: true,
      });

      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.monthTotalSpent, 400);
      assert.strictEqual(dashState?.averageConsumptionKml, 12.5);
      assert.strictEqual(dashState?.projectedAutonomyKm, 625);
      assert.strictEqual(dashState?.totalMileageKm, 10600);

      // 4. Atualiza quilometragem manual para 10.700 km (100 km rodados desde o último abastecimento)
      // Autonomia cai para 625 - 100 = 525 km
      await OdometerService.updateManualOdometer(vehicleA.id, 10700, d3);
      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.totalMileageKm, 10700);
      assert.strictEqual(dashState?.projectedAutonomyKm, 525);

      // 5. Registra Despesa manual de R$ 100 (Lavagem) -> gasto do mês sobe de 400 para 500
      const expense = await ExpenseService.createExpense({
        vehicleId: vehicleA.id,
        category: 'Lavagem',
        amount: 100,
        date: d3,
        description: 'Lavagem completa',
      });
      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.monthTotalSpent, 500);

      // 6. Edita Despesa para R$ 150 -> gasto do mês sobe para 550
      await ExpenseService.updateExpense(expense.id, { amount: 150 });
      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.monthTotalSpent, 550);

      // 7. Registra Manutenção preventiva aos 11.100 km de R$ 250 -> total 1.000 km rodados no mês (10.100 -> 11.100)
      // Gasto variável = 400 (combustível) + 150 (despesa) + 250 (manutenção) = R$ 800
      const maint = await MaintenanceService.createMaintenance({
        vehicleId: vehicleA.id,
        date: d4,
        odometer: 11100,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo sintético',
        totalValue: 250,
      });
      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.monthTotalSpent, 800);
      assert.strictEqual(dashState?.totalMileageKm, 11100);
      // 11.100 - 10.600 = 500 km desde último abastecimento -> Autonomia = 625 - 500 = 125 km
      assert.strictEqual(dashState?.projectedAutonomyKm, 125);
      // Custo médio/km = R$ 800 / 1.000 km = R$ 0,80/km
      assert.strictEqual(dashState?.averageCostPerKm, 0.8);

      // 8. Cadastra Custo Fixo de R$ 200/mês -> Gasto total do mês = 800 + 200 = R$ 1.000; Custo/km = 1000 / 1000 = R$ 1,00/km
      const fixedCost = await FixedCostService.createFixedCost({
        vehicleId: vehicleA.id,
        description: 'Seguro Mensal',
        monthlyAmount: 200,
      });
      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.monthTotalSpent, 1000);
      assert.strictEqual(dashState?.averageCostPerKm, 1.0);

      // 9. Exclui Custo Fixo, Manutenção e Despesa -> recalcula imediatamente
      await FixedCostService.deleteFixedCost(fixedCost.id);
      assert.strictEqual(useAppStore.getState().dashboardIndicators?.monthTotalSpent, 800);

      await MaintenanceService.deleteMaintenance(maint.id);
      assert.strictEqual(useAppStore.getState().dashboardIndicators?.monthTotalSpent, 550);

      await ExpenseService.deleteExpense(expense.id);
      assert.strictEqual(useAppStore.getState().dashboardIndicators?.monthTotalSpent, 400);

      // 10. Edita 2º abastecimento (altera valorTotal para R$ 250) -> gasto do mês vai para 450
      await FuelingService.updateRefuel(refuel2.id, { totalValue: 250 });
      assert.strictEqual(useAppStore.getState().dashboardIndicators?.monthTotalSpent, 450);

      // 11. Cria Veículo B e troca de veículo ativo -> painel recalcula para o Veículo B
      const vehicleB = await VehicleService.createVehicle({
        brand: 'Fiat',
        model: 'Pulse Impetus',
        year: 2024,
        plate: 'PUL4B24',
        tankCapacityL: 47,
        preferredFuel: 'Etanol',
        initialOdometer: 5000,
      });

      VehicleService.selectVehicle(vehicleB.id);
      // Aguarda resolução assíncrona do refresh disparado na troca de veículo
      await DashboardIndicatorsService.refreshForSelectedVehicle();

      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.vehicleId, vehicleB.id);
      assert.strictEqual(dashState?.monthTotalSpent, 0);
      assert.strictEqual(dashState?.totalMileageKm, 5000);
      assert.strictEqual(dashState?.hasData, false);

      // Troca de volta para o Veículo A -> restaura métricas do Veículo A
      VehicleService.selectVehicle(vehicleA.id);
      await DashboardIndicatorsService.refreshForSelectedVehicle();

      dashState = useAppStore.getState().dashboardIndicators;
      assert.strictEqual(dashState?.vehicleId, vehicleA.id);
      assert.strictEqual(dashState?.monthTotalSpent, 450);
      assert.strictEqual(dashState?.hasData, true);
    });
  });

  describe('US13.5 & US13.6: Índices no Banco Local (veiculo_id + data), Massa de Dados e Meta de Desempenho (RNF01)', () => {
    it('deve criar índices compostos (veiculo_id + data) no banco local e carregar indicadores com massa de dados em tempo inferior à meta RNF01 (< 500ms)', async () => {
      const vehicle = await VehicleService.createVehicle({
        brand: 'Chevrolet',
        model: 'Onix Premier',
        year: 2023,
        plate: 'ONX9C23',
        tankCapacityL: 44,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });

      // Verifica se os índices compostos por (veiculo_id + data) foram registrados na conexão local
      const registeredIndexes = db.getRegisteredIndexes();
      assert.ok(
        registeredIndexes.includes('idx_local_refuels_veiculo_data'),
        'Deve existir índice idx_local_refuels_veiculo_data',
      );
      assert.ok(
        registeredIndexes.includes('idx_local_despesas_veiculo_data'),
        'Deve existir índice idx_local_despesas_veiculo_data',
      );
      assert.ok(
        registeredIndexes.includes('idx_manutencoes_veiculo_data'),
        'Deve existir índice idx_manutencoes_veiculo_data',
      );
      assert.ok(
        registeredIndexes.includes('idx_local_leituras_hodometro_veiculo_data'),
        'Deve existir índice idx_local_leituras_hodometro_veiculo_data',
      );

      // Gera massa de dados (ex.: 120 registros distribuídos entre abastecimentos, despesas, manutenções e leituras)
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');

      const bulkRefuels = [];
      const bulkReadings = [];
      let currentKm = 10000;

      for (let i = 1; i <= 40; i++) {
        const prevKm = currentKm;
        currentKm += 400; // 400 km a cada 40 L = 10 km/l
        const day = String(((i - 1) % 28) + 1).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}T12:00:00.000Z`;

        bulkRefuels.push({
          id: `bulk_ref_${i}`,
          vehicleId: vehicle.id,
          date: dateStr,
          odometer: currentKm,
          fuelType: 'Gasolina',
          pricePerLiter: 5.5,
          totalValue: 220,
          liters: 40,
          isFullTank: true,
          calculatedKml: i === 1 ? null : Number(((currentKm - prevKm) / 40).toFixed(2)),
          createdAt: dateStr,
          updatedAt: dateStr,
          deletedAt: null,
        });

        bulkReadings.push({
          id: `bulk_odo_${i}`,
          vehicleId: vehicle.id,
          km: currentKm,
          date: dateStr,
          origin: 'abastecimento',
          createdAt: dateStr,
          updatedAt: dateStr,
          deletedAt: null,
        });
      }

      const bulkExpenses = [];
      for (let i = 1; i <= 40; i++) {
        const day = String(((i - 1) % 28) + 1).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}T15:00:00.000Z`;
        bulkExpenses.push({
          id: `bulk_exp_${i}`,
          vehicleId: vehicle.id,
          category: 'Outros',
          amount: 25,
          date: dateStr,
          description: `Pedágio #${i}`,
          createdAt: dateStr,
          updatedAt: dateStr,
          deletedAt: null,
        });
      }

      await db.saveTableData('local_refuels', bulkRefuels);
      await db.saveTableData('local_leituras_hodometro', bulkReadings);
      await db.saveTableData('local_despesas', bulkExpenses);
      await VehicleService.updateVehicle(vehicle.id, { currentOdometer: currentKm });

      // Cria regra de manutenção vencendo para testar próxima manutenção no dashboard (US10.6)
      await MaintenanceAlertService.createRule({
        vehicleId: vehicle.id,
        serviceType: 'troca_oleo',
        name: 'Troca de Óleo Sintético',
        intervalKm: 5000,
        intervalDays: 180,
        advanceKm: 500,
        advanceDays: 15,
        lastServiceKm: 10000,
        lastServiceDate: `${year}-01-01T10:00:00.000Z`,
        active: true,
      });

      const startMs = performance.now();
      const indicators = await DashboardIndicatorsService.calculateForVehicle(vehicle.id);
      const elapsedMs = performance.now() - startMs;

      assert.ok(indicators);
      // 40 abastecimentos * R$ 220 (8800) + 40 despesas * R$ 25 (1000) = R$ 9.800,00
      assert.strictEqual(indicators?.monthTotalSpent, 9800);
      assert.strictEqual(indicators?.averageConsumptionKml, 10);
      assert.strictEqual(indicators?.totalMileageKm, currentKm);
      // Autonomia = 44 L * 10 km/l - 0 km desde último abastecimento = 440 km
      assert.strictEqual(indicators?.projectedAutonomyKm, 440);
      assert.ok(indicators?.nextMaintenance, 'Deve retornar a próxima manutenção ativa (US10.6)');
      assert.strictEqual(indicators?.nextMaintenance?.serviceType, 'troca_oleo');

      // Meta de desempenho RNF01: medição registrada e < 500ms (bem abaixo do teto de 2000ms)
      assert.ok(
        typeof indicators?.loadDurationMs === 'number' && indicators.loadDurationMs >= 0,
        'Deve medir o tempo de carregamento em milissegundos',
      );
      assert.ok(
        elapsedMs < 500,
        `Carregamento com massa de dados deve ser rápido (< 500ms), levou ${elapsedMs.toFixed(2)}ms`,
      );
    });
  });
});
