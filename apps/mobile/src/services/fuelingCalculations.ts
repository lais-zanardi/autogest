/**
 * Funções puras para cálculos de abastecimento, consumo e validação de quilometragem.
 */

export interface ValidationKmResult {
  isValid: boolean;
  error?: string;
}

/**
 * US05.5: Calcula o consumo médio em km/l entre dois abastecimentos consecutivos.
 * Retorna null se for o primeiro abastecimento ou se os dados forem inconsistentes.
 */
export function calcularConsumo(
  kmAtual: number,
  kmAnterior: number | null | undefined,
  litros: number,
): number | null {
  if (kmAnterior === null || kmAnterior === undefined || kmAnterior <= 0) {
    return null;
  }

  if (litros <= 0 || kmAtual <= kmAnterior) {
    return null;
  }

  const distancia = kmAtual - kmAnterior;
  const kml = distancia / litros;

  // Arredonda para 2 casas decimais de forma determinística
  return Number(kml.toFixed(2));
}

/**
 * US05.3 e US06.2: Validação única e compartilhada de novo km.
 * O novo km deve ser estritamente maior que o último consolidado do veículo.
 */
export function validarNovoKm(
  novoKm: number,
  ultimoKm: number | null | undefined,
): ValidationKmResult {
  if (typeof novoKm !== 'number' || isNaN(novoKm) || novoKm <= 0) {
    return {
      isValid: false,
      error: 'A quilometragem deve ser um número positivo maior que zero.',
    };
  }

  if (ultimoKm !== null && ultimoKm !== undefined && ultimoKm > 0 && novoKm <= ultimoKm) {
    const ultimoFormatado = ultimoKm.toLocaleString('pt-BR');
    return {
      isValid: false,
      error: `A quilometragem informada (${novoKm.toLocaleString('pt-BR')} km) deve ser estritamente superior ao último registro (${ultimoFormatado} km).`,
    };
  }

  return { isValid: true };
}

/**
 * US05.2: Calcula o valor total a partir dos litros e do valor por litro.
 */
export function calcularValorTotal(litros: number, valorLitro: number): number | null {
  if (litros <= 0 || valorLitro <= 0) return null;
  return Number((litros * valorLitro).toFixed(2));
}

/**
 * US05.2: Calcula o valor por litro a partir do valor total e dos litros.
 */
export function calcularValorLitro(valorTotal: number, litros: number): number | null {
  if (litros <= 0 || valorTotal <= 0) return null;
  return Number((valorTotal / litros).toFixed(3));
}

/**
 * US05.2: Calcula a quantidade de litros a partir do valor total e do valor por litro.
 */
export function calcularLitros(valorTotal: number, valorLitro: number): number | null {
  if (valorLitro <= 0 || valorTotal <= 0) return null;
  return Number((valorTotal / valorLitro).toFixed(3));
}
