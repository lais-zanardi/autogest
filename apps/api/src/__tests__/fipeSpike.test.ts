import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ParallelumFipeProvider,
  normalizarMesReferenciaFipe,
  parseValorFipeCentavos,
} from '../services/fipeService';

const fixturesPath = path.resolve(__dirname, './fixtures/fipeRealFixtures.json');
const fipeFixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

describe('SPK.3 — Spike de Integração Tabela FIPE (Provedor Parallelum e Fixtures Reais)', () => {
  it('deve carregar as respostas reais guardadas em fipeRealFixtures.json com metadados de rate limit', () => {
    assert.strictEqual(
      fipeFixtures.providerBaseUrl,
      'https://parallelum.com.br/fipe/api/v1/carros',
    );
    assert.strictEqual(fipeFixtures.rateLimitHeaders['x-ratelimit-limit'], '500');
    assert.strictEqual(fipeFixtures.rateLimitHeaders['x-throttle-limit'], '50');
    assert.ok(Array.isArray(fipeFixtures.marcas));
    assert.ok(fipeFixtures.marcas.length > 0);
  });

  it('deve converter formatos de preço da FIPE (ex.: "R$ 43.703,00") para centavos inteiros sem erro de ponto flutuante', () => {
    assert.strictEqual(parseValorFipeCentavos('R$ 43.703,00'), 4_370_300);
    assert.strictEqual(parseValorFipeCentavos('R$ 44.796,00'), 4_479_600);
    assert.strictEqual(parseValorFipeCentavos('R$ 45.000,00'), 4_500_000);
    assert.strictEqual(parseValorFipeCentavos('R$\u00A0128.990,50'), 12_899_050);

    assert.throws(() => parseValorFipeCentavos(''));
    assert.throws(() => parseValorFipeCentavos('valor-invalido'));
  });

  it('deve normalizar o mês de referência em português ("novembro de 2026 ") para o formato ISO AAAA-MM ("2026-11")', () => {
    assert.strictEqual(normalizarMesReferenciaFipe('novembro de 2026'), '2026-11');
    assert.strictEqual(normalizarMesReferenciaFipe(' março de 2025 '), '2025-03');
    assert.strictEqual(normalizarMesReferenciaFipe('2026-11'), '2026-11');

    assert.throws(() => normalizarMesReferenciaFipe('mes invalido'));
  });

  it('deve consultar marcas, modelos (normalizando codigo numérico para string), anos e valor usando as fixtures reais sem acesso à rede', async () => {
    const mockFetch = async (url: string) => {
      if (url.endsWith('/marcas')) {
        return { ok: true, status: 200, json: async () => fipeFixtures.marcas };
      }
      if (url.endsWith('/marcas/59/modelos')) {
        return { ok: true, status: 200, json: async () => fipeFixtures.modelosPorMarca['59'] };
      }
      if (url.endsWith('/marcas/59/modelos/8323/anos')) {
        return { ok: true, status: 200, json: async () => fipeFixtures.anosPorModelo['59:8323'] };
      }
      if (url.endsWith('/marcas/59/modelos/8323/anos/2019-5')) {
        return {
          ok: true,
          status: 200,
          json: async () => fipeFixtures.valoresPorAno['59:8323:2019-5'],
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const provider = new ParallelumFipeProvider({ fetchFn: mockFetch });

    const marcas = await provider.listarMarcas();
    const vw = marcas.find(m => m.codigo === '59');
    assert.deepStrictEqual(vw, { codigo: '59', nome: 'VW - VolksWagen' });

    const modelos = await provider.listarModelos('59');
    const gol = modelos.find(m => m.codigo === '8323');
    assert.deepStrictEqual(gol, {
      codigo: '8323', // convertido de number 8323 para string '8323'
      nome: 'Gol 1.0 Flex 12V 5p',
    });

    const anos = await provider.listarAnos('59', '8323');
    assert.strictEqual(anos[0].codigo, '2019-5');

    const cotacao = await provider.consultarValor('59', '8323', '2019-5');
    assert.strictEqual(cotacao.codigoFipe, '005490-9');
    assert.strictEqual(cotacao.marca, 'VW - VolksWagen');
    assert.strictEqual(cotacao.modelo, 'Gol 1.0 Flex 12V 5p');
    assert.strictEqual(cotacao.anoModelo, 2019);
    assert.strictEqual(cotacao.valorFormatado, 'R$ 43.703,00');
    assert.strictEqual(cotacao.valorCentavos, 4_370_300);
    assert.strictEqual(cotacao.mesReferenciaIso, '2026-11');
  });

  it('deve realizar uma retentativa automática quando a primeira requisição falhar transitoriamente', async () => {
    let calls = 0;
    const flakyFetch = async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('Falha de rede transitória');
      }
      return { ok: true, status: 200, json: async () => fipeFixtures.marcas };
    };

    const provider = new ParallelumFipeProvider({ fetchFn: flakyFetch });
    const marcas = await provider.listarMarcas();
    assert.strictEqual(calls, 2);
    assert.strictEqual(marcas.length, fipeFixtures.marcas.length);
  });
});
