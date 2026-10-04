/**
 * Máscaras para campos de formulário mobile (Placa, Valor Monetário, Odômetro)
 */

export function maskCurrency(value: string): string {
  const cleanValue = value.replace(/\D/g, '');
  const numberValue = (Number(cleanValue) / 100).toFixed(2);
  return `R$ ${numberValue.replace('.', ',')}`;
}

export function maskOdometer(value: string): string {
  const cleanValue = value.replace(/\D/g, '');
  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function maskPlate(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length <= 7) {
    return clean;
  }
  return clean.substring(0, 7);
}
