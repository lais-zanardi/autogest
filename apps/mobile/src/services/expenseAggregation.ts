import { ExpenseCategory, Expense, Refuel, Maintenance } from '@autogest/shared-types';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';

export interface GastosDetalhadosPeriodo {
  total: number;
  porCategoria: Record<ExpenseCategory, number>;
  totalDespesas: number;
  totalAbastecimentos: number;
  totalManutencoes: number;
  despesas: Expense[];
  abastecimentos: Refuel[];
  manutencoes: Maintenance[];
}

function normalizeDateRange(inicio: string | Date, fim: string | Date): { start: Date; end: Date } {
  let start = new Date(inicio);
  let end = new Date(fim);

  if (typeof fim === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fim.trim())) {
    end = new Date(`${fim.trim()}T23:59:59.999Z`);
  }
  if (typeof inicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inicio.trim())) {
    start = new Date(`${inicio.trim()}T00:00:00.000Z`);
  }

  return { start, end };
}

/**
 * US22.4 & US09.3: Camada de agregação gastosDoPeriodo(veiculo, inicio, fim, categoria?)
 * Soma despesas manuais, abastecimentos e manutenções.
 * Se categoria for especificada:
 *  - 'Combustível': soma abastecimentos
 *  - 'Manutenção': soma manutenções da US09 (e eventuais despesas de manutenção)
 *  - 'Seguro', 'Imposto', 'Lavagem', 'Outros': soma despesas da respectiva categoria
 * Se categoria não for informada, soma tudo (despesas + abastecimentos + manutenções).
 */
export async function gastosDoPeriodo(
  veiculo: string | { id: string },
  inicio: string | Date,
  fim: string | Date,
  categoria?: ExpenseCategory,
): Promise<number> {
  const vehicleId = typeof veiculo === 'string' ? veiculo : veiculo.id;
  const { start, end } = normalizeDateRange(inicio, fim);

  let total = 0;

  // Despesas (Seguro, Imposto, Lavagem, Outros)
  if (!categoria || categoria !== 'Combustível') {
    const despesas = await ExpenseRepository.listByVehicleAndPeriod(vehicleId, start, end);
    const filteredDespesas = categoria ? despesas.filter(d => d.category === categoria) : despesas;

    const somaDespesas = filteredDespesas.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    total += somaDespesas;
  }

  // Abastecimentos (Combustível)
  if (!categoria || categoria === 'Combustível') {
    const abastecimentos = await RefuelRepository.listByVehicleAndPeriod(vehicleId, start, end);
    const somaAbastecimentos = abastecimentos.reduce(
      (acc, curr) => acc + (curr.totalValue || 0),
      0,
    );
    total += somaAbastecimentos;
  }

  // Manutenções (US09.3)
  if (!categoria || categoria === 'Manutenção') {
    const manutencoes = await MaintenanceRepository.listByVehicleAndPeriod(vehicleId, start, end);
    const somaManutencoes = manutencoes.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
    total += somaManutencoes;
  }

  return Number(total.toFixed(2));
}

/**
 * Fornece detalhamento completo de gastos agrupados por categoria
 * Reutilizada nas US13, US23, US24, US14 e US15
 */
export async function obterDetalhamentoGastosDoPeriodo(
  veiculo: string | { id: string },
  inicio: string | Date,
  fim: string | Date,
): Promise<GastosDetalhadosPeriodo> {
  const vehicleId = typeof veiculo === 'string' ? veiculo : veiculo.id;
  const { start, end } = normalizeDateRange(inicio, fim);

  const despesas = await ExpenseRepository.listByVehicleAndPeriod(vehicleId, start, end);
  const abastecimentos = await RefuelRepository.listByVehicleAndPeriod(vehicleId, start, end);
  const manutencoes = await MaintenanceRepository.listByVehicleAndPeriod(vehicleId, start, end);

  const porCategoria: Record<ExpenseCategory, number> = {
    Combustível: 0,
    Manutenção: 0,
    Seguro: 0,
    Imposto: 0,
    Lavagem: 0,
    Outros: 0,
  };

  for (const d of despesas) {
    if (porCategoria[d.category] !== undefined) {
      porCategoria[d.category] += d.amount || 0;
    } else {
      porCategoria['Outros'] += d.amount || 0;
    }
  }

  const totalAbastecimentos = abastecimentos.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  porCategoria['Combustível'] += totalAbastecimentos;

  const totalManutencoes = manutencoes.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  porCategoria['Manutenção'] += totalManutencoes;

  for (const cat of Object.keys(porCategoria) as ExpenseCategory[]) {
    porCategoria[cat] = Number(porCategoria[cat].toFixed(2));
  }

  const totalDespesas = despesas.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const total = Number((totalDespesas + totalAbastecimentos + totalManutencoes).toFixed(2));

  return {
    total,
    porCategoria,
    totalDespesas: Number(totalDespesas.toFixed(2)),
    totalAbastecimentos: Number(totalAbastecimentos.toFixed(2)),
    totalManutencoes: Number(porCategoria['Manutenção'].toFixed(2)),
    despesas,
    abastecimentos,
    manutencoes,
  };
}
