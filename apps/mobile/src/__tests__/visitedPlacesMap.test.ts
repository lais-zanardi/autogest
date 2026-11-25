import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { VisitedPlaceRecord } from '@autogest/shared-types';
import {
  agruparLocaisVisitados,
  LEGENDA_MAPA_LOCAIS,
  MENSAGEM_MAPA_VAZIO,
} from '../services/visitedPlacesDomain';
import { VisitedPlacesService } from '../services/visitedPlacesService';
import { FuelingService } from '../services/fuelingService';
import { MaintenanceService } from '../services/maintenanceService';
import { WorkshopService } from '../services/workshopService';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';

describe('US36 — Mapa de Postos e Oficinas Visitados', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('locais_visitados', []);
    await db.saveTableData('oficinas', []);
    await db.saveTableData('atendimentos_oficina', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('local_manutencoes', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('fila_sync', []);
  });

  describe('US36.2 & US36.5: Função pura agruparLocaisVisitados e legenda acessível', () => {
    it('agrupa registros do mesmo tipo dentro de 50 m, conta visitas e mantém última data', () => {
      // 0,00025 graus de latitude ≈ 28 metros (<= 50 m)
      // 0,0015 graus de latitude ≈ 167 metros (> 50 m)
      const locais: VisitedPlaceRecord[] = [
        {
          id: 'l1',
          tipo: 'posto',
          referencia_id: 'r1',
          nome: 'Posto Paulista',
          latitude: -23.5614,
          longitude: -46.6558,
          data: '2026-11-10',
          criado_em: '2026-11-10T10:00:00Z',
          atualizado_em: '2026-11-10T10:00:00Z',
        },
        {
          id: 'l2',
          tipo: 'posto',
          referencia_id: 'r2',
          nome: 'Posto Paulista',
          latitude: -23.56165, // ~28 m de distância
          longitude: -46.6558,
          data: '2026-11-24',
          criado_em: '2026-11-24T10:00:00Z',
          atualizado_em: '2026-11-24T10:00:00Z',
        },
        {
          id: 'l3',
          tipo: 'posto',
          referencia_id: 'r3',
          nome: 'Posto Consolação',
          latitude: -23.563, // ~178 m de distância (> 50 m)
          longitude: -46.6558,
          data: '2026-11-20',
          criado_em: '2026-11-20T10:00:00Z',
          atualizado_em: '2026-11-20T10:00:00Z',
        },
        {
          id: 'l4',
          tipo: 'oficina',
          referencia_id: 'm1',
          nome: 'Oficina Paulista',
          latitude: -23.5614, // mesma coordenada mas tipo diferente
          longitude: -46.6558,
          data: '2026-11-18',
          criado_em: '2026-11-18T10:00:00Z',
          atualizado_em: '2026-11-18T10:00:00Z',
        },
      ];

      const agrupados = agruparLocaisVisitados(locais);
      assert.strictEqual(agrupados.length, 3);

      const paulista = agrupados.find(g => g.nome === 'Posto Paulista');
      assert.ok(paulista);
      assert.strictEqual(paulista.visitas, 2);
      assert.strictEqual(paulista.ultimaData, '2026-11-24');

      const oficina = agrupados.find(g => g.tipo === 'oficina');
      assert.ok(oficina);
      assert.strictEqual(oficina.visitas, 1);
    });

    it('ignora registros sem coordenadas válidas no agrupamento', () => {
      const locaisInvalidos: any[] = [
        {
          id: 'inv-1',
          tipo: 'posto',
          referencia_id: 'r1',
          nome: 'Sem GPS',
          latitude: null,
          longitude: null,
          data: '2026-11-20',
        },
      ];
      assert.deepStrictEqual(agruparLocaisVisitados(locaisInvalidos), []);
    });

    it('US36.3, US36.4 & US36.5: legenda usa cores E ícones distintos e estado vazio tem texto exato', () => {
      assert.notStrictEqual(LEGENDA_MAPA_LOCAIS.posto.cor, LEGENDA_MAPA_LOCAIS.oficina.cor);
      assert.notStrictEqual(LEGENDA_MAPA_LOCAIS.posto.icone, LEGENDA_MAPA_LOCAIS.oficina.icone);
      assert.strictEqual(
        MENSAGEM_MAPA_VAZIO,
        'Registre um abastecimento ou manutenção com localização para ver seus locais aqui.',
      );
    });
  });

  describe('US36.1 & US36.5: Preenchimento automático em abastecimento/manutenção e filtro sem coordenadas', () => {
    it('abastecimento sem coordenadas NÃO entra no mapa; com coordenadas entra como posto', async () => {
      const veiculo = await VehicleRepository.create({
        plate: 'MAP1A23',
        brand: 'VW',
        model: 'Polo',
        year: 2023,
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 5000,
      });

      // Sem coordenadas -> não entra em locais_visitados
      await FuelingService.createRefuel(
        {
          vehicleId: veiculo.id,
          date: '2026-11-10T10:00:00.000Z',
          odometer: 5400,
          fuelType: 'Gasolina',
          pricePerLiter: 5.8,
          totalValue: 232,
          liters: 40,
          isFullTank: true,
          stationName: 'Posto Sem GPS',
        },
        null,
      );

      let agrupados = await VisitedPlacesService.listarLocaisAgrupados();
      assert.strictEqual(agrupados.length, 0);

      // Com coordenadas -> entra no mapa como posto
      await FuelingService.createRefuel(
        {
          vehicleId: veiculo.id,
          date: '2026-11-20T10:00:00.000Z',
          odometer: 5800,
          fuelType: 'Gasolina',
          pricePerLiter: 5.75,
          totalValue: 230,
          liters: 40,
          isFullTank: true,
          stationName: 'Posto Avenida',
        },
        { latitude: -23.55052, longitude: -46.633308 },
      );

      agrupados = await VisitedPlacesService.listarLocaisAgrupados();
      assert.strictEqual(agrupados.length, 1);
      assert.strictEqual(agrupados[0].tipo, 'posto');
      assert.strictEqual(agrupados[0].nome, 'Posto Avenida');
    });

    it('manutenção vinculada a oficina com coordenadas entra no mapa como oficina', async () => {
      const veiculo = await VehicleRepository.create({
        plate: 'MAP2B34',
        brand: 'Fiat',
        model: 'Pulse',
        year: 2024,
        tankCapacityL: 47,
        preferredFuel: 'Flex',
        initialOdometer: 1000,
      });

      const oficina = await WorkshopService.criarOficina({
        nome: 'Auto Mecânica Centro',
        latitude: -23.555,
        longitude: -46.64,
      });

      await MaintenanceService.createMaintenance({
        vehicleId: veiculo.id,
        date: '2026-11-22',
        odometer: 1500,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Revisão 1.500 km',
        workshopId: oficina.id,
        totalValue: 350,
      });

      const agrupados = await VisitedPlacesService.listarLocaisAgrupados();
      assert.strictEqual(agrupados.length, 1);
      assert.strictEqual(agrupados[0].tipo, 'oficina');
      assert.strictEqual(agrupados[0].nome, 'Auto Mecânica Centro');
    });

    it('US36.1: locais_visitados está registrado em SyncEntityRegistry', () => {
      const entities = SyncEntityRegistry.listRegisteredEntities();
      assert.ok(entities.includes('locais_visitados'));
    });
  });
});
