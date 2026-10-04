import { Expense, CreateExpenseDTO, UpdateExpenseDTO } from '@autogest/shared-types';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { validateExpenseForm } from './expenseValidation';
import { gastosDoPeriodo, obterDetalhamentoGastosDoPeriodo } from './expenseAggregation';

export class ExpenseService {
  /**
   * Registra uma nova despesa manual validada (US22.2)
   */
  static async createExpense(dto: CreateExpenseDTO): Promise<Expense> {
    const validation = validateExpenseForm({
      vehicleId: dto.vehicleId,
      category: dto.category,
      amount: dto.amount,
      date: dto.date,
      description: dto.description || undefined,
    });

    if (!validation.isValid || !validation.data) {
      const errorMsg = Object.values(validation.errors).join(' ');
      throw new Error(errorMsg || 'Dados da despesa inválidos.');
    }

    const newExpense = await ExpenseRepository.create(validation.data);

    // Enfileira na fila outbox de sincronização offline-first (US02)
    await SyncQueueRepository.enqueue('CREATE_EXPENSE', '/api/v1/expenses', newExpense);

    return newExpense;
  }

  /**
   * Atualiza uma despesa existente (US22.3)
   */
  static async updateExpense(id: string, updates: UpdateExpenseDTO): Promise<Expense> {
    const existing = await ExpenseRepository.findById(id);
    if (!existing) {
      throw new Error('Despesa não encontrada para atualização.');
    }

    if (updates.amount !== undefined && Number(updates.amount) <= 0) {
      throw new Error('O valor da despesa deve ser maior que zero.');
    }

    if (updates.category === 'Combustível' || updates.category === 'Manutenção') {
      throw new Error(
        'Gastos com Combustível e Manutenção são registrados diretamente em suas telas.',
      );
    }

    const updated = await ExpenseRepository.update(id, updates);
    if (!updated) {
      throw new Error('Falha ao atualizar despesa.');
    }

    await SyncQueueRepository.enqueue('UPDATE_EXPENSE', `/api/v1/expenses/${id}`, updated);

    return updated;
  }

  /**
   * Exclui logicamente uma despesa (US22.3)
   */
  static async deleteExpense(id: string): Promise<boolean> {
    const existing = await ExpenseRepository.findById(id);
    if (!existing) return false;

    const success = await ExpenseRepository.delete(id);
    if (!success) return false;

    await SyncQueueRepository.enqueue('DELETE_EXPENSE', `/api/v1/expenses/${id}`, {
      id,
      vehicleId: existing.vehicleId,
    });

    return true;
  }

  /**
   * Lista todas as despesas ativas do veículo
   */
  static async listByVehicle(vehicleId: string): Promise<Expense[]> {
    return ExpenseRepository.listByVehicle(vehicleId);
  }

  /**
   * Lista despesas do veículo para um determinado mês e ano (US22.3)
   */
  static async listByMonth(vehicleId: string, year: number, month: number): Promise<Expense[]> {
    return ExpenseRepository.listByVehicleAndMonth(vehicleId, year, month);
  }

  /**
   * Obtém o total das despesas manuais de um mês específico
   */
  static async getMonthExpensesTotal(
    vehicleId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const expenses = await ExpenseRepository.listByVehicleAndMonth(vehicleId, year, month);
    const sum = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    return Number(sum.toFixed(2));
  }

  /**
   * Camada de agregação gastosDoPeriodo (US22.4)
   */
  static gastosDoPeriodo = gastosDoPeriodo;

  /**
   * Detalhamento de gastos por categoria no período
   */
  static obterDetalhamentoGastosDoPeriodo = obterDetalhamentoGastosDoPeriodo;
}
