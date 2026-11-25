import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  AnpDadosAbertosProvider,
  AnpIntegrationError,
  ProvedorPrecos,
  parsePrecoAnpCentavos,
  normalizarCombustivelAnp,
  PrecoCombustivelColetado,
} from '../integracoes/anp';
import {
  ColetaPrecosAnpJob,
  InMemoryPrecosRepository,
} from '../jobs/coletaPrecosAnpJob';
import {
  OpenMeteoClimaProvider,
  ClimaIntegrationService,
  InMemoryCacheClimaRepository,
  ProvedorClima,
  traduzirCodigoClimaWmo,
} from '../integracoes/clima';
import { PrecosController } from '../controllers/precosController';

const fixturesPath = path.resolve(__dirname, 'fixtures/anpClimaFixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

describe('US17 — Monitoramento de Preços ANP e Clima (API)', () => {
  describe('US17.2 & US17.8: Adaptador ANP com respostas gravadas, timeout, retentativa e erros', () => {
    it('converte preços ANP pt-BR para centavos inteiros sem ponto flutuante', () => {
      assert.strictEqual(parsePrecoAnpCentavos('5,89'), 589);
      assert.strictEqual(parsePrecoAnpCentavos('6,129'), 613);
      assert.strictEqual(parsePrecoAnpCentavos('R$ 3,95'), 395);
      assert.throws(() => parsePrecoAnpCentavos('invalido'), AnpIntegrationError);
    });

    it('normaliza nomes de combustíveis da ANP para o domínio AutoGest', () => {
      assert.strictEqual(normalizarCombustivelAnp('GASOLINA'), 'Gasolina');
      assert.strictEqual(normalizarCombustivelAnp('GASOLINA ADITIVADA'), 'Gasolina');
      assert.strictEqual(normalizarCombustivelAnp('ETANOL'), 'Etanol');
      assert.strictEqual(normalizarCombustivelAnp('DIESEL S10'), 'Diesel');
      assert.strictEqual(normalizarCombustivelAnp('GNV'), 'GNV');
    });

    it('processa CSV gravado da ANP sem rede e agrega média municipal corretamente', async () => {
      let calls = 0;
      const mockFetch = async () => {
        calls += 1;
        return {
          ok: true,
          status: 200,
          text: async () => fixtures.anpCsvSample,
          json: async () => ({}),
        };
      };

      const provider = new AnpDadosAbertosProvider({ fetchFn: mockFetch, timeoutMs: 2000 });
      const registros = await provider.coletarPrecos();

      assert.strictEqual(calls, 1);
      // São Paulo Gasolina: média de 585 e 593 = 589 centavos
      const spGasolina = registros.find(
        r => r.municipio === 'SAO PAULO' && r.combustivel === 'Gasolina',
      );
      assert.ok(spGasolina);
      assert.strictEqual(spGasolina.preco_centavos, 589);
      assert.strictEqual(spGasolina.uf, 'SP');
      assert.strictEqual(spGasolina.data_coleta, '2026-11-24');
      assert.strictEqual(spGasolina.granularidade, 'municipal');
      assert.strictEqual(spGasolina.fonte, 'ANP');

      const spEtanol = registros.find(
        r => r.municipio === 'SAO PAULO' && r.combustivel === 'Etanol',
      );
      assert.ok(spEtanol);
      assert.strictEqual(spEtanol.preco_centavos, 395);

      const campinasDiesel = registros.find(
        r => r.municipio === 'CAMPINAS' && r.combustivel === 'Diesel',
      );
      assert.ok(campinasDiesel);
      assert.strictEqual(campinasDiesel.preco_centavos, 612);
    });

    it('realiza uma retentativa em erro transitório e sucede na segunda chamada', async () => {
      let attempts = 0;
      const flakyFetch = async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('ECONNRESET');
        }
        return {
          ok: true,
          status: 200,
          text: async () => fixtures.anpCsvSample,
          json: async () => ({}),
        };
      };

      const provider = new AnpDadosAbertosProvider({ fetchFn: flakyFetch, timeoutMs: 2000 });
      const registros = await provider.coletarPrecos();

      assert.strictEqual(attempts, 2);
      assert.ok(registros.length >= 3);
    });

    it('mapeia erro de timeout após esgotar retentativa', async () => {
      let attempts = 0;
      const slowFetch = async (_url: string, init?: RequestInit) => {
        attempts += 1;
        return await new Promise<any>((_resolve, reject) => {
          const onAbort = () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          };
          if (init?.signal?.aborted) {
            onAbort();
          } else {
            init?.signal?.addEventListener('abort', onAbort, { once: true });
          }
        });
      };

      const provider = new AnpDadosAbertosProvider({ fetchFn: slowFetch, timeoutMs: 25 });
      await assert.rejects(
        async () => {
          await provider.coletarPrecos();
        },
        (err: any) => err instanceof AnpIntegrationError && err.code === 'TIMEOUT',
      );
      assert.strictEqual(attempts, 2);
    });
  });

  describe('US17.3 & US17.8: Job diário de coleta de preços ANP', () => {
    it('coleta preços e grava em precos_combustivel', async () => {
      const repo = new InMemoryPrecosRepository();
      const provedor: ProvedorPrecos = {
        async coletarPrecos(): Promise<PrecoCombustivelColetado[]> {
          return [
            {
              municipio: 'SAO PAULO',
              uf: 'SP',
              combustivel: 'Gasolina',
              preco_centavos: 589,
              data_coleta: '2026-11-24',
              fonte: 'ANP',
              granularidade: 'municipal',
            },
          ];
        },
      };

      const job = new ColetaPrecosAnpJob(provedor, repo);
      const resultado = await job.executar();

      assert.strictEqual(resultado.sucesso, true);
      assert.strictEqual(resultado.registrosGravados, 1);

      const salvos = await repo.buscarPorMunicipioECombustivel('SAO PAULO', 'Gasolina');
      assert.strictEqual(salvos.length, 1);
      assert.strictEqual(salvos[0].preco_centavos, 589);
    });

    it('em caso de falha do provedor, mantém dados do dia anterior intactos e registra erro em log', async () => {
      const repo = new InMemoryPrecosRepository();
      await repo.salvarLote([
        {
          municipio: 'SAO PAULO',
          uf: 'SP',
          combustivel: 'Gasolina',
          preco_centavos: 579,
          data_coleta: '2026-11-23',
          fonte: 'ANP',
          granularidade: 'municipal',
        },
      ]);

      const logsErro: string[] = [];
      const provedorComFalha: ProvedorPrecos = {
        async coletarPrecos(): Promise<PrecoCombustivelColetado[]> {
          throw new AnpIntegrationError('HTTP_ERROR', 'ANP indisponível (503)', 503);
        },
      };

      const job = new ColetaPrecosAnpJob(provedorComFalha, repo, {
        error: (msg: string) => logsErro.push(msg),
        info: () => {},
      });

      const resultado = await job.executar();
      assert.strictEqual(resultado.sucesso, false);
      assert.strictEqual(resultado.registrosGravados, 0);
      assert.ok(logsErro.length >= 1);
      assert.match(logsErro[0], /ANP indisponível|Falha/);

      // Dados do dia anterior continuam preservados
      const salvos = await repo.buscarPorMunicipioECombustivel('SAO PAULO', 'Gasolina');
      assert.strictEqual(salvos.length, 1);
      assert.strictEqual(salvos[0].preco_centavos, 579);
      assert.strictEqual(salvos[0].data_coleta, '2026-11-23');
    });
  });

  describe('US17.4 & US17.8: Módulo de clima com provedor gratuito e cache persistido de 24h', () => {
    it('traduz códigos WMO para condição legível em português', () => {
      assert.strictEqual(traduzirCodigoClimaWmo(0), 'Céu limpo');
      assert.strictEqual(traduzirCodigoClimaWmo(2), 'Parcialmente nublado');
      assert.strictEqual(traduzirCodigoClimaWmo(61), 'Chuva leve');
    });

    it('adaptador Open-Meteo processa respostas gravadas sem rede', async () => {
      const mockFetch = async (url: string) => {
        if (url.includes('geocoding-api.open-meteo.com')) {
          return {
            ok: true,
            status: 200,
            json: async () => fixtures.openMeteoGeocodingSample,
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => fixtures.openMeteoForecastSample,
        };
      };

      const provider = new OpenMeteoClimaProvider({ fetchFn: mockFetch, timeoutMs: 2000 });
      const clima = await provider.consultarClima('São Paulo', 'SP');

      assert.strictEqual(clima.municipio, 'São Paulo');
      assert.strictEqual(clima.temperatura_atual, 25.4);
      assert.strictEqual(clima.temperatura_min, 18.2);
      assert.strictEqual(clima.temperatura_max, 28.7);
      assert.strictEqual(clima.condicao, 'Parcialmente nublado');
    });

    it('usa cache persistido de 24h em cache_clima: segunda chamada não vai ao provedor e sobrevive a reinício', async () => {
      const cacheRepo = new InMemoryCacheClimaRepository();
      let providerCalls = 0;
      const fakeProvider: ProvedorClima = {
        async consultarClima(municipio: string) {
          providerCalls += 1;
          return {
            municipio,
            uf: 'SP',
            data: '2026-11-25',
            temperatura_atual: 25.4,
            temperatura_min: 18.2,
            temperatura_max: 28.7,
            condicao: 'Parcialmente nublado',
          };
        },
      };

      const now = new Date('2026-11-25T10:00:00.000Z');
      const service1 = new ClimaIntegrationService(fakeProvider, cacheRepo, () => now);
      const first = await service1.obterClima('São Paulo', 'SP');
      assert.strictEqual(providerCalls, 1);
      assert.strictEqual(first.temperatura_max, 28.7);

      // Simula reinício do servidor criando nova instância do serviço com o mesmo repositório persistido
      const fiveHoursLater = new Date('2026-11-25T15:00:00.000Z');
      const serviceAfterRestart = new ClimaIntegrationService(
        fakeProvider,
        cacheRepo,
        () => fiveHoursLater,
      );
      const second = await serviceAfterRestart.obterClima('São Paulo', 'SP');
      assert.strictEqual(providerCalls, 1, 'Segunda chamada dentro de 24h não deve chamar o provedor');
      assert.strictEqual(second.condicao, 'Parcialmente nublado');

      // Após 24h01m o cache expira e consulta novamente o provedor
      const after24h = new Date('2026-11-26T10:01:00.000Z');
      const serviceExpired = new ClimaIntegrationService(fakeProvider, cacheRepo, () => after24h);
      await serviceExpired.obterClima('São Paulo', 'SP');
      assert.strictEqual(providerCalls, 2);
    });
  });

  describe('US17.5: Rota GET /api/v1/precos?municipio=&combustivel=', () => {
    it('retorna preço médio, histórico da semana, data da coleta e aviso de granularidade municipal', async () => {
      const precosRepo = new InMemoryPrecosRepository();
      await precosRepo.salvarLote([
        {
          municipio: 'SAO PAULO',
          uf: 'SP',
          combustivel: 'Gasolina',
          preco_centavos: 585,
          data_coleta: '2026-11-20',
          fonte: 'ANP',
          granularidade: 'municipal',
        },
        {
          municipio: 'SAO PAULO',
          uf: 'SP',
          combustivel: 'Gasolina',
          preco_centavos: 589,
          data_coleta: '2026-11-24',
          fonte: 'ANP',
          granularidade: 'municipal',
        },
      ]);

      const climaRepo = new InMemoryCacheClimaRepository();
      const climaService = new ClimaIntegrationService(
        {
          async consultarClima(municipio: string) {
            return {
              municipio,
              uf: 'SP',
              data: '2026-11-25',
              temperatura_atual: 24,
              temperatura_min: 18,
              temperatura_max: 27,
              condicao: 'Céu limpo',
            };
          },
        },
        climaRepo,
      );

      PrecosController.setDependencies({ precosRepo, climaService });

      let statusCode = 200;
      let body: any = null;
      const req: any = {
        query: { municipio: 'SAO PAULO', combustivel: 'Gasolina' },
      };
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

      await PrecosController.getPrecos(req, res, (err: any) => {
        throw err;
      });

      assert.strictEqual(statusCode, 200);
      assert.ok(body);
      assert.strictEqual(body.preco_medio_centavos, 589);
      assert.strictEqual(body.data_coleta, '2026-11-24');
      assert.strictEqual(body.granularidade, 'municipal');
      assert.ok(body.aviso_granularidade && body.aviso_granularidade.length > 0);
      assert.strictEqual(body.historico_semana.length, 2);
      assert.strictEqual(body.clima?.condicao, 'Céu limpo');
    });

    it('retorna 400 quando município ou combustível não são informados', async () => {
      let statusCode = 0;
      let body: any = null;
      const req: any = { query: { municipio: '' } };
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

      await PrecosController.getPrecos(req, res, () => {});
      assert.strictEqual(statusCode, 400);
      assert.ok(body?.error);
    });
  });
});
