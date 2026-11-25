import {
  DrivingProfileCorrelationResult,
  DrivingProfileRecord,
  DrivingProfileType,
} from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { correlacaoPerfilConsumo } from './drivingProfileDomain';

export const PERFIS_CONDUCAO_TABLE = 'perfis_conducao';

function generateId(): string {
  return `perf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * US29.1, US29.3 & US29.5 — Serviço de Perfil de Condução por veículo.
 * Grava um novo registro de perfil sem reescrever o histórico de abastecimentos anteriores.
 */
export class DrivingProfileService {
  static async obterPerfilAtual(veiculoId: string): Promise<DrivingProfileType> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<DrivingProfileRecord>(PERFIS_CONDUCAO_TABLE)) || [];
    const doVeiculo = rows
      .filter(r => !r.excluido_em && r.veiculo_id === veiculoId)
      .sort((a, b) => b.definido_em.localeCompare(a.definido_em));

    return doVeiculo[0]?.perfil_conducao || 'normal';
  }

  static async definirPerfil(
    veiculoId: string,
    perfil: DrivingProfileType,
  ): Promise<DrivingProfileRecord> {
    if (!['economico', 'normal', 'agressivo'].includes(perfil)) {
      throw new Error('Perfil de condução inválido.');
    }

    const db = DatabaseConnection.getInstance();
    const now = new Date().toISOString();
    const record: DrivingProfileRecord = {
      id: generateId(),
      veiculo_id: veiculoId,
      vehicleId: veiculoId,
      perfil_conducao: perfil,
      definido_em: now,
      criado_em: now,
      atualizado_em: now,
      excluido_em: null,
    };

    await db.insert(PERFIS_CONDUCAO_TABLE, record);
    await SyncQueueRepository.enqueue(
      'CREATE_DRIVING_PROFILE',
      '/api/v1/sync/perfis_conducao',
      record,
    ).catch(() => {});

    return record;
  }

  static async obterCorrelacaoDoVeiculo(
    veiculoId: string,
  ): Promise<DrivingProfileCorrelationResult> {
    const refuels = await RefuelRepository.listByVehicle(veiculoId);
    return correlacaoPerfilConsumo(refuels);
  }
}
