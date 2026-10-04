/**
 * Formatadores numéricos e de precisão decimal para consumo e custos
 */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatKml(value?: number | null): string {
  if (value === undefined || value === null || value <= 0) {
    return '-- km/L';
  }
  return `${value.toFixed(2).replace('.', ',')} km/L`;
}

export function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}
