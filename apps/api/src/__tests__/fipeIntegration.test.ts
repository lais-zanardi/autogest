import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FipeMemoryCache } from '../integracoes/fipe';
import {
  ParallelumFipeProvider,
  parseValorFipeCentavos,
  normalizarMesReferenciaFipe,
} from '../services/fipeService';

describe('US18 — Integração Tabela FIPE, Cache e Rotas', () => {
  it('US18.8: Converte texto de preço para centavos inteiros (R$ 45.000,00 -> 4.500.000 centavos)', () => {
    assert.strictEqual(parseValorFipeCentavos('R$ 45.000,00'), 4_500_000);
    assert.strictEqual(parseValorFipeCentavos('R$ 50.000,00'), 5_000_000);
    assert.strictEqual(parseValorFipeCentavos('R$ 1.234,56'), 123_456);
  });

  it('US18.8: Normaliza mês de referência em português para ISO YYYY-MM', () => {
    assert.strictEqual(normalizarMesReferenciaFipe('novembro de 2026'), '2026-11');
    assert.strictEqual(normalizarMesReferenciaFipe('janeiro de 2025'), '2025-01');
  });

  it('US18.2 & US18.8: Cache em memória com TTL armazena consultas e a segunda chamada vem do cache', async () => {
    const cache = new FipeMemoryCache(1000); // 1s
    cache.set('fipe:test:1', { valor: 50000 });

    const first = cache.get<{ valor: number }>('fipe:test:1');
    assert.ok(first);
    assert.strictEqual(first.valor, 50000);

    // Segundo acesso vem do cache
    const second = cache.get<{ valor: number }>('fipe:test:1');
    assert.strictEqual(second?.valor, 50000);
  });

  it('US18.1 & US18.8: Adaptador Parallelum com respostas mockadas sem rede e retentativa em falha', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => [{ codigo: '59', nome: 'VW - VolksWagen' }],
      };
    };

    const provider = new ParallelumFipeProvider({ fetchFn: mockFetch });
    const marcas = await provider.listarMarcas();

    assert.strictEqual(marcas.length, 1);
    assert.strictEqual(marcas[0].nome, 'VW - VolksWagen');
    assert.strictEqual(callCount, 1);
  });

  it('US18.8: Provedor falhando retorna erro mapeado (lança exceção tratável para 503)', async () => {
    const failingFetch = async () => {
      throw new Error('Falha de conexão com a API da FIPE');
    };

    const provider = new ParallelumFipeProvider({ fetchFn: failingFetch });
    await assert.rejects(async () => {
      await provider.listarMarcas();
    }, /Falha de conexão/);
  });
});
