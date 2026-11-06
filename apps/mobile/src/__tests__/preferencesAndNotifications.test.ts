import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  converterConsumo,
  formatarConsumo,
  formatarConsumoDetalhado,
  PreferencesService,
  formatarFaixaPausaNotificacoes,
} from '../services/preferencesService';
import { NotificacaoService } from '../services/notificationService';
import { MaintenanceAlertService } from '../services/maintenanceAlertService';
import { BudgetService } from '../services/budgetService';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { MaintenanceRuleRepository } from '../repositories/MaintenanceRuleRepository';
import { ExpenseRepository } from '../repositories/ExpenseRepository';

describe('US39 — Configurações: Unidade de Consumo e Pausa de Notificações', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('preferencias', []);
    await db.saveTableData('notificacoes_agendadas', []);
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('veiculos', []);
    await db.saveTableData('regras_manutencao', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('despesas', []);
    await db.saveTableData('abastecimentos', []);
    await db.saveTableData('custos_fixos', []);
    await db.saveTableData('orcamentos', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('registros_pneu', []);
    await db.saveTableData('registros_fluido', []);
    PreferencesService.resetCache();
    NotificacaoService.resetMock();
  });

  describe('US39.2 & US39.9 — converterConsumo e formatarConsumo (BDD, zero e nulo)', () => {
    it('(BDD) dado consumo de 12,5 km/l, deve converter para 8,0 L/100 km e formatar com a unidade principal escolhida em destaque', () => {
      const convertido = converterConsumo(12.5);
      assert.equal(convertido, 8.0);

      // Padrão: km/l em destaque, L/100 km ao lado (formato pt-BR com 1 casa decimal)
      const formatoKml = formatarConsumo(12.5, 'km/l');
      assert.equal(formatoKml, '12,5 km/l (8,0 L/100 km)');

      const detalhadoKml = formatarConsumoDetalhado(12.5, 'km/l');
      assert.equal(detalhadoKml.principal, '12,5 km/l');
      assert.equal(detalhadoKml.secundario, '8,0 L/100 km');
      assert.equal(detalhadoKml.textoCompleto, '12,5 km/l (8,0 L/100 km)');
      assert.equal(detalhadoKml.vazio, false);

      // Alternando unidade principal para L/100 km: L/100 km em destaque, km/l ao lado
      const formatoL100 = formatarConsumo(12.5, 'L/100 km');
      assert.equal(formatoL100, '8,0 L/100 km (12,5 km/l)');

      const detalhadoL100 = formatarConsumoDetalhado(12.5, 'L/100 km');
      assert.equal(detalhadoL100.principal, '8,0 L/100 km');
      assert.equal(detalhadoL100.secundario, '12,5 km/l');
      assert.equal(detalhadoL100.textoCompleto, '8,0 L/100 km (12,5 km/l)');
    });

    it('deve devolver vazio para consumo zero, nulo, indefinido ou negativo', () => {
      assert.equal(converterConsumo(0), null);
      assert.equal(converterConsumo(null), null);
      assert.equal(converterConsumo(undefined), null);
      assert.equal(converterConsumo(-10), null);
      assert.equal(converterConsumo(NaN), null);

      assert.equal(formatarConsumo(0, 'km/l'), '');
      assert.equal(formatarConsumo(null, 'km/l'), '');
      assert.equal(formatarConsumo(undefined, 'L/100 km'), '');
      assert.equal(formatarConsumo(-4.5, 'km/l'), '');

      const detalhadoZero = formatarConsumoDetalhado(0, 'km/l');
      assert.equal(detalhadoZero.vazio, true);
      assert.equal(detalhadoZero.principal, '');
      assert.equal(detalhadoZero.secundario, '');
      assert.equal(detalhadoZero.textoCompleto, '');
    });
  });

  describe('US39.1, US39.3 & US39.5 — Preferências locais (unidade_consumo_principal e notificacoes_pausadas_ate)', () => {
    it('deve iniciar com km/l por padrão, persistir alteração de unidade localmente e refletir em formatarConsumo', async () => {
      const inicial = await PreferencesService.obterPreferencias();
      assert.equal(inicial.unidade_consumo_principal, 'km/l');
      assert.equal(inicial.notificacoes_pausadas_ate, null);

      await PreferencesService.definirUnidadeConsumoPrincipal('L/100 km');
      const atualizado = await PreferencesService.obterPreferencias();
      assert.equal(atualizado.unidade_consumo_principal, 'L/100 km');

      // Sem passar o 2º argumento, formatarConsumo usa a preferência principal ativa
      assert.equal(formatarConsumo(12.5), '8,0 L/100 km (12,5 km/l)');
    });

    it('deve exigir duração ou data final válida ao pausar notificações e formatar a faixa "Notificações pausadas até dd/mm"', async () => {
      const refNow = new Date('2026-11-05T12:00:00.000Z');

      await assert.rejects(async () => {
        await PreferencesService.pausarNotificacoes({}, refNow);
      }, /duração ou data final/i);

      await assert.rejects(async () => {
        await PreferencesService.pausarNotificacoes(
          { dataFinal: '2026-11-01T00:00:00.000Z' },
          refNow,
        );
      }, /futuro|posterior/i);

      const prefs = await PreferencesService.pausarNotificacoes(
        { dataFinal: '2026-11-20T23:59:59.999Z' },
        refNow,
      );
      assert.equal(prefs.notificacoes_pausadas_ate, '2026-11-20T23:59:59.999Z');

      const faixa = formatarFaixaPausaNotificacoes(prefs.notificacoes_pausadas_ate, refNow);
      assert.equal(faixa, 'Notificações pausadas até 20/11');
    });
  });

  describe('US39.6, US39.7, US39.8 & US39.9 — Pausa que suprime, fim da pausa que retoma e reconciliação idempotente', () => {
    it('deve suprimir notificações imediatas durante a pausa, cancelar agendadas na janela e manter alertas vencidos na lista', async () => {
      const dataAgora = new Date('2026-11-05T10:00:00.000Z');

      const veiculo = await VehicleRepository.create({
        plate: 'PAU1A99',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2023,
        fuelType: 'Flex',
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });

      // Cria uma regra que já está vencida em 05/11/2026 (último serviço em 01/01/2026, intervalo 180 dias)
      await MaintenanceRuleRepository.create({
        vehicleId: veiculo.id,
        serviceType: 'troca_oleo',
        name: 'Troca de Óleo do Motor',
        intervalKm: 10000,
        intervalDays: 180,
        advanceKm: 500,
        advanceDays: 15,
        lastServiceKm: 10000,
        lastServiceDate: '2026-01-01T00:00:00.000Z',
        active: true,
      });

      // Agenda duas notificações: uma dentro da janela da pausa (10/11) e outra fora da janela (25/11)
      await NotificacaoService.agendar({
        id: 'sched_dentro_janela',
        title: 'Lembrete 10/11',
        body: 'Cai durante as férias',
        triggerAt: '2026-11-10T09:00:00.000Z',
      });
      await NotificacaoService.agendar({
        id: 'sched_fora_janela',
        title: 'Lembrete 25/11',
        body: 'Após retorno das férias',
        triggerAt: '2026-11-25T09:00:00.000Z',
      });

      // Ativa pausa até 20/11/2026
      await NotificacaoService.pausarAte('2026-11-20T23:59:59.999Z', dataAgora);

      // Verifica que o agendamento dentro da janela (10/11) foi cancelado e o de 25/11 continua agendado
      const agendadasNoBanco = await NotificacaoService.listarAgendadasNoBanco();
      const dentro = agendadasNoBanco.find(item => item.id === 'sched_dentro_janela');
      const fora = agendadasNoBanco.find(item => item.id === 'sched_fora_janela');
      assert.equal(dentro?.status, 'cancelada');
      assert.equal(fora?.status, 'agendada');

      // Tentativa de disparo imediato durante a pausa é suprimida
      const tentativaDisparo = await NotificacaoService.disparar(
        {
          title: 'Alerta Imediato',
          body: 'Não deve tocar durante a pausa',
        },
        dataAgora,
      );
      assert.equal(tentativaDisparo.sent, false);
      assert.equal(tentativaDisparo.reason, 'notifications_paused');
      assert.equal(NotificacaoService.getDeliveredNotifications().length, 0);

      // Avalia alertas do veículo durante a pausa: o que venceu entra em "alertas vencidos", mas nenhuma notificação é disparada
      const alertasDurantePausa = await MaintenanceAlertService.evaluateVehicleAlerts(
        veiculo.id,
        dataAgora,
        false,
      );
      const vencidos = alertasDurantePausa.filter(a => a.status === 'vencido');
      assert.equal(vencidos.length, 1);
      assert.equal(vencidos[0].serviceName, 'Troca de Óleo do Motor');
      assert.equal(NotificacaoService.getDeliveredNotifications().length, 0);
    });

    it('ao fim da pausa (automático ou retomar agora), deve reavaliar regras (US10) e orçamento (US15), reagendar futuro e emitir uma única notificação-resumo', async () => {
      const dataInicioPausa = new Date('2026-11-05T10:00:00.000Z');

      const veiculo = await VehicleRepository.create({
        plate: 'RET2B77',
        brand: 'Honda',
        model: 'Civic',
        year: 2022,
        fuelType: 'Flex',
        tankCapacityL: 56,
        preferredFuel: 'Gasolina',
        initialOdometer: 30000,
      });

      // Duas regras que estarão vencidas ao término da pausa em 16/11/2026
      await MaintenanceRuleRepository.create({
        vehicleId: veiculo.id,
        serviceType: 'troca_oleo',
        name: 'Troca de Óleo',
        intervalKm: 10000,
        intervalDays: 180,
        advanceKm: 500,
        advanceDays: 15,
        lastServiceKm: 30000,
        lastServiceDate: '2026-04-01T00:00:00.000Z',
        active: true,
      });
      await MaintenanceRuleRepository.create({
        vehicleId: veiculo.id,
        serviceType: 'calibragem_pneus',
        name: 'Calibragem de Pneus',
        intervalKm: 0,
        intervalDays: 15,
        advanceKm: 0,
        advanceDays: 3,
        lastServiceKm: 30000,
        lastServiceDate: '2026-10-15T00:00:00.000Z',
        active: true,
      });
      // E uma regra futura (vence em 2027) para ser reagendada
      await MaintenanceRuleRepository.create({
        vehicleId: veiculo.id,
        serviceType: 'fluido_freio',
        name: 'Fluido de Freio',
        intervalKm: 20000,
        intervalDays: 365,
        advanceKm: 1000,
        advanceDays: 15,
        lastServiceKm: 30000,
        lastServiceDate: '2026-08-01T00:00:00.000Z',
        active: true,
      });

      // Pausa até 15/11/2026
      await NotificacaoService.pausarAte('2026-11-15T23:59:59.999Z', dataInicioPausa);

      // Durante a pausa (10/11), lança orçamento de R$ 1.000 e despesa de R$ 900 (80% -> aviso suprimido pela pausa)
      const dataDurantePausa = new Date('2026-11-10T12:00:00.000Z');
      await BudgetService.salvarOrcamento(
        { vehicleId: veiculo.id, tetoMensalCentavos: 100000 },
        dataDurantePausa,
      );
      await ExpenseRepository.create({
        vehicleId: veiculo.id,
        category: 'Manutenção',
        description: 'Bateria nova',
        amount: 900,
        date: '2026-11-10T10:00:00.000Z',
      });
      await BudgetService.reavaliarOrcamentoDoVeiculo(veiculo.id, dataDurantePausa);
      assert.equal(NotificacaoService.getDeliveredNotifications().length, 0);

      // Agora o relógio avança para 16/11/2026 (pós-pausa) e o app executa a reconciliação/retomada
      const dataPosPausa = new Date('2026-11-16T09:00:00.000Z');
      const resultado = await NotificacaoService.reconciliarAoAbrirApp(dataPosPausa);

      assert.equal(resultado.pausaEncerrada, true);
      assert.equal(resultado.alertasVencidos.length, 2);
      assert.ok(resultado.notificacaoResumoId);

      // Verifica que foi disparada UMA ÚNICA notificação-resumo consolidada (Decisão #9 / US39.8)
      const disparadas = NotificacaoService.getDeliveredNotifications();
      assert.equal(disparadas.length, 1);
      assert.match(disparadas[0].title, /Resumo de Alertas/i);
      assert.match(disparadas[0].body, /2 alertas vencidos/i);

      // E a regra futura (Fluido de Freio) foi reagendada em notificacoes_agendadas
      assert.equal(resultado.agendadasAtivas.length, 1);
      assert.match(resultado.agendadasAtivas[0].title, /Fluido de Freio/);

      // A pausa foi limpa nas preferências
      const prefsApos = await PreferencesService.obterPreferencias();
      assert.equal(prefsApos.notificacoes_pausadas_ate, null);
    });

    it('deve realizar reconciliação idempotente ao abrir o app (cancelar e recriar agendamentos sem duplicar)', async () => {
      const dataRef = new Date('2026-11-05T10:00:00.000Z');

      const veiculo = await VehicleRepository.create({
        plate: 'IDP3C88',
        brand: 'Chevrolet',
        model: 'Onix',
        year: 2024,
        fuelType: 'Flex',
        tankCapacityL: 44,
        preferredFuel: 'Gasolina',
        initialOdometer: 5000,
      });

      await MaintenanceRuleRepository.create({
        vehicleId: veiculo.id,
        serviceType: 'troca_oleo',
        name: 'Troca de Óleo Programada',
        intervalKm: 10000,
        intervalDays: 180,
        advanceKm: 500,
        advanceDays: 15,
        lastServiceKm: 5000,
        lastServiceDate: '2026-10-01T00:00:00.000Z',
        active: true,
      });

      const primeiraExecucao = await NotificacaoService.reconciliarAoAbrirApp(dataRef);
      const segundaExecucao = await NotificacaoService.reconciliarAoAbrirApp(dataRef);

      assert.equal(primeiraExecucao.agendadasAtivas.length, 1);
      assert.equal(segundaExecucao.agendadasAtivas.length, 1);
      assert.equal(primeiraExecucao.agendadasAtivas[0].id, segundaExecucao.agendadasAtivas[0].id);
      assert.equal(
        primeiraExecucao.agendadasAtivas[0].triggerAt,
        segundaExecucao.agendadasAtivas[0].triggerAt,
      );

      const todasAgendadasAtivas = (await NotificacaoService.listarAgendadasNoBanco()).filter(
        n => n.status === 'agendada',
      );
      assert.equal(todasAgendadasAtivas.length, 1);
    });
  });
});
