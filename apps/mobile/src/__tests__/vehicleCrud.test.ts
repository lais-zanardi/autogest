import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { VehicleService } from '../services/vehicleService';
import { useAppStore } from '../store/useAppStore';
import { db } from '../database/DatabaseConnection';

describe('US04 - CRUD de Veículos e Exclusão Lógica em Cascata', () => {
  beforeEach(async () => {
    // Limpa banco local e estado global antes de cada teste
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('sync_queue', []);
    useAppStore.getState().logout();
  });

  it('US04.1 / US04.2: deve cadastrar múltiplos veículos com seus metadados completos', async () => {
    const v1 = await VehicleService.createVehicle({
      name: 'Carro Principal',
      brand: 'Honda',
      model: 'Civic Touring',
      year: 2020,
      plate: 'BRA2E19',
      fuelType: 'Gasolina',
      tankCapacityL: 56,
      preferredFuel: 'Gasolina',
      initialOdometer: 42000,
    });

    const v2 = await VehicleService.createVehicle({
      name: 'Carro de Trabalho',
      brand: 'Volkswagen',
      model: 'Gol 1.0',
      year: 2018,
      plate: 'ABC-1234',
      fuelType: 'Flex',
      tankCapacityL: 50,
      preferredFuel: 'Etanol',
      initialOdometer: 85000,
    });

    assert.ok(v1.id);
    assert.ok(v2.id);
    assert.equal(v1.plate, 'BRA2E19');
    assert.equal(v2.plate, 'ABC1234');
    assert.equal(v1.tankCapacityL, 56);
    assert.equal(v2.preferredFuel, 'Etanol');

    const list = await VehicleService.listVehicles();
    assert.equal(list.length, 2);
  });

  it('US04.5: com um único veículo cadastrado, ele já vem selecionado automaticamente no estado global', async () => {
    // Garante estado inicial vazio
    assert.equal(useAppStore.getState().selectedVehicle, null);

    const vehicle = await VehicleService.createVehicle({
      name: 'Meu Carro',
      brand: 'Toyota',
      model: 'Corolla Altis',
      year: 2022,
      plate: 'XYZ9K88',
      fuelType: 'Flex',
      tankCapacityL: 50,
      preferredFuel: 'Gasolina',
      initialOdometer: 15000,
    });

    const activeVehicle = useAppStore.getState().selectedVehicle;
    assert.ok(activeVehicle);
    assert.equal(activeVehicle?.id, vehicle.id);
    assert.equal(activeVehicle?.model, 'Corolla Altis');
  });

  it('US04.5: com múltiplos veículos, permite alternar o veículo ativo e todas as telas filtram por ele', async () => {
    const v1 = await VehicleService.createVehicle({
      brand: 'Honda',
      model: 'Civic',
      year: 2020,
      plate: 'BRA2E19',
      fuelType: 'Gasolina',
      tankCapacityL: 56,
      preferredFuel: 'Gasolina',
      initialOdometer: 40000,
    });

    const v2 = await VehicleService.createVehicle({
      brand: 'Volkswagen',
      model: 'Gol',
      year: 2018,
      plate: 'ABC1234',
      fuelType: 'Flex',
      tankCapacityL: 50,
      preferredFuel: 'Etanol',
      initialOdometer: 80000,
    });

    // Inicialmente v1 é selecionado
    assert.equal(useAppStore.getState().selectedVehicle?.id, v1.id);

    // Alterna para v2
    VehicleService.selectVehicle(v2.id);
    assert.equal(useAppStore.getState().selectedVehicle?.id, v2.id);
  });

  it('US04.2: deve editar os metadados de um veículo existente', async () => {
    const created = await VehicleService.createVehicle({
      brand: 'Fiat',
      model: 'Uno',
      year: 2015,
      plate: 'UNO1A23',
      fuelType: 'Flex',
      tankCapacityL: 48,
      preferredFuel: 'Gasolina',
      initialOdometer: 90000,
    });

    const updated = await VehicleService.updateVehicle(created.id, {
      model: 'Uno Way 1.4',
      tankCapacityL: 50,
      preferredFuel: 'Etanol',
    });

    assert.equal(updated.model, 'Uno Way 1.4');
    assert.equal(updated.tankCapacityL, 50);
    assert.equal(updated.preferredFuel, 'Etanol');

    const inDb = await VehicleRepository.findById(created.id);
    assert.equal(inDb?.model, 'Uno Way 1.4');
  });

  it('US04.6: exclusão lógica marca timestamp e oculta o veículo da lista ativa', async () => {
    const vehicle = await VehicleService.createVehicle({
      brand: 'Ford',
      model: 'Ka',
      year: 2019,
      plate: 'KAA9999',
      fuelType: 'Flex',
      tankCapacityL: 51,
      preferredFuel: 'Gasolina',
      initialOdometer: 30000,
    });

    const success = await VehicleService.deleteVehicle(vehicle.id);
    assert.equal(success, true);

    // Na lista de veículos ativos, não deve mais aparecer
    const activeVehicles = await VehicleService.listVehicles();
    assert.equal(
      activeVehicles.some(v => v.id === vehicle.id),
      false,
    );

    // No banco de dados, o registro persiste com deletedAt / excluido_em preenchido
    const rawAll = await db.getTableData<any>('local_vehicles');
    const softDeleted = rawAll.find(v => v.id === vehicle.id);
    assert.ok(softDeleted);
    assert.ok(softDeleted.deletedAt || softDeleted.excluido_em);
  });

  it('US04.6: exclusão em cascata oculta os registros vinculados ao veículo excluído', async () => {
    const vehicle = await VehicleService.createVehicle({
      brand: 'Chevrolet',
      model: 'Onix',
      year: 2021,
      plate: 'ONX1000',
      fuelType: 'Flex',
      tankCapacityL: 44,
      preferredFuel: 'Gasolina',
      initialOdometer: 10000,
    });

    // Cria abastecimento vinculado a este veículo
    const refuel = await RefuelRepository.create({
      vehicleId: vehicle.id,
      date: new Date().toISOString(),
      odometer: 10400,
      fuelType: 'Gasolina',
      pricePerLiter: 5.89,
      totalValue: 200,
      liters: 33.95,
      isFullTank: true,
    });

    // Antes da exclusão, o abastecimento aparece para o veículo
    const beforeList = await RefuelRepository.listByVehicle(vehicle.id);
    assert.equal(beforeList.length, 1);
    assert.equal(beforeList[0].id, refuel.id);

    // Executa a exclusão lógica em cascata
    await VehicleService.deleteVehicle(vehicle.id);

    // Após a exclusão, os registros vinculados ficam ocultos
    const afterList = await RefuelRepository.listByVehicle(vehicle.id);
    assert.equal(afterList.length, 0);

    // O registro bruto ainda existe com marcação de exclusão
    const rawRefuels = await db.getTableData<any>('local_refuels');
    const rawRefuel = rawRefuels.find(r => r.id === refuel.id);
    assert.ok(rawRefuel);
    assert.ok(rawRefuel.deletedAt || rawRefuel.excluido_em);
  });

  it('US04.5 / US04.6: ao excluir o veículo atualmente ativo, seleciona automaticamente outro veículo remanescente', async () => {
    const v1 = await VehicleService.createVehicle({
      brand: 'Honda',
      model: 'Civic',
      year: 2020,
      plate: 'BRA2E19',
      fuelType: 'Gasolina',
      tankCapacityL: 56,
      preferredFuel: 'Gasolina',
      initialOdometer: 40000,
    });

    const v2 = await VehicleService.createVehicle({
      brand: 'Toyota',
      model: 'Yaris',
      year: 2021,
      plate: 'YAR2021',
      fuelType: 'Flex',
      tankCapacityL: 45,
      preferredFuel: 'Gasolina',
      initialOdometer: 20000,
    });

    // v1 é o ativo
    assert.equal(useAppStore.getState().selectedVehicle?.id, v1.id);

    // Exclui v1
    await VehicleService.deleteVehicle(v1.id);

    // O veículo ativo deve mudar automaticamente para v2
    assert.equal(useAppStore.getState().selectedVehicle?.id, v2.id);

    // Exclui v2
    await VehicleService.deleteVehicle(v2.id);

    // Não restam veículos
    assert.equal(useAppStore.getState().selectedVehicle, null);
  });
});
