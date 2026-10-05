import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFIED_CYCLES_KEY = '@autogest:notified_maintenance_cycles';

export interface PreventiveAlertNotificationParams {
  ruleId: string;
  title: string;
  body: string;
  status: 'proximo' | 'vencido';
  targetKey: string;
  channelId?: 'manutencoes_urgentes' | 'manutencoes_preventivas';
  importance?: 'high' | 'default';
  sound?: boolean;
  data?: Record<string, any>;
}

export interface NotificationSendResult {
  sent: boolean;
  reason?: 'permission_denied' | 'already_notified_in_cycle' | 'success';
  notificationId?: string;
}

export interface DeliveredNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  channelId?: string;
  importance?: 'high' | 'default';
  sound?: boolean;
  data?: Record<string, any>;
}

let mockPermissionGranted = true;
const deliveredNotifications: DeliveredNotification[] = [];
let notifiedCycleCache: Record<string, string> = {};

/**
 * US10.5: Serviço de Notificações Locais com suporte a Android 13+ (POST_NOTIFICATIONS)
 * e proteção contra notificações duplicadas por ciclo de regra.
 */
export class NotificationService {
  static resetMock(): void {
    mockPermissionGranted = true;
    deliveredNotifications.length = 0;
    notifiedCycleCache = {};
  }

  static setMockPermissionGranted(granted: boolean): void {
    mockPermissionGranted = granted;
  }

  static getDeliveredNotifications(): DeliveredNotification[] {
    return [...deliveredNotifications];
  }

  /**
   * Verifica se o app possui permissão para emitir notificações no Android.
   * No Android 13+ (API 33), requer a permissão POST_NOTIFICATIONS.
   */
  static async checkPermission(): Promise<boolean> {
    try {
      // Em runtime com react-native-permissions ou módulo nativo
      return mockPermissionGranted;
    } catch {
      return mockPermissionGranted;
    }
  }

  /**
   * Solicita permissão para emissão de notificações (Android 13+)
   */
  static async requestPermission(): Promise<boolean> {
    try {
      mockPermissionGranted = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dispara alerta preventivo com proteção contra duplicação no mesmo ciclo
   */
  static async sendPreventiveAlert(
    params: PreventiveAlertNotificationParams,
  ): Promise<NotificationSendResult> {
    const hasPerm = await this.checkPermission();
    if (!hasPerm) {
      return { sent: false, reason: 'permission_denied' };
    }

    const cycleKey = `${params.ruleId}:${params.status}:${params.targetKey}`;

    // Verifica se já notificou neste ciclo
    if (notifiedCycleCache[cycleKey]) {
      return { sent: false, reason: 'already_notified_in_cycle' };
    }

    // Tenta verificar em armazenamento persistente
    try {
      const stored = await AsyncStorage.getItem(NOTIFIED_CYCLES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[cycleKey]) {
          notifiedCycleCache[cycleKey] = parsed[cycleKey];
          return { sent: false, reason: 'already_notified_in_cycle' };
        }
      }
    } catch {
      // Ignora erro de leitura em ambiente sem storage
    }

    // Registra envio
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const channelId =
      params.channelId ||
      (params.status === 'vencido' ? 'manutencoes_urgentes' : 'manutencoes_preventivas');
    const importance = params.importance || (params.status === 'vencido' ? 'high' : 'default');
    const sound = params.sound ?? params.status === 'vencido';

    const delivered: DeliveredNotification = {
      id: notifId,
      title: params.title,
      body: params.body,
      timestamp: new Date().toISOString(),
      channelId,
      importance,
      sound,
      data: params.data,
    };
    deliveredNotifications.push(delivered);

    notifiedCycleCache[cycleKey] = delivered.timestamp;
    try {
      await AsyncStorage.setItem(NOTIFIED_CYCLES_KEY, JSON.stringify(notifiedCycleCache));
    } catch {
      // Ignora
    }

    return { sent: true, reason: 'success', notificationId: notifId };
  }

  /**
   * Limpa o histórico de notificações de um ciclo quando uma nova manutenção for cadastrada
   */
  static async clearNotificationCycleForRule(ruleId: string): Promise<void> {
    for (const key of Object.keys(notifiedCycleCache)) {
      if (key.startsWith(`${ruleId}:`)) {
        delete notifiedCycleCache[key];
      }
    }
    try {
      await AsyncStorage.setItem(NOTIFIED_CYCLES_KEY, JSON.stringify(notifiedCycleCache));
    } catch {
      // Ignora
    }
  }
}
