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
import { db } from '../database/DatabaseConnection';
import { localMigrator } from '../database/migrations/localMigrator';
import '../database/migrations/011_create_local_auditoria';
import '../database/migrations/012_create_local_orcamentos';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { VehicleService } from '../services/vehicleService';
import { ExpenseService } from '../services/expenseService';
import { FuelingService } from '../services/fuelingService';
import { FixedCostService } from '../services/fixedCostService';
import { MaintenanceService } from '../services/maintenanceService';
import { NotificacaoService, NotificationService } from '../services/notificationService';
import { AuditRepository } from '../repositories/AuditRepository';
import { avaliarOrcamento, BudgetService } from '../services/budgetService';
import { useAppStore } from '../store/useAppStore';

describe('US15 — Alertas de Teto Orçamentário Mensal', () => {
  beforeEach(async () => {
    for (const def of SyncEntityRegistry.getAll()) {
      await db.saveTableData(def.localTable, []);
    }
    await db.saveTableData('orcamentos', []);
    await db.saveTableData('auditoria', []);
    await db.saveTableData('fila_sync', []);
    await db.saveTableData('sync_queue', []);
    NotificationService.resetMock();
    useAppStore.getState().logout();
    await localMigrator.runMigrations();
  });

  describe('US15.3 & US15.7 · Função Pura avaliarOrcamento(gastoMes, teto, percentualAviso)', () => {
    it('(BDD) Dado teto de R$ 1.000 e gastos atingindo R$ 820, quando computar o gasto, então retorna nivel "aviso" e "82% atingido"', () => {
      // Em centavos (100000 e 82000) ou em reais (1000 e 820), o percentual é exatamente 82%
      const emCentavos = avaliarOrcamento(82000, 100000, 80);
      assert.strictEqual(emCentavos.percentual, 82);
      assert.strictEqual(emCentavos.nivel, 'aviso');
      assert.match(emCentavos.mensagem, /82% atingido/i);

      const emReais = avaliarOrcamento(820, 1000); // percentualAviso padrão = 80%
      assert.strictEqual(emReais.percentual, 82);
      assert.strictEqual(emReais.nivel, 'aviso');
      assert.match(emReais.mensagem, /82% atingido/i);
    });

    it('deve classificar corretamente os níveis normal (< 80%), aviso (80% a 100%) e critico (> 100%) e retornar normal quando não houver teto', () => {
      // Abaixo de 80% -> normal
      const normal = avaliarOrcamento(50000, 100000);
      assert.strictEqual(normal.percentual, 50);
      assert.strictEqual(normal.nivel, 'normal');

      // Exatamente no limiar de aviso (80%) -> aviso
      const limiarAviso = avaliarOrcamento(80000, 100000);
      assert.strictEqual(limiarAviso.percentual, 80);
      assert.strictEqual(limiarAviso.nivel, 'aviso');

      // Ultrapassando 100% (ex.: R$ 1.050 em teto de R$ 1.000 = 105%) -> critico
      const critico = avaliarOrcamento(105000, 100000);
      assert.strictEqual(critico.percentual, 105);
      assert.strictEqual(critico.nivel, 'critico');

      // Sem teto (0 ou negativo) -> normal (0%)
      const semTeto = avaliarOrcamento(82000, 0);
      assert.strictEqual(semTeto.percentual, 0);
      assert.strictEqual(semTeto.nivel, 'normal');
    });
  });

  describe('US15.1, US15.2, US15.4, US15.5 & US15.7 · Fluxo Completo: Gatilhos, Notificação Única por Nível/Mês, Virada de Mês, Edição Redutora, Redução de Teto e Auditoria', () => {
    it('ausência de teto não deve avaliar nem disparar notificação ao registrar gastos', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'HB20 Platinum',
        plate: 'HBZ1A23',
        year: 2023,
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 1000,
      });

      await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Seguro',
        amount: 1500,
        date: '2026-11-10T10:00:00.000Z',
        description: 'Seguro Anual',
      });

      const status = await BudgetService.obterStatusOrcamento(
        vehicle.id,
        new Date('2026-11-10T12:00:00.000Z'),
      );
      assert.strictEqual(status, null);
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 0);
    });

    it('(BDD) deve disparar aviso em 82% (teto R$ 1.000, gasto R$ 820), crítico imediato ao ultrapassar 100% em canal de alta importância, sem repetir no mesmo mês e recomeçar na virada de mês', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'Compass Longitude',
        plate: 'CMP2B34',
        year: 2024,
        tankCapacityL: 60,
        preferredFuel: 'Gasolina',
        initialOdometer: 5000,
      });

      // Define teto mensal de R$ 1.000,00 (100.000 centavos)
      const orcamento = await BudgetService.salvarOrcamento(
        {
          vehicleId: vehicle.id,
          tetoMensalCentavos: 100_000,
          percentualAviso: 80,
        },
        new Date('2026-11-01T10:00:00.000Z'),
      );
      assert.strictEqual(orcamento.teto_mensal, 100_000);

      // 1. Gasto fixo mensal de R$ 300,00 + Abastecimento de R$ 520,00 no mês 2026-11 -> Total = R$ 820,00 (82% atingido!)
      // (Usa o mesmo totalGastoDoMes do dashboard que inclui custos fixos + variáveis, Decisão #5 da Entrega 2)
      await FixedCostService.createFixedCost({
        vehicleId: vehicle.id,
        description: 'Estacionamento Mensal',
        monthlyAmount: 300,
      });

      await FuelingService.createRefuel({
        vehicleId: vehicle.id,
        date: '2026-11-05T10:00:00.000Z',
        odometer: 5400,
        fuelType: 'Gasolina',
        pricePerLiter: 5.2,
        totalValue: 520,
        liters: 100,
        isFullTank: true,
      });

      const status82 = await BudgetService.reavaliarOrcamentoDoVeiculo(
        vehicle.id,
        new Date('2026-11-05T12:00:00.000Z'),
      );
      assert.ok(status82);
      assert.strictEqual(status82.gastoMesReais, 820);
      assert.strictEqual(status82.percentual, 82);
      assert.strictEqual(status82.nivel, 'aviso');
      assert.match(status82.mensagem, /82% atingido/i);

      // Deve ter disparado 1 notificação de nível aviso
      let notificacoes = NotificacaoService.getDeliveredNotifications();
      assert.strictEqual(notificacoes.length, 1);
      assert.match(notificacoes[0].body, /82%/);
      assert.strictEqual(status82.budget.aviso_enviado_mes, '2026-11');
      assert.strictEqual(status82.budget.critico_enviado_mes, null);

      // 2. Novo gasto no mesmo mês que mantém no nível 'aviso' (ex.: +R$ 50 = R$ 870 = 87%) NÃO repete notificação
      const despesaExtra = await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Lavagem',
        amount: 50,
        date: '2026-11-12T10:00:00.000Z',
        description: 'Lavagem completa',
      });
      await BudgetService.reavaliarOrcamentoDoVeiculo(
        vehicle.id,
        new Date('2026-11-12T12:00:00.000Z'),
      );
      notificacoes = NotificacaoService.getDeliveredNotifications();
      assert.strictEqual(notificacoes.length, 1); // Sem repetição!

      // 3. Gasto que faz ultrapassar 100% (ex.: +R$ 200 = R$ 1.070 = 107%) -> Dispara notificação crítica imediata em canal de alta importância
      const despesaCritica = await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Imposto',
        amount: 200,
        date: '2026-11-15T10:00:00.000Z',
        description: 'Taxa de licenciamento',
      });

      const statusCritico = await BudgetService.reavaliarOrcamentoDoVeiculo(
        vehicle.id,
        new Date('2026-11-15T12:00:00.000Z'),
      );
      assert.ok(statusCritico);
      assert.strictEqual(statusCritico.percentual, 107);
      assert.strictEqual(statusCritico.nivel, 'critico');
      assert.strictEqual(statusCritico.budget.critico_enviado_mes, '2026-11');

      notificacoes = NotificacaoService.getDeliveredNotifications();
      assert.strictEqual(notificacoes.length, 2);
      assert.strictEqual(notificacoes[1].importance, 'high');
      assert.strictEqual(notificacoes[1].channelId, 'orcamento_critico');

      // 4. Edição que reduz o gasto (ex.: reduz a despesa de R$ 200 para R$ 10 -> total cai para R$ 880 = 88% 'aviso') NÃO renotifica
      await ExpenseService.updateExpense(despesaCritica.id, { amount: 10 });
      const statusAposReducaoGasto = await BudgetService.reavaliarOrcamentoDoVeiculo(
        vehicle.id,
        new Date('2026-11-16T12:00:00.000Z'),
      );
      assert.strictEqual(statusAposReducaoGasto?.nivel, 'aviso');
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 2); // Não renotificou!

      // Remove a despesa extra para testar outro cenário
      await ExpenseService.deleteExpense(despesaExtra.id);

      // 5. Virada de mês (2026-12): o novo mês recomeça os disparos!
      // Em 2026-12 temos R$ 300 de custo fixo + nova despesa de R$ 550 em 2026-12 = R$ 850 (85% 'aviso')
      await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Seguro',
        amount: 550,
        date: '2026-12-05T10:00:00.000Z',
        description: 'Franquia parabrisas',
      });

      const statusDezembro = await BudgetService.reavaliarOrcamentoDoVeiculo(
        vehicle.id,
        new Date('2026-12-05T12:00:00.000Z'),
      );
      assert.ok(statusDezembro);
      assert.strictEqual(statusDezembro.mesReferencia, '2026-12');
      assert.strictEqual(statusDezembro.percentual, 85);
      assert.strictEqual(statusDezembro.nivel, 'aviso');
      assert.strictEqual(statusDezembro.budget.aviso_enviado_mes, '2026-12');
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 3);
    });

    it('reduzir o teto abaixo do gasto atual deve disparar o nível correspondente na hora e auditar todas as alterações de teto (US15.2 & US15.5)', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'Nivus Highline',
        plate: 'NIV9C88',
        year: 2024,
        tankCapacityL: 52,
        preferredFuel: 'Gasolina',
        initialOdometer: 1000,
      });

      // 1. Define teto inicial alto: R$ 2.000,00 (200.000 centavos)
      await BudgetService.salvarOrcamento(
        {
          vehicleId: vehicle.id,
          tetoMensalCentavos: 200_000,
        },
        new Date('2026-11-10T10:00:00.000Z'),
      );

      // 2. Registra despesa de R$ 900,00 -> 45% do teto de R$ 2.000 (nível 'normal', 0 notificações)
      await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Seguro',
        amount: 900,
        date: '2026-11-10T11:00:00.000Z',
        description: 'Parcela Seguro',
      });
      await BudgetService.reavaliarOrcamentoDoVeiculo(
        vehicle.id,
        new Date('2026-11-10T11:30:00.000Z'),
      );
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 0);

      // 3. Reduz o teto para R$ 800,00 (80.000 centavos), abaixo do gasto atual de R$ 900,00 (112,5%) -> dispara crítico na hora!
      await BudgetService.salvarOrcamento(
        {
          vehicleId: vehicle.id,
          tetoMensalCentavos: 80_000,
        },
        new Date('2026-11-10T12:00:00.000Z'),
      );

      const notifs = NotificacaoService.getDeliveredNotifications();
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].importance, 'high');
      assert.strictEqual(notifs[0].channelId, 'orcamento_critico');

      // 4. Remove o orçamento do veículo
      const removido = await BudgetService.removerOrcamentoDoVeiculo(vehicle.id);
      assert.strictEqual(removido, true);

      // 5. Verifica se a criação, edição e exclusão do teto orçamentário foram auditadas (US15.2 / US21.6)
      const logsOrcamento = await AuditRepository.listFiltered({ entidade: 'orcamentos' });
      const acoes = logsOrcamento.map(l => l.acao).sort();
      assert.deepStrictEqual(acoes, ['criacao', 'edicao', 'exclusao']);
    });

    it('deve reavaliar o teto orçamentário automaticamente ao registrar uma manutenção pelo MaintenanceService (US15.4)', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'T-Cross Highline',
        plate: 'TCR5D77',
        year: 2024,
        tankCapacityL: 52,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });

      await BudgetService.salvarOrcamento(
        {
          vehicleId: vehicle.id,
          tetoMensalCentavos: 100_000, // R$ 1.000,00
        },
        new Date('2026-11-01T10:00:00.000Z'),
      );

      await MaintenanceService.createMaintenance({
        vehicleId: vehicle.id,
        date: '2026-11-10T10:00:00.000Z',
        odometer: 10500,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo e filtros',
        totalValue: 850, // 85% do teto -> nível 'aviso'
      });

      const notifs = NotificacaoService.getDeliveredNotifications();
      assert.strictEqual(notifs.length, 1);
      assert.match(notifs[0].body, /85%/);
    });
  });
});
