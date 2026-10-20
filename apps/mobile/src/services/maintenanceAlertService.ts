import {
  MaintenanceRule,
  CreateMaintenanceRuleDTO,
  UpdateMaintenanceRuleDTO,
  MaintenanceAlert,
  MaintenanceServiceType,
  Maintenance,
} from '@autogest/shared-types';
import { MaintenanceRuleRepository } from '../repositories/MaintenanceRuleRepository';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';
import { TireRecordRepository } from '../repositories/TireRecordRepository';
import { FluidRecordRepository } from '../repositories/FluidRecordRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { calcularMediaKmDia, calcularProximoVencimento } from './maintenanceCalculation';
import { NotificationService } from './notificationService';

export const SERVICE_TYPE_LABELS: Record<MaintenanceServiceType, string> = {
  troca_oleo: 'Troca de Óleo',
  calibragem_pneus: 'Calibragem de Pneus',
  fluido_freio: 'Fluido de Freio',
  agua_radiador: 'Água do Radiador',
  filtros: 'Filtros (Ar/Combustível/Cabine)',
  correia_dentada: 'Correia Dentada',
  velas: 'Velas de Ignição',
  pneus: 'Pneus e Rodízio',
  freios: 'Freios e Pastilhas',
  outros: 'Outros Serviços',
};

export const DEFAULT_MAINTENANCE_RULES: Array<{
  serviceType: MaintenanceServiceType;
  name: string;
  intervalKm: number;
  intervalDays: number;
  advanceKm: number;
  advanceDays: number;
}> = [
  {
    serviceType: 'troca_oleo',
    name: 'Troca de Óleo e Filtro',
    intervalKm: 10000,
    intervalDays: 180,
    advanceKm: 500,
    advanceDays: 15,
  },
  {
    serviceType: 'calibragem_pneus',
    name: 'Calibragem Periódica dos Pneus',
    intervalKm: 0,
    intervalDays: 15,
    advanceKm: 0,
    advanceDays: 3,
  },
  {
    serviceType: 'fluido_freio',
    name: 'Troca de Fluido de Freio',
    intervalKm: 20000,
    intervalDays: 365,
    advanceKm: 1000,
    advanceDays: 15,
  },
  {
    serviceType: 'agua_radiador',
    name: 'Troca de Água/Aditivo do Radiador',
    intervalKm: 30000,
    intervalDays: 365,
    advanceKm: 1000,
    advanceDays: 15,
  },
  {
    serviceType: 'filtros',
    name: 'Filtros (Ar, Combustível e Cabine)',
    intervalKm: 10000,
    intervalDays: 365,
    advanceKm: 500,
    advanceDays: 15,
  },
  {
    serviceType: 'freios',
    name: 'Revisão de Pastilhas e Fluido de Freio',
    intervalKm: 20000,
    intervalDays: 365,
    advanceKm: 1000,
    advanceDays: 20,
  },
  {
    serviceType: 'velas',
    name: 'Velas de Ignição',
    intervalKm: 30000,
    intervalDays: 730,
    advanceKm: 1000,
    advanceDays: 20,
  },
  {
    serviceType: 'pneus',
    name: 'Rodízio e Troca de Pneus',
    intervalKm: 10000,
    intervalDays: 180,
    advanceKm: 500,
    advanceDays: 15,
  },
  {
    serviceType: 'correia_dentada',
    name: 'Correia Dentada e Tensores',
    intervalKm: 50000,
    intervalDays: 1825,
    advanceKm: 2000,
    advanceDays: 30,
  },
];

export class MaintenanceAlertService {
  /**
   * US10.2: Inicializa regras padrão de manutenção caso o veículo ainda não possua regras cadastradas.
   */
  static async ensureDefaultRules(vehicleId: string): Promise<MaintenanceRule[]> {
    const existing = await MaintenanceRuleRepository.listByVehicle(vehicleId);
    if (existing.length > 0) {
      return existing;
    }

    const createdRules: MaintenanceRule[] = [];
    const vehicle = await VehicleRepository.findById(vehicleId);
    const initialKm = vehicle?.currentOdometer || vehicle?.initialOdometer || 0;

    for (const def of DEFAULT_MAINTENANCE_RULES) {
      const rule = await MaintenanceRuleRepository.create({
        vehicleId,
        serviceType: def.serviceType,
        name: def.name,
        intervalKm: def.intervalKm,
        intervalDays: def.intervalDays,
        advanceKm: def.advanceKm,
        advanceDays: def.advanceDays,
        lastServiceKm: initialKm,
        lastServiceDate: new Date().toISOString(),
        active: true,
      });
      createdRules.push(rule);

      await SyncQueueRepository.enqueue(
        'CREATE_MAINTENANCE_RULE',
        '/sync/regras_manutencao',
        rule,
      ).catch(() => {});
    }

    return createdRules;
  }

  /**
   * US10.6: Avalia todas as regras de manutenção ativas de um veículo e retorna lista de alertas.
   * Dispara notificações locais protegidas contra duplicidade (US10.5).
   */
  static async evaluateVehicleAlerts(
    vehicleId: string,
    dataReferencia?: Date | string,
    autoCreateDefaultRules: boolean = true,
  ): Promise<MaintenanceAlert[]> {
    const vehicle = await VehicleRepository.findById(vehicleId);
    if (!vehicle) return [];

    const kmAtual = vehicle.currentOdometer || vehicle.initialOdometer || 0;

    // Obtém histórico de odômetro para calcular projeção de km/dia (US10.4)
    const leituras = await OdometerRepository.listByVehicle(vehicleId);
    const mediaKmDia = calcularMediaKmDia(leituras, dataReferencia);

    // Obtém histórico de manutenções realizadas (US09) e registros de pneus/fluidos (US11.5)
    const [allMaintenances, allTireRecords, allFluidRecords] = await Promise.all([
      MaintenanceRepository.listByVehicle(vehicleId),
      TireRecordRepository.listByVehicle(vehicleId),
      FluidRecordRepository.listByVehicle(vehicleId),
    ]);

    // Obtém regras ativas
    let rules = await MaintenanceRuleRepository.listByVehicle(vehicleId, true);
    if (rules.length === 0 && autoCreateDefaultRules) {
      rules = await this.ensureDefaultRules(vehicleId);
    }

    const alerts: MaintenanceAlert[] = [];

    for (const rule of rules) {
      // Encontra a execução mais recente realizada deste tipo de serviço (US09 + US11.5)
      const candidates: Array<{ odometer: number; date: string }> = allMaintenances
        .filter(m => m.serviceType === rule.serviceType)
        .map(m => ({ odometer: m.odometer, date: m.date }));

      if (rule.serviceType === 'calibragem_pneus') {
        for (const t of allTireRecords) {
          if (t.type === 'calibragem') {
            candidates.push({ odometer: t.km, date: t.date });
          }
        }
      } else if (rule.serviceType === 'pneus') {
        for (const t of allTireRecords) {
          if (t.type === 'troca') {
            candidates.push({ odometer: t.km, date: t.date });
          }
        }
      } else if (rule.serviceType === 'troca_oleo') {
        for (const f of allFluidRecords) {
          if (f.fluidType === 'oleo_motor' && f.level !== 'baixo') {
            candidates.push({ odometer: f.km, date: f.date });
          }
        }
      } else if (rule.serviceType === 'fluido_freio') {
        for (const f of allFluidRecords) {
          if (f.fluidType === 'freio' && f.level !== 'baixo') {
            candidates.push({ odometer: f.km, date: f.date });
          }
        }
      } else if (rule.serviceType === 'agua_radiador') {
        for (const f of allFluidRecords) {
          if (f.fluidType === 'radiador' && f.level !== 'baixo') {
            candidates.push({ odometer: f.km, date: f.date });
          }
        }
      }

      candidates.sort((a, b) => {
        const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.odometer - a.odometer;
      });

      const ultimaManutencao: Maintenance | { odometer: number; date: string } | null =
        candidates[0] || null;

      // Executa cálculo puro (US10.3)
      const calculation = calcularProximoVencimento({
        regra: rule,
        ultimaManutencao,
        kmAtual,
        mediaKmDia,
        dataReferencia,
      });

      if (calculation.status === 'proximo' || calculation.status === 'vencido') {
        const serviceName = rule.name || SERVICE_TYPE_LABELS[rule.serviceType] || rule.serviceType;
        const targetKey = `${calculation.targetKm || ''}_${calculation.targetDate || ''}`;

        const alert: MaintenanceAlert = {
          id: `alert_${rule.id}`,
          ruleId: rule.id,
          vehicleId: rule.vehicleId,
          serviceType: rule.serviceType,
          serviceName,
          status: calculation.status,
          vencePorKm: calculation.vencePorKm,
          vencePorDias: calculation.vencePorDias,
          targetKm: calculation.targetKm,
          remainingKm: calculation.remainingKm,
          targetDate: calculation.targetDate,
          remainingDays: calculation.remainingDays,
          estimatedDateByKm: calculation.estimatedDateByKm,
          message: calculation.reason || `${serviceName}: revisão pendente.`,
        };

        alerts.push(alert);

        // US10.5: Dispara notificação com proteção contra repetição no mesmo ciclo
        const notificationTitle =
          calculation.status === 'vencido'
            ? `⚠️ Manutenção Vencida: ${serviceName}`
            : `🔔 Próxima Revisão: ${serviceName}`;

        await NotificationService.sendPreventiveAlert({
          ruleId: rule.id,
          title: notificationTitle,
          body: alert.message,
          status: calculation.status,
          targetKey,
          data: {
            vehicleId,
            ruleId: rule.id,
            serviceType: rule.serviceType,
          },
        }).catch(() => {});
      }
    }

    // Ordena: vencidos primeiro, depois próximos
    return alerts.sort((a, b) => {
      if (a.status === 'vencido' && b.status !== 'vencido') return -1;
      if (a.status !== 'vencido' && b.status === 'vencido') return 1;
      const daysA = a.remainingDays ?? 9999;
      const daysB = b.remainingDays ?? 9999;
      return daysA - daysB;
    });
  }

  /**
   * US10.5: Reavalia alertas para o veículo ativo ou todos os veículos
   */
  static async triggerBackgroundAlertCheck(vehicleId?: string): Promise<MaintenanceAlert[]> {
    if (vehicleId) {
      return this.evaluateVehicleAlerts(vehicleId);
    }
    const vehicles = await VehicleRepository.listAll();
    const allAlerts: MaintenanceAlert[] = [];
    for (const v of vehicles) {
      const vAlerts = await this.evaluateVehicleAlerts(v.id);
      allAlerts.push(...vAlerts);
    }
    return allAlerts;
  }

  private static periodicIntervalId: any = null;

  /**
   * US10.5: Inicia avaliação periódica em segundo plano no ciclo de vida do app
   */
  static startPeriodicEvaluation(intervalMs: number = 60 * 60 * 1000): void {
    if (this.periodicIntervalId) {
      clearInterval(this.periodicIntervalId);
    }
    this.periodicIntervalId = setInterval(() => {
      this.triggerBackgroundAlertCheck().catch(() => {});
    }, intervalMs);
  }

  /**
   * US10.5: Interrompe a avaliação periódica em segundo plano
   */
  static stopPeriodicEvaluation(): void {
    if (this.periodicIntervalId) {
      clearInterval(this.periodicIntervalId);
      this.periodicIntervalId = null;
    }
  }

  /**
   * Operações CRUD de Regras
   */
  static async createRule(dto: CreateMaintenanceRuleDTO): Promise<MaintenanceRule> {
    const rule = await MaintenanceRuleRepository.create(dto);
    await SyncQueueRepository.enqueue(
      'CREATE_MAINTENANCE_RULE',
      '/sync/regras_manutencao',
      rule,
    ).catch(() => {});

    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(dto.vehicleId).catch(() => {});

    return rule;
  }

  static async updateRule(
    id: string,
    updates: UpdateMaintenanceRuleDTO,
  ): Promise<MaintenanceRule | null> {
    const updated = await MaintenanceRuleRepository.update(id, updates);
    if (updated) {
      await SyncQueueRepository.enqueue(
        'UPDATE_MAINTENANCE_RULE',
        `/sync/regras_manutencao/${id}`,
        updated,
      ).catch(() => {});
      // Limpa ciclo para reavaliar com os novos parâmetros
      await NotificationService.clearNotificationCycleForRule(id);

      const { DashboardIndicatorsService } = await import('./dashboardIndicators');
      await DashboardIndicatorsService.refreshForVehicle(updated.vehicleId).catch(() => {});
    }
    return updated;
  }

  static async deleteRule(id: string): Promise<boolean> {
    const existing = await MaintenanceRuleRepository.findById(id);
    const success = await MaintenanceRuleRepository.delete(id);
    if (success) {
      await SyncQueueRepository.enqueue(
        'DELETE_MAINTENANCE_RULE',
        `/sync/regras_manutencao/${id}`,
        { id },
      ).catch(() => {});
      await NotificationService.clearNotificationCycleForRule(id);

      if (existing?.vehicleId) {
        const { DashboardIndicatorsService } = await import('./dashboardIndicators');
        await DashboardIndicatorsService.refreshForVehicle(existing.vehicleId).catch(() => {});
      }
    }
    return success;
  }

  static async listRulesByVehicle(vehicleId: string): Promise<MaintenanceRule[]> {
    let rules = await MaintenanceRuleRepository.listByVehicle(vehicleId);
    if (rules.length === 0) {
      rules = await this.ensureDefaultRules(vehicleId);
    }
    return rules;
  }
}
