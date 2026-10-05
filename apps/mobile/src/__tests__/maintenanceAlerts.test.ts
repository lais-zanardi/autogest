// Polyfill para AsyncStorage em ambiente Node.js / testes
if (typeof (global as any).window === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  };
}

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MaintenanceRule, Maintenance } from '@autogest/shared-types';
import { calcularMediaKmDia, calcularProximoVencimento } from '../services/maintenanceCalculation';
import { NotificationService } from '../services/notificationService';
import { MaintenanceAlertService } from '../services/maintenanceAlertService';
import { db } from '../database/DatabaseConnection';
import { MaintenanceRuleRepository } from '../repositories/MaintenanceRuleRepository';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import '../database/migrations/006_create_local_regras_manutencao';
import { localMigrator } from '../database/migrations/localMigrator';

describe('US10 — Alertas Preventivos de Tempo e Km', () => {
  beforeEach(async () => {
    await db.saveTableData('regras_manutencao', []);
    await db.saveTableData('local_regras_manutencao', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('local_manutencoes', []);
    await db.saveTableData('veiculos', []);
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('local_odometer_readings', []);
    await db.saveTableData('fila_sync', []);
    await localMigrator.runMigrations();
    NotificationService.resetMock();
  });

  describe('US10.4: Cálculo de Média de Km/Dia (Reaproveitável para US24)', () => {
    it('(BDD Backlog): Dado 900 km rodados em 30 dias, deve calcular exatamente média de 30 km/dia', () => {
      const leituras = [
        { km: 10000, date: '2026-05-01T10:00:00.000Z' },
        { km: 10900, date: '2026-05-31T10:00:00.000Z' }, // 30 dias depois, delta = 900 km
      ];

      const media = calcularMediaKmDia(leituras);
      assert.strictEqual(media, 30);
    });

    it('deve retornar 0 quando houver menos de 2 leituras ou dias insuficientes', () => {
      assert.strictEqual(calcularMediaKmDia([]), 0);
      assert.strictEqual(calcularMediaKmDia([{ km: 10000, date: '2026-05-01' }]), 0);
      assert.strictEqual(
        calcularMediaKmDia([
          { km: 10000, date: '2026-05-01T10:00:00.000Z' },
          { km: 10000, date: '2026-05-01T10:00:00.000Z' },
        ]),
        0,
      );
    });

    it('deve ordenar leituras cronologicamente e calcular a média ponderada do período', () => {
      const leiturasDesordenadas = [
        { km: 11500, date: '2026-06-15T12:00:00.000Z' }, // delta 1500 km em 45 dias = 33.33 km/dia
        { km: 10000, date: '2026-05-01T12:00:00.000Z' },
        { km: 10700, date: '2026-05-20T12:00:00.000Z' },
      ];

      const media = calcularMediaKmDia(leiturasDesordenadas);
      assert.strictEqual(media, 33.33);
    });
  });

  describe('US10.3: Função Pura calcularProximoVencimento', () => {
    const regraPadraoOleo: MaintenanceRule = {
      id: 'regra-oleo-1',
      vehicleId: 'veiculo-1',
      serviceType: 'troca_oleo',
      name: 'Troca de Óleo',
      intervalKm: 10000,
      intervalDays: 180,
      advanceKm: 500,
      advanceDays: 15,
      active: true,
      lastServiceKm: 40000,
      lastServiceDate: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    it('US10.7: Antes da antecedência deve retornar status "ok" e não disparar alerta', () => {
      // 40.000 + 10.000 = 50.000 alvo. Km atual 49.200 -> faltam 800 km (> 500 km antecedência)
      // Data alvo: 01/01 + 180 dias = 30/06. Data ref 01/05 -> faltam 60 dias (> 15 dias antecedência)
      const res = calcularProximoVencimento({
        regra: regraPadraoOleo,
        ultimaManutencao: null,
        kmAtual: 49200,
        mediaKmDia: 25,
        dataReferencia: '2026-05-01T00:00:00.000Z',
      });

      assert.strictEqual(res.status, 'ok');
      assert.strictEqual(res.vencePorKm, false);
      assert.strictEqual(res.vencePorDias, false);
      assert.strictEqual(res.remainingKm, 800);
      assert.ok(res.remainingDays && res.remainingDays > 15);
    });

    it('US10.7: Vence por km: dentro da antecedência (ex: restam 350 km <= 500 km) deve retornar status "proximo"', () => {
      const res = calcularProximoVencimento({
        regra: regraPadraoOleo,
        ultimaManutencao: null,
        kmAtual: 49650, // faltam 350 km <= 500 km de antecedência
        mediaKmDia: 25,
        dataReferencia: '2026-05-01T00:00:00.000Z',
      });

      assert.strictEqual(res.status, 'proximo');
      assert.strictEqual(res.vencePorKm, true);
      assert.strictEqual(res.vencePorDias, false);
      assert.strictEqual(res.remainingKm, 350);
      assert.ok(res.reason?.includes('350 km'));
    });

    it('US10.7: Vence por dias: dentro da antecedência (ex: restam 10 dias <= 15 dias) deve retornar status "proximo"', () => {
      // Data alvo de 180 dias de 01/01/2026 = 30/06/2026.
      // Data ref: 20/06/2026 -> restam 10 dias <= 15 dias
      const res = calcularProximoVencimento({
        regra: regraPadraoOleo,
        ultimaManutencao: null,
        kmAtual: 45000, // longe do km alvo
        mediaKmDia: 20,
        dataReferencia: '2026-06-20T00:00:00.000Z',
      });

      assert.strictEqual(res.status, 'proximo');
      assert.strictEqual(res.vencePorDias, true);
      assert.ok(res.remainingDays && res.remainingDays <= 15 && res.remainingDays >= 0);
      assert.ok(res.reason?.includes('dias'));
    });

    it('US10.7: Vencido por km ou dias quando ultrapassar o alvo', () => {
      const resKmUltrapassado = calcularProximoVencimento({
        regra: regraPadraoOleo,
        ultimaManutencao: null,
        kmAtual: 50150, // 150 km além do alvo de 50.000 km
        mediaKmDia: 25,
        dataReferencia: '2026-05-01T00:00:00.000Z',
      });

      assert.strictEqual(resKmUltrapassado.status, 'vencido');
      assert.strictEqual(resKmUltrapassado.vencePorKm, true);
      assert.strictEqual(resKmUltrapassado.remainingKm, -150);

      const resDiasUltrapassados = calcularProximoVencimento({
        regra: regraPadraoOleo,
        ultimaManutencao: null,
        kmAtual: 45000,
        mediaKmDia: 25,
        dataReferencia: '2026-07-05T00:00:00.000Z', // 5 dias após o vencimento em 30/06
      });

      assert.strictEqual(resDiasUltrapassados.status, 'vencido');
      assert.strictEqual(resDiasUltrapassados.vencePorDias, true);
      assert.ok(resDiasUltrapassados.remainingDays && resDiasUltrapassados.remainingDays < 0);
    });

    it('US10.7: Após nova manutenção cadastrada, a regra reinicia com a nova manutenção como base', () => {
      // Situação inicial: estava vencida aos 50.150 km
      const manutencaoRealizada: Maintenance = {
        id: 'maint-oleo-nova',
        vehicleId: 'veiculo-1',
        date: '2026-07-06T10:00:00.000Z',
        odometer: 50200,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo e filtro 5W30',
        totalValue: 350,
        createdAt: '2026-07-06T10:00:00.000Z',
      };

      // Novo cálculo com a manutenção realizada fornecida como ultimaManutencao
      const res = calcularProximoVencimento({
        regra: regraPadraoOleo,
        ultimaManutencao: manutencaoRealizada,
        kmAtual: 50200, // mesmo km da manutenção
        mediaKmDia: 30,
        dataReferencia: '2026-07-06T10:00:00.000Z',
      });

      // A regra deve ter reiniciado! Nova base = 50.200 km, novo alvo = 60.200 km. Restam 10.000 km.
      assert.strictEqual(res.status, 'ok');
      assert.strictEqual(res.baseKm, 50200);
      assert.strictEqual(res.targetKm, 60200);
      assert.strictEqual(res.remainingKm, 10000);
      assert.strictEqual(res.vencePorKm, false);
      assert.strictEqual(res.vencePorDias, false);
    });
  });

  describe('US10.5: Permissões de Notificação e Proteção Contra Notificação Duplicada', () => {
    it('deve simular suporte à permissão de notificação Android 13+ (POST_NOTIFICATIONS)', async () => {
      NotificationService.setMockPermissionGranted(false);
      assert.strictEqual(await NotificationService.checkPermission(), false);

      const requestResult = await NotificationService.requestPermission();
      assert.strictEqual(requestResult, true); // padrão concede ao solicitar
      assert.strictEqual(await NotificationService.checkPermission(), true);
    });

    it('deve disparar notificação local quando permitido e bloquear disparo duplicado no mesmo ciclo', async () => {
      NotificationService.setMockPermissionGranted(true);

      const notificationPayload = {
        ruleId: 'regra-oleo-1',
        title: 'Revisão Próxima: Troca de Óleo',
        body: 'Faltam 350 km para a próxima troca de óleo.',
        status: 'proximo' as const,
        targetKey: '50000',
      };

      // Primeiro envio do ciclo: deve enviar com sucesso
      const firstResult = await NotificationService.sendPreventiveAlert(notificationPayload);
      assert.strictEqual(firstResult.sent, true);
      assert.strictEqual(NotificationService.getDeliveredNotifications().length, 1);

      // Segundo envio com o mesmo status e targetKey no mesmo ciclo: protegido contra duplicidade!
      const duplicateResult = await NotificationService.sendPreventiveAlert(notificationPayload);
      assert.strictEqual(duplicateResult.sent, false);
      assert.strictEqual(duplicateResult.reason, 'already_notified_in_cycle');
      assert.strictEqual(NotificationService.getDeliveredNotifications().length, 1);

      // Transição para vencido: novo ciclo de alerta -> deve permitir novo disparo!
      const vencidoPayload = {
        ...notificationPayload,
        status: 'vencido' as const,
        body: 'A troca de óleo está vencida!',
      };
      const vencidoResult = await NotificationService.sendPreventiveAlert(vencidoPayload);
      assert.strictEqual(vencidoResult.sent, true);
      assert.strictEqual(NotificationService.getDeliveredNotifications().length, 2);

      const delivered = NotificationService.getDeliveredNotifications();
      assert.strictEqual(delivered[0].channelId, 'manutencoes_preventivas');
      assert.strictEqual(delivered[0].importance, 'default');
      assert.strictEqual(delivered[0].sound, false);
      assert.strictEqual(delivered[1].channelId, 'manutencoes_urgentes');
      assert.strictEqual(delivered[1].importance, 'high');
      assert.strictEqual(delivered[1].sound, true);
    });

    it('deve gerenciar início e parada da avaliação periódica em segundo plano', () => {
      MaintenanceAlertService.startPeriodicEvaluation(10000);
      MaintenanceAlertService.stopPeriodicEvaluation();
      assert.ok(true);
    });
  });

  describe('US10.1 & US10.2 & US10.6: Gestão de Regras e Alertas Ativos por Veículo', () => {
    it('deve criar regras padrão para o veículo e listar alertas ativos no painel', async () => {
      // 1. Cadastra veículo de teste
      const vehicle = await VehicleRepository.create(
        {
          brand: 'Honda',
          model: 'Civic G10',
          name: 'Civic',
          year: 2021,
          plate: 'BRA2E19',
          tankCapacityL: 56,
          preferredFuel: 'Gasolina',
          initialOdometer: 49700,
        },
        'user-teste-1',
      );
      await VehicleRepository.updateOdometer(vehicle.id, 49700);

      // 2. Cria regra preventiva para o veículo
      const rule = await MaintenanceRuleRepository.create({
        vehicleId: vehicle.id,
        serviceType: 'troca_oleo',
        name: 'Troca de Óleo e Filtro',
        intervalKm: 10000,
        intervalDays: 180,
        advanceKm: 500,
        advanceDays: 15,
        lastServiceKm: 40000,
        lastServiceDate: '2026-01-10T00:00:00.000Z',
        active: true,
      });

      assert.ok(rule.id);
      assert.strictEqual(rule.advanceKm, 500);

      // 3. Avalia os alertas do veículo (US10.6)
      // Km atual 49.700 -> alvo 50.000 -> faltam 300 km <= 500 km antecedência
      const dataRef = '2026-05-10T00:00:00.000Z';
      const alerts = await MaintenanceAlertService.evaluateVehicleAlerts(vehicle.id, dataRef);
      assert.strictEqual(alerts.length, 1);
      assert.strictEqual(alerts[0].serviceType, 'troca_oleo');
      assert.strictEqual(alerts[0].status, 'proximo');
      assert.strictEqual(alerts[0].remainingKm, 300);

      // 4. Cadastra a manutenção correspondente (US09.3 / US10.7)
      await MaintenanceRepository.create({
        vehicleId: vehicle.id,
        date: dataRef,
        odometer: 49750,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo realizada na concessionária',
        totalValue: 400,
      });

      // 5. Reavalia: agora o alvo passa a ser 59.750 km. Com km 49.700, não há alertas ativos!
      const alertsAfterMaintenance = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        dataRef,
      );
      assert.strictEqual(alertsAfterMaintenance.length, 0);
    });
  });
});
