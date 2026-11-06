import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../database/DatabaseConnection';
import { resumoDaViagem, validarFinalizacaoViagem } from '../services/tripCalculations';
import { TripService } from '../services/tripService';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { Trip, Refuel, Expense, Vehicle } from '@autogest/shared-types';

describe('US07 — Modo Viagem com Origem e Destino', () => {
  beforeEach(async () => {
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('local_despesas', []);
    await db.saveTableData('viagens', []);
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('leituras_hodometro', []);
  });

  describe('US07.5 & US07.7 — resumoDaViagem (Critério BDD com valores exatos)', () => {
    // US07.7 [Teste]: 500 km, 40 L (12,5 km/l), combustível de R$ 240, pedágios de R$ 50 e alimentação de R$ 60
    // resultam em custo total de R$ 350 e custo/km de R$ 0,70.
    test('calcula resumo com valores exatos do backlog: 500 km, 40L, R$ 240 comb, R$ 50 pedágio, R$ 60 alimentação', () => {
      const viagem: Trip = {
        id: 'trip-1',
        vehicleId: 'veh-1',
        origin: 'São Paulo',
        destination: 'Rio de Janeiro',
        startDate: '2026-05-01T08:00:00.000Z',
        endDate: '2026-05-01T16:00:00.000Z',
        startOdometer: 10000,
        endOdometer: 10500, // 500 km percorridos
        status: 'finalizada',
        createdAt: '2026-05-01T08:00:00.000Z',
      };

      const abastecimentos: Refuel[] = [
        {
          id: 'ref-1',
          vehicleId: 'veh-1',
          date: '2026-05-01T12:00:00.000Z',
          odometer: 10300,
          fuelType: 'Gasolina',
          pricePerLiter: 6.0,
          totalValue: 240,
          liters: 40,
          isFullTank: true,
          tripId: 'trip-1',
          createdAt: '2026-05-01T12:00:00.000Z',
        },
      ];

      const despesas: Expense[] = [
        {
          id: 'exp-1',
          vehicleId: 'veh-1',
          date: '2026-05-01T10:00:00.000Z',
          category: 'Outros',
          subtipoViagem: 'pedagio',
          amount: 50,
          description: 'Pedágio Dutra',
          tripId: 'trip-1',
          createdAt: '2026-05-01T10:00:00.000Z',
        },
        {
          id: 'exp-2',
          vehicleId: 'veh-1',
          date: '2026-05-01T13:00:00.000Z',
          category: 'Outros',
          subtipoViagem: 'alimentacao',
          amount: 60,
          description: 'Almoço no Graal',
          tripId: 'trip-1',
          createdAt: '2026-05-01T13:00:00.000Z',
        },
      ];

      const resumo = resumoDaViagem(viagem, abastecimentos, despesas);

      assert.strictEqual(resumo.distanciaKm, 500);
      assert.strictEqual(resumo.totalLitros, 40);
      assert.strictEqual(resumo.rendimentoKml, 12.5); // 500 / 40 = 12.5 km/l
      assert.strictEqual(resumo.custoCombustivel, 240);
      assert.strictEqual(resumo.custoTotal, 350); // 240 + 50 + 60 = 350
      assert.strictEqual(resumo.custoPorKm, 0.7); // 350 / 500 = 0.70
      assert.strictEqual(resumo.custoPorSubtipo.pedagio, 50);
      assert.strictEqual(resumo.custoPorSubtipo.alimentacao, 60);
    });

    test('sem km final ou viagem em andamento, não calcula rendimento (retorna null)', () => {
      const viagemEmAndamento: Trip = {
        id: 'trip-2',
        vehicleId: 'veh-1',
        origin: 'Curitiba',
        destination: 'Florianópolis',
        startDate: '2026-05-02T08:00:00.000Z',
        startOdometer: 10500,
        endOdometer: null,
        status: 'em_andamento',
        createdAt: '2026-05-02T08:00:00.000Z',
      };

      const resumo = resumoDaViagem(viagemEmAndamento, [], []);
      assert.strictEqual(resumo.distanciaKm, null);
      assert.strictEqual(resumo.rendimentoKml, null);
      assert.strictEqual(resumo.custoPorKm, null);
      assert.strictEqual(resumo.custoTotal, 0);
    });
  });

  describe('US07.2 & US07.4 — Ciclo de vida e regras de negócio da viagem', () => {
    test('permite apenas uma viagem em andamento por veículo', async () => {
      const v: Vehicle = {
        id: 'veh-1',
        userId: 'user-1',
        model: 'Corolla',
        plate: 'BRA2E19',
        year: 2022,
        fuelType: 'Flex',
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
        currentOdometer: 10000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.insert('local_vehicles', v);

      // Inicia a primeira viagem
      const trip1 = await TripService.iniciarViagem({
        vehicleId: 'veh-1',
        origin: 'São Paulo',
        destination: 'Campinas',
        startOdometer: 10000,
      });
      assert.ok(trip1.id);
      assert.strictEqual(trip1.status, 'em_andamento');

      // Tenta iniciar uma segunda viagem com a primeira ainda ativa: deve rejeitar
      await assert.rejects(
        async () => {
          await TripService.iniciarViagem({
            vehicleId: 'veh-1',
            origin: 'Campinas',
            destination: 'Ribeirão Preto',
            startOdometer: 10100,
          });
        },
        /já possui uma viagem em andamento/i,
      );
    });

    test('finalização de viagem valida km final com validarNovoKm e atualiza hodômetro do veículo', async () => {
      const v: Vehicle = {
        id: 'veh-1',
        userId: 'user-1',
        model: 'Corolla',
        plate: 'BRA2E19',
        year: 2022,
        fuelType: 'Flex',
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
        currentOdometer: 10000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.insert('local_vehicles', v);

      const trip = await TripService.iniciarViagem({
        vehicleId: 'veh-1',
        origin: 'São Paulo',
        destination: 'Santos',
        startOdometer: 10000,
      });

      // Validação de km final inválido (menor ou igual ao inicial)
      const validacaoInvalida = validarFinalizacaoViagem(10000, 9900);
      assert.strictEqual(validacaoInvalida.isValid, false);
      assert.match(validacaoInvalida.error || '', /maior que/i);

      await assert.rejects(
        async () => {
          await TripService.finalizarViagem(trip.id, 9900);
        },
        /Quilometragem/i,
      );

      // Finalização válida
      const tripFinalizada = await TripService.finalizarViagem(trip.id, 10080);
      assert.strictEqual(tripFinalizada.status, 'finalizada');
      assert.strictEqual(tripFinalizada.endOdometer, 10080);

      // Deve ter atualizado o hodômetro atual do veículo
      const veiculoAtualizado = await VehicleRepository.findById('veh-1');
      assert.strictEqual(veiculoAtualizado?.currentOdometer, 10080);
    });

    test('vínculo automático: obtém a viagem em andamento para associar a abastecimentos e despesas', async () => {
      await TripService.iniciarViagem({
        vehicleId: 'veh-1',
        origin: 'Belo Horizonte',
        destination: 'Ouro Preto',
        startOdometer: 5000,
      });

      const ativa = await TripService.obterViagemAtiva('veh-1');
      assert.ok(ativa);
      assert.strictEqual(ativa?.destination, 'Ouro Preto');

      // Veículo sem viagem ativa retorna null
      const semViagem = await TripService.obterViagemAtiva('veh-2');
      assert.strictEqual(semViagem, null);
    });
  });
});
