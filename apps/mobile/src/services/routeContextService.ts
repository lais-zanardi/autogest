import { Refuel, RouteType, ConsumptionByRouteTypeSummary } from '@autogest/shared-types';

export const LIMITE_MAXIMO_NOTA = 500;

export interface ValidacaoNotaResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida o limite de caracteres de notas livres (US27.4).
 */
export function validarNota(nota?: string | null): ValidacaoNotaResult {
  if (nota === null || nota === undefined || nota === '') {
    return { isValid: true };
  }
  if (nota.length > LIMITE_MAXIMO_NOTA) {
    return {
      isValid: false,
      error: `A nota deve ter no máximo ${LIMITE_MAXIMO_NOTA} caracteres (atual: ${nota.length}).`,
    };
  }
  return { isValid: true };
}

/**
 * Normaliza o tipo de percurso de um abastecimento
 */
export function normalizarTipoPercurso(refuel: Refuel): RouteType | 'nao_informado' {
  const tipo = (refuel.routeType || refuel.tipo_percurso || '') as string;
  if (tipo === 'urbano' || tipo === 'rodoviario' || tipo === 'misto') {
    return tipo as RouteType;
  }
  return 'nao_informado';
}

/**
 * US27.6: Calcula média dos consumos por tipo de percurso.
 * Registros sem tipo de percurso ficam em "não informado".
 * Registros sem consumo válido (<= 0 ou nulo) não são incluídos no cálculo da média.
 */
export function consumoPorTipoPercurso(abastecimentos: Refuel[]): ConsumptionByRouteTypeSummary {
  const acumuladores: Record<
    RouteType | 'nao_informado',
    { somaKml: number; totalConsumos: number; totalGeral: number }
  > = {
    urbano: { somaKml: 0, totalConsumos: 0, totalGeral: 0 },
    rodoviario: { somaKml: 0, totalConsumos: 0, totalGeral: 0 },
    misto: { somaKml: 0, totalConsumos: 0, totalGeral: 0 },
    nao_informado: { somaKml: 0, totalConsumos: 0, totalGeral: 0 },
  };

  const activeRefuels = (abastecimentos || []).filter(r => !r.deletedAt && !(r as any).excluido_em);

  for (const ref of activeRefuels) {
    const tipo = normalizarTipoPercurso(ref);
    const kml = Number(ref.calculatedKml ?? (ref as any).consumo_kml ?? 0);

    acumuladores[tipo].totalGeral += 1;

    if (kml > 0 && !isNaN(kml)) {
      acumuladores[tipo].somaKml += kml;
      acumuladores[tipo].totalConsumos += 1;
    }
  }

  const formatarItem = (tipo: RouteType | 'nao_informado', rotulo: string) => {
    const item = acumuladores[tipo];
    const mediaKml =
      item.totalConsumos > 0 ? Number((item.somaKml / item.totalConsumos).toFixed(2)) : 0;
    return {
      tipo,
      rotulo,
      mediaKml,
      totalRegistros: item.totalConsumos, // registros que geraram cálculo de consumo
    };
  };

  return {
    urbano: formatarItem('urbano', 'Urbano'),
    rodoviario: formatarItem('rodoviario', 'Rodoviário'),
    misto: formatarItem('misto', 'Misto'),
    naoInformado: formatarItem('nao_informado', 'Não informado'),
  };
}
