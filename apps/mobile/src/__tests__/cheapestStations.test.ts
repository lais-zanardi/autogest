import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FuelStationRecord } from '@autogest/shared-types';
import {
  calcularDistanciaHaversineKm,
  ordenarPostosPorPreco,
  montarUrlMapaRota,
} from '../services/cheapestStationsDomain';
import { CheapestStationsService } from '../services/cheapestStationsService';
import { GPSService } from '../services/gpsService';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { formatarMoeda } from '../utils/formatters';

describe('US34 — Postos Mais Baratos por GPS (Domínio, Permissão e Cache Local)', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('postos', []);
    await db.saveTableData('precos_combustivel', []);
    GPSService.setMockPermissionDenied(false);
  });

  describe('US34.2 & US34.6: Função pura Haversine e ordenarPostosPorPreco', () => {
    it('calcula distância conhecida por Haversine (dois pontos a ~1 km)', () => {
      // 1 grau de latitude ≈ 111,195 km -> 0,008993 graus ≈ 1,00 km
      const origem = { latitude: -23.55052, longitude: -46.633308 };
      const destino1Km = { latitude: -23.55052 + 0.008993, longitude: -46.633308 };

      const dist = calcularDistanciaHaversineKm(origem, destino1Km);
      assert.ok(dist >= 0.98 && dist <= 1.02, `Esperado ~1.0 km, obtido ${dist}`);
      assert.strictEqual(calcularDistanciaHaversineKm(origem, origem), 0);
    });

    it('ordena por menor preço e desempata por menor distância dentro do raio', () => {
      const posicao = { latitude: -23.55052, longitude: -46.633308 };
      const postos: FuelStationRecord[] = [
        {
          id: 'p-caro',
          nome: 'Posto Caro Perto',
          bandeira: 'SHELL',
          latitude: -23.5515,
          longitude: -46.6333,
          municipio: 'SAO PAULO',
          uf: 'SP',
          precos_centavos: { Gasolina: 610 },
        },
        {
          id: 'p-empate-longe',
          nome: 'Posto Empate Longe',
          bandeira: 'IPIRANGA',
          latitude: -23.575, // ~2.7 km
          longitude: -46.6333,
          municipio: 'SAO PAULO',
          uf: 'SP',
          precos_centavos: { Gasolina: 579 },
        },
        {
          id: 'p-empate-perto',
          nome: 'Posto Empate Perto',
          bandeira: 'BRANCA',
          latitude: -23.555, // ~0.5 km
          longitude: -46.6333,
          municipio: 'SAO PAULO',
          uf: 'SP',
          precos_centavos: { Gasolina: 579 },
        },
        {
          id: 'p-fora-raio',
          nome: 'Posto Muito Longe',
          bandeira: 'BR',
          latitude: -23.75, // > 20 km
          longitude: -46.6333,
          municipio: 'SAO PAULO',
          uf: 'SP',
          precos_centavos: { Gasolina: 499 },
        },
      ];

      const resultado = ordenarPostosPorPreco(postos, posicao, 'Gasolina', 5);
      assert.strictEqual(resultado.length, 3);
      assert.strictEqual(resultado[0].id, 'p-empate-perto');
      assert.strictEqual(resultado[1].id, 'p-empate-longe');
      assert.strictEqual(resultado[2].id, 'p-caro');
      assert.ok(resultado[0].distancia_km! < resultado[1].distancia_km!);
    });

    it('retorna lista vazia quando raioKm for zero ou quando não houver postos no raio', () => {
      const posicao = { latitude: -23.55052, longitude: -46.633308 };
      const postos: FuelStationRecord[] = [
        {
          id: 'p-1',
          nome: 'Posto Distante',
          bandeira: 'SHELL',
          latitude: -23.65, // ~11 km
          longitude: -46.6333,
          municipio: 'SAO PAULO',
          uf: 'SP',
          precos_centavos: { Gasolina: 569 },
        },
      ];

      assert.deepStrictEqual(ordenarPostosPorPreco(postos, posicao, 'Gasolina', 0), []);
      assert.deepStrictEqual(ordenarPostosPorPreco(postos, posicao, 'Gasolina', 5), []);
    });

    it('gera URL válida de rota para o app de mapas do aparelho e formata preço com formatarMoeda', () => {
      const url = montarUrlMapaRota(-23.55052, -46.633308, 'Posto Central');
      assert.ok(url.includes('-23.55052'));
      assert.ok(url.includes('-46.633308'));
      assert.strictEqual(formatarMoeda(5.79).replace(/\u00A0/g, ' '), 'R$ 5,79');
    });
  });

  describe('US34.3, US34.5 & US34.6: Permissão negada, busca por município e cache local da US17', () => {
    it('com permissão de localização negada, filtra por município e ordena somente por preço usando cache local', async () => {
      const db = DatabaseConnection.getInstance();
      await db.saveTableData('precos_combustivel', [
        {
          id: 'preco-sp-gas',
          municipio: 'SAO PAULO',
          uf: 'SP',
          combustivel: 'Gasolina',
          preco_centavos: 589,
          data_coleta: '2026-11-24',
          fonte: 'ANP',
          granularidade: 'municipal',
          sincronizado_em: '2026-11-25T10:00:00.000Z',
        },
      ]);
      await db.saveTableData('postos', [
        {
          id: 'p-sp-1',
          nome: 'Posto B',
          bandeira: 'SHELL',
          latitude: -23.56,
          longitude: -46.64,
          municipio: 'SAO PAULO',
          uf: 'SP',
          precos_centavos: { Gasolina: 599 },
        },
        {
          id: 'p-sp-2',
          nome: 'Posto A (Fallback Média US17)',
          bandeira: 'BRANCA',
          latitude: -23.57,
          longitude: -46.65,
          municipio: 'SAO PAULO',
          uf: 'SP',
        },
        {
          id: 'p-campinas',
          nome: 'Posto Campinas',
          bandeira: 'IPIRANGA',
          latitude: -22.9,
          longitude: -47.06,
          municipio: 'CAMPINAS',
          uf: 'SP',
          precos_centavos: { Gasolina: 549 },
        },
      ]);

      GPSService.setMockPermissionDenied(true);

      const res = await CheapestStationsService.buscarPostosMaisBaratos({
        combustivel: 'Gasolina',
        raioKm: 10,
        municipioFallback: 'São Paulo',
      });

      assert.strictEqual(res.permissaoNegada, true);
      assert.strictEqual(res.posicao, null);
      assert.strictEqual(res.postos.length, 2);
      // Posto A usa fallback do cache municipal US17 (589) < Posto B (599)
      assert.strictEqual(res.postos[0].id, 'p-sp-2');
      assert.strictEqual(res.postos[0].preco_centavos, 589);
      assert.strictEqual(res.postos[0].fonte_preco, 'media_municipal');
      assert.strictEqual(res.postos[0].distancia_km, null);
      assert.strictEqual(res.postos[1].id, 'p-sp-1');
      assert.strictEqual(res.postos[1].preco_centavos, 599);
    });

    it('US34.1: entidade postos está registrada em SyncEntityRegistry (somente leitura)', () => {
      const entities = SyncEntityRegistry.listRegisteredEntities();
      assert.ok(entities.includes('postos'));
    });
  });
});
