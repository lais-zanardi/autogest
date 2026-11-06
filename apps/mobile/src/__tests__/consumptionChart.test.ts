import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mediaMovel,
  agruparConsumoPorPeriodo,
  gerarPontosGraficoConsumo,
} from '../services/consumptionHistoryService';
import { Refuel } from '@autogest/shared-types';

describe('US25 — Gráfico de Consumo e Média Móvel', () => {
  describe('US25.1 & US25.5 — Cálculo de Média Móvel', () => {
    it('(BDD US25) Dado consumos de 10, 11, 12, 13 e 14 km/l, a média móvel dos últimos cinco é exatamente 12,0 km/l', () => {
      const valores = [10, 11, 12, 13, 14];
      const resultado = mediaMovel(valores, 5);
      // (10 + 11 + 12 + 13 + 14) / 5 = 60 / 5 = 12
      assert.equal(resultado.length, 5);
      assert.equal(resultado[4], 12.0);
    });

    it('com menos de 5 pontos, deve calcular a média móvel com os pontos disponíveis até aquele instante', () => {
      const valores = [10, 12, 14];
      const resultado = mediaMovel(valores, 5);
      assert.equal(resultado.length, 3);
      // Ponto 0: 10 / 1 = 10
      assert.equal(resultado[0], 10.0);
      // Ponto 1: (10 + 12) / 2 = 11
      assert.equal(resultado[1], 11.0);
      // Ponto 2: (10 + 12 + 14) / 3 = 12
      assert.equal(resultado[2], 12.0);
    });

    it('deve lidar corretamente com série vazia ou com um único ponto', () => {
      assert.deepEqual(mediaMovel([], 5), []);
      assert.deepEqual(mediaMovel([15.5], 5), [15.5]);
    });

    it('ao ultrapassar 5 pontos, a média móvel deve considerar estritamente a janela deslizante dos últimos 5', () => {
      // 10, 11, 12, 13, 14 -> mm = 12
      // novo valor 19 -> janela [11, 12, 13, 14, 19] -> soma 69 / 5 = 13.8
      const valores = [10, 11, 12, 13, 14, 19];
      const resultado = mediaMovel(valores, 5);
      assert.equal(resultado.length, 6);
      assert.equal(resultado[4], 12.0);
      assert.equal(resultado[5], 13.8);
    });
  });

  describe('US25.1, US25.3 & US25.5 — Agrupamento por Granularidade (Diária, Semanal ISO e Mensal)', () => {
    const criarRefuelMock = (
      date: string,
      calculatedKml: number | null,
      id = Math.random().toString(),
    ): Refuel => ({
      id,
      vehicleId: 'veh_test',
      date,
      odometer: 10000,
      fuelType: 'Gasolina',
      pricePerLiter: 5.5,
      totalValue: 200,
      liters: 36.36,
      isFullTank: true,
      calculatedKml,
      createdAt: date,
    });

    it('deve agrupar por Dia (mesmo dia calcula a média aritmética do consumo ponderado ou simples)', () => {
      const abastecimentos: Refuel[] = [
        criarRefuelMock('2026-03-10T08:00:00.000Z', 10.0),
        criarRefuelMock('2026-03-10T18:00:00.000Z', 12.0),
        criarRefuelMock('2026-03-11T10:00:00.000Z', 14.0),
      ];

      const grupos = agruparConsumoPorPeriodo(abastecimentos, 'diaria');
      assert.equal(grupos.length, 2);
      assert.equal(grupos[0].chave, '2026-03-10');
      assert.equal(grupos[0].consumoMedioKml, 11.0); // (10 + 12) / 2
      assert.equal(grupos[1].chave, '2026-03-11');
      assert.equal(grupos[1].consumoMedioKml, 14.0);
    });

    it('deve agrupar por Semana ISO (começando na segunda-feira e terminando no domingo)', () => {
      // 2026-11-02 é uma segunda-feira (Semana W45)
      // 2026-11-08 é domingo da mesma semana
      // 2026-11-09 é a segunda-feira seguinte (Semana W46)
      const abastecimentos: Refuel[] = [
        criarRefuelMock('2026-11-02T10:00:00.000Z', 10.0),
        criarRefuelMock('2026-11-08T22:00:00.000Z', 12.0),
        criarRefuelMock('2026-11-09T08:00:00.000Z', 15.0),
      ];

      const grupos = agruparConsumoPorPeriodo(abastecimentos, 'semanal');
      assert.equal(grupos.length, 2);
      assert.match(grupos[0].chave, /2026-W45/);
      assert.equal(grupos[0].consumoMedioKml, 11.0);
      assert.match(grupos[1].chave, /2026-W46/);
      assert.equal(grupos[1].consumoMedioKml, 15.0);
    });

    it('deve agrupar por Mês e suportar virada de ano corretamente', () => {
      const abastecimentos: Refuel[] = [
        criarRefuelMock('2025-12-28T10:00:00.000Z', 11.0),
        criarRefuelMock('2025-12-31T15:00:00.000Z', 13.0),
        criarRefuelMock('2026-01-02T10:00:00.000Z', 16.0),
      ];

      const grupos = agruparConsumoPorPeriodo(abastecimentos, 'mensal');
      assert.equal(grupos.length, 2);
      assert.equal(grupos[0].chave, '2025-12');
      assert.equal(grupos[0].consumoMedioKml, 12.0); // (11 + 13) / 2
      assert.equal(grupos[1].chave, '2026-01');
      assert.equal(grupos[1].consumoMedioKml, 16.0);
    });

    it('deve ignorar abastecimentos sem consumo apurado (null, 0 ou negativo)', () => {
      const abastecimentos: Refuel[] = [
        criarRefuelMock('2026-05-01T10:00:00.000Z', null),
        criarRefuelMock('2026-05-01T15:00:00.000Z', 0),
        criarRefuelMock('2026-05-01T20:00:00.000Z', 12.5),
      ];

      const grupos = agruparConsumoPorPeriodo(abastecimentos, 'diaria');
      assert.equal(grupos.length, 1);
      assert.equal(grupos[0].consumoMedioKml, 12.5);
    });

    it('deve limitar a janela padrão de exibição (30 dias, 12 semanas, 12 meses)', () => {
      // Cria 40 dias seguidos de abastecimentos
      const abastecimentos: Refuel[] = [];
      const baseDate = new Date('2026-01-01T00:00:00.000Z');
      for (let i = 0; i < 40; i++) {
        const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
        abastecimentos.push(criarRefuelMock(d.toISOString(), 10 + (i % 5)));
      }

      const pontosDiarios = gerarPontosGraficoConsumo(abastecimentos, 'diaria');
      // Janela padrão de 30 pontos
      assert.equal(pontosDiarios.length, 30);
      assert.equal(pontosDiarios[pontosDiarios.length - 1].label.length > 0, true);
    });
  });

  describe('US25.4 — Formatação de Tooltip e Integração com formatarConsumo', () => {
    it('deve gerar pontos formatados com formatarConsumo tanto para o valor pontual quanto para a média móvel', () => {
      const abastecimentos = [
        {
          id: '1',
          vehicleId: 'v1',
          date: '2026-06-01T10:00:00.000Z',
          odometer: 1000,
          fuelType: 'Gasolina' as const,
          pricePerLiter: 5,
          totalValue: 100,
          liters: 20,
          isFullTank: true,
          calculatedKml: 12.5,
          createdAt: '2026-06-01T10:00:00.000Z',
        },
      ];

      const pontos = gerarPontosGraficoConsumo(abastecimentos, 'diaria');
      assert.equal(pontos.length, 1);
      assert.equal(pontos[0].value, 12.5);
      assert.equal(pontos[0].formattedValue, '12,5 km/l (8,0 L/100 km)');
      assert.equal(pontos[0].formattedMovingAverage, '12,5 km/l (8,0 L/100 km)');
    });
  });
});
