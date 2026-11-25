import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Refuel } from '@autogest/shared-types';
import {
  consumoPorCombustivel,
  compararVeiculos,
} from '../services/comparisonDomain';
import { ComparisonService } from '../services/comparisonService';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { FuelingService } from '../services/fuelingService';
import { DatabaseConnection } from '../database/DatabaseConnection';

describe('US28 — Comparativos entre Combustíveis e Veículos', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('local_despesas', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('custos_fixos', []);
    await db.saveTableData('locais_visitados', []);
    await db.saveTableData('perfis_conducao', []);
    await db.saveTableData('fila_sync', []);
  });

  describe('US28.1 & US28.5: consumoPorCombustivel', () => {
    it('compara combustíveis do mesmo veículo com massa conhecida e exclui combustíveis sem registros', () => {
      const abastecimentos: Partial<Refuel>[] = [
        // Gasolina: média 12,0 km/l, R$ 6,00/L -> custo/km = R$ 0,50
        {
          id: 'r1',
          vehicleId: 'v1',
          fuelType: 'Gasolina',
          date: '2026-11-01',
          liters: 40,
          totalValue: 240,
          pricePerLiter: 6.0,
          calculatedKml: 12.0,
        },
        // Etanol: média 8,0 km/l, R$ 4,00/L -> custo/km = R$ 0,50
        {
          id: 'r2',
          vehicleId: 'v1',
          fuelType: 'Etanol',
          date: '2026-11-10',
          liters: 40,
          totalValue: 160,
          pricePerLiter: 4.0,
          calculatedKml: 8.0,
        },
        // Outro veículo (não entra)
        {
          id: 'r3',
          vehicleId: 'v2',
          fuelType: 'Diesel',
          date: '2026-11-12',
          liters: 50,
          totalValue: 300,
          pricePerLiter: 6.0,
          calculatedKml: 15.0,
        },
      ];

      const res = consumoPorCombustivel(abastecimentos as Refuel[], 'v1');
      assert.strictEqual(res.length, 2);

      const gas = res.find(i => i.combustivel === 'Gasolina');
      const eta = res.find(i => i.combustivel === 'Etanol');
      const diesel = res.find(i => i.combustivel === 'Diesel');

      assert.ok(gas);
      assert.strictEqual(gas.mediaKml, 12);
      assert.strictEqual(gas.custoPorKm, 0.5);

      assert.ok(eta);
      assert.strictEqual(eta.mediaKml, 8);
      assert.strictEqual(eta.custoPorKm, 0.5);

      // Combustível sem registros (Diesel / GNV) fica de fora
      assert.strictEqual(diesel, undefined);
    });

    it('período vazio retorna lista vazia', () => {
      const res = consumoPorCombustivel([], 'v1');
      assert.deepStrictEqual(res, []);
    });
  });

  describe('US28.1 & US28.5: compararVeiculos', () => {
    it('compara múltiplos veículos e exibe "--" (sem zero) quando veículo não tem km rodados', () => {
      const res = compararVeiculos([
        {
          veiculoId: 'v1',
          nome: 'Honda Civic',
          placa: 'ABC1D23',
          consumoMedioKml: 12.5,
          kmRodados: 1000,
          custoTotal: 600,
          custoPorKm: 0.6,
        },
        {
          veiculoId: 'v2',
          nome: 'VW Polo',
          placa: 'XYZ9K88',
          consumoMedioKml: null,
          kmRodados: 0,
          custoTotal: 0,
          custoPorKm: null,
        },
      ]);

      assert.strictEqual(res.length, 2);
      const civic = res.find(v => v.veiculoId === 'v1');
      const polo = res.find(v => v.veiculoId === 'v2');

      assert.strictEqual(civic?.custoPorKm, 0.6);
      assert.ok(civic?.custoPorKmFormatado.includes('0,60'));

      // Veículo sem km mostra "--" (nunca R$ 0,00)
      assert.strictEqual(polo?.custoPorKm, null);
      assert.strictEqual(polo?.custoPorKmFormatado, '--');
      assert.strictEqual(polo?.consumoFormatado, '--');
    });

    it('US28.4: ComparisonService usa período padrão de 90 dias e reutiliza funções da US24', async () => {
      const v1 = await VehicleRepository.create({
        plate: 'CMP1A11',
        brand: 'Honda',
        model: 'Civic',
        year: 2022,
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });
      const v2 = await VehicleRepository.create({
        plate: 'CMP2B22',
        brand: 'Fiat',
        model: 'Argo',
        year: 2023,
        tankCapacityL: 48,
        preferredFuel: 'Flex',
        initialOdometer: 5000,
      });

      const hoje = new Date('2026-11-25T12:00:00.000Z');
      await FuelingService.createRefuel(
        {
          vehicleId: v1.id,
          date: '2026-11-01T10:00:00.000Z',
          odometer: 10000,
          fuelType: 'Gasolina',
          pricePerLiter: 6.0,
          totalValue: 240,
          liters: 40,
          isFullTank: true,
        },
        null,
      );
      await FuelingService.createRefuel(
        {
          vehicleId: v1.id,
          date: '2026-11-20T10:00:00.000Z',
          odometer: 10500,
          fuelType: 'Gasolina',
          pricePerLiter: 6.0,
          totalValue: 240,
          liters: 40,
          isFullTank: true,
        },
        null,
      );

      const comparativo = await ComparisonService.compararVeiculosDaFrota('ultimos_90_dias', hoje);
      assert.strictEqual(comparativo.itens.length, 2);
      const argo = comparativo.itens.find(i => i.veiculoId === v2.id);
      assert.strictEqual(argo?.custoPorKmFormatado, '--');
    });
  });
});
