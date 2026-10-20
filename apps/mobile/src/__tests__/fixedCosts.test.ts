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
  FixedCostService,
  calcularCustoFixoDoPeriodo,
  validateFixedCostForm,
} from '../services/fixedCostService';
import {
  calcularCustoPorKm,
  obterIndicadoresUsoECustoDoPeriodo,
} from '../services/usageAndCostIndicators';
import { VehicleService } from '../services/vehicleService';
import { FuelingService } from '../services/fuelingService';
import { ExpenseService } from '../services/expenseService';
import { OdometerService } from '../services/odometerService';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { db } from '../database/DatabaseConnection';
import { useAppStore } from '../store/useAppStore';
import '../database/migrations/007_create_local_custos_fixos';
import { localMigrator } from '../database/migrations/localMigrator';

describe('US23 — Custos Fixos Mensais', () => {
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
    await db.saveTableData('custos_fixos', []);
    await db.saveTableData('local_custos_fixos', []);
    await db.saveTableData('sync_queue', []);
    await db.saveTableData('fila_sync', []);
    await localMigrator.runMigrations();
    useAppStore.getState().logout();
  });

  describe('US23.3 & US23.4: Critério BDD do Backlog e Integração ao Custo/Km', () => {
    it('(BDD Backlog): Dado custo fixo de R$ 300 no mês, R$ 700 em gastos variáveis e 1.000 km rodados, quando calcular o custo/km, então exibe R$ 1,00/km', async () => {
      // 1. Validação na função pura de cálculo de custo/km
      const custoPuro = calcularCustoPorKm({
        kmRodados: 1000,
        custoCombustivel: 500, // R$ 500 combustível + R$ 200 outras despesas = R$ 700 gastos variáveis
        manutencoes: [],
        custoOutrasDespesas: 200,
        custoFixoProporcional: 300, // R$ 300 custo fixo mensal
      });

      assert.strictEqual(custoPuro.custoFixoProporcional, 300);
      assert.strictEqual(custoPuro.custoTotal, 1000); // 300 + 700
      assert.strictEqual(custoPuro.custoKmTotal, 1.0); // R$ 1,00/km

      // 2. Validação ponta a ponta com veículo, custos fixos no banco, gastos variáveis e 1.000 km no mês
      const vehicle = await VehicleService.createVehicle({
        brand: 'Toyota',
        model: 'Corolla Altis',
        year: 2023,
        plate: 'COR2E23',
        fuelType: 'Flex',
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });

      // Cadastra custo fixo mensal de R$ 300 (ex.: estacionamento mensal + seguro)
      await FixedCostService.createFixedCost({
        vehicleId: vehicle.id,
        description: 'Estacionamento Mensal + Seguro',
        monthlyAmount: 300,
      });

      // Leitura inicial no mês: 10.001 km em 01/10/2026
      await OdometerService.updateManualOdometer(vehicle.id, 10001, '2026-10-01T08:00:00.000Z');

      // Abastecimento (gasto variável 1): R$ 500,00 aos 10.501 km
      await FuelingService.createRefuel({
        vehicleId: vehicle.id,
        odometer: 10501,
        liters: 80,
        pricePerLiter: 6.25,
        totalValue: 500,
        fuelType: 'Gasolina',
        isFullTank: true,
        date: '2026-10-15T10:00:00.000Z',
      });

      // Despesa variável (gasto variável 2): R$ 200,00 em 20/10/2026 (Total variável = 500 + 200 = R$ 700)
      await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Lavagem',
        amount: 200,
        date: '2026-10-20T14:00:00.000Z',
        description: 'Polimento e higienização',
      });

      // Leitura final no mês: 11.001 km em 31/10/2026 -> 1.000 km rodados no período!
      await OdometerService.updateManualOdometer(vehicle.id, 11001, '2026-10-31T18:00:00.000Z');

      // Consulta os indicadores do período mensal (01/10 a 31/10)
      const indicadores = await obterIndicadoresUsoECustoDoPeriodo(
        vehicle.id,
        '2026-10-01',
        '2026-10-31',
      );

      assert.strictEqual(indicadores.uso.kmRodados, 1000);
      assert.strictEqual(indicadores.custo.custoFixoProporcional, 300);
      assert.strictEqual(indicadores.custo.custoTotal, 1000); // 300 fixo + 700 variável
      assert.strictEqual(indicadores.custo.custoKmTotal, 1.0); // R$ 1,00/km exato!
    });

    it('US23.3: Em período mensal soma o valor cheio; em outros períodos, calcula proporcional aos dias (base de 30 dias)', () => {
      // Custo fixo mensal total de R$ 300,00
      const somaMensal = 300;

      // 1. Período mensal cheio (ex.: 01/10/2026 a 31/10/2026 ou 01/02/2026 a 28/02/2026) -> soma o valor cheio (R$ 300,00)
      assert.strictEqual(calcularCustoFixoDoPeriodo(somaMensal, '2026-10-01', '2026-10-31'), 300);
      assert.strictEqual(calcularCustoFixoDoPeriodo(somaMensal, '2026-02-01', '2026-02-28'), 300);
      assert.strictEqual(calcularCustoFixoDoPeriodo(somaMensal, '2026-04-01', '2026-04-30'), 300);

      // 2. Período de 15 dias (ex.: 01/10/2026 a 15/10/2026 = 15 dias) -> proporcional: 300 * (15 / 30) = R$ 150,00
      assert.strictEqual(calcularCustoFixoDoPeriodo(somaMensal, '2026-10-01', '2026-10-15'), 150);

      // 3. Período de 90 dias -> proporcional: 300 * (90 / 30) = R$ 900,00
      assert.strictEqual(
        calcularCustoFixoDoPeriodo(somaMensal, '2026-07-01', '2026-09-28'), // 90 dias inclusivos
        900,
      );

      // 4. Período de 10 dias -> proporcional: 300 * (10 / 30) = R$ 100,00
      assert.strictEqual(calcularCustoFixoDoPeriodo(somaMensal, '2026-10-01', '2026-10-10'), 100);
    });
  });

  describe('US23.1 & US23.2: CRUD de Custos Fixos por Veículo e Sincronização', () => {
    it('deve validar formulário de custo fixo (descrição obrigatória e valor mensal > 0)', () => {
      const invalidoSemDescricao = validateFixedCostForm({
        vehicleId: 'v1',
        description: '   ',
        monthlyAmount: '150,00',
      });
      assert.strictEqual(invalidoSemDescricao.isValid, false);
      assert.ok(invalidoSemDescricao.errors.description);

      const invalidoValorZero = validateFixedCostForm({
        vehicleId: 'v1',
        description: 'Seguro',
        monthlyAmount: '0',
      });
      assert.strictEqual(invalidoValorZero.isValid, false);
      assert.ok(invalidoValorZero.errors.monthlyAmount);

      const validoComVirgula = validateFixedCostForm({
        vehicleId: 'v1',
        description: 'Seguro Auto',
        monthlyAmount: '245,50',
      });
      assert.strictEqual(validoComVirgula.isValid, true);
      assert.strictEqual(validoComVirgula.data?.monthlyAmount, 245.5);
    });

    it('deve cadastrar, listar, somar, editar e remover (exclusão lógica) custos fixos por veículo e enfileirar no sync', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'Compass',
        year: 2022,
        plate: 'CMP2E22',
        tankCapacityL: 60,
        preferredFuel: 'Gasolina',
      });

      // 1. Cadastrar dois custos fixos (R$ 180 + R$ 120 = R$ 300)
      const fc1 = await FixedCostService.createFixedCost({
        vehicleId: vehicle.id,
        description: 'Seguro Mensal',
        monthlyAmount: 180,
      });
      const fc2 = await FixedCostService.createFixedCost({
        vehicleId: vehicle.id,
        description: 'Estacionamento Coberto',
        monthlyAmount: 120,
      });

      const list = await FixedCostService.listByVehicle(vehicle.id);
      assert.strictEqual(list.length, 2);

      const totalMensal = await FixedCostService.getMonthlyTotalByVehicle(vehicle.id);
      assert.strictEqual(totalMensal, 300);

      // 2. Editar valor de fc2 de R$ 120 para R$ 150
      const updated = await FixedCostService.updateFixedCost(fc2.id, {
        description: 'Estacionamento 24h',
        monthlyAmount: 150,
      });
      assert.strictEqual(updated.monthlyAmount, 150);
      assert.strictEqual(updated.description, 'Estacionamento 24h');
      assert.strictEqual(await FixedCostService.getMonthlyTotalByVehicle(vehicle.id), 330);

      // 3. Remover fc1 (exclusão lógica)
      const deleted = await FixedCostService.deleteFixedCost(fc1.id);
      assert.strictEqual(deleted, true);

      const remaining = await FixedCostService.listByVehicle(vehicle.id);
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].id, fc2.id);
      assert.strictEqual(await FixedCostService.getMonthlyTotalByVehicle(vehicle.id), 150);

      // 4. Verifica registro na fila de sincronização (US23.1 / US02.7)
      const pendingSync = await SyncQueueRepository.getPendingItems();
      const fixedCostOps = pendingSync.filter(item =>
        item.endpoint.includes('/api/v1/sync/custos_fixos'),
      );
      assert.ok(fixedCostOps.length >= 3);

      // 5. Verifica registro no SyncEntityRegistry (US02.7)
      const entityDef = SyncEntityRegistry.get('custos_fixos');
      assert.ok(entityDef, 'custos_fixos deve estar registrado no SyncEntityRegistry');
    });

    it('US04.6: Exclusão lógica de veículo deve ocultar seus custos fixos em cascata', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'HB20',
        year: 2021,
        plate: 'HBV2E21',
        tankCapacityL: 50,
        preferredFuel: 'Flex',
      });

      await FixedCostService.createFixedCost({
        vehicleId: vehicle.id,
        description: 'Seguro',
        monthlyAmount: 200,
      });

      assert.strictEqual((await FixedCostService.listByVehicle(vehicle.id)).length, 1);

      await VehicleService.deleteVehicle(vehicle.id);

      assert.strictEqual((await FixedCostService.listByVehicle(vehicle.id)).length, 0);
    });
  });
});
