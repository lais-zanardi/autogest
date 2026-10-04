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
  | 'UPDATE_ODOMETER';
export type SyncStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';

export interface SyncQueueItem<T = any> {
  id: string;
  operation: SyncOperationType;
  endpoint: string;
  payload: T;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt?: string;
}

export class SyncQueueRepository {
  private static TABLE = 'sync_queue';

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
    return item;
  }

  static async getPendingItems(): Promise<SyncQueueItem[]> {
    return db.find<SyncQueueItem>(this.TABLE, item => item.status === 'PENDING');
  }

  static async updateStatus(id: string, status: SyncStatus, lastError?: string): Promise<void> {
    const item = await db.findById<SyncQueueItem>(this.TABLE, id);
    if (!item) return;

    await db.update<SyncQueueItem>(this.TABLE, id, {
      status,
      lastError,
      retryCount: status === 'FAILED' ? item.retryCount + 1 : item.retryCount,
    });
  }

  static async removeItem(id: string): Promise<boolean> {
    return db.delete(this.TABLE, id);
  }

  static async clearAll(): Promise<void> {
    await db.saveTableData(this.TABLE, []);
  }
}
