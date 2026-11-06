import {
  UnifiedRecord,
  SearchFilters,
  SearchPaginationOptions,
  SearchResultPage,
  Refuel,
  Expense,
  Maintenance,
} from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { montarFiltro } from '../services/searchFilterService';

export class SearchRepository {
  /**
   * US33.1: Repositório unificado buscarRegistros(filtros)
   * Agrega abastecimentos, despesas e manutenções, aplica filtros combináveis,
   * filtra por etiqueta (se informada), ordena por data decrescente e pagina o resultado.
   */
  static async buscarRegistros(
    filtros: SearchFilters = {},
    pagination: SearchPaginationOptions = {},
  ): Promise<SearchResultPage> {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.max(1, pagination.limit || 20);

    // 1. Carrega abastecimentos ativos
    const refuelsRaw = await db.getTableData<Refuel>('local_refuels');
    const refuels = refuelsRaw.filter(r => !r.deletedAt && !(r as any).excluido_em);

    // 2. Carrega despesas ativas
    const expensesRaw = await db.getTableData<Expense>('local_despesas');
    const expenses = expensesRaw.filter(e => !e.deletedAt && !(e as any).excluido_em);

    // 3. Carrega manutenções ativas
    const maintsRaw = await db.getTableData<Maintenance>('manutencoes');
    const maints = maintsRaw.filter(m => !m.deletedAt && !(m as any).excluido_em);

    // 4. Mapeamento unificado
    const unified: UnifiedRecord[] = [];

    // Abastecimentos -> UnifiedRecord
    for (const r of refuels) {
      unified.push({
        id: r.id,
        vehicleId: r.vehicleId,
        date: r.date,
        recordType: 'abastecimento',
        title: r.fuelType ? `Abastecimento (${r.fuelType})` : 'Abastecimento',
        category: 'Combustível',
        amount: Number(r.totalValue || 0),
        odometer: r.odometer !== undefined ? Number(r.odometer) : null,
        description: r.stationName ? `Posto: ${r.stationName}` : null,
        notes: r.notes || (r as any).nota || null,
        routeType: r.routeType || (r as any).tipo_percurso || null,
        rawRecord: r,
      });
    }

    // Despesas -> UnifiedRecord
    for (const e of expenses) {
      unified.push({
        id: e.id,
        vehicleId: e.vehicleId,
        date: e.date,
        recordType: 'despesa',
        title: e.category || 'Despesa',
        category: e.category,
        amount: Number(e.amount || 0),
        odometer: null,
        description: e.description || null,
        notes: null,
        rawRecord: e,
      });
    }

    // Manutenções -> UnifiedRecord
    for (const m of maints) {
      unified.push({
        id: m.id,
        vehicleId: m.vehicleId,
        date: m.date,
        recordType: 'manutencao',
        title: m.description || `Manutenção (${m.type})`,
        category: 'Manutenção',
        amount: Number(m.totalValue || 0),
        odometer: m.odometer !== undefined ? Number(m.odometer) : null,
        description: m.description || null,
        notes: m.notes || (m as any).nota || null,
        workshop: m.workshop || null,
        parts: m.replacedParts || null,
        rawRecord: m,
      });
    }

    // 5. Filtro por etiqueta (se informado)
    let recordsFiltrados = unified;
    if (filtros.tagId) {
      const allRecordTags = await db.getTableData<any>('registros_etiquetas');
      const activeRecordTags = allRecordTags.filter(
        rt =>
          !rt.deletedAt &&
          !rt.excluido_em &&
          (rt.tagId === filtros.tagId || rt.etiqueta_id === filtros.tagId),
      );
      const taggedIds = new Set(activeRecordTags.map(rt => rt.recordId || rt.registro_id));
      recordsFiltrados = recordsFiltrados.filter(rec => taggedIds.has(rec.id));
    }

    // 6. Aplica predicado puro de busca e filtros
    const predicate = montarFiltro(filtros);
    recordsFiltrados = recordsFiltrados.filter(predicate);

    // 7. Ordenação decrescente por data (e odômetro/id como desempate)
    recordsFiltrados.sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (diff !== 0) return diff;
      const odoA = a.odometer || 0;
      const odoB = b.odometer || 0;
      return odoB - odoA;
    });

    // 8. Paginação
    const total = recordsFiltrados.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = recordsFiltrados.slice(offset, offset + limit);

    return {
      records: paginated,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
    };
  }
}
