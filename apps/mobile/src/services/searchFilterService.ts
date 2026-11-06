import { UnifiedRecord, SearchFilters } from '@autogest/shared-types';

/**
 * US33.4: Retorna o ID curto (8 primeiros caracteres do UUID)
 */
export function obterIdCurto(id: string): string {
  if (!id) return '';
  const limpo = id.trim().toLowerCase();
  // Se for UUID no formato 8-4-4-4-12 ou com prefixo, retorna os 8 primeiros caracteres úteis
  const match = limpo.match(/([0-9a-f]{8})-[0-9a-f]{4}/);
  if (match) return match[1];
  return limpo.substring(0, 8);
}

/**
 * US33.2: Montagem das condições de filtro em função pura (montarFiltro), testável sem banco.
 * Retorna um predicado booleano aplicável a um registro unificado.
 */
export function montarFiltro(filtros: SearchFilters): (record: UnifiedRecord) => boolean {
  const {
    vehicleId,
    dataInicio,
    dataFim,
    recordType,
    category,
    valorMin,
    valorMax,
    kmMin,
    kmMax,
    texto,
    routeType,
  } = filtros;

  const textoNormalizado = texto ? texto.trim().toLowerCase() : null;
  const timeInicio = dataInicio ? new Date(dataInicio).getTime() : null;
  const timeFim = dataFim ? new Date(dataFim).getTime() : null;

  return (record: UnifiedRecord): boolean => {
    // 1. Veículo
    if (vehicleId && record.vehicleId !== vehicleId) {
      return false;
    }

    // 2. Tipo de Registro
    if (recordType && recordType !== 'todos' && record.recordType !== recordType) {
      return false;
    }

    // 3. Categoria
    if (category && category !== 'todas') {
      const catRecord = (record.category || '').toLowerCase();
      if (catRecord !== category.toLowerCase()) {
        return false;
      }
    }

    // 4. Período
    if (timeInicio !== null || timeFim !== null) {
      const recTime = new Date(record.date).getTime();
      if (timeInicio !== null && recTime < timeInicio) return false;
      if (timeFim !== null && recTime > timeFim) return false;
    }

    // 5. Faixa de Valor
    if (valorMin !== null && valorMin !== undefined) {
      if (record.amount < valorMin) return false;
    }
    if (valorMax !== null && valorMax !== undefined) {
      if (record.amount > valorMax) return false;
    }

    // 6. Faixa de Km
    if (kmMin !== null && kmMin !== undefined) {
      if (record.odometer === null || record.odometer === undefined || record.odometer < kmMin) {
        return false;
      }
    }
    if (kmMax !== null && kmMax !== undefined) {
      if (record.odometer === null || record.odometer === undefined || record.odometer > kmMax) {
        return false;
      }
    }

    // 7. Tipo de Percurso
    if (routeType && routeType !== 'todos') {
      if (routeType === 'sem_tipo') {
        if (record.routeType) return false;
      } else {
        if (record.routeType !== routeType) return false;
      }
    }

    // 8. Busca textual por descrição, notas, oficina, peças ou ID por prefixo (US33.4)
    if (textoNormalizado) {
      const idLimpo = (record.id || '').toLowerCase();
      // Checa se o texto digitado é prefixo do ID (ex: "e4b1" em "e4b1a8d9-...")
      if (idLimpo.startsWith(textoNormalizado) || idLimpo.replace(/^[a-z]+_/, '').startsWith(textoNormalizado)) {
        return true;
      }

      const matchDesc = (record.description || '').toLowerCase().includes(textoNormalizado);
      const matchTitle = (record.title || '').toLowerCase().includes(textoNormalizado);
      const matchNotes = (record.notes || '').toLowerCase().includes(textoNormalizado);
      const matchWorkshop = (record.workshop || '').toLowerCase().includes(textoNormalizado);
      const matchParts = (record.parts || '').toLowerCase().includes(textoNormalizado);

      if (!matchDesc && !matchTitle && !matchNotes && !matchWorkshop && !matchParts) {
        return false;
      }
    }

    return true;
  };
}

/**
 * Aplica filtros em memória sobre uma lista de registros unificados
 */
export function filtrarRegistrosUnificados(
  records: UnifiedRecord[],
  filtros: SearchFilters,
): UnifiedRecord[] {
  const predicate = montarFiltro(filtros);
  return records.filter(predicate);
}
