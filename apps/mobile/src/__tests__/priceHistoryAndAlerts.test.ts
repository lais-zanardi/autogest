import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LocalPriceHistoryRecord } from '@autogest/shared-types';
import {
  avaliarAlertaPreco,
  calcularTendenciaPrecos,
  validarPrecoLimiteCentavos,
} from '../services/priceAlertDomain';
import { PriceAlertService } from '../services/priceAlertService';
import { NotificacaoService } from '../services/notificationService';
import { PreferencesService } from '../services/preferencesService';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';

describe('US35 — Histórico de Preços e Alerta de Preço-Limite (Domínio, Notificações e Sync)', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('alertas_preco', []);
    await db.saveTableData('historico_precos_locais', []);
    await db.saveTableData('precos_combustivel', []);
    await db.saveTableData('preferencias', []);
    await db.saveTableData('fila_sync', []);
    PreferencesService.resetCache();
    NotificacaoService.resetMock();
  });

  describe('US35.2 & US35.7: Função pura avaliarAlertaPreco e tendência de histórico', () => {
    it('BDD: limite R$ 5,50 (550) e média R$ 5,45 (545) dispara; igual ao limite (550 === 550) dispara', () => {
      assert.strictEqual(avaliarAlertaPreco(545, 550), true);
      assert.strictEqual(avaliarAlertaPreco(550, 550), true);
      assert.strictEqual(avaliarAlertaPreco(551, 550), false);
      assert.strictEqual(avaliarAlertaPreco(0, 550), false);
      assert.strictEqual(avaliarAlertaPreco(545, 0), false);
    });

    it('US35.4: valida que preço-limite deve ser maior que zero', () => {
      assert.strictEqual(validarPrecoLimiteCentavos(550).valido, true);
      assert.strictEqual(validarPrecoLimiteCentavos(0).valido, false);
      assert.strictEqual(validarPrecoLimiteCentavos(-100).valido, false);
    });

    it('US35.3 & US35.7: calcula tendência de queda/alta em 30 e 90 dias e lida com série de um ponto', () => {
      const refDate = new Date('2026-11-25T12:00:00.000Z');
      const serieQueda: LocalPriceHistoryRecord[] = [
        {
          id: 'h-1',
          municipio: 'SAO PAULO',
          combustivel: 'Gasolina',
          preco_centavos: 580,
          data_coleta: '2026-11-01',
        },
        {
          id: 'h-2',
          municipio: 'SAO PAULO',
          combustivel: 'Gasolina',
          preco_centavos: 545,
          data_coleta: '2026-11-25',
        },
      ];

      const trend30 = calcularTendenciaPrecos(serieQueda, 30, refDate);
      assert.strictEqual(trend30.direcao, 'queda');
      assert.strictEqual(trend30.variacaoCentavos, -35);
      assert.ok(trend30.variacaoPercentual < 0);

      // Série com apenas um ponto não gera NaN nem erro
      const umPonto = calcularTendenciaPrecos([serieQueda[1]], 30, refDate);
      assert.strictEqual(umPonto.pontos.length, 1);
      assert.strictEqual(umPonto.variacaoCentavos, 0);
      assert.strictEqual(umPonto.variacaoPercentual, 0);
      assert.strictEqual(umPonto.direcao, 'estavel');
    });
  });

  describe('US35.5, US35.6 & US35.7: Disparo único, rearme, pausa (US39) e alerta desativado', () => {
    it('BDD: limite R$ 5,50 e média caindo para R$ 5,45 dispara 1x em canal de alta importância, não repete abaixo e rearma ao subir', async () => {
      const now = new Date('2026-11-25T12:00:00.000Z');
      await PriceAlertService.salvarAlertaPreco({
        veiculoId: 'v-1',
        combustivel: 'Gasolina',
        precoLimiteCentavos: 550,
        ativo: true,
      });

      // 1) Preço cai para R$ 5,45 -> dispara
      const res1 = await PriceAlertService.avaliarAlertasParaPreco({
        combustivel: 'Gasolina',
        precoAtualCentavos: 545,
        municipio: 'São Paulo',
        dataReferencia: now,
      });
      assert.strictEqual(res1.disparados, 1);
      const notifs = NotificacaoService.getDeliveredNotifications();
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].importance, 'high');
      assert.ok(notifs[0].body.replace(/\u00A0/g, ' ').includes('R$ 5,45'));

      // 2) Preço continua abaixo (R$ 5,40) -> NÃO repete
      const res2 = await PriceAlertService.avaliarAlertasParaPreco({
        combustivel: 'Gasolina',
        precoAtualCentavos: 540,
        municipio: 'São Paulo',
        dataReferencia: now,
      });
      assert.strictEqual(res2.disparados, 0);
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 1);

      // 3) Preço sobe acima do limite (R$ 5,60) -> rearma alerta
      const res3 = await PriceAlertService.avaliarAlertasParaPreco({
        combustivel: 'Gasolina',
        precoAtualCentavos: 560,
        municipio: 'São Paulo',
        dataReferencia: now,
      });
      assert.strictEqual(res3.disparados, 0);
      assert.strictEqual(res3.rearmados, 1);

      // 4) Preço volta a cair para exatamente R$ 5,50 (borda) -> dispara novamente
      const res4 = await PriceAlertService.avaliarAlertasParaPreco({
        combustivel: 'Gasolina',
        precoAtualCentavos: 550,
        municipio: 'São Paulo',
        dataReferencia: now,
      });
      assert.strictEqual(res4.disparados, 1);
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 2);
    });

    it('US35.6 & US35.7: pausa de notificações (US39) suprime o disparo e alerta desativado é ignorado', async () => {
      const now = new Date('2026-11-25T12:00:00.000Z');
      await PriceAlertService.salvarAlertaPreco({
        veiculoId: 'v-1',
        combustivel: 'Gasolina',
        precoLimiteCentavos: 550,
        ativo: true,
      });
      await PriceAlertService.salvarAlertaPreco({
        veiculoId: 'v-1',
        combustivel: 'Etanol',
        precoLimiteCentavos: 400,
        ativo: false,
      });

      // Alerta desativado (Etanol) é ignorado
      const resInativo = await PriceAlertService.avaliarAlertasParaPreco({
        combustivel: 'Etanol',
        precoAtualCentavos: 350,
        municipio: 'São Paulo',
        dataReferencia: now,
      });
      assert.strictEqual(resInativo.disparados, 0);

      // Pausa global de notificações (US39) suprime o alerta ativo
      await PreferencesService.pausarNotificacoes({ duracaoDias: 3 }, now);
      const resPausado = await PriceAlertService.avaliarAlertasParaPreco({
        combustivel: 'Gasolina',
        precoAtualCentavos: 545,
        municipio: 'São Paulo',
        dataReferencia: now,
      });
      assert.strictEqual(resPausado.disparados, 0);
      assert.strictEqual(NotificacaoService.getDeliveredNotifications().length, 0);
    });

    it('US35.1: historico_precos_locais e alertas_preco estão registrados em SyncEntityRegistry', () => {
      const entities = SyncEntityRegistry.listRegisteredEntities();
      assert.ok(entities.includes('historico_precos_locais'));
      assert.ok(entities.includes('alertas_preco'));
    });
  });
});
