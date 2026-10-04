import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OdometerService } from '../services/odometerService';
import { VehicleService } from '../services/vehicleService';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { db } from '../database/DatabaseConnection';
import { useAppStore } from '../store/useAppStore';

describe('US06 - Atualização Manual de Hodômetro', () => {
  beforeEach(async () => {
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('local_leituras_hodometro', []);
    await db.saveTableData('sync_queue', []);
    useAppStore.getState().logout();
  });

  it('US06.4: deve rejeitar km menor que o último consolidado exibindo o último valor na mensagem', async () => {
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

    await assert.rejects(
      async () => {
        await OdometerService.updateManualOdometer(vehicle.id, 9500);
      },
      (err: Error) => {
        assert.match(err.message, /10\.?000|10000/);
        return true;
      },
    );

    // O odômetro do veículo não deve ter sido alterado
    const current = await VehicleService.getVehicle(vehicle.id);
    assert.equal(current?.currentOdometer, 10000);
  });

  it('US06.4: deve rejeitar km igual ao último consolidado exibindo o último valor na mensagem', async () => {
    const vehicle = await VehicleService.createVehicle({
      brand: 'Toyota',
      model: 'Corolla',
      year: 2021,
      plate: 'COR2021',
      fuelType: 'Flex',
      tankCapacityL: 50,
      preferredFuel: 'Gasolina',
      initialOdometer: 25000,
    });

    await assert.rejects(
      async () => {
        await OdometerService.updateManualOdometer(vehicle.id, 25000);
      },
      (err: Error) => {
        assert.match(err.message, /25\.?000|25000/);
        return true;
      },
    );

    const current = await VehicleService.getVehicle(vehicle.id);
    assert.equal(current?.currentOdometer, 25000);
  });

  it('US06.3 / US06.4: deve aceitar km estritamente superior, gravar leitura com origem "manual" e atualizar veículo e store', async () => {
    const vehicle = await VehicleService.createVehicle({
      brand: 'Volkswagen',
      model: 'Gol',
      year: 2019,
      plate: 'GOL2019',
      fuelType: 'Flex',
      tankCapacityL: 50,
      preferredFuel: 'Etanol',
      initialOdometer: 40000,
    });

    // Atualização manual para 40.850 km
    const result = await OdometerService.updateManualOdometer(vehicle.id, 40850);

    assert.equal(result.km, 40850);
    assert.equal(result.origin, 'manual');
    assert.equal(result.vehicleId, vehicle.id);

    // Verifica persistência no repositório de leituras
    const readings = await OdometerRepository.listByVehicle(vehicle.id);
    assert.equal(readings.length, 1);
    assert.equal(readings[0].km, 40850);
    assert.equal(readings[0].origin, 'manual');

    // Verifica atualização no veículo
    const updatedVehicle = await VehicleService.getVehicle(vehicle.id);
    assert.equal(updatedVehicle?.currentOdometer, 40850);

    // Verifica atualização no estado global (useAppStore)
    assert.equal(useAppStore.getState().selectedVehicle?.currentOdometer, 40850);
  });
});
