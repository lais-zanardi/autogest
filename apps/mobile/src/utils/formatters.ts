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
 * Alias pt-BR padronizado (US17.6 / US17.8): formata valor em reais no padrão brasileiro.
 */
export function formatarMoeda(valorReais: number): string {
  return formatCurrency(valorReais);
}

/**
 * Formata valor em centavos inteiros no padrão pt-BR (ex.: 589 -> "R$ 5,89").
 */
export function formatarMoedaCentavos(centavos: number): string {
  return formatarMoeda(centavos / 100);
}

/**
 * Formata data ISO "AAAA-MM-DD" para "DD/MM/AAAA".
 */
export function formatarDataColeta(dataIso?: string | null): string {
  if (!dataIso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso.trim());
  if (!match) return dataIso;
  return `${match[3]}/${match[2]}/${match[1]}`;
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

/**
 * Formata números com separador de milhar brasileiro (pt-BR)
 * Ex: 49380 -> "49.380", 1093 -> "1.093"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/**
 * Formata quilometragem no padrão brasileiro
 * Ex: 49380 -> "49.380 km"
 */
export function formatKm(value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0 km';
  }
  return `${formatNumber(Math.round(value))} km`;
}

/**
 * Formata um mês ISO ou representação no formato "mmm/aaaa"
 * Ex: "2026-11" -> "nov/2026", "2026-05-18" -> "mai/2026"
 */
export function formatMonth(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return '';
  const str = typeof dateOrIso === 'string' ? dateOrIso : dateOrIso.toISOString();
  const match = str.match(/^(\d{4})-(\d{2})/);
  if (!match) return str;
  const year = match[1];
  const monthNum = parseInt(match[2], 10);
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const monthName = months[monthNum - 1] || match[2];
  return `${monthName}/${year}`;
}

