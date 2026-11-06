import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MaintenanceAlert,
  NotificationReconciliationResult,
  ScheduledNotificationRecord,
} from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { PausarNotificacoesOptions, PreferencesService } from './preferencesService';

const NOTIFIED_CYCLES_KEY = '@autogest:notified_maintenance_cycles';
const SCHEDULED_TABLE = 'notificacoes_agendadas';

export interface PreventiveAlertNotificationParams {
  ruleId: string;
  title: string;
  body: string;
  status: 'proximo' | 'vencido';
  targetKey: string;
  channelId?:
    | 'manutencoes_urgentes'
    | 'manutencoes_preventivas'
    | 'orcamento_avisos'
    | 'orcamento_critico'
    | string;
  importance?: 'high' | 'default';
  sound?: boolean;
  data?: Record<string, any>;
}

export interface DispararNotificacaoParams {
  title: string;
  body: string;
  channelId?:
    | 'manutencoes_urgentes'
    | 'manutencoes_preventivas'
    | 'orcamento_avisos'
    | 'orcamento_critico'
    | string;
  importance?: 'high' | 'default';
  sound?: boolean;
  data?: Record<string, any>;
}

export interface AgendarNotificacaoParams extends DispararNotificacaoParams {
  id?: string;
  triggerAt: string | Date;
  sourceType?: 'regra_manutencao' | 'agendamento' | 'outro';
  sourceId?: string;
  vehicleId?: string;
}

export type ScheduledNotificationItem = ScheduledNotificationRecord;

export interface NotificationSendResult {
  sent: boolean;
  reason?:
    | 'permission_denied'
    | 'already_notified_in_cycle'
    | 'notifications_paused'
    | 'suppressed_for_summary'
    | 'success';
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
const scheduledNotifications = new Map<string, ScheduledNotificationItem>();
let notifiedCycleCache: Record<string, string> = {};
let suppressIndividualDispatches = false;

/**
 * US10.5, US15.4 & US39.6–US39.8: Serviço Unificado de Notificações Locais (`NotificacaoService`)
 * Centraliza `disparar`, `agendar`, `cancelar`, pausa global (`pausarAte`, `retomarAgora`)
 * e reconciliação idempotente na tabela local `notificacoes_agendadas`.
 */
export class NotificationService {
  static resetMock(): void {
    mockPermissionGranted = true;
    deliveredNotifications.length = 0;
    scheduledNotifications.clear();
    notifiedCycleCache = {};
    suppressIndividualDispatches = false;
  }

  static setMockPermissionGranted(granted: boolean): void {
    mockPermissionGranted = granted;
  }

  static getDeliveredNotifications(): DeliveredNotification[] {
    return [...deliveredNotifications];
  }

  static getScheduledNotifications(): ScheduledNotificationItem[] {
    return Array.from(scheduledNotifications.values());
  }

  static async listarAgendadasNoBanco(): Promise<ScheduledNotificationRecord[]> {
    const db = DatabaseConnection.getInstance();
    return db.getTableData<ScheduledNotificationRecord>(SCHEDULED_TABLE);
  }

  /**
   * US15.4 & US39.7: Ponto único para disparar uma notificação local imediata.
   * Suprime o disparo quando as notificações estiverem pausadas.
   */
  static async disparar(
    params: DispararNotificacaoParams,
    dataReferencia: Date = new Date(),
  ): Promise<NotificationSendResult> {
    const hasPerm = await this.checkPermission();
    if (!hasPerm) {
      return { sent: false, reason: 'permission_denied' };
    }

    if (suppressIndividualDispatches) {
      return { sent: false, reason: 'suppressed_for_summary' };
    }

    const emPausa = await PreferencesService.estaEmPausa(dataReferencia);
    if (emPausa) {
      return { sent: false, reason: 'notifications_paused' };
    }

    return this.emitirNotificacaoInterna(params, dataReferencia);
  }

  private static emitirNotificacaoInterna(
    params: DispararNotificacaoParams,
    dataReferencia: Date = new Date(),
  ): NotificationSendResult {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const importance = params.importance || 'default';
    const channelId =
      params.channelId || (importance === 'high' ? 'orcamento_critico' : 'orcamento_avisos');
    const sound = params.sound ?? importance === 'high';

    const delivered: DeliveredNotification = {
      id: notifId,
      title: params.title,
      body: params.body,
      timestamp: dataReferencia.toISOString(),
      channelId,
      importance,
      sound,
      data: params.data,
    };

    deliveredNotifications.push(delivered);
    return { sent: true, reason: 'success', notificationId: notifId };
  }

  /**
   * US39.6 & US39.7: Ponto único para agendar uma notificação local futura,
   * persistindo na tabela local `notificacoes_agendadas`.
   * Se cair dentro da janela de pausa ativa, grava já como `'cancelada'`.
   */
  static async agendar(params: AgendarNotificacaoParams): Promise<ScheduledNotificationItem> {
    const id = params.id || `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const triggerAt =
      typeof params.triggerAt === 'string' ? params.triggerAt : params.triggerAt.toISOString();
    const importance = params.importance || 'default';
    const channelId = params.channelId || 'manutencoes_preventivas';
    const nowIso = new Date().toISOString();

    const prefs = await PreferencesService.obterPreferencias();
    let status: 'agendada' | 'cancelada' = 'agendada';
    if (prefs.notificacoes_pausadas_ate) {
      const pauseEndMs = new Date(prefs.notificacoes_pausadas_ate).getTime();
      const triggerMs = new Date(triggerAt).getTime();
      if (Number.isFinite(pauseEndMs) && Number.isFinite(triggerMs) && triggerMs <= pauseEndMs) {
        status = 'cancelada';
      }
    }

    const item: ScheduledNotificationItem = {
      id,
      title: params.title,
      body: params.body,
      triggerAt,
      channelId,
      importance,
      status,
      sourceType: params.sourceType || 'outro',
      sourceId: params.sourceId,
      vehicleId: params.vehicleId,
      data: params.data,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    scheduledNotifications.set(id, item);

    const db = DatabaseConnection.getInstance();
    const rows = await db.getTableData<ScheduledNotificationRecord>(SCHEDULED_TABLE);
    const existingIdx = rows.findIndex(r => r.id === id);
    if (existingIdx >= 0) {
      rows[existingIdx] = item;
    } else {
      rows.push(item);
    }
    await db.saveTableData(SCHEDULED_TABLE, rows);

    return item;
  }

  /**
   * US39.6 & US30.4: Cancela notificações agendadas associadas a um ID de referência/origem (ex.: id de agendamento).
   */
  static async cancelarPorReferencia(sourceId: string): Promise<number> {
    const db = DatabaseConnection.getInstance();
    const rows = await db.getTableData<ScheduledNotificationRecord>(SCHEDULED_TABLE);
    const nowIso = new Date().toISOString();
    let canceladas = 0;

    const updatedRows = rows.map(row => {
      if (
        row.sourceId === sourceId &&
        (row.status === 'agendada' || (row.status as string) === 'pendente')
      ) {
        canceladas += 1;
        const updated: ScheduledNotificationRecord = {
          ...row,
          status: 'cancelada',
          updatedAt: nowIso,
        };
        scheduledNotifications.set(row.id, updated);
        return updated;
      }
      return row;
    });

    for (const [id, memItem] of scheduledNotifications.entries()) {
      if (
        memItem.sourceId === sourceId &&
        (memItem.status === 'agendada' || (memItem.status as string) === 'pendente')
      ) {
        memItem.status = 'cancelada';
        memItem.updatedAt = nowIso;
        scheduledNotifications.set(id, memItem);
      }
    }

    await db.saveTableData(SCHEDULED_TABLE, updatedRows);
    return canceladas;
  }

  /**
   * US39.6: Ponto único para cancelar uma notificação local agendada.
   */
  static async cancelar(id: string): Promise<boolean> {
    const db = DatabaseConnection.getInstance();
    const rows = await db.getTableData<ScheduledNotificationRecord>(SCHEDULED_TABLE);
    const idx = rows.findIndex(r => r.id === id);
    const existingMem = scheduledNotifications.get(id);

    if (idx < 0 && !existingMem) {
      return false;
    }

    const nowIso = new Date().toISOString();
    if (existingMem) {
      existingMem.status = 'cancelada';
      existingMem.updatedAt = nowIso;
      scheduledNotifications.set(id, existingMem);
    }

    if (idx >= 0) {
      rows[idx] = {
        ...rows[idx],
        status: 'cancelada',
        updatedAt: nowIso,
      };
      await db.saveTableData(SCHEDULED_TABLE, rows);
    }

    return true;
  }

  /**
   * US39.7: Cancela todas as notificações agendadas cujo disparo caia até `pausaAteIso`.
   */
  static async cancelarAgendadasNaJanela(pausaAteIso: string): Promise<number> {
    const pauseEndMs = new Date(pausaAteIso).getTime();
    if (!Number.isFinite(pauseEndMs)) return 0;

    const db = DatabaseConnection.getInstance();
    const rows = await db.getTableData<ScheduledNotificationRecord>(SCHEDULED_TABLE);
    const nowIso = new Date().toISOString();
    let canceladas = 0;

    const updatedRows = rows.map(row => {
      const triggerMs = new Date(row.triggerAt).getTime();
      if (row.status === 'agendada' && Number.isFinite(triggerMs) && triggerMs <= pauseEndMs) {
        canceladas += 1;
        const updated: ScheduledNotificationRecord = {
          ...row,
          status: 'cancelada',
          updatedAt: nowIso,
        };
        scheduledNotifications.set(row.id, updated);
        return updated;
      }
      return row;
    });

    for (const [id, memItem] of scheduledNotifications.entries()) {
      const triggerMs = new Date(memItem.triggerAt).getTime();
      if (memItem.status === 'agendada' && Number.isFinite(triggerMs) && triggerMs <= pauseEndMs) {
        memItem.status = 'cancelada';
        memItem.updatedAt = nowIso;
        scheduledNotifications.set(id, memItem);
      }
    }

    await db.saveTableData(SCHEDULED_TABLE, updatedRows);
    return canceladas;
  }

  /**
   * US39.5 & US39.7: Pausa notificações até a data/duração escolhida e cancela agendamentos na janela.
   */
  static async pausarAte(
    dataFinalOuOpcoes: string | Date | PausarNotificacoesOptions,
    dataReferencia: Date = new Date(),
  ): Promise<string> {
    const opcoes: PausarNotificacoesOptions =
      typeof dataFinalOuOpcoes === 'string' || dataFinalOuOpcoes instanceof Date
        ? { dataFinal: dataFinalOuOpcoes }
        : dataFinalOuOpcoes;

    const prefs = await PreferencesService.pausarNotificacoes(opcoes, dataReferencia);
    const pausadasAte = prefs.notificacoes_pausadas_ate!;
    await this.cancelarAgendadasNaJanela(pausadasAte);
    return pausadasAte;
  }

  /**
   * US39.5 & US39.8: Retoma as notificações imediatamente ("Retomar agora"),
   * reavaliando regras (US10) e orçamento (US15), reagendando o futuro e emitindo
   * uma única notificação-resumo se houver alertas vencidos ou críticos.
   */
  static async retomarAgora(
    dataReferencia: Date = new Date(),
  ): Promise<NotificationReconciliationResult> {
    await PreferencesService.definirNotificacoesPausadasAte(null);
    return this.executarRetomadaEReconciliacao(dataReferencia, true);
  }

  /**
   * US39.6 & US39.8: Reconciliação ao abrir o app (ou em tarefa em background):
   * - Se havia uma pausa cujo prazo expirou (`notificacoes_pausadas_ate <= agora`), encerra a pausa,
   *   reavalia regras (US10) e orçamento (US15), reagenda o futuro e dispara uma única notificação-resumo.
   * - Caso contrário, cancela e recria de forma idempotente os agendamentos futuros na tabela
   *   `notificacoes_agendadas` a partir das regras de manutenção ativas e agendamentos.
   */
  static async reconciliarAoAbrirApp(
    dataReferencia: Date = new Date(),
  ): Promise<NotificationReconciliationResult> {
    const prefs = await PreferencesService.obterPreferencias();
    let pausaEncerrada = false;

    if (prefs.notificacoes_pausadas_ate) {
      const pauseEndMs = new Date(prefs.notificacoes_pausadas_ate).getTime();
      if (Number.isFinite(pauseEndMs) && pauseEndMs <= dataReferencia.getTime()) {
        pausaEncerrada = true;
        await PreferencesService.definirNotificacoesPausadasAte(null);
      } else if (Number.isFinite(pauseEndMs) && pauseEndMs > dataReferencia.getTime()) {
        // Ainda está em pausa: garante que agendamentos na janela estejam cancelados e coleta alertas vencidos silenciosamente
        await this.cancelarAgendadasNaJanela(prefs.notificacoes_pausadas_ate);
        const alertasVencidos = await this.avaliarRegrasSilenciosamente(dataReferencia);
        const agendadasAtivas = (await this.listarAgendadasNoBanco()).filter(
          n => n.status === 'agendada',
        );
        return {
          agendadasAtivas,
          alertasVencidos,
          pausaEncerrada: false,
        };
      }
    }

    return this.executarRetomadaEReconciliacao(dataReferencia, pausaEncerrada);
  }

  private static async avaliarRegrasSilenciosamente(
    dataReferencia: Date,
  ): Promise<MaintenanceAlert[]> {
    const { VehicleRepository } = await import('../repositories/VehicleRepository');
    const { MaintenanceAlertService } = await import('./maintenanceAlertService');

    const prevSuppress = suppressIndividualDispatches;
    suppressIndividualDispatches = true;
    try {
      const vehicles = await VehicleRepository.listAll();
      const vencidos: MaintenanceAlert[] = [];
      for (const v of vehicles) {
        const alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
          v.id,
          dataReferencia,
          false,
        );
        for (const a of alerts) {
          if (a.status === 'vencido') {
            vencidos.push(a);
          }
        }
      }
      return vencidos;
    } finally {
      suppressIndividualDispatches = prevSuppress;
    }
  }

  private static async executarRetomadaEReconciliacao(
    dataReferencia: Date,
    emitirResumoFimDePausa: boolean,
  ): Promise<NotificationReconciliationResult> {
    const { VehicleRepository } = await import('../repositories/VehicleRepository');
    const { MaintenanceRuleRepository } = await import('../repositories/MaintenanceRuleRepository');
    const { MaintenanceRepository } = await import('../repositories/MaintenanceRepository');
    const { OdometerRepository } = await import('../repositories/OdometerRepository');
    const { MaintenanceAlertService, SERVICE_TYPE_LABELS } =
      await import('./maintenanceAlertService');
    const { calcularMediaKmDia, calcularProximoVencimento } =
      await import('./maintenanceCalculation');
    const { BudgetService } = await import('./budgetService');

    const vehicles = await VehicleRepository.listAll();
    const alertasVencidos: MaintenanceAlert[] = [];
    const alertasOrcamento: string[] = [];

    // 1. Durante a reconciliação/retomada, suprime disparos individuais para evitar spam
    const prevSuppress = suppressIndividualDispatches;
    suppressIndividualDispatches = true;

    try {
      for (const v of vehicles) {
        const vAlerts = await MaintenanceAlertService.evaluateVehicleAlerts(
          v.id,
          dataReferencia,
          false,
        );
        for (const a of vAlerts) {
          if (a.status === 'vencido') {
            alertasVencidos.push(a);
          }
        }

        if (emitirResumoFimDePausa) {
          const budgetSummary = await BudgetService.reavaliarOrcamentoDoVeiculo(
            v.id,
            dataReferencia,
          );
          if (
            budgetSummary &&
            (budgetSummary.nivel === 'aviso' || budgetSummary.nivel === 'critico')
          ) {
            alertasOrcamento.push(`${v.model}: ${budgetSummary.mensagem}`);
          }
        }
      }
    } finally {
      suppressIndividualDispatches = prevSuppress;
    }

    // 2. Reconcilia tabela `notificacoes_agendadas`: cancela agendamentos de regras anteriores e recria os futuros de forma determinística
    const db = DatabaseConnection.getInstance();
    const existentes = await db.getTableData<ScheduledNotificationRecord>(SCHEDULED_TABLE);
    const nowMs = dataReferencia.getTime();
    const nowIso = dataReferencia.toISOString();

    // Preserva agendamentos manuais futuros que não sejam de regras_manutencao
    const preservadas: ScheduledNotificationRecord[] = [];
    for (const row of existentes) {
      if (row.sourceType === 'regra_manutencao') {
        // Será recriado deterministicamente a partir das regras ativas abaixo se ainda estiver no futuro
        continue;
      } else {
        const triggerMs = new Date(row.triggerAt).getTime();
        const isPendenteOuAgendada =
          row.status === 'agendada' || (row.status as string) === 'pendente';
        if (isPendenteOuAgendada && Number.isFinite(triggerMs) && triggerMs > nowMs) {
          preservadas.push(row);
          scheduledNotifications.set(row.id, row);
        } else if (isPendenteOuAgendada && Number.isFinite(triggerMs) && triggerMs <= nowMs) {
          // Chegou o horário do lembrete (US30.4 / US30.6): dispara notificação interna e marca como disparada
          this.emitirNotificacaoInterna(
            {
              title: row.title,
              body: row.body,
              channelId: row.channelId,
              importance: row.importance,
              sound: true,
              data: {
                ...row.data,
                sourceId: row.sourceId,
                sourceType: row.sourceType,
              },
            },
            dataReferencia,
          );

          const disparada: ScheduledNotificationRecord = {
            ...row,
            status: 'cancelada', // ou disparada
            updatedAt: nowIso,
          };
          preservadas.push(disparada);
          scheduledNotifications.set(row.id, disparada);
        } else {
          preservadas.push(row);
          scheduledNotifications.set(row.id, row);
        }
      }
    }

    const novasAgendadas: ScheduledNotificationRecord[] = [];

    for (const v of vehicles) {
      const kmAtual = v.currentOdometer || v.initialOdometer || 0;
      const [rules, maintenances, leituras] = await Promise.all([
        MaintenanceRuleRepository.listByVehicle(v.id, true),
        MaintenanceRepository.listByVehicle(v.id),
        OdometerRepository.listByVehicle(v.id),
      ]);
      const mediaKmDia = calcularMediaKmDia(leituras, dataReferencia);

      for (const rule of rules) {
        const candidates = maintenances
          .filter(m => m.serviceType === rule.serviceType)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const ultimaManutencao = candidates[0] || null;

        const calc = calcularProximoVencimento({
          regra: rule,
          ultimaManutencao,
          kmAtual,
          mediaKmDia,
          dataReferencia,
        });

        const futureDateStr = calc.targetDate || calc.estimatedDateByKm;
        if (futureDateStr) {
          const triggerIso = /^\d{4}-\d{2}-\d{2}$/.test(futureDateStr)
            ? `${futureDateStr}T09:00:00.000Z`
            : new Date(futureDateStr).toISOString();
          const triggerMs = new Date(triggerIso).getTime();

          if (Number.isFinite(triggerMs) && triggerMs > nowMs) {
            const serviceName =
              rule.name || SERVICE_TYPE_LABELS[rule.serviceType] || rule.serviceType;
            const schedId = `sched_rule_${rule.id}_${futureDateStr}`;
            const record: ScheduledNotificationRecord = {
              id: schedId,
              title: `🔔 Lembrete Programado: ${serviceName}`,
              body: `Revisão programada (${serviceName}) para o veículo ${v.model}.`,
              triggerAt: triggerIso,
              channelId: 'manutencoes_preventivas',
              importance: 'default',
              status: 'agendada',
              sourceType: 'regra_manutencao',
              sourceId: rule.id,
              vehicleId: v.id,
              data: {
                vehicleId: v.id,
                ruleId: rule.id,
                targetDate: futureDateStr,
              },
              createdAt: nowIso,
              updatedAt: nowIso,
            };

            novasAgendadas.push(record);
            scheduledNotifications.set(schedId, record);
          }
        }
      }
    }

    const todasSalvas = [...preservadas, ...novasAgendadas];
    await db.saveTableData(SCHEDULED_TABLE, todasSalvas);

    // 3. US39.8: Se encerrou uma pausa e há alertas vencidos ou alertas de orçamento, dispara UMA ÚNICA notificação-resumo
    let notificacaoResumoId: string | undefined;
    if (emitirResumoFimDePausa && (alertasVencidos.length > 0 || alertasOrcamento.length > 0)) {
      const partesResumo: string[] = [];
      if (alertasVencidos.length > 0) {
        const labelAlertas =
          alertasVencidos.length === 1
            ? '1 alerta vencido'
            : `${alertasVencidos.length} alertas vencidos`;
        const nomes = alertasVencidos.map(a => a.serviceName).join(', ');
        partesResumo.push(`Você possui ${labelAlertas} (${nomes}).`);
      }
      if (alertasOrcamento.length > 0) {
        partesResumo.push(`Orçamento: ${alertasOrcamento.join('; ')}.`);
      }

      const res = this.emitirNotificacaoInterna(
        {
          title: '📋 Resumo de Alertas Após Pausa',
          body: partesResumo.join(' '),
          channelId: 'manutencoes_urgentes',
          importance: 'high',
          sound: true,
          data: {
            type: 'pause_end_summary',
            overdueCount: alertasVencidos.length,
            budgetAlertsCount: alertasOrcamento.length,
          },
        },
        dataReferencia,
      );

      if (res.sent) {
        notificacaoResumoId = res.notificationId;
      }
    }

    const agendadasAtivas = todasSalvas.filter(n => n.status === 'agendada');

    return {
      agendadasAtivas,
      alertasVencidos,
      pausaEncerrada: emitirResumoFimDePausa,
      notificacaoResumoId,
    };
  }

  /**
   * Verifica se o app possui permissão para emitir notificações no Android.
   * No Android 13+ (API 33), requer a permissão POST_NOTIFICATIONS.
   */
  static async checkPermission(): Promise<boolean> {
    try {
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
   * e respeito à pausa global de notificações (US39.7).
   */
  static async sendPreventiveAlert(
    params: PreventiveAlertNotificationParams,
    dataReferencia: Date = new Date(),
  ): Promise<NotificationSendResult> {
    const hasPerm = await this.checkPermission();
    if (!hasPerm) {
      return { sent: false, reason: 'permission_denied' };
    }

    if (suppressIndividualDispatches) {
      return { sent: false, reason: 'suppressed_for_summary' };
    }

    const emPausa = await PreferencesService.estaEmPausa(dataReferencia);
    if (emPausa) {
      return { sent: false, reason: 'notifications_paused' };
    }

    const cycleKey = `${params.ruleId}:${params.status}:${params.targetKey}`;

    if (notifiedCycleCache[cycleKey]) {
      return { sent: false, reason: 'already_notified_in_cycle' };
    }

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

    const channelId =
      params.channelId ||
      (params.status === 'vencido' ? 'manutencoes_urgentes' : 'manutencoes_preventivas');
    const importance = params.importance || (params.status === 'vencido' ? 'high' : 'default');
    const sound = params.sound ?? params.status === 'vencido';

    const res = this.emitirNotificacaoInterna(
      {
        title: params.title,
        body: params.body,
        channelId,
        importance,
        sound,
        data: params.data,
      },
      dataReferencia,
    );

    notifiedCycleCache[cycleKey] = dataReferencia.toISOString();
    try {
      await AsyncStorage.setItem(NOTIFIED_CYCLES_KEY, JSON.stringify(notifiedCycleCache));
    } catch {
      // Ignora
    }

    return res;
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

export const NotificacaoService = NotificationService;
