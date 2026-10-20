import { FixedCost, CreateFixedCostDTO, UpdateFixedCostDTO } from '@autogest/shared-types';
import { FixedCostRepository } from '../repositories/FixedCostRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { parseExpenseAmount } from './expenseValidation';

export interface ValidateFixedCostInput {
  vehicleId: string;
  description: string;
  monthlyAmount: string | number;
}

export interface ValidateFixedCostResult {
  isValid: boolean;
  errors: Record<string, string>;
  data?: CreateFixedCostDTO;
}

/**
 * Valida o formulário de criação/edição de Custo Fixo Mensal (US23.2)
 */
export function validateFixedCostForm(input: ValidateFixedCostInput): ValidateFixedCostResult {
  const errors: Record<string, string> = {};

  if (!input.vehicleId || !String(input.vehicleId).trim()) {
    errors.vehicleId = 'Veículo é obrigatório.';
  }

  const trimmedDesc = input.description ? String(input.description).trim() : '';
  if (!trimmedDesc) {
    errors.description = 'A descrição do custo fixo é obrigatória (ex.: Seguro, Estacionamento).';
  }

  const parsedAmount = parseExpenseAmount(input.monthlyAmount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.monthlyAmount = 'O valor mensal deve ser maior que zero.';
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: {},
    data: {
      vehicleId: input.vehicleId,
      description: trimmedDesc,
      monthlyAmount: Number(parsedAmount.toFixed(2)),
    },
  };
}

/**
 * Verifica se o intervalo [inicio, fim] corresponde a um mês calendário cheio
 * (do dia 1 ao último dia do mesmo mês/ano) ou exatamente 30 dias.
 */
function isFullMonthPeriod(inicio: string | Date, fim: string | Date): boolean {
  const startStr =
    typeof inicio === 'string' ? inicio.trim().split('T')[0] : inicio.toISOString().split('T')[0];
  const endStr =
    typeof fim === 'string' ? fim.trim().split('T')[0] : fim.toISOString().split('T')[0];

  const startParts = startStr.split('-').map(Number);
  const endParts = endStr.split('-').map(Number);

  if (startParts.length === 3 && endParts.length === 3) {
    const [sYear, sMonth, sDay] = startParts;
    const [eYear, eMonth, eDay] = endParts;

    // Mesmo ano e mesmo mês começando no dia 01 e terminando no último dia do mês
    if (sYear === eYear && sMonth === eMonth && sDay === 1) {
      const lastDayOfMonth = new Date(Date.UTC(sYear, sMonth, 0)).getUTCDate();
      if (eDay === lastDayOfMonth) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calcula a quantidade de dias (inclusivos) em um intervalo [inicio, fim].
 */
function calculateDaysInPeriod(inicio: string | Date, fim: string | Date): number {
  const startStr =
    typeof inicio === 'string' ? inicio.trim().split('T')[0] : inicio.toISOString().split('T')[0];
  const endStr =
    typeof fim === 'string' ? fim.trim().split('T')[0] : fim.toISOString().split('T')[0];

  const startUtc = new Date(`${startStr}T00:00:00.000Z`).getTime();
  const endUtc = new Date(`${endStr}T00:00:00.000Z`).getTime();

  if (isNaN(startUtc) || isNaN(endUtc) || endUtc < startUtc) {
    return 0;
  }

  const diffDays = Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diffDays);
}

/**
 * US23.3 (Decisão #9 confirmada):
 * Função pura que calcula o valor de custo fixo aplicável ao período:
 * - Em período mensal (mês calendário completo ou 30 dias), soma o valor cheio;
 * - Em outros períodos, calcula proporcional aos dias: (somaMensal * diasNoPeriodo) / 30.
 */
export function calcularCustoFixoDoPeriodo(
  somaMensal: number,
  inicio: string | Date,
  fim: string | Date,
): number {
  const baseMensal = Number(somaMensal) || 0;
  if (baseMensal <= 0) {
    return 0;
  }

  if (isFullMonthPeriod(inicio, fim)) {
    return Number(baseMensal.toFixed(2));
  }

  const dias = calculateDaysInPeriod(inicio, fim);
  if (dias <= 0) {
    return 0;
  }

  if (dias === 30) {
    return Number(baseMensal.toFixed(2));
  }

  const proporcional = (baseMensal * dias) / 30;
  return Number(proporcional.toFixed(2));
}

export class FixedCostService {
  /**
   * Cadastra um novo custo fixo mensal por veículo e enfileira sincronização (US23.1 e US23.2)
   */
  static async createFixedCost(dto: CreateFixedCostDTO): Promise<FixedCost> {
    const validation = validateFixedCostForm({
      vehicleId: dto.vehicleId,
      description: dto.description,
      monthlyAmount: dto.monthlyAmount,
    });

    if (!validation.isValid || !validation.data) {
      const errorMsg = Object.values(validation.errors).join(' ');
      throw new Error(errorMsg || 'Dados do custo fixo inválidos.');
    }

    const created = await FixedCostRepository.create(validation.data);

    await SyncQueueRepository.enqueue('CREATE_FIXED_COST', '/api/v1/sync/custos_fixos', {
      id: created.id,
      veiculo_id: created.vehicleId,
      descricao: created.description,
      valor_mensal: created.monthlyAmount,
      criado_em: created.createdAt,
      atualizado_em: created.updatedAt,
    });

    // US13.3: Recalcula indicadores globais do dashboard ao cadastrar custo fixo
    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(created.vehicleId).catch(() => {});

    return created;
  }

  /**
   * Atualiza um custo fixo mensal existente (US23.2)
   */
  static async updateFixedCost(id: string, updates: UpdateFixedCostDTO): Promise<FixedCost> {
    const existing = await FixedCostRepository.findById(id);
    if (!existing) {
      throw new Error('Custo fixo não encontrado para atualização.');
    }

    if (updates.description !== undefined && !String(updates.description).trim()) {
      throw new Error('A descrição do custo fixo não pode ficar vazia.');
    }

    if (updates.monthlyAmount !== undefined && Number(updates.monthlyAmount) <= 0) {
      throw new Error('O valor mensal deve ser maior que zero.');
    }

    const updated = await FixedCostRepository.update(id, updates);
    if (!updated) {
      throw new Error('Falha ao atualizar custo fixo.');
    }

    await SyncQueueRepository.enqueue('UPDATE_FIXED_COST', `/api/v1/sync/custos_fixos/${id}`, {
      id: updated.id,
      veiculo_id: updated.vehicleId,
      descricao: updated.description,
      valor_mensal: updated.monthlyAmount,
      atualizado_em: updated.updatedAt,
    });

    // US13.3: Recalcula indicadores globais do dashboard ao editar custo fixo
    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(updated.vehicleId).catch(() => {});

    return updated;
  }

  /**
   * Remove (exclusão lógica) um custo fixo mensal (US23.2)
   */
  static async deleteFixedCost(id: string): Promise<boolean> {
    const existing = await FixedCostRepository.findById(id);
    if (!existing) return false;

    const success = await FixedCostRepository.delete(id);
    if (!success) return false;

    await SyncQueueRepository.enqueue('DELETE_FIXED_COST', `/api/v1/sync/custos_fixos/${id}`, {
      id,
      veiculo_id: existing.vehicleId,
    });

    // US13.3: Recalcula indicadores globais do dashboard ao excluir custo fixo
    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(existing.vehicleId).catch(() => {});

    return true;
  }

  /**
   * Lista todos os custos fixos ativos de um veículo (US23.2)
   */
  static async listByVehicle(vehicleId: string): Promise<FixedCost[]> {
    return FixedCostRepository.listByVehicle(vehicleId);
  }

  /**
   * Retorna a soma mensal cheia de todos os custos fixos ativos do veículo
   */
  static async getMonthlyTotalByVehicle(vehicleId: string): Promise<number> {
    const items = await FixedCostRepository.listByVehicle(vehicleId);
    const sum = items.reduce((acc, curr) => acc + (Number(curr.monthlyAmount) || 0), 0);
    return Number(sum.toFixed(2));
  }

  /**
   * Retorna o valor de custo fixo do veículo aplicável ao período (cheio no mês ou proporcional aos dias)
   */
  static async getPeriodTotalByVehicle(
    vehicleId: string,
    inicio: string | Date,
    fim: string | Date,
  ): Promise<number> {
    const somaMensal = await this.getMonthlyTotalByVehicle(vehicleId);
    return calcularCustoFixoDoPeriodo(somaMensal, inicio, fim);
  }
}
