import { ConsumptionUnit } from '@autogest/shared-types';
import {
  converterConsumo,
  formatarConsumo,
  formatarConsumoDetalhado,
} from '../services/preferencesService';

/**
 * Formatadores numéricos e de precisão decimal para consumo e custos
 */

export { converterConsumo, formatarConsumo, formatarConsumoDetalhado };

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * US39.4: Redireciona para `formatarConsumo` respeitando `unidade_consumo_principal`
 * e exibindo "-- km/l" quando vazio na interface.
 */
export function formatKml(value?: number | null, unidadePrincipal?: ConsumptionUnit): string {
  const formatted = formatarConsumo(value, unidadePrincipal);
  if (!formatted) {
    return '-- km/l';
  }
  return formatted;
}

export function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}
