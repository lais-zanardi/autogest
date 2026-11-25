import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITENS_INSPECAO_PREDEFINIDOS,
  LIMITE_TENTATIVAS_REPETICAO_INSPECAO,
  proximoCicloInspecao,
} from '../services/visualInspectionDomain';
import { VisualInspectionService } from '../services/visualInspectionService';
import { NotificacaoService } from '../services/notificationService';
import { PreferencesService } from '../services/preferencesService';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';

describe('US31 — Lembretes de Inspeção Visual', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('lembretes_inspecao', []);
    await db.saveTableData('ciclos_inspecao', []);
    await db.saveTableData('notificacoes_agendadas', []);
    await db.saveTableData('preferencias', []);
    await db.saveTableData('fila_sync', []);
    PreferencesService.resetCache();
    NotificacaoService.resetMock();
  });

  describe('US31.3 & US31.5: Função pura proximoCicloInspecao', () => {
    it('calcula a data do próximo ciclo a partir da última inspeção + periodicidade em dias', () => {
      const lembrete = {
        id: 'l-1',
        veiculo_id: 'v-1',
        item: 'Pneus',
        periodicidade_dias: 30,
        ultima_inspecao_em: '2026-10-01T09:00:00.000Z',
        ativo: true,
        criado_em: '2026-10-01T09:00:00.000Z',
        atualizado_em: '2026-10-01T09:00:00.000Z',
      };

      const prox = proximoCicloInspecao(lembrete, new Date('2026-10-20T09:00:00.000Z'));
      assert.strictEqual(prox.proximaDataIso.slice(0, 10), '2026-10-31');
      assert.strictEqual(prox.vencido, false);
      assert.strictEqual(prox.diasRestantes, 11);

      const vencido = proximoCicloInspecao(lembrete, new Date('2026-11-02T09:00:00.000Z'));
      assert.strictEqual(vencido.vencido, true);
      assert.ok(ITENS_INSPECAO_PREDEFINIDOS.includes('Faróis'));
      assert.ok(ITENS_INSPECAO_PREDEFINIDOS.includes('Pneus'));
      assert.ok(ITENS_INSPECAO_PREDEFINIDOS.includes('Limpadores'));
    });
  });

  describe('US31.4 & US31.5: Ciclo aberto repete notificação, marcar como feito fecha/reagenda e pausa US39', () => {
    it('ciclo aberto repete notificação diariamente até atingir o limite de tentativas', async () => {
      const lembrete = await VisualInspectionService.criarLembrete({
        veiculoId: 'v-1',
        item: 'Faróis',
        periodicidadeDias: 15,
        ultimaInspecaoEm: '2026-11-01T09:00:00.000Z',
        ativo: true,
      });

      // Dia 16: venceu -> abre ciclo e dispara 1ª notificação
      const dia16 = new Date('2026-11-16T10:00:00.000Z');
      const r1 = await VisualInspectionService.verificarEDispararCiclos(dia16);
      assert.strictEqual(r1.disparados, 1);
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 1);

      // Mesmo dia 2h depois -> NÃO repete
      const mesmoDia = new Date('2026-11-16T12:00:00.000Z');
      const rMesmoDia = await VisualInspectionService.verificarEDispararCiclos(mesmoDia);
      assert.strictEqual(rMesmoDia.disparados, 0);

      // Dia 17 (+24h) -> ciclo ainda aberto -> repete notificação (2ª tentativa)
      const dia17 = new Date('2026-11-17T10:00:00.000Z');
      const r2 = await VisualInspectionService.verificarEDispararCiclos(dia17);
      assert.strictEqual(r2.disparados, 1);
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 2);

      // Simula atingir o limite máximo de tentativas (7)
      for (let d = 18; d <= 25; d += 1) {
        await VisualInspectionService.verificarEDispararCiclos(
          new Date(`2026-11-${String(d).padStart(2, '0')}T10:00:00.000Z`),
        );
      }
      assert.strictEqual(
        NotificacaoService.getDeliveredNotifications().length,
        LIMITE_TENTATIVAS_REPETICAO_INSPECAO,
      );

      // Marcar como feito fecha o ciclo aberto e agenda o seguinte
      const dia26 = new Date('2026-11-26T10:00:00.000Z');
      const concluido = await VisualInspectionService.marcarInspecaoFeita(lembrete.id, dia26);
      assert.ok(concluido);
      assert.strictEqual(concluido.cicloFechado?.concluido_em, dia26.toISOString());
      assert.strictEqual(concluido.lembrete.ultima_inspecao_em, dia26.toISOString());
      assert.strictEqual(concluido.proximoAgendamentoIso.slice(0, 10), '2026-12-11');

      const agendadas = await NotificacaoService.listarAgendadasNoBanco();
      assert.ok(agendadas.some(a => a.sourceId === lembrete.id && a.status === 'agendada'));
    });

    it('pausa global de notificações (US39) suprime o disparo de inspeção visual', async () => {
      const now = new Date('2026-11-20T10:00:00.000Z');
      await VisualInspectionService.criarLembrete({
        veiculoId: 'v-1',
        item: 'Limpadores',
        periodicidadeDias: 10,
        ultimaInspecaoEm: '2026-11-01T09:00:00.000Z',
        ativo: true,
      });

      await PreferencesService.pausarNotificacoes({ duracaoDias: 5 }, now);

      const res = await VisualInspectionService.verificarEDispararCiclos(now);
      assert.strictEqual(res.disparados, 0);
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 0);
    });

    it('US31.1: lembretes_inspecao e ciclos_inspecao estão registrados em SyncEntityRegistry', () => {
      const entities = SyncEntityRegistry.listRegisteredEntities();
      assert.ok(entities.includes('lembretes_inspecao'));
      assert.ok(entities.includes('ciclos_inspecao'));
    });
  });
});
