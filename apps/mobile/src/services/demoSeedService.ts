import { db } from '../database/DatabaseConnection';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { FixedCostRepository } from '../repositories/FixedCostRepository';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';
import { MaintenanceRuleRepository } from '../repositories/MaintenanceRuleRepository';
import { TireRecordRepository } from '../repositories/TireRecordRepository';
import { FluidRecordRepository } from '../repositories/FluidRecordRepository';
import { TripRepository } from '../repositories/TripRepository';
import { BudgetRepository } from '../repositories/BudgetRepository';
import { EfficiencyGoalRepository } from '../repositories/EfficiencyGoalRepository';
import { MaintenanceScheduleRepository } from '../repositories/MaintenanceScheduleRepository';
import { FipeRepository } from '../repositories/FipeRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { TagRepository } from '../repositories/TagRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { NotificationService } from './notificationService';
import { PreferencesService } from './preferencesService';
import { TutorialService } from './tutorialService';
import { DashboardIndicatorsService } from './dashboardIndicators';
import {
  gerarDadosDemo,
  makeDemoId,
  DemoDataPackage,
} from './demoSeedGenerator';
import { useAppStore } from '../store/useAppStore';

export interface DemoSeedProgress {
  step: string;
  current: number;
  total: number;
}

export interface DemoSeedSummary {
  veiculos: number;
  abastecimentos: number;
  despesas: number;
  custosFixos: number;
  manutencoes: number;
  regrasManutencao: number;
  registrosPneu: number;
  registrosFluido: number;
  orcamentos: number;
  viagens: number;
  metasEficiencia: number;
  agendamentos: number;
  consultasFipe: number;
  etiquetas: number;
  auditorias: number;
}

export type DemoProgressListener = (progress: DemoSeedProgress) => void;

/**
 * US-EXTRA (ETAPA 41): Serviço orquestrador de Carga, Exclusão e Recarga
 * de Dados de Demonstração para as Entregas 1 e 2.
 *
 * Princípios do AGENTS.md e requisitos da tarefa:
 * - Determinístico (baseado no `gerarDadosDemo`)
 * - IDs determinísticos via UUID v5
 * - Modo silencioso (sem notificações locais e sem poluir status de alertas enviados)
 * - Usa repositórios e serviços reais
 * - Enfileira na outbox de sincronização para manter integridade com o backend
 * - Trilha de auditoria gerada coerentemente
 */
export class DemoSeedService {
  /**
   * Identifica se uma entidade pertence ao pacote de dados de demonstração
   */
  static isDemoId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    // UUID v5 com namespace do AutoGest Demo (padrão 8-4-4-4-12)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Executa em modo silencioso suspendendo notificações temporariamente
   */
  private static async executeSilently<T>(fn: () => Promise<T>): Promise<T> {
    const originalSilenced = NotificationService.isSilenced ? NotificationService.isSilenced() : false;
    if (NotificationService.setSilenced) {
      NotificationService.setSilenced(true);
    }
    try {
      return await fn();
    } finally {
      if (NotificationService.setSilenced) {
        NotificationService.setSilenced(originalSilenced);
      }
    }
  }

  /**
   * Carrega os dados de demonstração
   */
  static async carregarDadosDemo(
    agora: Date = new Date(),
    usuarioId: string = 'demo_user',
    onProgress?: DemoProgressListener,
  ): Promise<{ summary: DemoSeedSummary; packageData: DemoDataPackage }> {
    return this.executeSilently(async () => {
      const dataPkg = gerarDadosDemo(agora, usuarioId);

      const totalSteps = 15;
      let currentStep = 0;

      const notify = (stepName: string) => {
        currentStep++;
        if (onProgress) {
          onProgress({ step: stepName, current: currentStep, total: totalSteps });
        }
      };

      // 1. Veículos
      notify('Cadastrando veículos');
      for (const v of dataPkg.vehicles) {
        const existing = await VehicleRepository.findById(v.id);
        if (existing) {
          await VehicleRepository.update(v.id, {
            name: v.name,
            brand: v.brand,
            model: v.model,
            year: v.year,
            plate: v.plate,
            fuelType: v.fuelType as any,
            tankCapacityL: v.tankCapacityL,
            preferredFuel: v.preferredFuel as any,
          });
        } else {
          const vehicleRecord = {
            id: v.id,
            userId: v.userId,
            name: v.name,
            brand: v.brand,
            model: v.model,
            year: v.year,
            plate: v.plate,
            fuelType: v.fuelType as any,
            tankCapacityL: v.tankCapacityL,
            preferredFuel: v.preferredFuel as any,
            initialOdometer: v.initialOdometer,
            currentOdometer: v.currentOdometer,
            fipeValue: null,
            createdAt: dataPkg.generatedAt,
            updatedAt: dataPkg.generatedAt,
            deletedAt: null,
          };
          await db.insert('local_vehicles', vehicleRecord);
          await AuditRepository.recordMutation({
            usuario_id: v.userId,
            entidade: 'veiculos',
            entidade_id: v.id,
            acao: 'criacao',
            antes: null,
            depois: vehicleRecord,
          });
          await SyncQueueRepository.enqueue('CREATE_VEHICLE', '/api/v1/vehicles', vehicleRecord);
        }
      }

      // Atualiza Zustand com os veículos inseridos
      const store = useAppStore.getState();
      const allVehicles = await VehicleRepository.listAll();
      store.setVehicles(allVehicles);
      if (allVehicles.length > 0 && !store.selectedVehicle) {
        store.setSelectedVehicle(allVehicles[0]);
      }

      // 2. Viagem (Criar viagem antes dos abastecimentos/despesas para que possam referenciá-la)
      notify('Configurando Modo Viagem');
      const trip = dataPkg.trip;
      const existingTrip = await TripRepository.findById(trip.id);
      if (!existingTrip) {
        const tripRecord = {
          id: trip.id,
          vehicleId: trip.vehicleId,
          veiculo_id: trip.vehicleId,
          origin: trip.origin,
          origem: trip.origin,
          destination: trip.destination,
          destino: trip.destination,
          startDate: trip.startDate,
          inicio_em: trip.startDate,
          endDate: trip.endDate,
          fim_em: trip.endDate,
          startOdometer: trip.startOdometer,
          km_inicio: trip.startOdometer,
          endOdometer: trip.endOdometer,
          km_fim: trip.endOdometer,
          status: trip.status,
          createdAt: trip.startDate,
          criado_em: trip.startDate,
          updatedAt: trip.endDate,
          atualizado_em: trip.endDate,
          deletedAt: null,
          excluido_em: null,
        };
        await db.insert('viagens', tripRecord);
        await SyncQueueRepository.enqueue('CREATE_FIXED_COST' as any, '/sync/viagens', tripRecord);
      }

      // 3. Etiquetas (Tags)
      notify('Criando etiquetas');
      const tagMap = new Map<string, string>(); // nome -> id
      const uniqueTagNames = Array.from(new Set(dataPkg.refuels.flatMap(r => r.tags)));
      for (const tagName of uniqueTagNames) {
        let tag = await TagRepository.findByName(tagName);
        if (!tag) {
          tag = await TagRepository.create({ name: tagName, userId: usuarioId });
        }
        tagMap.set(tagName, tag.id);
      }

      // 4. Abastecimentos
      notify('Carregando histórico de abastecimentos');
      for (const r of dataPkg.refuels) {
        const existing = await RefuelRepository.findById(r.id);
        if (!existing) {
          const newRefuel = {
            id: r.id,
            vehicleId: r.vehicleId,
            date: r.date,
            odometer: r.odometer,
            fuelType: r.fuelType,
            pricePerLiter: r.pricePerLiter,
            totalValue: r.totalValue,
            liters: r.liters,
            isFullTank: r.isFullTank,
            calculatedKml: null,
            receiptImageUrl: null,
            stationName: r.stationName,
            latitude: null,
            longitude: null,
            routeType: r.routeType,
            notes: r.notes,
            tipo_percurso: r.routeType,
            nota: r.notes,
            tripId: r.tripId || null,
            viagem_id: r.tripId || null,
            createdAt: r.date,
            updatedAt: r.date,
            deletedAt: null,
          };
          await db.insert('local_refuels', newRefuel);

          // Registra leitura de hodômetro
          await OdometerRepository.create({
            vehicleId: r.vehicleId,
            km: r.odometer,
            date: r.date,
            origin: 'abastecimento',
          });

          // Vincula etiquetas
          const tagIdsToLink = r.tags.map(t => tagMap.get(t)).filter((t): t is string => !!t);
          if (tagIdsToLink.length > 0) {
            await TagRepository.setRecordTags('abastecimento', r.id, tagIdsToLink);
          }

          await SyncQueueRepository.enqueue('CREATE_REFUEL', '/api/v1/refuels', newRefuel);
        }
      }

      // Recalcula cadeia de abastecimentos do Veículo A e B para obter consumos determinísticos reais
      await RefuelRepository.recalculateAllForVehicle(dataPkg.vehicles[0].id);
      await RefuelRepository.recalculateAllForVehicle(dataPkg.vehicles[1].id);

      // Atualiza hodômetro final dos veículos
      await VehicleRepository.updateOdometer(dataPkg.vehicles[0].id, dataPkg.vehicles[0].currentOdometer);
      await VehicleRepository.updateOdometer(dataPkg.vehicles[1].id, dataPkg.vehicles[1].currentOdometer);

      // 5. Custos Fixos
      notify('Cadastrando custos fixos');
      for (const fc of dataPkg.fixedCosts) {
        const existing = await FixedCostRepository.findById(fc.id);
        if (!existing) {
          const fcRecord = {
            id: fc.id,
            vehicleId: fc.vehicleId,
            description: fc.description,
            monthlyAmount: fc.monthlyAmount,
            createdAt: dataPkg.generatedAt,
            updatedAt: dataPkg.generatedAt,
            deletedAt: null,
          };
          await db.insert('local_custos_fixos', fcRecord);
          await SyncQueueRepository.enqueue('CREATE_FIXED_COST', '/api/v1/sync/custos_fixos', fcRecord);
        }
      }

      // 6. Despesas
      notify('Lançando despesas categorizadas');
      for (const exp of dataPkg.expenses) {
        const existing = await ExpenseRepository.findById(exp.id);
        if (!existing) {
          const expRecord = {
            id: exp.id,
            vehicleId: exp.vehicleId,
            category: exp.category,
            amount: exp.amount, // centavos
            date: exp.date,
            description: exp.description,
            tripId: exp.tripId || null,
            viagem_id: exp.tripId || null,
            subtipoViagem: exp.subtipoViagem || null,
            subtipo_viagem: exp.subtipoViagem || null,
            createdAt: exp.date,
            updatedAt: exp.date,
            deletedAt: null,
          };
          await db.insert('local_despesas', expRecord);
          await SyncQueueRepository.enqueue('CREATE_EXPENSE', '/api/v1/sync/despesas', expRecord);
        }
      }

      // 7. Manutenções
      notify('Registrando manutenções preventivas e corretivas');
      for (const m of dataPkg.maintenances) {
        const existing = await MaintenanceRepository.findById(m.id);
        if (!existing) {
          const maintRecord = {
            id: m.id,
            vehicleId: m.vehicleId,
            date: m.date,
            odometer: m.odometer,
            type: m.type,
            serviceType: m.serviceType,
            description: m.description,
            replacedParts: null,
            workshop: m.workshop,
            mechanic: null,
            executionTimeMin: null,
            totalValue: m.totalValue,
            notes: m.notes || null,
            nota: m.notes || null,
            createdAt: m.date,
            updatedAt: m.date,
            deletedAt: null,
          };
          await db.insert('manutencoes', maintRecord);
          try {
            await db.insert('local_manutencoes', maintRecord);
          } catch {
            //
          }
          await OdometerRepository.create({
            vehicleId: m.vehicleId,
            km: m.odometer,
            date: m.date,
            origin: 'manutencao',
          });
          await SyncQueueRepository.enqueue('CREATE_MAINTENANCE', '/api/v1/maintenances', maintRecord);
        }
      }

      // 8. Regras de Manutenção
      notify('Configurando regras preventivas');
      for (const rule of dataPkg.maintenanceRules) {
        const existing = await MaintenanceRuleRepository.findById(rule.id);
        if (!existing) {
          const ruleRecord = {
            id: rule.id,
            vehicleId: rule.vehicleId,
            userId: usuarioId,
            serviceType: rule.serviceType,
            name: rule.name,
            intervalKm: rule.intervalKm,
            intervalDays: rule.intervalDays,
            advanceKm: rule.advanceKm,
            advanceDays: rule.advanceDays,
            lastServiceDate: rule.lastServiceDate,
            lastServiceKm: rule.lastServiceKm,
            active: true,
            createdAt: dataPkg.generatedAt,
            updatedAt: dataPkg.generatedAt,
            deletedAt: null,
          };
          await db.insert('regras_manutencao', ruleRecord);
          try {
            await db.insert('local_regras_manutencao', ruleRecord);
          } catch {
            //
          }
          await SyncQueueRepository.enqueue(
            'CREATE_MAINTENANCE_RULE',
            '/api/v1/maintenance-rules',
            ruleRecord,
          );
        }
      }

      // 9. Registros de Pneu e Fluido
      notify('Lançando registros de pneus e fluidos');
      for (const t of dataPkg.tireRecords) {
        const existing = await TireRecordRepository.findById(t.id);
        if (!existing) {
          const tRecord = {
            id: t.id,
            vehicleId: t.vehicleId,
            date: t.date,
            km: t.km,
            type: t.type,
            pressurePsi: t.pressurePsi,
            treadDepthMm: t.treadDepthMm,
            createdAt: t.date,
            updatedAt: t.date,
            deletedAt: null,
          };
          await db.insert('registros_pneu', tRecord);
          await SyncQueueRepository.enqueue('CREATE_TIRE_RECORD', '/api/v1/sync/registros_pneu', tRecord);
        }
      }

      for (const f of dataPkg.fluidRecords) {
        const existing = await FluidRecordRepository.findById(f.id);
        if (!existing) {
          const fRecord = {
            id: f.id,
            vehicleId: f.vehicleId,
            fluidType: f.fluidType,
            date: f.date,
            km: f.km,
            level: f.level,
            createdAt: f.date,
            updatedAt: f.date,
            deletedAt: null,
          };
          await db.insert('registros_fluido', fRecord);
          await SyncQueueRepository.enqueue(
            'CREATE_FLUID_RECORD',
            '/api/v1/sync/registros_fluido',
            fRecord,
          );
        }
      }

      // 10. Orçamento (em modo silencioso)
      notify('Definindo orçamento mensal');
      for (const b of dataPkg.budgets) {
        const existing = await BudgetRepository.findByVehicle(b.vehicleId);
        if (!existing) {
          const bRecord = {
            id: b.id,
            vehicleId: b.vehicleId,
            veiculo_id: b.vehicleId,
            teto_mensal: b.tetoMensalCentavos,
            monthlyLimitCents: b.tetoMensalCentavos,
            percentual_aviso: b.percentualAviso,
            warningPercentage: b.percentualAviso,
            aviso_enviado_mes: null,
            warningSentMonth: null,
            critico_enviado_mes: null,
            criticalSentMonth: null,
            createdAt: dataPkg.generatedAt,
            updatedAt: dataPkg.generatedAt,
            deletedAt: null,
            excluido_em: null,
          };
          await db.insert('orcamentos', bRecord);
          await SyncQueueRepository.enqueue('CREATE_BUDGET', '/api/v1/sync/orcamentos', bRecord);
        }
      }

      // 11. Metas de Eficiência
      notify('Configurando metas de eficiência');
      for (const eg of dataPkg.efficiencyGoals) {
        await EfficiencyGoalRepository.setGoal(eg.vehicleId, eg.targetKml);
      }

      // 12. Agendamentos de Manutenção
      notify('Inserindo agendamento futuro');
      for (const sch of dataPkg.maintenanceSchedules) {
        const existing = await MaintenanceScheduleRepository.findById(sch.id);
        if (!existing) {
          const schRecord = {
            id: sch.id,
            veiculo_id: sch.vehicleId,
            vehicleId: sch.vehicleId,
            data: sch.date,
            date: sch.date,
            hora_lembrete: sch.reminderTime,
            reminderTime: sch.reminderTime,
            tipo_servico: sch.serviceType,
            serviceType: sch.serviceType,
            descricao: sch.description,
            description: sch.description,
            status: sch.status,
            criado_em: dataPkg.generatedAt,
            createdAt: dataPkg.generatedAt,
            atualizado_em: dataPkg.generatedAt,
            updatedAt: dataPkg.generatedAt,
            deletedAt: null,
            excluido_em: null,
          };
          await db.insert('agendamentos_manutencao', schRecord);
        }
      }

      // 13. Consultas FIPE
      notify('Histórico de valor FIPE');
      for (const fp of dataPkg.fipeConsultations) {
        const existing = await FipeRepository.findByVehicleAndMonth(fp.vehicleId, fp.referenceMonth);
        if (!existing) {
          const fpRecord = {
            id: fp.id,
            veiculo_id: fp.vehicleId,
            vehicleId: fp.vehicleId,
            codigo_fipe: fp.fipeCode,
            fipeCode: fp.fipeCode,
            marca: fp.brand,
            brand: fp.brand,
            modelo: fp.model,
            model: fp.model,
            ano_modelo: fp.modelYear,
            modelYear: fp.modelYear,
            combustivel: fp.fuel,
            fuel: fp.fuel,
            mes_referencia: fp.referenceMonth,
            referenceMonth: fp.referenceMonth,
            valor_centavos: fp.valueCentavos,
            valueCentavos: fp.valueCentavos,
            consultado_em: fp.consultedAt,
            consultedAt: fp.consultedAt,
            criado_em: fp.consultedAt,
            createdAt: fp.consultedAt,
            atualizado_em: fp.consultedAt,
            updatedAt: fp.consultedAt,
            deletedAt: null,
            excluido_em: null,
          };
          await db.insert('consultas_fipe', fpRecord);
        }
      }

      // 14. Preferências e Tutorial
      notify('Ajustando preferências');
      await PreferencesService.definirUnidadeConsumoPrincipal('km/l');
      await TutorialService.completeTour();

      // 15. Auditoria de demonstração: 2 edições e 1 exclusão nas despesas do Veículo B
      notify('Registrando trilha de auditoria');
      let auditCount = 0;
      const despesaB1Id = makeDemoId('despesa_b', 1);
      const despesaB1 = await ExpenseRepository.findById(despesaB1Id);
      if (despesaB1) {
        const antes = { ...despesaB1 };
        const depois = { ...despesaB1, amount: 65.0, description: 'Ducha e cera líquida Gol' };
        await ExpenseRepository.update(despesaB1.id, { amount: 65.0, description: 'Ducha e cera líquida Gol' });
        await AuditRepository.recordMutation({
          usuario_id: usuarioId,
          entidade: 'despesas',
          entidade_id: despesaB1.id,
          acao: 'edicao',
          antes,
          depois,
        });
        auditCount++;
      }

      const despesaB2Id = makeDemoId('despesa_b', 2);
      const despesaB2 = await ExpenseRepository.findById(despesaB2Id);
      if (despesaB2) {
        const antes = { ...despesaB2 };
        const depois = { ...despesaB2, amount: 50.0, description: 'Palhetas de silicone Gol' };
        await ExpenseRepository.update(despesaB2.id, { amount: 50.0, description: 'Palhetas de silicone Gol' });
        await AuditRepository.recordMutation({
          usuario_id: usuarioId,
          entidade: 'despesas',
          entidade_id: despesaB2.id,
          acao: 'edicao',
          antes,
          depois,
        });
        auditCount++;
      }

      const despesaB3Id = makeDemoId('despesa_b', 3);
      const despesaB3 = await ExpenseRepository.findById(despesaB3Id);
      if (despesaB3) {
        const antes = { ...despesaB3 };
        await ExpenseRepository.delete(despesaB3.id);
        await AuditRepository.recordMutation({
          usuario_id: usuarioId,
          entidade: 'despesas',
          entidade_id: despesaB3.id,
          acao: 'exclusao',
          antes,
          depois: null,
        });
        auditCount++;
      }

      // Atualiza indicadores do Dashboard para os 2 veículos
      await DashboardIndicatorsService.refreshForVehicle(dataPkg.vehicles[0].id).catch(() => {});
      await DashboardIndicatorsService.refreshForVehicle(dataPkg.vehicles[1].id).catch(() => {});

      // US-EXTRA (ETAPA 41): Modo silencioso estrito - limpa aviso_enviado_mes / critico_enviado_mes
      // para não queimar o envio de notificações quando o usuário interagir na demo ao vivo
      for (const b of dataPkg.budgets) {
        const bg = await BudgetRepository.findByVehicle(b.vehicleId);
        if (bg) {
          await BudgetRepository.update(bg.id, {
            avisoEnviadoMes: null,
            criticoEnviadoMes: null,
          });
        }
      }

      const summary: DemoSeedSummary = {
        veiculos: dataPkg.vehicles.length,
        abastecimentos: dataPkg.refuels.length,
        despesas: dataPkg.expenses.length,
        custosFixos: dataPkg.fixedCosts.length,
        manutencoes: dataPkg.maintenances.length,
        regrasManutencao: dataPkg.maintenanceRules.length,
        registrosPneu: dataPkg.tireRecords.length,
        registrosFluido: dataPkg.fluidRecords.length,
        orcamentos: dataPkg.budgets.length,
        viagens: 1,
        metasEficiencia: dataPkg.efficiencyGoals.length,
        agendamentos: dataPkg.maintenanceSchedules.length,
        consultasFipe: dataPkg.fipeConsultations.length,
        etiquetas: uniqueTagNames.length,
        auditorias: auditCount,
      };

      return { summary, packageData: dataPkg };
    });
  }

  /**
   * Remove APENAS os dados de demonstração (exclusão lógica determinística por IDs demo).
   * Não afeta dados manuais reais do usuário.
   */
  static async removerDadosDemo(onProgress?: DemoProgressListener): Promise<{ deletedCounts: Record<string, number> }> {
    return this.executeSilently(async () => {
      const deletedCounts: Record<string, number> = {};
      const tablesToCheck = [
        { name: 'local_vehicles', repo: VehicleRepository, entity: 'veiculos', syncEndpoint: '/api/v1/vehicles' },
        { name: 'local_refuels', repo: RefuelRepository, entity: 'abastecimentos', syncEndpoint: '/api/v1/refuels' },
        { name: 'local_despesas', repo: ExpenseRepository, entity: 'despesas', syncEndpoint: '/api/v1/sync/despesas' },
        { name: 'local_custos_fixos', repo: FixedCostRepository, entity: 'custos_fixos', syncEndpoint: '/api/v1/sync/custos_fixos' },
        { name: 'manutencoes', repo: MaintenanceRepository, entity: 'manutencoes', syncEndpoint: '/api/v1/maintenances' },
        { name: 'regras_manutencao', repo: MaintenanceRuleRepository, entity: 'regras_manutencao', syncEndpoint: '/api/v1/maintenance-rules' },
        { name: 'registros_pneu', repo: TireRecordRepository, entity: 'registros_pneu', syncEndpoint: '/api/v1/sync/registros_pneu' },
        { name: 'registros_fluido', repo: FluidRecordRepository, entity: 'registros_fluido', syncEndpoint: '/api/v1/sync/registros_fluido' },
        { name: 'orcamentos', repo: BudgetRepository, entity: 'orcamentos', syncEndpoint: '/api/v1/sync/orcamentos' },
        { name: 'viagens', repo: TripRepository, entity: 'viagens', syncEndpoint: '/sync/viagens' },
        { name: 'agendamentos_manutencao', repo: MaintenanceScheduleRepository, entity: 'agendamentos_manutencao', syncEndpoint: '/sync/agendamentos_manutencao' },
        { name: 'consultas_fipe', repo: FipeRepository, entity: 'consultas_fipe', syncEndpoint: '/sync/consultas_fipe' },
      ];

      const now = new Date().toISOString();
      let stepIndex = 0;

      for (const t of tablesToCheck) {
        stepIndex++;
        if (onProgress) {
          onProgress({ step: `Removendo ${t.entity}`, current: stepIndex, total: tablesToCheck.length });
        }

        const rows = await db.getTableData<any>(t.name);
        const demoRows = rows.filter(r => this.isDemoId(r.id));
        let count = 0;

        for (const row of demoRows) {
          // Se tiver método delete do repositório, use-o; senão marca deletedAt
          if (t.repo && typeof (t.repo as any).delete === 'function') {
            await (t.repo as any).delete(row.id);
          } else {
            row.deletedAt = now;
            row.excluido_em = now;
            row.updatedAt = now;
            await db.update(t.name, row.id, row);
          }

          // Enfileira exclusão lógica na fila de sincronização
          await SyncQueueRepository.enqueue(
            'DELETE_VEHICLE' as any,
            `${t.syncEndpoint}/${row.id}`,
            { id: row.id, deletedAt: now, excluido_em: now },
          );
          count++;
        }
        deletedCounts[t.entity] = count;
      }

      // Remove leituras de odômetro vinculadas a veículos de demo
      const odometers = await db.getTableData<any>('leituras_hodometro');
      const filteredOdometers = odometers.filter(o => !this.isDemoId(o.vehicleId || o.veiculo_id));
      await db.saveTableData('leituras_hodometro', filteredOdometers);

      // Atualiza estado do Zustand
      const remainingVehicles = await VehicleRepository.listAll();
      const store = useAppStore.getState();
      store.setVehicles(remainingVehicles);
      if (remainingVehicles.length > 0) {
        store.setSelectedVehicle(remainingVehicles[0]);
      } else {
        store.setSelectedVehicle(null);
      }

      return { deletedCounts };
    });
  }

  /**
   * Recarrega os dados de demonstração: remove os antigos e carrega novos com datas atualizadas
   */
  static async recarregarDadosDemo(
    agora: Date = new Date(),
    usuarioId: string = 'demo_user',
    onProgress?: DemoProgressListener,
  ): Promise<{ summary: DemoSeedSummary; packageData: DemoDataPackage }> {
    await this.removerDadosDemo(progress => {
      if (onProgress) {
        onProgress({ step: `[1/2] Limpando: ${progress.step}`, current: progress.current, total: progress.total * 2 });
      }
    });

    return await this.carregarDadosDemo(agora, usuarioId, progress => {
      if (onProgress) {
        onProgress({ step: `[2/2] Inserindo: ${progress.step}`, current: progress.total + progress.current, total: progress.total * 2 });
      }
    });
  }
}
