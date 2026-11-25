import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ColetaPrecosAnpJob,
  InMemoryHistoricoPrecosRepository,
  InMemoryPrecosRepository,
} from '../jobs/coletaPrecosAnpJob';
import { PrecoCombustivelColetado, ProvedorPrecos } from '../integracoes/anp';
import { PrecosController } from '../controllers/precosController';

describe('US35.1 — Alimentação de historico_precos_locais pelo Job e Sync (API)', () => {
  it('job diário (US17.3) grava preços em precos_combustivel e alimenta historico_precos_locais', async () => {
    const precosRepo = new InMemoryPrecosRepository();
    const historicoRepo = new InMemoryHistoricoPrecosRepository();

    const provedor: ProvedorPrecos = {
      async coletarPrecos(): Promise<PrecoCombustivelColetado[]> {
        return [
          {
            municipio: 'SAO PAULO',
            uf: 'SP',
            combustivel: 'Gasolina',
            preco_centavos: 545,
            data_coleta: '2026-11-25',
            fonte: 'ANP',
            granularidade: 'municipal',
          },
        ];
      },
    };

    const job = new ColetaPrecosAnpJob(
      provedor,
      precosRepo,
      { info: () => {}, error: () => {} },
      undefined,
      undefined,
      historicoRepo,
    );

    const res = await job.executar();
    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.registrosGravados, 1);

    const historico = await historicoRepo.listarTodos();
    assert.strictEqual(historico.length, 1);
    assert.strictEqual(historico[0].municipio, 'SAO PAULO');
    assert.strictEqual(historico[0].combustivel, 'Gasolina');
    assert.strictEqual(historico[0].preco_centavos, 545);
    assert.strictEqual(historico[0].data_coleta, '2026-11-25');
  });

  it('GET /api/v1/sync/historico_precos_locais retorna série sincronizável', async () => {
    const historicoRepo = new InMemoryHistoricoPrecosRepository();
    await historicoRepo.salvarLote([
      {
        municipio: 'SAO PAULO',
        uf: 'SP',
        combustivel: 'Gasolina',
        preco_centavos: 560,
        data_coleta: '2026-11-10',
        fonte: 'ANP',
        granularidade: 'municipal',
      },
      {
        municipio: 'SAO PAULO',
        uf: 'SP',
        combustivel: 'Gasolina',
        preco_centavos: 545,
        data_coleta: '2026-11-25',
        fonte: 'ANP',
        granularidade: 'municipal',
      },
    ]);

    PrecosController.setDependencies({ historicoRepo });

    let statusCode = 0;
    let body: any = null;
    const req: any = { query: {} };
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        body = payload;
        return this;
      },
    };

    await PrecosController.listHistoricoPrecosSync(req, res, (err: any) => {
      throw err;
    });

    assert.strictEqual(statusCode, 200);
    assert.ok(Array.isArray(body?.items));
    assert.strictEqual(body.items.length, 2);
  });
});
