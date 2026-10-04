import { FuelType } from '@autogest/shared-types';

export interface PlateValidationResult {
  isValid: boolean;
  formattedPlate?: string;
  error?: string;
}

export interface YearValidationResult {
  isValid: boolean;
  year?: number;
  error?: string;
}

export interface TankCapacityValidationResult {
  isValid: boolean;
  capacity?: number;
  error?: string;
}

export interface VehicleFormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  data?: {
    plate: string;
    model: string;
    year: number;
    tankCapacityL: number;
    preferredFuel: FuelType;
    name?: string;
    brand?: string;
    initialOdometer?: number;
  };
}

/**
 * Valida placa nos padrões brasileiro tradicional (ABC-1234 / ABC1234) e Mercosul (ABC1D23 / BRA2E19).
 */
export function validatePlate(plate: string | null | undefined): PlateValidationResult {
  if (!plate || typeof plate !== 'string') {
    return { isValid: false, error: 'A placa é obrigatória.' };
  }

  const clean = plate
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  // Padrão Tradicional: 3 letras e 4 números (ex: ABC1234)
  const isTraditional = /^[A-Z]{3}[0-9]{4}$/.test(clean);

  // Padrão Mercosul: 3 letras, 1 número, 1 letra, 2 números (ex: BRA2E19)
  const isMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(clean);

  if (isTraditional || isMercosul) {
    return { isValid: true, formattedPlate: clean };
  }

  return {
    isValid: false,
    error: 'Placa inválida. Utilize o formato tradicional (ABC-1234) ou Mercosul (ABC1D23).',
  };
}

/**
 * Converte entrada numérica textual aceitando vírgula ou ponto como separador decimal.
 */
export function parseDecimalInput(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  const normalized = String(value).trim().replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Valida o ano de fabricação/modelo entre 1900 e o ano seguinte ao atual.
 */
export function validateYear(year: number | string | null | undefined): YearValidationResult {
  if (year === null || year === undefined || year === '') {
    return { isValid: false, error: 'O ano do veículo é obrigatório.' };
  }

  const num = typeof year === 'number' ? year : parseInt(String(year), 10);
  if (isNaN(num) || !Number.isInteger(num)) {
    return { isValid: false, error: 'O ano deve ser um número inteiro válido.' };
  }

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 1;

  if (num < 1900 || num > maxYear) {
    return {
      isValid: false,
      error: `O ano deve estar entre 1900 e ${maxYear}.`,
    };
  }

  return { isValid: true, year: num };
}

/**
 * Valida a capacidade do tanque em litros (estritamente maior que zero, aceita decimais).
 */
export function validateTankCapacity(
  capacity: number | string | null | undefined,
): TankCapacityValidationResult {
  const parsed = parseDecimalInput(capacity);

  if (parsed === null || parsed <= 0) {
    return {
      isValid: false,
      error: 'A capacidade do tanque deve ser um valor maior que zero.',
    };
  }

  // Limite razoável de tanque (ex: até 1500L para caminhões)
  if (parsed > 2000) {
    return {
      isValid: false,
      error: 'Capacidade do tanque excede o limite aceito.',
    };
  }

  return { isValid: true, capacity: parsed };
}

/**
 * Validação completa do formulário de veículo para criação/edição.
 */
export function validateVehicleForm(form: {
  plate?: string;
  model?: string;
  year?: number | string;
  tankCapacityL?: number | string;
  preferredFuel?: FuelType | string;
  name?: string;
  brand?: string;
  initialOdometer?: number | string;
}): VehicleFormValidationResult {
  const errors: Record<string, string> = {};

  // Placa
  const plateResult = validatePlate(form.plate);
  if (!plateResult.isValid) {
    errors.plate = plateResult.error || 'Placa inválida.';
  }

  // Modelo
  if (!form.model || form.model.trim().length < 2) {
    errors.model = 'O modelo deve conter ao menos 2 caracteres.';
  }

  // Ano
  const yearResult = validateYear(form.year);
  if (!yearResult.isValid) {
    errors.year = yearResult.error || 'Ano inválido.';
  }

  // Capacidade do tanque
  const capacityResult = validateTankCapacity(form.tankCapacityL);
  if (!capacityResult.isValid) {
    errors.tankCapacityL = capacityResult.error || 'Capacidade inválida.';
  }

  // Combustível preferencial
  const validFuels: FuelType[] = ['Gasolina', 'Etanol', 'Diesel', 'GNV', 'Flex'];
  if (!form.preferredFuel || !validFuels.includes(form.preferredFuel as FuelType)) {
    errors.preferredFuel = 'Selecione um combustível preferencial válido.';
  }

  const isValid = Object.keys(errors).length === 0;

  if (!isValid) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: {},
    data: {
      plate: plateResult.formattedPlate!,
      model: form.model!.trim(),
      year: yearResult.year!,
      tankCapacityL: capacityResult.capacity!,
      preferredFuel: form.preferredFuel as FuelType,
      name: form.name?.trim(),
      brand: form.brand?.trim(),
      initialOdometer: parseDecimalInput(form.initialOdometer) ?? 0,
    },
  };
}
