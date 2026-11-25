import { GroupedVisitedPlace, VisitedPlaceRecord, VisitedPlaceType } from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { agruparLocaisVisitados } from './visitedPlacesDomain';

export const LOCAIS_VISITADOS_TABLE = 'locais_visitados';

function generateId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface RegistrarLocalVisitadoInput {
  tipo: VisitedPlaceType;
  referenciaId: string;
  nome?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  data: string;
}

/**
 * US36.1 — Serviço de persistência e consulta da tabela sincronizável `locais_visitados`.
 * Registros sem coordenadas válidas são ignorados (não entram no mapa).
 */
export class VisitedPlacesService {
  static async registrarLocalVisitado(
    input: RegistrarLocalVisitadoInput,
  ): Promise<VisitedPlaceRecord | null> {
    if (
      input.latitude === null ||
      input.latitude === undefined ||
      input.longitude === null ||
      input.longitude === undefined
    ) {
      return null;
    }

    const lat = Number(input.latitude);
    const lon = Number(input.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    const db = DatabaseConnection.getInstance();
    const now = new Date().toISOString();
    const record: VisitedPlaceRecord = {
      id: generateId(),
      tipo: input.tipo,
      referencia_id: input.referenciaId,
      nome: input.nome ? input.nome.trim() : null,
      latitude: lat,
      longitude: lon,
      data: input.data.slice(0, 10),
      criado_em: now,
      atualizado_em: now,
      excluido_em: null,
    };

    await db.insert(LOCAIS_VISITADOS_TABLE, record);
    await SyncQueueRepository.enqueue(
      'CREATE_VISITED_PLACE',
      '/api/v1/sync/locais_visitados',
      record,
    ).catch(() => {});
    return record;
  }

  static async listarBrutos(): Promise<VisitedPlaceRecord[]> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<VisitedPlaceRecord>(LOCAIS_VISITADOS_TABLE)) || [];
    return rows.filter(r => !r.excluido_em);
  }

  static async listarLocaisAgrupados(): Promise<GroupedVisitedPlace[]> {
    const brutos = await this.listarBrutos();
    return agruparLocaisVisitados(brutos);
  }
}
