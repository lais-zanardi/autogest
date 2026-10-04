import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FuelingService } from '../services/fuelingService';
import { VehicleService } from '../services/vehicleService';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { GPSService } from '../services/gpsService';
import { db } from '../database/DatabaseConnection';
import { useAppStore } from '../store/useAppStore';

describe('US05 - Ciclo Completo de Abastecimento, GPS, Hodômetro e Recálculo', () => {
  beforeEach(async () => {
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('local_leituras_hodometro', []);
    await db.saveTableData('sync_queue', []);
    useAppStore.getState().logout();
  });

  it('US05.5 / US05.6: salva abastecimento, grava leitura de hodômetro e atualiza km do veículo', async () => {
    // Cria veículo de teste
    const vehicle = await VehicleService.createVehicle({
      brand: 'Honda',
      model: 'Civic',
      year: 2020,
      plate: 'BRA2E19',
      fuelType: 'Gasolina',
      tankCapacityL: 56,
      preferredFuel: 'Gasolina',
      initialOdometer: 10000,
    });

    // 1º abastecimento aos 10.000 km (primeiro registro, sem consumo)
    const refuel1 = await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: '2026-10-01T10:00:00.000Z',
      odometer: 10000,
      fuelType: 'Gasolina',
      liters: 45,
      pricePerLiter: 5.89,
      totalValue: 265.05,
      isFullTank: true,
    });

    assert.equal(refuel1.calculatedKml, null);

    // 2º abastecimento aos 10.500 km com 40 L (Critério BDD: 500 km / 40 L = 12,5 km/l)
    const refuel2 = await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: '2026-10-04T10:00:00.000Z',
      odometer: 10500,
      fuelType: 'Gasolina',
      liters: 40,
      pricePerLiter: 5.9,
      totalValue: 236,
      isFullTank: true,
    });

    assert.equal(refuel2.calculatedKml, 12.5);

    // US05.6: Verifica gravação da leitura de hodômetro com origem 'abastecimento'
    const readings = await OdometerRepository.listByVehicle(vehicle.id);
    assert.equal(readings.length, 2);
    assert.equal(readings[0].km, 10500);
    assert.equal(readings[0].origin, 'abastecimento');

    // US05.6: Verifica atualização do km atual do veículo
    const updatedVehicle = await VehicleService.getVehicle(vehicle.id);
    assert.equal(updatedVehicle?.currentOdometer, 10500);
  });

  it('US05.4: salva com coordenadas quando GPS disponível, e sem coordenadas quando negado', async () => {
    const vehicle = await VehicleService.createVehicle({
      brand: 'Toyota',
      model: 'Corolla',
      year: 2021,
      plate: 'COR2021',
      fuelType: 'Flex',
      tankCapacityL: 50,
      preferredFuel: 'Gasolina',
      initialOdometer: 20000,
    });

    // Cenário 1: GPS disponível
    const refuelWithGps = await FuelingService.createRefuel(
      {
        vehicleId: vehicle.id,
        date: new Date().toISOString(),
        odometer: 20500,
        fuelType: 'Gasolina',
        liters: 35,
        pricePerLiter: 5.7,
        totalValue: 199.5,
        isFullTank: true,
      },
      { latitude: -23.55052, longitude: -46.633308 },
    );

    assert.equal(refuelWithGps.latitude, -23.55052);
    assert.equal(refuelWithGps.longitude, -46.633308);

    // Cenário 2: GPS negado/indisponível (null)
    const refuelNoGps = await FuelingService.createRefuel(
      {
        vehicleId: vehicle.id,
        date: new Date().toISOString(),
        odometer: 21000,
        fuelType: 'Gasolina',
        liters: 38,
        pricePerLiter: 5.7,
        totalValue: 216.6,
        isFullTank: true,
      },
      null,
    );

    assert.equal(refuelNoGps.latitude, null);
    assert.equal(refuelNoGps.longitude, null);
    assert.ok(refuelNoGps.id);

    // Cenário 3: GPS negado no dispositivo via permissão nativa
    GPSService.setMockPermissionDenied(true);
    const refuelDenied = await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: new Date().toISOString(),
      odometer: 21500,
      fuelType: 'Gasolina',
      liters: 30,
      pricePerLiter: 5.7,
      totalValue: 171,
      isFullTank: true,
    });
    assert.equal(refuelDenied.latitude, null);
    assert.equal(refuelDenied.longitude, null);
    assert.ok(refuelDenied.id);
    GPSService.setMockPermissionDenied(false);
  });

  it('US05.7: edição de abastecimento recalcula o consumo dele e do abastecimento seguinte', async () => {
    const vehicle = await VehicleService.createVehicle({
      brand: 'Fiat',
      model: 'Pulse',
      year: 2022,
      plate: 'PUL2022',
      fuelType: 'Flex',
      tankCapacityL: 47,
      preferredFuel: 'Gasolina',
      initialOdometer: 10000,
    });

    // Abastecimento 1: 10.000 km
    await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: '2026-10-01T10:00:00.000Z',
      odometer: 10000,
      fuelType: 'Gasolina',
      liters: 40,
      pricePerLiter: 5,
      totalValue: 200,
      isFullTank: true,
    });

    // Abastecimento 2: 10.500 km, 50 L -> consumo = (10500 - 10000) / 50 = 10,0 km/l
    const refuel2 = await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: '2026-10-02T10:00:00.000Z',
      odometer: 10500,
      fuelType: 'Gasolina',
      liters: 50,
      pricePerLiter: 5,
      totalValue: 250,
      isFullTank: true,
    });
    assert.equal(refuel2.calculatedKml, 10);

    // Abastecimento 3: 11.000 km, 50 L -> consumo = (11000 - 10500) / 50 = 10,0 km/l
    const refuel3 = await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: '2026-10-03T10:00:00.000Z',
      odometer: 11000,
      fuelType: 'Gasolina',
      liters: 50,
      pricePerLiter: 5,
      totalValue: 250,
      isFullTank: true,
    });
    assert.equal(refuel3.calculatedKml, 10);

    // Edição do Abastecimento 2: altera km de 10.500 para 10.600
    // Novo consumo do Abastecimento 2: (10600 - 10000) / 50 = 600 / 50 = 12,0 km/l
    // Novo consumo do Abastecimento 3: (11000 - 10600) / 50 = 400 / 50 = 8,0 km/l
    await FuelingService.updateRefuel(refuel2.id, {
      odometer: 10600,
    });

    const updated2 = await RefuelRepository.findById(refuel2.id);
    const updated3 = await RefuelRepository.findById(refuel3.id);

    assert.equal(updated2?.calculatedKml, 12);
    assert.equal(updated3?.calculatedKml, 8);

    // Verifica que UPDATE_REFUEL foi devidamente enfileirado na outbox
    const syncItems = await SyncQueueRepository.getPendingItems();
    const updateSync = syncItems.find(item => item.operation === 'UPDATE_REFUEL');
    assert.ok(updateSync);
    assert.equal(updateSync.endpoint, `/api/v1/refuels/${refuel2.id}`);
  });

  it('US05.7: exclusão de abastecimento recalcula o consumo do abastecimento seguinte com base no anterior', async () => {
    const vehicle = await VehicleService.createVehicle({
      brand: 'Jeep',
      model: 'Renegade',
      year: 2023,
      plate: 'JEP2023',
      fuelType: 'Flex',
      tankCapacityL: 55,
      preferredFuel: 'Gasolina',
      initialOdometer: 10000,
    });

    // 1: 10.000 km
    await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: '2026-10-01T10:00:00.000Z',
      odometer: 10000,
      fuelType: 'Gasolina',
      liters: 40,
      pricePerLiter: 5,
      totalValue: 200,
      isFullTank: true,
    });

    // 2: 10.400 km, 40 L -> (10400 - 10000) / 40 = 10 km/l
    const refuel2 = await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: '2026-10-02T10:00:00.000Z',
      odometer: 10400,
      fuelType: 'Gasolina',
      liters: 40,
      pricePerLiter: 5,
      totalValue: 200,
      isFullTank: true,
    });

    // 3: 10.800 km, 40 L -> (10800 - 10400) / 40 = 10 km/l
    const refuel3 = await FuelingService.createRefuel({
      vehicleId: vehicle.id,
      date: '2026-10-03T10:00:00.000Z',
      odometer: 10800,
      fuelType: 'Gasolina',
      liters: 40,
      pricePerLiter: 5,
      totalValue: 200,
      isFullTank: true,
    });

    // Ao excluir o abastecimento 2 (10.400 km), o abastecimento 3 agora tem como anterior o 1 (10.000 km)
    // Novo consumo do abastecimento 3: (10800 - 10000) / 40 = 800 / 40 = 20 km/l
    await FuelingService.deleteRefuel(refuel2.id);

    const refuel3After = await RefuelRepository.findById(refuel3.id);
    assert.equal(refuel3After?.calculatedKml, 20);

    // Verifica que DELETE_REFUEL foi devidamente enfileirado na outbox
    const syncItems = await SyncQueueRepository.getPendingItems();
    const deleteSync = syncItems.find(item => item.operation === 'DELETE_REFUEL');
    assert.ok(deleteSync);
    assert.equal(deleteSync.endpoint, `/api/v1/refuels/${refuel2.id}`);
  });
});
