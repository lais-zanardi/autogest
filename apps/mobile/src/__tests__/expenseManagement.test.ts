import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ExpenseService } from '../services/expenseService';
import { VehicleService } from '../services/vehicleService';
import { FuelingService } from '../services/fuelingService';
import { gastosDoPeriodo, obterDetalhamentoGastosDoPeriodo } from '../services/expenseAggregation';
import { validateExpenseForm, parseExpenseAmount } from '../services/expenseValidation';
import { db } from '../database/DatabaseConnection';
import { useAppStore } from '../store/useAppStore';

describe('US22 — Cadastro de Despesas por Categoria', () => {
  beforeEach(async () => {
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('local_leituras_hodometro', []);
    await db.saveTableData('local_despesas', []);
    await db.saveTableData('sync_queue', []);
    useAppStore.getState().logout();
  });

  it('US22 BDD: Dado um veículo selecionado, quando registrar uma despesa de R$ 50 na categoria Lavagem, então ela aparece no histórico e soma R$ 50 ao total do mês', async () => {
    const vehicle = await VehicleService.createVehicle({
      brand: 'Honda',
      model: 'Civic',
      year: 2020,
      plate: 'BRA2E19',
      fuelType: 'Gasolina',
      tankCapacityL: 56,
      preferredFuel: 'Gasolina',
      initialOdometer: 10000,
    });

    const now = new Date('2026-10-15T10:00:00.000Z');
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 10

    // Registra despesa de R$ 50 na categoria Lavagem
    const expense = await ExpenseService.createExpense({
      vehicleId: vehicle.id,
      category: 'Lavagem',
      amount: 50,
      date: now.toISOString(),
      description: 'Lavagem completa com cera',
    });

    assert.equal(expense.amount, 50);
    assert.equal(expense.category, 'Lavagem');

    // 1. Aparece no histórico do mês
    const history = await ExpenseService.listByMonth(vehicle.id, year, month);
    assert.equal(history.length, 1);
    assert.equal(history[0].id, expense.id);
    assert.equal(history[0].amount, 50);
    assert.equal(history[0].category, 'Lavagem');

    // 2. Soma R$ 50 ao total do mês
    const monthTotal = await ExpenseService.getMonthExpensesTotal(vehicle.id, year, month);
    assert.equal(monthTotal, 50);

    // 3. Camada de agregação no período
    const totalPeriodo = await gastosDoPeriodo(vehicle.id, '2026-10-01', '2026-10-31');
    assert.equal(totalPeriodo, 50);
  });

  describe('US22.2: Validações de Formulário de Despesas', () => {
    it('deve converter corretamente decimais com vírgula ou ponto', () => {
      assert.equal(parseExpenseAmount('50'), 50);
      assert.equal(parseExpenseAmount('50,50'), 50.5);
      assert.equal(parseExpenseAmount('R$ 120,75'), 120.75);
      assert.equal(parseExpenseAmount('1.250,50'), 1250.5);
      assert.equal(parseExpenseAmount(85.2), 85.2);
    });

    it('deve aceitar as 4 categorias manuais: Seguro, Imposto, Lavagem e Outros', () => {
      const validCategories = ['Seguro', 'Imposto', 'Lavagem', 'Outros'];
      for (const cat of validCategories) {
        const result = validateExpenseForm({
          vehicleId: 'veh_123',
          category: cat,
          amount: '100,00',
          date: '2026-10-15',
        });
        assert.equal(result.isValid, true, `Categoria ${cat} deveria ser válida`);
      }
    });

    it('deve rejeitar categoria Combustível e Manutenção no formulário manual com aviso sobre duplicidade', () => {
      const combustivelResult = validateExpenseForm({
        vehicleId: 'veh_123',
        category: 'Combustível',
        amount: '100,00',
        date: '2026-10-15',
      });
      assert.equal(combustivelResult.isValid, false);
      assert.match(combustivelResult.errors.category, /duplicidade/i);

      const manutencaoResult = validateExpenseForm({
        vehicleId: 'veh_123',
        category: 'Manutenção',
        amount: '100,00',
        date: '2026-10-15',
      });
      assert.equal(manutencaoResult.isValid, false);
      assert.match(manutencaoResult.errors.category, /duplicidade/i);
    });

    it('deve rejeitar valores zerados, negativos ou não numéricos', () => {
      const zeroResult = validateExpenseForm({
        vehicleId: 'veh_123',
        category: 'Outros',
        amount: '0',
        date: '2026-10-15',
      });
      assert.equal(zeroResult.isValid, false);
      assert.match(zeroResult.errors.amount, /maior que zero/i);

      const negativeResult = validateExpenseForm({
        vehicleId: 'veh_123',
        category: 'Outros',
        amount: '-15',
        date: '2026-10-15',
      });
      assert.equal(negativeResult.isValid, false);
    });
  });

  describe('US22.3: Edição e Exclusão Lógica de Despesas', () => {
    it('deve editar uma despesa existente e recalcular o total do mês', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'Corolla',
        year: 2021,
        plate: 'COR2021',
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
      });

      const expense = await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Outros',
        amount: 30, // Pedágio R$ 30
        date: '2026-10-10T12:00:00.000Z',
        description: 'Pedágio rodovia',
      });

      // Atualiza para R$ 45
      const updated = await ExpenseService.updateExpense(expense.id, {
        amount: 45,
        description: 'Pedágio rodovia ida e volta',
      });
      assert.equal(updated.amount, 45);
      assert.equal(updated.description, 'Pedágio rodovia ida e volta');

      const total = await ExpenseService.getMonthExpensesTotal(vehicle.id, 2026, 10);
      assert.equal(total, 45);
    });

    it('deve excluir logicamente uma despesa e removê-la do total do mês', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'Gol',
        year: 2019,
        plate: 'GOL2019',
        tankCapacityL: 50,
        preferredFuel: 'Flex',
      });

      const expense1 = await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Lavagem',
        amount: 50,
        date: '2026-10-02T10:00:00.000Z',
      });

      const expense2 = await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Seguro',
        amount: 200,
        date: '2026-10-05T10:00:00.000Z',
      });

      assert.equal(await ExpenseService.getMonthExpensesTotal(vehicle.id, 2026, 10), 250);

      // Exclui a despesa de lavagem
      const deleted = await ExpenseService.deleteExpense(expense1.id);
      assert.equal(deleted, true);

      // Agora só resta o seguro (R$ 200)
      const list = await ExpenseService.listByMonth(vehicle.id, 2026, 10);
      assert.equal(list.length, 1);
      assert.equal(list[0].id, expense2.id);

      const total = await ExpenseService.getMonthExpensesTotal(vehicle.id, 2026, 10);
      assert.equal(total, 200);
    });
  });

  describe('US22.4 / US22.5: Camada de Agregação gastosDoPeriodo com Múltiplas Fontes', () => {
    it('deve somar despesas e abastecimentos no período de forma precisa', async () => {
      const vehicle = await VehicleService.createVehicle({
        model: 'Onix',
        year: 2022,
        plate: 'ONX2022',
        tankCapacityL: 44,
        preferredFuel: 'Flex',
        initialOdometer: 10000,
      });

      // 1. Abastecimento de R$ 180 em 2026-10-02 (Combustível)
      await FuelingService.createRefuel({
        vehicleId: vehicle.id,
        odometer: 10400,
        liters: 30,
        pricePerLiter: 6.0,
        totalValue: 180,
        fuelType: 'Gasolina',
        isFullTank: true,
        date: '2026-10-02T08:00:00.000Z',
      });

      // 2. Despesa de Lavagem de R$ 50 em 2026-10-10
      await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Lavagem',
        amount: 50,
        date: '2026-10-10T14:00:00.000Z',
      });

      // 3. Despesa de Pedágio (Outros) de R$ 35,50 em 2026-10-15
      await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Outros',
        amount: 35.5,
        date: '2026-10-15T16:00:00.000Z',
      });

      // Total geral no período: 180 + 50 + 35.50 = 265.50
      const totalGeral = await gastosDoPeriodo(vehicle.id, '2026-10-01', '2026-10-31');
      assert.equal(totalGeral, 265.5);

      // Filtro por categoria 'Combustível' (vem de abastecimentos)
      const totalCombustivel = await gastosDoPeriodo(
        vehicle.id,
        '2026-10-01',
        '2026-10-31',
        'Combustível',
      );
      assert.equal(totalCombustivel, 180);

      // Filtro por categoria 'Lavagem'
      const totalLavagem = await gastosDoPeriodo(vehicle.id, '2026-10-01', '2026-10-31', 'Lavagem');
      assert.equal(totalLavagem, 50);

      // Filtro por categoria 'Outros'
      const totalOutros = await gastosDoPeriodo(vehicle.id, '2026-10-01', '2026-10-31', 'Outros');
      assert.equal(totalOutros, 35.5);

      // Filtro por categoria sem lançamentos ('Seguro')
      const totalSeguro = await gastosDoPeriodo(vehicle.id, '2026-10-01', '2026-10-31', 'Seguro');
      assert.equal(totalSeguro, 0);

      // Detalhamento agrupado completo
      const detalhe = await obterDetalhamentoGastosDoPeriodo(
        vehicle.id,
        '2026-10-01',
        '2026-10-31',
      );
      assert.equal(detalhe.total, 265.5);
      assert.equal(detalhe.totalAbastecimentos, 180);
      assert.equal(detalhe.totalDespesas, 85.5);
      assert.equal(detalhe.porCategoria['Combustível'], 180);
      assert.equal(detalhe.porCategoria['Lavagem'], 50);
      assert.equal(detalhe.porCategoria['Outros'], 35.5);
      assert.equal(detalhe.porCategoria['Seguro'], 0);
    });
  });

  it('US04.6 / US22: Exclusão lógica em cascata oculta despesas do veículo excluído', async () => {
    const vehicle = await VehicleService.createVehicle({
      model: 'Kwid',
      year: 2020,
      plate: 'KWD2020',
      tankCapacityL: 38,
      preferredFuel: 'Flex',
    });

    await ExpenseService.createExpense({
      vehicleId: vehicle.id,
      category: 'Seguro',
      amount: 150,
      date: '2026-10-01T10:00:00.000Z',
    });

    assert.equal((await ExpenseService.listByVehicle(vehicle.id)).length, 1);

    // Exclui veículo
    await VehicleService.deleteVehicle(vehicle.id);

    // Despesas do veículo devem ser ocultadas
    assert.equal((await ExpenseService.listByVehicle(vehicle.id)).length, 0);
  });
});
