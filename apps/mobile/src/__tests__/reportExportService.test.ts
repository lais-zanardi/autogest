import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ReportExportService } from '../services/reportExportService';
import { db } from '../database/DatabaseConnection';

describe('US19.6 & US19.8 — App: Verificação de Rede e Pré-sincronização de Relatórios', () => {
  it('identifica quando há operações pendentes na fila_sync offline', async () => {
    // Insere pendência no banco local
    await db.saveTableData('fila_sync', [
      { id: 'item-1', operation: 'CREATE_REFUEL', endpoint: '/sync/refuels', payload: {}, status: 'PENDING', retryCount: 0, createdAt: new Date().toISOString() } as any,
    ]);

    const pendingCount = await ReportExportService.contarPendenciasSync();
    assert.strictEqual(pendingCount, 1);
    
    const checkResult = await ReportExportService.verificarProntidaoExportacao(false);
    assert.strictEqual(checkResult.podeExportar, false);
    assert.strictEqual(checkResult.pendencias, 1);
    assert.ok(checkResult.mensagemBloqueio && checkResult.mensagemBloqueio.includes('Sem conexão'));
  });

  it('permite exportação quando online e avisa sobre pendências sincronizadas', async () => {
    await db.saveTableData('fila_sync', []);

    const checkResult = await ReportExportService.verificarProntidaoExportacao(true);
    assert.strictEqual(checkResult.podeExportar, true);
    assert.strictEqual(checkResult.mensagemBloqueio, null);
  });

  it('calcula corretamente o período baseado nos filtros padrão', () => {
    const periodoMesAtual = ReportExportService.calcularPeriodo('mes_atual', new Date('2026-05-15T12:00:00Z'));
    assert.strictEqual(periodoMesAtual.de, '2026-05-01');
    assert.strictEqual(periodoMesAtual.ate, '2026-05-31');

    const periodoMesAnterior = ReportExportService.calcularPeriodo('mes_anterior', new Date('2026-05-15T12:00:00Z'));
    assert.strictEqual(periodoMesAnterior.de, '2026-04-01');
    assert.strictEqual(periodoMesAnterior.ate, '2026-04-30');
  });
});

