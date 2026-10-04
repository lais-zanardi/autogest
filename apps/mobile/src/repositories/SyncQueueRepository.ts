import { db } from '../database/DatabaseConnection';

export type SyncOperationType =
  | 'CREATE_REFUEL'
  | 'UPDATE_REFUEL'
  | 'DELETE_REFUEL'
  | 'CREATE_VEHICLE'
  | 'UPDATE_VEHICLE'
  | 'DELETE_VEHICLE'
  | 'CREATE_EXPENSE'
  | 'UPDATE_EXPENSE'
  | 'DELETE_EXPENSE'
  | 'CREATE_ODOMETER_READING'
  | 'UPDATE_ODOMETER'
  | 'CREATE_MAINTENANCE'
  | 'UPDATE_MAINTENANCE'
  | 'DELETE_MAINTENANCE'
  | 'CREATE_ATTACHMENT'
  | 'UPDATE_ATTACHMENT'
  | 'DELETE_ATTACHMENT';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';

export interface SyncQueueItem<T = any> {
  id: string;
  operation: SyncOperationType;
  endpoint: string;
  payload: T;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
  nextRetryAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * US02.4: Repositório da fila outbox de sincronização (fila_sync / sync_queue).
 * Garante enfileiramento transacional offline-first e ordem FIFO com retentativas de espera crescente.
 */
export class SyncQueueRepository {
  private static TABLE = 'fila_sync';
  private static LEGACY_TABLE = 'sync_queue';

  /**
   * Enfileira uma nova operação na outbox
   */
  static async enqueue<T>(
    operation: SyncOperationType,
    endpoint: string,
    payload: T,
  ): Promise<SyncQueueItem<T>> {
    const item: SyncQueueItem<T> = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      operation,
      endpoint,
      payload,
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await db.insert(this.TABLE, item);
    // Mantém compatibilidade com a tabela legada
    try {
      await db.insert(this.LEGACY_TABLE, item);
    } catch {
      // Ignore
    }
    return item;
  }

  /**
   * Retorna os itens pendentes em estrita ordem cronológica FIFO (US02.5)
   */
  static async getPendingItems(): Promise<SyncQueueItem[]> {
    const primary = await db.find<SyncQueueItem>(
      this.TABLE,
      item => item.status === 'PENDING' || item.status === 'FAILED',
    );
    const items =
      primary.length > 0
        ? primary
        : await db.find<SyncQueueItem>(
            this.LEGACY_TABLE,
            item => item.status === 'PENDING' || item.status === 'FAILED',
          );

    const now = Date.now();
    return items
      .filter(item => !item.nextRetryAt || new Date(item.nextRetryAt).getTime() <= now)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Conta quantos itens pendentes aguardam sincronização
   */
  static async countPending(): Promise<number> {
    const list = await this.getPendingItems();
    return list.length;
  }

  /**
   * Calcula o atraso de retentativa em milissegundos com backoff exponencial (1s, 2s, 4s, 8s... até 30s)
   */
  static calculateBackoffDelayMs(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 30000);
  }

  /**
   * Atualiza o status do item na fila com suporte a espera crescente
   */
  static async updateStatus(id: string, status: SyncStatus, lastError?: string): Promise<void> {
    const item =
      (await db.findById<SyncQueueItem>(this.TABLE, id)) ||
      (await db.findById<SyncQueueItem>(this.LEGACY_TABLE, id));
    if (!item) return;

    const newRetryCount = status === 'FAILED' ? item.retryCount + 1 : item.retryCount;
    const delay = this.calculateBackoffDelayMs(newRetryCount);
    const nextRetryAt =
      status === 'FAILED' ? new Date(Date.now() + delay).toISOString() : undefined;

    const updates: Partial<SyncQueueItem> = {
      status,
      lastError,
      retryCount: newRetryCount,
      nextRetryAt,
      updatedAt: new Date().toISOString(),
    };

    await db.update<SyncQueueItem>(this.TABLE, id, updates);
    try {
      await db.update<SyncQueueItem>(this.LEGACY_TABLE, id, updates);
    } catch {
      // Ignore
    }
  }

  /**
   * Remove item processado da fila
   */
  static async removeItem(id: string): Promise<boolean> {
    const res1 = await db.delete(this.TABLE, id);
    const res2 = await db.delete(this.LEGACY_TABLE, id);
    return res1 || res2;
  }

  /**
   * Limpa todos os itens da fila
   */
  static async clearAll(): Promise<void> {
    await db.saveTableData(this.TABLE, []);
    await db.saveTableData(this.LEGACY_TABLE, []);
  }
}
