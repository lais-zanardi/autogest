import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Refuel } from '@autogest/shared-types';
import {
  correlacaoPerfilConsumo,
  PERFIS_CONDUCAO_OPCOES,
} from '../services/drivingProfileDomain';
import { DrivingProfileService } from '../services/drivingProfileService';
import { FuelingService } from '../services/fuelingService';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';

describe('US29 — Perfil de Condução e Correlação com Consumo', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('perfis_conducao', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('locais_visitados', []);
    await db.saveTableData('fila_sync', []);
  });

  describe('US29.2 & US29.5: Função pura correlacaoPerfilConsumo', () => {
    it('agrupa consumo médio por perfil e trata perfil sem registros sem NaN', () => {
      const registros: Partial<Refuel>[] = [
        { id: 'r1', calculatedKml: 14.0, perfil_conducao: 'economico' },
        { id: 'r2', calculatedKml: 16.0, perfil_conducao: 'economico' },
        { id: 'r3', calculatedKml: 11.5, perfil_conducao: 'normal' },
        // nenhum registro 'agressivo'
      ];

      const res = correlacaoPerfilConsumo(registros as Refuel[]);
      assert.strictEqual(res.totalRegistrosComConsumo, 3);
      assert.strictEqual(res.dadosSuficientes, true);

      const eco = res.itens.find(i => i.perfil === 'economico');
      const norm = res.itens.find(i => i.perfil === 'normal');
      const agr = res.itens.find(i => i.perfil === 'agressivo');

      assert.strictEqual(eco?.mediaKml, 15);
      assert.strictEqual(eco?.totalAbastecimentos, 2);
      assert.strictEqual(norm?.mediaKml, 11.5);
      assert.strictEqual(norm?.totalAbastecimentos, 1);
      assert.strictEqual(agr?.mediaKml, null);
      assert.strictEqual(agr?.totalAbastecimentos, 0);
      assert.strictEqual(PERFIS_CONDUCAO_OPCOES.length, 3);
    });

    it('sinaliza dadosSuficientes=false quando houver poucos registros com consumo', () => {
      const res = correlacaoPerfilConsumo([
        { id: 'r1', calculatedKml: 12.0, perfil_conducao: 'normal' } as Refuel,
      ]);
      assert.strictEqual(res.dadosSuficientes, false);
    });
  });

  describe('US29.1, US29.3 & US29.5: Alteração de perfil não reescreve histórico', () => {
    it('alterar o perfil do veículo mantém o perfil original dos abastecimentos anteriores', async () => {
      const veiculo = await VehicleRepository.create({
        plate: 'PRF1A23',
        brand: 'Honda',
        model: 'City',
        year: 2023,
        tankCapacityL: 44,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });

      // Define perfil econômico e registra dois abastecimentos
      await DrivingProfileService.definirPerfil(veiculo.id, 'economico');
      const r1 = await FuelingService.createRefuel(
        {
          vehicleId: veiculo.id,
          date: '2026-11-01T10:00:00.000Z',
          odometer: 10000,
          fuelType: 'Gasolina',
          pricePerLiter: 5.8,
          totalValue: 232,
          liters: 40,
          isFullTank: true,
        },
        null,
      );
      const r2 = await FuelingService.createRefuel(
        {
          vehicleId: veiculo.id,
          date: '2026-11-10T10:00:00.000Z',
          odometer: 10600,
          fuelType: 'Gasolina',
          pricePerLiter: 5.8,
          totalValue: 232,
          liters: 40,
          isFullTank: true,
        },
        null,
      );

      // Altera o perfil atual para agressivo
      await DrivingProfileService.definirPerfil(veiculo.id, 'agressivo');
      const perfilAtual = await DrivingProfileService.obterPerfilAtual(veiculo.id);
      assert.strictEqual(perfilAtual, 'agressivo');

      // Registra novo abastecimento no perfil agressivo
      const r3 = await FuelingService.createRefuel(
        {
          vehicleId: veiculo.id,
          date: '2026-11-20T10:00:00.000Z',
          odometer: 11000,
          fuelType: 'Gasolina',
          pricePerLiter: 5.8,
          totalValue: 232,
          liters: 40,
          isFullTank: true,
        },
        null,
      );

      // Verifica que os abastecimentos anteriores NÃO tiveram o perfil reescrito
      const r1Salvo = await RefuelRepository.findById(r1.id);
      const r2Salvo = await RefuelRepository.findById(r2.id);
      const r3Salvo = await RefuelRepository.findById(r3.id);

      assert.strictEqual(r1Salvo?.perfil_conducao, 'economico');
      assert.strictEqual(r2Salvo?.perfil_conducao, 'economico');
      assert.strictEqual(r3Salvo?.perfil_conducao, 'agressivo');
    });

    it('US29.1: perfis_conducao está registrada em SyncEntityRegistry', () => {
      const entities = SyncEntityRegistry.listRegisteredEntities();
      assert.ok(entities.includes('perfis_conducao'));
    });
  });
});
