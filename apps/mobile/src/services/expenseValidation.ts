import { ExpenseCategory, MANUAL_EXPENSE_CATEGORIES } from '@autogest/shared-types';

export interface ExpenseValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  data?: {
    vehicleId: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    description?: string | null;
  };
}

export interface ExpenseInputForm {
  vehicleId: string;
  category: string;
  amount: string | number;
  date: string;
  description?: string;
}

/**
 * Converte valor numérico em string (com vírgula ou ponto) para número
 */
export function parseExpenseAmount(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val || typeof val !== 'string') return 0;

  const cleaned = val.replace(/\s+/g, '').replace('R$', '').trim();
  let normalized = cleaned;
  if (cleaned.includes('.') && cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
}

/**
 * Valida os campos do formulário de despesas manuais (US22.2)
 */
export function validateExpenseForm(input: ExpenseInputForm): ExpenseValidationResult {
  const errors: Record<string, string> = {};

  if (!input.vehicleId || !input.vehicleId.trim()) {
    errors.vehicleId = 'Veículo não informado.';
  }

  // Validação da categoria
  if (!input.category) {
    errors.category = 'Selecione uma categoria de despesa.';
  } else if (input.category === 'Combustível' || input.category === 'Manutenção') {
    errors.category =
      'Gastos com Combustível e Manutenção são registrados diretamente em suas telas para evitar duplicidade.';
  } else if (!MANUAL_EXPENSE_CATEGORIES.includes(input.category as ExpenseCategory)) {
    errors.category = `Categoria inválida. Categorias permitidas: ${MANUAL_EXPENSE_CATEGORIES.join(', ')}.`;
  }

  // Validação do valor
  const parsedAmount = parseExpenseAmount(input.amount);
  if (!input.amount || String(input.amount).trim() === '') {
    errors.amount = 'Informe o valor da despesa.';
  } else if (parsedAmount <= 0) {
    errors.amount = 'O valor da despesa deve ser maior que zero.';
  }

  // Validação da data
  if (!input.date || !input.date.trim()) {
    errors.date = 'Informe a data da despesa.';
  } else {
    const parsedDate = new Date(input.date);
    if (isNaN(parsedDate.getTime())) {
      errors.date = 'Data inválida.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: {},
    data: {
      vehicleId: input.vehicleId,
      category: input.category as ExpenseCategory,
      amount: parsedAmount,
      date: new Date(input.date).toISOString(),
      description: input.description?.trim() || null,
    },
  };
}
