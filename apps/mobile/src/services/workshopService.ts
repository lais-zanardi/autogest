import {
  CreateWorkshopDTO,
  Maintenance,
  UpdateWorkshopDTO,
  WorkshopDetailSummary,
  WorkshopRecord,
  WorkshopVisitDetail,
  WorkshopVisitRecord,
} from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import {
  calcularTotalGastoOficina,
  validarTelefoneOficina,
} from './workshopValidation';

export const OFICINAS_TABLE = 'oficinas';
export const ATENDIMENTOS_OFICINA_TABLE = 'atendimentos_oficina';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * US12.2, US12.3 & US12.4 — Serviço CRUD de Oficinas Favoritas e Histórico de Atendimentos
 */
export class WorkshopService {
  static async criarOficina(dto: CreateWorkshopDTO): Promise<WorkshopRecord> {
    const nome = (dto.nome || '').trim();
    if (!nome) {
      throw new Error('O nome da oficina é obrigatório.');
    }

    const validacaoTel = validarTelefoneOficina(dto.telefone);
    if (!validacaoTel.valido) {
      throw new Error(validacaoTel.erro || 'Telefone inválido.');
    }

    const db = DatabaseConnection.getInstance();
    const now = new Date().toISOString();
    const record: WorkshopRecord = {
      id: generateId('oficina'),
      nome,
      telefone: dto.telefone ? dto.telefone.trim() : null,
      endereco: dto.endereco ? dto.endereco.trim() : null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      favorita: Boolean(dto.favorita),
      observacoes: dto.observacoes ? dto.observacoes.trim() : null,
      criado_em: now,
      atualizado_em: now,
      excluido_em: null,
    };

    await db.insert(OFICINAS_TABLE, record);
    await SyncQueueRepository.enqueue('CREATE_WORKSHOP', '/api/v1/sync/oficinas', record).catch(
      () => {},
    );
    return record;
  }

  static async listarOficinas(apenasFavoritas: boolean = false): Promise<WorkshopRecord[]> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<WorkshopRecord>(OFICINAS_TABLE)) || [];
    return rows
      .filter(r => !r.excluido_em && (!apenasFavoritas || r.favorita))
      .sort((a, b) => {
        if (a.favorita !== b.favorita) return a.favorita ? -1 : 1;
        return a.nome.localeCompare(b.nome);
      });
  }

  static async buscarPorId(
    id: string,
    incluirExcluidas: boolean = false,
  ): Promise<WorkshopRecord | null> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<WorkshopRecord>(OFICINAS_TABLE)) || [];
    const found = rows.find(r => r.id === id && (incluirExcluidas || !r.excluido_em));
    return found || null;
  }

  static async atualizarOficina(
    id: string,
    updates: UpdateWorkshopDTO,
  ): Promise<WorkshopRecord | null> {
    const existing = await this.buscarPorId(id);
    if (!existing) return null;

    if (updates.nome !== undefined && !updates.nome.trim()) {
      throw new Error('O nome da oficina é obrigatório.');
    }
    if (updates.telefone !== undefined) {
      const validacaoTel = validarTelefoneOficina(updates.telefone);
      if (!validacaoTel.valido) {
        throw new Error(validacaoTel.erro || 'Telefone inválido.');
      }
    }

    const db = DatabaseConnection.getInstance();
    const updated: WorkshopRecord = {
      ...existing,
      ...(updates.nome !== undefined ? { nome: updates.nome.trim() } : {}),
      ...(updates.telefone !== undefined
        ? { telefone: updates.telefone ? updates.telefone.trim() : null }
        : {}),
      ...(updates.endereco !== undefined
        ? { endereco: updates.endereco ? updates.endereco.trim() : null }
        : {}),
      ...(updates.latitude !== undefined ? { latitude: updates.latitude } : {}),
      ...(updates.longitude !== undefined ? { longitude: updates.longitude } : {}),
      ...(updates.favorita !== undefined ? { favorita: Boolean(updates.favorita) } : {}),
      ...(updates.observacoes !== undefined
        ? { observacoes: updates.observacoes ? updates.observacoes.trim() : null }
        : {}),
      atualizado_em: new Date().toISOString(),
    };

    await db.update(OFICINAS_TABLE, id, updated);
    await SyncQueueRepository.enqueue('UPDATE_WORKSHOP', '/api/v1/sync/oficinas', updated).catch(
      () => {},
    );
    return updated;
  }

  static async alternarFavorita(id: string): Promise<WorkshopRecord | null> {
    const existing = await this.buscarPorId(id);
    if (!existing) return null;
    return this.atualizarOficina(id, { favorita: !existing.favorita });
  }

  /**
   * US12.5: Exclusão lógica de oficina (marca `excluido_em`), mantendo intacto
   * o histórico de atendimentos (`atendimentos_oficina`) e manutenções.
   */
  static async excluirOficina(id: string): Promise<boolean> {
    const existing = await this.buscarPorId(id);
    if (!existing) return false;

    const db = DatabaseConnection.getInstance();
    const now = new Date().toISOString();
    const deleted: WorkshopRecord = {
      ...existing,
      excluido_em: now,
      atualizado_em: now,
    };

    await db.update(OFICINAS_TABLE, id, deleted);
    await SyncQueueRepository.enqueue('DELETE_WORKSHOP', '/api/v1/sync/oficinas', { id }).catch(
      () => {},
    );
    return true;
  }

  /**
   * US12.3: Registra atendimento vinculando oficina cadastrada à manutenção salva.
   */
  static async registrarAtendimento(
    oficinaId: string,
    manutencaoId: string,
    data: string,
  ): Promise<WorkshopVisitRecord> {
    const db = DatabaseConnection.getInstance();
    const existentes =
      (await db.getTableData<WorkshopVisitRecord>(ATENDIMENTOS_OFICINA_TABLE)) || [];

    const jaExiste = existentes.find(
      a => !a.excluido_em && a.oficina_id === oficinaId && a.manutencao_id === manutencaoId,
    );
    if (jaExiste) {
      return jaExiste;
    }

    const now = new Date().toISOString();
    const record: WorkshopVisitRecord = {
      id: generateId('atend'),
      oficina_id: oficinaId,
      manutencao_id: manutencaoId,
      data,
      criado_em: now,
      atualizado_em: now,
      excluido_em: null,
    };

    await db.insert(ATENDIMENTOS_OFICINA_TABLE, record);
    await SyncQueueRepository.enqueue(
      'CREATE_WORKSHOP_VISIT',
      '/api/v1/sync/atendimentos_oficina',
      record,
    ).catch(() => {});
    return record;
  }

  static async listarAtendimentosDaOficina(oficinaId: string): Promise<WorkshopVisitRecord[]> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<WorkshopVisitRecord>(ATENDIMENTOS_OFICINA_TABLE)) || [];
    return rows
      .filter(r => !r.excluido_em && r.oficina_id === oficinaId)
      .sort((a, b) => b.data.localeCompare(a.data));
  }

  /**
   * US12.4: Retorna detalhes da oficina com histórico de atendimentos e total gasto.
   */
  static async obterDetalheOficina(
    oficinaId: string,
    incluirExcluidas: boolean = false,
  ): Promise<WorkshopDetailSummary | null> {
    const oficina = await this.buscarPorId(oficinaId, incluirExcluidas);
    if (!oficina) return null;

    const db = DatabaseConnection.getInstance();
    const atendimentos = await this.listarAtendimentosDaOficina(oficinaId);
    const manutencoes = (await db.getTableData<Maintenance>('manutencoes')) || [];

    const maintMap = new Map<string, Maintenance>();
    for (const m of manutencoes) {
      if (!m.deletedAt) {
        maintMap.set(m.id, m);
      }
    }

    const detalhes: WorkshopVisitDetail[] = atendimentos
      .map(att => {
        const maint = maintMap.get(att.manutencao_id);
        return {
          ...att,
          descricaoManutencao: maint?.description || 'Manutenção registrada',
          tipoServico: maint?.serviceType || 'outros',
          valorReais: maint ? Number(maint.totalValue || 0) : 0,
        };
      })
      .sort((a, b) => b.data.localeCompare(a.data));

    const totalGastoReais = calcularTotalGastoOficina(atendimentos, manutencoes);

    return {
      oficina,
      atendimentos: detalhes,
      totalGastoReais,
    };
  }
}
