import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MonthlySummaryPreferencesService } from '../services/monthlySummaryPreferencesService';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';

describe('US37.1 & US37.2 — Preferência de Resumo Mensal por E-mail (Mobile)', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('preferencias_resumo', []);
    await db.saveTableData('fila_sync', []);
  });

  it('inicia desativada por padrão, valida e-mail ao ativar e permite desativar a qualquer momento', async () => {
    const inicial = await MonthlySummaryPreferencesService.obterPreferencia();
    assert.strictEqual(inicial.receber_resumo, false);

    // E-mail inválido ao ativar é rejeitado
    await assert.rejects(
      async () => {
        await MonthlySummaryPreferencesService.salvarPreferencia({
          receberResumo: true,
          emailDestino: 'email-invalido',
        });
      },
      /e-mail válido/,
    );

    const ativada = await MonthlySummaryPreferencesService.salvarPreferencia({
      receberResumo: true,
      emailDestino: 'usuario@autogest.app',
    });
    assert.strictEqual(ativada.receber_resumo, true);
    assert.strictEqual(ativada.email_destino, 'usuario@autogest.app');

    const desativada = await MonthlySummaryPreferencesService.salvarPreferencia({
      receberResumo: false,
      emailDestino: 'usuario@autogest.app',
    });
    assert.strictEqual(desativada.receber_resumo, false);
  });

  it('preferencias_resumo está registrada em SyncEntityRegistry', () => {
    const entities = SyncEntityRegistry.listRegisteredEntities();
    assert.ok(entities.includes('preferencias_resumo'));
  });
});
