import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularDepreciacao } from '../services/fipeDepreciation';
import { FipeConsultation } from '@autogest/shared-types';

describe('US18.7 & US18.8 — Domínio: Cálculo de Depreciação da Tabela FIPE', () => {
  it('retorna nulo se houver menos de 2 consultas no histórico', () => {
    assert.strictEqual(calcularDepreciacao([]), null);

    const unicaConsulta: FipeConsultation[] = [
      {
        id: 'c1',
        vehicleId: 'v1',
        fipeCode: '005490-9',
        brand: 'VW',
        model: 'Gol',
        modelYear: 2019,
        fuel: 'Gasolina',
        referenceMonth: '2026-05',
        valueCentavos: 5_000_000,
        consultedAt: '2026-05-10T10:00:00Z',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:00:00Z',
      },
    ];

    assert.strictEqual(calcularDepreciacao(unicaConsulta), null);
  });

  it('US18.8 BDD: R$ 50.000 (5.000.000 centavos) para R$ 45.000 (4.500.000 centavos) resulta em variação de -R$ 5.000 e -10%', () => {
    const consultas: FipeConsultation[] = [
      {
        id: 'c1',
        vehicleId: 'v1',
        fipeCode: '005490-9',
        brand: 'VW',
        model: 'Gol',
        modelYear: 2019,
        fuel: 'Gasolina',
        referenceMonth: '2026-01',
        valueCentavos: 5_000_000, // R$ 50.000,00
        consultedAt: '2026-01-15T10:00:00Z',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-15T10:00:00Z',
      },
      {
        id: 'c2',
        vehicleId: 'v1',
        fipeCode: '005490-9',
        brand: 'VW',
        model: 'Gol',
        modelYear: 2019,
        fuel: 'Gasolina',
        referenceMonth: '2026-03',
        valueCentavos: 4_500_000, // R$ 45.000,00
        consultedAt: '2026-03-15T10:00:00Z',
        createdAt: '2026-03-15T10:00:00Z',
        updatedAt: '2026-03-15T10:00:00Z',
      },
    ];

    const resultado = calcularDepreciacao(consultas);
    assert.ok(resultado);
    assert.strictEqual(resultado.valorInicialCentavos, 5_000_000);
    assert.strictEqual(resultado.valorAtualCentavos, 4_500_000);
    assert.strictEqual(resultado.variacaoReais, -5000);
    assert.strictEqual(resultado.variacaoPercentual, -10.0);
    // Intervalo de 59 dias (< 90 dias): variacaoAnualizadaPercentual deve ser null
    assert.strictEqual(resultado.variacaoAnualizadaPercentual, null);
  });

  it('calcula percentual anualizado quando intervalo entre consultas for de pelo menos 90 dias', () => {
    const consultas: FipeConsultation[] = [
      {
        id: 'c1',
        vehicleId: 'v1',
        fipeCode: '005490-9',
        brand: 'VW',
        model: 'Gol',
        modelYear: 2019,
        fuel: 'Gasolina',
        referenceMonth: '2026-01',
        valueCentavos: 10_000_000, // R$ 100.000,00
        consultedAt: '2026-01-01T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c2',
        vehicleId: 'v1',
        fipeCode: '005490-9',
        brand: 'VW',
        model: 'Gol',
        modelYear: 2019,
        fuel: 'Gasolina',
        referenceMonth: '2026-07',
        valueCentavos: 9_000_000, // R$ 90.000,00 (-10% em aprox 181 dias)
        consultedAt: '2026-07-01T00:00:00Z',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ];

    const resultado = calcularDepreciacao(consultas);
    assert.ok(resultado);
    assert.strictEqual(resultado.diasDecorridos >= 90, true);
    assert.ok(resultado.variacaoAnualizadaPercentual !== null);
    // Em ~181 dias caiu 10%, anualizado em 365 dias fica em torno de -20%
    assert.ok(resultado.variacaoAnualizadaPercentual < -15 && resultado.variacaoAnualizadaPercentual > -25);
  });
});
