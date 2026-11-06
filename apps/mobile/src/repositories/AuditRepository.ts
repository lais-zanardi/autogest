import {
  AuditAction,
  AuditChanges,
  AuditEntityName,
  AuditLogRecord,
  CreateAuditLogDTO,
} from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { SyncQueueRepository } from './SyncQueueRepository';
import { useAppStore } from '../store/useAppStore';

export type AuditSnapshot = Record<string, any>;

export interface AuditFilterOptions {
  entidade?: AuditEntityName | 'todas';
  de?: string | Date;
  ate?: string | Date;
  usuarioId?: string;
}

/**
 * US21.5, US21.6 & US21.8: Repositório e Interceptor de Auditoria (somente inserção / append-only).
 * Não possui métodos de edição nem de exclusão, e seus registros não contêm `atualizado_em` nem `excluido_em`.
 */
export class AuditRepository {
  public static readonly TABLE = 'auditoria';
  private static auditSuspendDepth = 0;

  /**
   * Resolve automaticamente o ID do usuário a partir do parâmetro explícito, dos snapshots `antes`/`depois`
   * ou da sessão autenticada ativa no `useAppStore` antes de recorrer ao fallback `'local_user'`.
   */
  private static resolveUserId(
    explicitUserId?: string,
    antes?: AuditSnapshot | null,
    depois?: AuditSnapshot | null,
  ): string {
    if (explicitUserId && explicitUserId !== 'local_user') {
      return explicitUserId;
    }

    const fromDepois = depois?.usuario_id || depois?.userId;
    if (typeof fromDepois === 'string' && fromDepois.trim() && fromDepois !== 'local_user') {
      return fromDepois;
    }

    const fromAntes = antes?.usuario_id || antes?.userId;
    if (typeof fromAntes === 'string' && fromAntes.trim() && fromAntes !== 'local_user') {
      return fromAntes;
    }

    try {
      const storeUser = useAppStore.getState()?.user;
      if (storeUser?.id && storeUser.id.trim()) {
        return storeUser.id;
      }
    } catch {
      // Ignora caso a store ainda não esteja inicializada
    }

    return explicitUserId || 'local_user';
  }

  /**
   * Executa um bloco suspendendo temporariamente o interceptor de auditoria
   * (usado por exemplo quando o SyncEntityRegistry aplica alterações vindas do servidor).
   */
  static async runWithAuditSuspended<T>(fn: () => Promise<T>): Promise<T> {
    this.auditSuspendDepth += 1;
    try {
      return await fn();
    } finally {
      this.auditSuspendDepth = Math.max(0, this.auditSuspendDepth - 1);
    }
  }

  static isAuditSuspended(): boolean {
    return this.auditSuspendDepth > 0;
  }

  /**
   * Insere um novo registro imutável de auditoria localmente e enfileira na outbox de sincronização.
   */
  static async create(dto: CreateAuditLogDTO): Promise<AuditLogRecord> {
    const now = new Date().toISOString();
    const resolvedUserId = this.resolveUserId(
      dto.usuario_id,
      dto.alteracoes?.antes,
      dto.alteracoes?.depois,
    );
    const record: AuditLogRecord = {
      id: dto.id || `aud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      usuario_id: resolvedUserId,
      entidade: dto.entidade,
      entidade_id: dto.entidade_id,
      acao: dto.acao,
      alteracoes: {
        antes: dto.alteracoes?.antes ? this.sanitizeSnapshot(dto.alteracoes.antes) : null,
        depois: dto.alteracoes?.depois ? this.sanitizeSnapshot(dto.alteracoes.depois) : null,
      },
      data_hora: dto.data_hora || now,
    };

    const existing = await db.getTableData<AuditLogRecord>(this.TABLE);
    const alreadyExists = existing.find(item => item.id === record.id);
    if (alreadyExists) {
      return alreadyExists;
    }

    existing.push(record);
    await db.saveTableData(this.TABLE, existing);

    try {
      await SyncQueueRepository.enqueue(
        'CREATE_AUDIT_LOG',
        `/api/v1/sync/auditoria/${record.id}`,
        record,
      );
    } catch {
      // Ignora falha de outbox caso ocorra fora de contexto
    }

    return record;
  }

  /**
   * Interceptor chamado pela camada de repositórios (US21.6).
   */
  static async recordMutation(params: {
    usuario_id?: string;
    entidade: AuditEntityName;
    entidade_id: string;
    acao: AuditAction;
    antes: AuditSnapshot | null;
    depois: AuditSnapshot | null;
  }): Promise<AuditLogRecord | null> {
    if (this.isAuditSuspended()) {
      return null;
    }

    const alteracoes: AuditChanges = {
      antes: params.antes ? this.sanitizeSnapshot(params.antes) : null,
      depois: params.depois ? this.sanitizeSnapshot(params.depois) : null,
    };

    const resolvedUserId = this.resolveUserId(params.usuario_id, params.antes, params.depois);

    return this.create({
      usuario_id: resolvedUserId,
      entidade: params.entidade,
      entidade_id: params.entidade_id,
      acao: params.acao,
      alteracoes,
    });
  }

  /**
   * Insere registro recebido do servidor durante pull de sync (idempotente, sem re-enfileirar na outbox).
   */
  static async insertFromRemote(remote: any): Promise<void> {
    if (!remote || !remote.id) return;
    const existing = await db.getTableData<AuditLogRecord>(this.TABLE);
    if (existing.some(item => item.id === remote.id)) {
      return;
    }

    let parsedChanges: AuditChanges = { antes: null, depois: null };
    if (typeof remote.alteracoes === 'string') {
      try {
        parsedChanges = JSON.parse(remote.alteracoes);
      } catch {
        parsedChanges = { antes: null, depois: null };
      }
    } else if (remote.alteracoes && typeof remote.alteracoes === 'object') {
      parsedChanges = {
        antes: remote.alteracoes.antes ?? null,
        depois: remote.alteracoes.depois ?? null,
      };
    }

    const record: AuditLogRecord = {
      id: String(remote.id),
      usuario_id: String(remote.usuario_id || remote.userId || 'local_user'),
      entidade: remote.entidade as AuditEntityName,
      entidade_id: String(remote.entidade_id || remote.entityId || ''),
      acao: remote.acao as AuditAction,
      alteracoes: parsedChanges,
      data_hora: String(remote.data_hora || remote.criado_em || new Date().toISOString()),
    };

    existing.push(record);
    await db.saveTableData(this.TABLE, existing);
  }

  static async findById(id: string): Promise<AuditLogRecord | null> {
    const all = await db.getTableData<AuditLogRecord>(this.TABLE);
    return all.find(item => item.id === id) || null;
  }

  /**
   * Lista todos os registros de auditoria ordenados por data_hora decrescente (mais recente primeiro).
   */
  static async listAll(): Promise<AuditLogRecord[]> {
    const all = await db.getTableData<AuditLogRecord>(this.TABLE);
    return [...all].sort(
      (a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime(),
    );
  }

  /**
   * US21.8: Lista registros de auditoria filtrados por entidade e/ou período.
   */
  static async listFiltered(filters?: AuditFilterOptions): Promise<AuditLogRecord[]> {
    const all = await this.listAll();
    if (!filters) return all;

    const startTime = filters.de ? new Date(filters.de).getTime() : undefined;
    const endTime = filters.ate ? new Date(filters.ate).getTime() : undefined;

    return all.filter(item => {
      if (filters.entidade && filters.entidade !== 'todas' && item.entidade !== filters.entidade) {
        return false;
      }

      if (filters.usuarioId && item.usuario_id !== filters.usuarioId) {
        return false;
      }

      if (startTime !== undefined || endTime !== undefined) {
        const t = new Date(item.data_hora).getTime();
        if (startTime !== undefined && !isNaN(startTime) && t < startTime) {
          return false;
        }
        if (endTime !== undefined && !isNaN(endTime) && t > endTime) {
          return false;
        }
      }

      return true;
    });
  }

  private static sanitizeSnapshot(obj: Record<string, any>): Record<string, any> {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        copy[k] = v;
      }
    }
    return copy;
  }
}
