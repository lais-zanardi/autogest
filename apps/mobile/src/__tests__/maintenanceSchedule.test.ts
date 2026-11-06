import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MaintenanceScheduleService } from '../services/maintenanceScheduleService';
import { NotificacaoService } from '../services/notificationService';
import { db } from '../database/DatabaseConnection';

describe('US30.6 — BDD: Agendamento de Manutenções Futuras e Lembretes Locais', () => {
  beforeEach(async () => {
    await db.saveTableData('agendamentos_manutencao', []);
    await db.saveTableData('notificacoes_agendadas', []);
    await db.saveTableData('preferencias', []);
    NotificacaoService.resetMock();
  });

  it('US30 BDD: Dado manutenção agendada para 10/12, quando a data chegar, dispara lembrete local mesmo sem conexão', async () => {
    // 1. Cria agendamento para 10/12/2026 às 09:00
    const schedule = await MaintenanceScheduleService.criarAgendamento({
      vehicleId: 'veh-teste-1',
      date: '2026-12-10',
      reminderTime: '09:00',
      serviceType: 'troca_oleo',
      description: 'Troca de Óleo dos 40.000 km',
    });

    assert.ok(schedule.id);
    assert.strictEqual(schedule.status, 'agendado');

    // 2. Verifica se o lembrete foi registrado no banco local de notificações agendadas (US39.6)
    const agendadas = await NotificacaoService.listarAgendadasNoBanco();
    const lembrete = agendadas.find(n => n.sourceId === schedule.id);
    assert.ok(lembrete, 'Deve existir lembrete local registrado');
    assert.strictEqual(lembrete.status, 'agendada');

    // Antes da data (ex: 09/12/2026), reconciliação não dispara
    const dataAntes = new Date('2026-12-09T10:00:00.000Z');
    await NotificacaoService.reconciliarAoAbrirApp(dataAntes);
    assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 0);

    // Quando chega a data e hora do agendamento (10/12/2026 às 12:05 UTC), mesmo sem conexão, dispara lembrete
    const dataChegada = new Date('2026-12-10T15:05:00.000Z');
    await NotificacaoService.reconciliarAoAbrirApp(dataChegada);

    const disparadas = NotificacaoService.getDeliveredNotifications();
    assert.strictEqual(disparadas.length, 1);
    assert.ok(disparadas[0].body.includes('Troca de Óleo dos 40.000 km'));
  });

  it('cancelar agendamento remove o lembrete local do NotificacaoService', async () => {
    const schedule = await MaintenanceScheduleService.criarAgendamento({
      vehicleId: 'veh-teste-1',
      date: '2026-12-15',
      reminderTime: '09:00',
      serviceType: 'filtros',
      description: 'Revisão dos filtros de cabine',
    });

    let agendadas = await NotificacaoService.listarAgendadasNoBanco();
    assert.ok(agendadas.some(n => n.sourceId === schedule.id && n.status === 'agendada'));

    // Cancela o agendamento
    await MaintenanceScheduleService.cancelarAgendamento(schedule.id);

    agendadas = await NotificacaoService.listarAgendadasNoBanco();
    const lembreteCancelado = agendadas.find(n => n.sourceId === schedule.id);
    assert.strictEqual(lembreteCancelado?.status, 'cancelada');

    // Na data do lembrete, não dispara nada
    await NotificacaoService.reconciliarAoAbrirApp(new Date('2026-12-15T15:00:00.000Z'));
    assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 0);
  });

  it('durante a pausa de notificações (US39), o lembrete não é disparado', async () => {
    const _schedule = await MaintenanceScheduleService.criarAgendamento({
      vehicleId: 'veh-teste-1',
      date: '2026-12-10',
      reminderTime: '09:00',
      serviceType: 'freios',
      description: 'Revisão de pastilhas de freio',
    });

    // Usuário ativa pausa de notificações até 20/12
    await NotificacaoService.pausarAte({
      dataFinal: '2026-12-20T23:59:59.999Z',
    });

    // Na data do lembrete (10/12), como está pausado, nenhum lembrete é entregue
    await NotificacaoService.reconciliarAoAbrirApp(new Date('2026-12-10T15:00:00.000Z'));
    assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 0);
  });

  it('concluir agendamento vincula manutencao_id e marca como concluído', async () => {
    const schedule = await MaintenanceScheduleService.criarAgendamento({
      vehicleId: 'veh-teste-1',
      date: '2026-12-05',
      reminderTime: '09:00',
      serviceType: 'velas',
      description: 'Troca de velas de ignição',
    });

    const manutencaoRealizadaId = 'maint-realizada-123';
    const concluido = await MaintenanceScheduleService.concluirAgendamento(
      schedule.id,
      manutencaoRealizadaId
    );

    assert.ok(concluido);
    assert.strictEqual(concluido.status, 'concluido');
    assert.strictEqual(concluido.maintenanceId, manutencaoRealizadaId);

    // O lembrete é cancelado para não disparar após a conclusão
    const agendadas = await NotificacaoService.listarAgendadasNoBanco();
    const lembrete = agendadas.find(n => n.sourceId === schedule.id);
    assert.strictEqual(lembrete?.status, 'cancelada');
  });
});
