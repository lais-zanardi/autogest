import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { SyncQueueRepository } from '../../repositories/SyncQueueRepository';
import { SyncEntityRegistry } from './SyncEntityRegistry';
import { useAppStore } from '../../store/useAppStore';

const LAST_SYNC_KEY = '@autogest:last_sync_timestamp';
let memoryLastSync: string | null = null;

async function getStoredLastSync(): Promise<string> {
  try {
    const val = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (val) return val;
  } catch {
    // Fallback Node
  }
  return memoryLastSync || '';
}

async function setStoredLastSync(ts: string): Promise<void> {
  memoryLastSync = ts;
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, ts);
  } catch {
    // Fallback Node
  }
}

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  error?: string;
}

/**
 * US02.5 & US02.6: Serviço de Sincronização em Nuvem (Push / Pull com Last-Write-Wins e Retentativas)
 */
export class SyncService {
  private static isSyncing = false;
  private static syncListeners: Array<(isOnline: boolean) => void> = [];

  /**
   * Envia as operações pendentes da outbox (fila_sync) em estrita ordem FIFO (US02.5)
   */
  static async push(): Promise<{ success: boolean; pushedCount: number; error?: string }> {
    const pendingItems = await SyncQueueRepository.getPendingItems();
    let pushedCount = 0;

    for (const item of pendingItems) {
      try {
        await SyncQueueRepository.updateStatus(item.id, 'SYNCING');

        // Determina o método HTTP com base na operação
        const isDelete = item.operation.startsWith('DELETE_');
        let endpoint = item.endpoint.startsWith('/api/v1')
          ? item.endpoint
          : `/api/v1${item.endpoint.startsWith('/') ? '' : '/'}${item.endpoint}`;

        // Normalização defensiva: assegura que chamadas de sincronização sejam direcionadas ao motor /api/v1/sync/
        if (!endpoint.includes('/sync/')) {
          endpoint = endpoint.replace('/api/v1/', '/api/v1/sync/');
        }

        if (isDelete) {
          const targetId = item.payload?.id || item.payload;
          const url = endpoint.includes(`/${targetId}`) ? endpoint : `${endpoint}/${targetId}`;
          await api.delete(url);
        } else {
          const targetId = item.payload?.id;
          const url =
            targetId && !endpoint.includes(`/${targetId}`) ? `${endpoint}/${targetId}` : endpoint;
          await api.put(url, item.payload);
        }

        // Sucesso -> remove da outbox
        await SyncQueueRepository.removeItem(item.id);
        pushedCount++;
      } catch (err: any) {
        // Falha -> atualiza com backoff exponencial crescente e interrompe a fila para manter FIFO
        const errorMsg = err?.response?.data?.error || err?.message || 'Erro de conexão';
        await SyncQueueRepository.updateStatus(item.id, 'FAILED', errorMsg);
        return {
          success: false,
          pushedCount,
          error: errorMsg,
        };
      }
    }

    return { success: true, pushedCount };
  }

  /**
   * Busca as mudanças no servidor desde a última sincronização (Pull)
   */
  static async pull(): Promise<{ success: boolean; pulledCount: number; error?: string }> {
    let pulledCount = 0;
    try {
      const lastSyncTimestamp = await getStoredLastSync();
      const entities = SyncEntityRegistry.getAll();

      for (const entity of entities) {
        try {
          const url = `${entity.endpoint}${lastSyncTimestamp ? `?atualizado_desde=${encodeURIComponent(lastSyncTimestamp)}` : ''}`;
          const response = await api.get(url);
          const items = response.data?.items || response.data || [];

          if (Array.isArray(items)) {
            for (const item of items) {
              await entity.applyRemote(item);
              pulledCount++;
            }
          }
        } catch (e) {
          // Continua para as demais entidades caso uma falhe temporariamente
          console.warn(`[SyncService] Erro ao sincronizar entidade ${entity.name}:`, e);
        }
      }

      await setStoredLastSync(new Date().toISOString());
      return { success: true, pulledCount };
    } catch (err: any) {
      return {
        success: false,
        pulledCount,
        error: err?.message || 'Erro ao puxar dados do servidor.',
      };
    }
  }

  /**
   * Ciclo completo de sincronização: Push seguido de Pull
   */
  static async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        error: 'Sincronização em andamento.',
      };
    }

    this.isSyncing = true;
    const store = useAppStore.getState();
    store.setOnlineStatus(true);
    if ((store as any).setSyncState) {
      (store as any).setSyncState('syncing');
    }

    try {
      // 1. Push
      const pushRes = await this.push();
      // 2. Pull
      const pullRes = await this.pull();

      if (pullRes.pulledCount > 0) {
        try {
          const { VehicleRepository } = await import('../../repositories/VehicleRepository');
          const vehicles = await VehicleRepository.listAll();
          store.setVehicles(vehicles);
        } catch {
          // Ignore in headless test runs
        }
      }

      const success = pushRes.success && pullRes.success;
      const now = new Date().toISOString();
      const remainingPending = await SyncQueueRepository.countPending();

      if ((store as any).setSyncState) {
        let finalStatus: 'idle' | 'syncing' | 'synced' | 'error' = success ? 'synced' : 'error';
        if (remainingPending > 0 && !success) {
          finalStatus = 'error';
        } else if (remainingPending > 0) {
          finalStatus = 'idle';
        }
        (store as any).setSyncState(finalStatus, success ? now : undefined, remainingPending);
      }

      return {
        success,
        pushedCount: pushRes.pushedCount,
        pulledCount: pullRes.pulledCount,
        error: pushRes.error || pullRes.error,
      };
    } catch (err: any) {
      const remainingPending = await SyncQueueRepository.countPending().catch(() => 0);
      if ((store as any).setSyncState) {
        (store as any).setSyncState('error', undefined, remainingPending);
      }
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        error: err?.message || 'Falha geral de sincronização.',
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * US02.6: Disparo sem ação do usuário quando a conexão voltar
   */
  static async onConnectionRestored(): Promise<void> {
    const store = useAppStore.getState();
    store.setOnlineStatus(true);
    await this.sync();
  }

  /**
   * Atualiza a contagem de itens pendentes no store
   */
  static async refreshPendingCount(): Promise<number> {
    const count = await SyncQueueRepository.countPending();
    const store = useAppStore.getState();
    if ((store as any).setSyncState) {
      (store as any).setSyncState(store.syncStatus, undefined, count);
    }
    return count;
  }

  /**
   * Obtém a data da última sincronização
   */
  static async getLastSyncTime(): Promise<string | null> {
    return getStoredLastSync();
  }

  /**
   * US02.6: Inicializa ouvintes de conectividade e dispara sync automático na abertura
   */
  static init(): void {
    NetworkMonitor.init();
    NetworkMonitor.onReconnect(async () => {
      await this.onConnectionRestored();
    });

    // Sincroniza em background ao inicializar o app se estiver autenticado
    const state = useAppStore.getState();
    this.refreshPendingCount().catch(() => {});
    if (state.isAuthenticated) {
      this.sync().catch(() => {});
    }
  }
}

export type NetworkStateListener = (isConnected: boolean) => void;

/**
 * Monitor de conectividade de rede com suporte ao NetInfo e fallback transparente para testes Node
 */
export class NetworkMonitor {
  private static listeners: NetworkStateListener[] = [];
  private static isConnected = true;
  private static unsubscribeNetInfo: (() => void) | null = null;

  static init(): void {
    try {
      // Carregamento dinâmico seguro em ambiente React Native
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetInfo = require('@react-native-community/netinfo');
      if (NetInfo && typeof NetInfo.addEventListener === 'function') {
        this.unsubscribeNetInfo = NetInfo.addEventListener((state: any) => {
          const connected = !!(state.isConnected && state.isInternetReachable !== false);
          this.setConnected(connected);
        });
      }
    } catch {
      // Ambiente Node.js de testes / runtime sem NetInfo nativo
    }
  }

  static setConnected(connected: boolean): void {
    const wasDisconnected = !this.isConnected;
    this.isConnected = connected;
    useAppStore.getState().setOnlineStatus(connected);
    if (wasDisconnected && connected) {
      this.listeners.forEach(fn => fn(true));
    }
  }

  static onReconnect(listener: NetworkStateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  static cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.listeners = [];
  }
}
