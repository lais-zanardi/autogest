import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  AnpPostosProvider,
  InMemoryPostosRepository,
  PostoColetado,
  ProvedorPostos,
} from '../integracoes/postos';
import {
  ColetaPrecosAnpJob,
  InMemoryPrecosRepository,
} from '../jobs/coletaPrecosAnpJob';
import { PrecoCombustivelColetado, ProvedorPrecos } from '../integracoes/anp';
import { PrecosController } from '../controllers/precosController';

const fixturesPath = path.resolve(__dirname, 'fixtures/anpClimaFixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

describe('US34 — Carga de Postos pelo Job e Sync Somente Leitura (API)', () => {
  it('US34.1: extrai postos do CSV ANP e geocodifica coordenadas sem rede via adaptador', async () => {
    const mockFetch = async (url: string) => {
      if (url.includes('nominatim')) {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => [{ lat: '-23.561414', lon: '-46.655881' }],
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => fixtures.anpCsvSample,
        json: async () => ({}),
      };
    };

    const provider = new AnpPostosProvider({ fetchFn: mockFetch, timeoutMs: 2000 });
    const postos = await provider.coletarPostos();

    assert.ok(postos.length >= 2);
    const postoA = postos.find(p => p.nome === 'POSTO EXEMPLO A');
    assert.ok(postoA);
    assert.strictEqual(postoA.municipio, 'SAO PAULO');
    assert.strictEqual(postoA.uf, 'SP');
    assert.strictEqual(postoA.bandeira, 'BRANCA');
    assert.strictEqual(postoA.latitude, -23.561414);
    assert.strictEqual(postoA.longitude, -46.655881);
    assert.strictEqual(postoA.precos_centavos?.Gasolina, 585);
    assert.strictEqual(postoA.precos_centavos?.Etanol, 395);
  });

  it('US34.1: job diário (US17.3) carrega tabela postos junto com precos_combustivel', async () => {
    const precosRepo = new InMemoryPrecosRepository();
    const postosRepo = new InMemoryPostosRepository();

    const provedorPrecos: ProvedorPrecos = {
      async coletarPrecos(): Promise<PrecoCombustivelColetado[]> {
        return [
          {
            municipio: 'SAO PAULO',
            uf: 'SP',
            combustivel: 'Gasolina',
            preco_centavos: 589,
            data_coleta: '2026-11-25',
            fonte: 'ANP',
            granularidade: 'municipal',
          },
        ];
      },
    };

    const provedorPostos: ProvedorPostos = {
      async coletarPostos(): Promise<PostoColetado[]> {
        return [
          {
            nome: 'POSTO PAULISTA',
            bandeira: 'IPIRANGA',
            latitude: -23.5614,
            longitude: -46.6558,
            municipio: 'SAO PAULO',
            uf: 'SP',
            endereco: 'AV PAULISTA, 200',
            precos_centavos: { Gasolina: 585 },
          },
        ];
      },
    };

    const job = new ColetaPrecosAnpJob(
      provedorPrecos,
      precosRepo,
      { info: () => {}, error: () => {} },
      provedorPostos,
      postosRepo,
    );

    const resultado = await job.executar();
    assert.strictEqual(resultado.sucesso, true);
    assert.strictEqual(resultado.registrosGravados, 1);
    assert.strictEqual(resultado.postosGravados, 1);

    const postosSalvos = await postosRepo.listarTodos();
    assert.strictEqual(postosSalvos.length, 1);
    assert.strictEqual(postosSalvos[0].nome, 'POSTO PAULISTA');
  });

  it('US34.1: endpoint GET /api/v1/sync/postos retorna postos sincronizáveis somente leitura', async () => {
    const postosRepo = new InMemoryPostosRepository();
    await postosRepo.salvarLote([
      {
        nome: 'POSTO CENTRO',
        bandeira: 'SHELL',
        latitude: -23.5505,
        longitude: -46.6333,
        municipio: 'SAO PAULO',
        uf: 'SP',
        precos_centavos: { Gasolina: 579 },
      },
    ]);

    PrecosController.setDependencies({ postosRepo });

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

    await PrecosController.listPostosSync(req, res, (err: any) => {
      throw err;
    });

    assert.strictEqual(statusCode, 200);
    assert.ok(Array.isArray(body?.items));
    assert.strictEqual(body.items.length, 1);
    assert.strictEqual(body.items[0].nome, 'POSTO CENTRO');
  });
});
