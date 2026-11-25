import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { formatarMoeda, formatarDataColeta } from '../utils/formatters';
import { PreferencesService } from '../services/preferencesService';
import { RegionalPricesService, montarAvisoDadosDe } from '../services/regionalPricesService';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { DatabaseConnection } from '../database/DatabaseConnection';

describe('US17 — Preços da Região, Clima, Cache 24h e Modo Offline (Mobile)', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('precos_combustivel', []);
    await db.saveTableData('cache_clima', []);
    await db.saveTableData('preferencias', []);
    PreferencesService.resetCache();
    RegionalPricesService.resetClient();
  });

  it('US17.6 & US17.8: formata preços em centavos/reais com formatarMoeda (pt-BR)', () => {
    const formatted = formatarMoeda(5.89);
    // Normaliza espaço não-quebrável do Intl.NumberFormat pt-BR
    assert.strictEqual(formatted.replace(/\u00A0/g, ' '), 'R$ 5,89');

    const formattedEtanol = formatarMoeda(3.95);
    assert.strictEqual(formattedEtanol.replace(/\u00A0/g, ' '), 'R$ 3,95');

    assert.strictEqual(formatarDataColeta('2026-11-24'), '24/11/2026');
    assert.strictEqual(montarAvisoDadosDe('2026-11-24'), 'Dados de 24/11/2026');
  });

  it('US17.6: persiste e lê a preferência local combustivel_principal', async () => {
    const inicial = await PreferencesService.obterCombustivelPrincipal();
    assert.strictEqual(inicial, 'Gasolina');

    await PreferencesService.definirCombustivelPrincipal('Etanol');
    const atualizado = await PreferencesService.obterCombustivelPrincipal();
    assert.strictEqual(atualizado, 'Etanol');
  });

  it('US17.7 & US17.8: usa cache local de 24h evitando requisições repetidas ao backend', async () => {
    let apiCalls = 0;
    RegionalPricesService.setHttpClient({
      async get(url: string) {
        apiCalls += 1;
        if (url.includes('/precos')) {
          return {
            data: {
              municipio: 'São Paulo',
              uf: 'SP',
              combustivel: 'Gasolina',
              preco_medio_centavos: 589,
              data_coleta: '2026-11-24',
              fonte: 'ANP',
              granularidade: 'municipal',
              aviso_granularidade: 'Média municipal da ANP; pode variar entre postos.',
              historico_semana: [
                { data_coleta: '2026-11-20', preco_centavos: 585 },
                { data_coleta: '2026-11-24', preco_centavos: 589 },
              ],
              clima: {
                id: 'clima-sp-1',
                municipio: 'São Paulo',
                uf: 'SP',
                data: '2026-11-25',
                temperatura_atual: 25,
                temperatura_min: 18,
                temperatura_max: 28,
                condicao: 'Parcialmente nublado',
                expira_em: '2026-11-26T10:00:00.000Z',
              },
            },
          };
        }
        return { data: null };
      },
    });

    const now = new Date('2026-11-25T10:00:00.000Z');
    const first = await RegionalPricesService.consultarPrecosRegiao({
      municipio: 'São Paulo',
      combustivel: 'Gasolina',
      now,
    });

    assert.strictEqual(apiCalls, 1);
    assert.strictEqual(first.preco_medio_centavos, 589);
    assert.strictEqual(first.origem, 'rede');
    assert.strictEqual(first.clima?.condicao, 'Parcialmente nublado');

    // Segunda chamada dentro de 24h deve usar o cache local sem ir à rede
    const twoHoursLater = new Date('2026-11-25T12:00:00.000Z');
    const second = await RegionalPricesService.consultarPrecosRegiao({
      municipio: 'São Paulo',
      combustivel: 'Gasolina',
      now: twoHoursLater,
    });

    assert.strictEqual(apiCalls, 1, 'Segunda consulta dentro de 24h não deve fazer requisição');
    assert.strictEqual(second.preco_medio_centavos, 589);
    assert.strictEqual(second.origem, 'cache');
    assert.strictEqual(second.aviso_data, 'Dados de 24/11/2026');
  });

  it('US17.7 & US17.8: sem conexão, exibe a última coleta salva localmente (preços e clima)', async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('precos_combustivel', [
      {
        id: 'p-1',
        municipio: 'São Paulo',
        uf: 'SP',
        combustivel: 'Gasolina',
        preco_centavos: 579,
        data_coleta: '2026-11-20',
        fonte: 'ANP',
        granularidade: 'municipal',
        sincronizado_em: '2026-11-20T12:00:00.000Z',
      },
      {
        id: 'p-2',
        municipio: 'São Paulo',
        uf: 'SP',
        combustivel: 'Gasolina',
        preco_centavos: 589,
        data_coleta: '2026-11-23',
        fonte: 'ANP',
        granularidade: 'municipal',
        sincronizado_em: '2026-11-23T12:00:00.000Z',
      },
    ]);
    await db.saveTableData('cache_clima', [
      {
        id: 'c-1',
        municipio: 'São Paulo',
        uf: 'SP',
        data: '2026-11-23',
        temperatura_atual: 22,
        temperatura_min: 17,
        temperatura_max: 26,
        condicao: 'Céu limpo',
        expira_em: '2026-11-24T12:00:00.000Z',
      },
    ]);

    // Simula falha de rede (offline) mesmo após expiração de 24h
    RegionalPricesService.setHttpClient({
      async get() {
        const err: any = new Error('Network Error');
        err.code = 'ERR_NETWORK';
        throw err;
      },
    });

    const result = await RegionalPricesService.consultarPrecosRegiao({
      municipio: 'São Paulo',
      combustivel: 'Gasolina',
      forceRefresh: true,
      now: new Date('2026-11-25T15:00:00.000Z'),
    });

    assert.strictEqual(result.origem, 'offline');
    assert.strictEqual(result.offline, true);
    assert.strictEqual(result.preco_medio_centavos, 589);
    assert.strictEqual(result.data_coleta, '2026-11-23');
    assert.strictEqual(result.aviso_data, 'Dados de 23/11/2026');
    assert.strictEqual(result.historico_semana.length, 2);
    assert.strictEqual(result.clima?.condicao, 'Céu limpo');
  });

  it('US17.7: precos_combustivel e cache_clima estão registrados na lista central de sync', () => {
    const registered = SyncEntityRegistry.listRegisteredEntities();
    assert.ok(registered.includes('precos_combustivel'));
    assert.ok(registered.includes('cache_clima'));
  });
});
