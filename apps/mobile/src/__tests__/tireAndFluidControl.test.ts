// Polyfill para AsyncStorage em ambiente Node.js / testes
if (typeof (global as any).window === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  };
}

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database/DatabaseConnection';
import { localMigrator } from '../database/migrations/localMigrator';
import '../database/migrations/006_create_local_regras_manutencao';
import '../database/migrations/009_create_local_pneus_e_fluidos';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { TireRecordRepository } from '../repositories/TireRecordRepository';
import { FluidRecordRepository } from '../repositories/FluidRecordRepository';
import { MaintenanceRuleRepository } from '../repositories/MaintenanceRuleRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import {
  TireAndFluidService,
  validarRegistroPneu,
  validarRegistroFluido,
} from '../services/tireAndFluidService';
import {
  MaintenanceAlertService,
  SERVICE_TYPE_LABELS,
  DEFAULT_MAINTENANCE_RULES,
} from '../services/maintenanceAlertService';
import { NotificationService } from '../services/notificationService';
import { VehicleService } from '../services/vehicleService';

describe('US11 — Controle de Pneus e Fluidos', () => {
  beforeEach(async () => {
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('veiculos', []);
    await db.saveTableData('local_registros_pneu', []);
    await db.saveTableData('registros_pneu', []);
    await db.saveTableData('local_registros_fluido', []);
    await db.saveTableData('registros_fluido', []);
    await db.saveTableData('regras_manutencao', []);
    await db.saveTableData('local_regras_manutencao', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('local_manutencoes', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('local_leituras_hodometro', []);
    await db.saveTableData('fila_sync', []);
    await db.saveTableData('sync_queue', []);
    await localMigrator.runMigrations();
    NotificationService.resetMock();
  });

  describe('US11.1 [BD]: Tabelas registros_pneu e registros_fluido sincronizáveis', () => {
    it('deve registrar entidades registros_pneu e registros_fluido no SyncEntityRegistry e aplicar pull/push offline-first', async () => {
      const registeredEntities = SyncEntityRegistry.listRegisteredEntities();
      assert.ok(
        registeredEntities.includes('registros_pneu'),
        'registros_pneu deve estar registrada no SyncEntityRegistry',
      );
      assert.ok(
        registeredEntities.includes('registros_fluido'),
        'registros_fluido deve estar registrada no SyncEntityRegistry',
      );

      // Verifica criação de índices compostos (veiculo_id + data)
      const indexes = db.getRegisteredIndexes();
      assert.ok(
        indexes.includes('idx_registros_pneu_veiculo_data'),
        'Índice idx_registros_pneu_veiculo_data deve existir',
      );
      assert.ok(
        indexes.includes('idx_registros_fluido_veiculo_data'),
        'Índice idx_registros_fluido_veiculo_data deve existir',
      );

      // Simula pull do servidor para registros_pneu e registros_fluido
      const tireAdapter = SyncEntityRegistry.get('registros_pneu');
      const fluidAdapter = SyncEntityRegistry.get('registros_fluido');
      assert.ok(tireAdapter);
      assert.ok(fluidAdapter);

      await tireAdapter!.applyRemote({
        id: 'sync-tire-1',
        veiculo_id: 'v-sync-1',
        data: '2026-06-01',
        km: 35000,
        tipo: 'calibragem',
        pressao_psi: 32,
        sulco_mm: 5.5,
        criado_em: '2026-06-01T10:00:00.000Z',
        atualizado_em: '2026-06-01T10:00:00.000Z',
        excluido_em: null,
      });

      await fluidAdapter!.applyRemote({
        id: 'sync-fluid-1',
        veiculo_id: 'v-sync-1',
        tipo_fluido: 'freio',
        data: '2026-06-02',
        km: 35100,
        nivel: 'normal',
        criado_em: '2026-06-02T10:00:00.000Z',
        atualizado_em: '2026-06-02T10:00:00.000Z',
        excluido_em: null,
      });

      const syncedTires = await TireRecordRepository.listByVehicle('v-sync-1');
      assert.strictEqual(syncedTires.length, 1);
      assert.strictEqual(syncedTires[0].pressurePsi, 32);
      assert.strictEqual(syncedTires[0].treadDepthMm, 5.5);

      const syncedFluids = await FluidRecordRepository.listByVehicle('v-sync-1');
      assert.strictEqual(syncedFluids.length, 1);
      assert.strictEqual(syncedFluids[0].fluidType, 'freio');
      assert.strictEqual(syncedFluids[0].level, 'normal');
    });
  });

  describe('US11.2, US11.3 & US11.4 [App]: Formulários, Validações e Histórico com Editar e Excluir', () => {
    it('US11.2: deve validar e registrar calibragem (pressão + sulco opcional) e troca de pneu (km da troca)', async () => {
      const vehicle = await VehicleRepository.create(
        {
          brand: 'Volkswagen',
          model: 'Nivus Highline',
          year: 2023,
          plate: 'NIV1A23',
          tankCapacityL: 52,
          preferredFuel: 'Gasolina',
          initialOdometer: 20000,
        },
        'user-1',
      );

      // Validações de pressão e sulco
      assert.throws(
        () =>
          validarRegistroPneu({
            vehicleId: vehicle.id,
            date: '2026-06-10',
            km: 20500,
            type: 'calibragem',
            pressurePsi: 0,
          }),
        /pressão/i,
      );

      assert.throws(
        () =>
          validarRegistroPneu({
            vehicleId: vehicle.id,
            date: '2026-06-10',
            km: 20500,
            type: 'calibragem',
            pressurePsi: 32,
            treadDepthMm: -1,
          }),
        /sulco/i,
      );

      // 1. Registro de Calibragem sem sulco (opcional)
      const calibragem = await TireAndFluidService.createTireRecord({
        vehicleId: vehicle.id,
        date: '2026-06-10',
        km: 20500,
        type: 'calibragem',
        pressurePsi: 32,
      });

      assert.ok(calibragem.id);
      assert.strictEqual(calibragem.type, 'calibragem');
      assert.strictEqual(calibragem.pressurePsi, 32);
      assert.strictEqual(calibragem.treadDepthMm, null);

      // 2. Registro de Troca de Pneu com km da troca e profundidade do sulco novo (8.0 mm)
      const troca = await TireAndFluidService.createTireRecord({
        vehicleId: vehicle.id,
        date: '2026-06-15',
        km: 21000,
        type: 'troca',
        pressurePsi: 34,
        treadDepthMm: 8.0,
      });

      assert.strictEqual(troca.type, 'troca');
      assert.strictEqual(troca.km, 21000);
      assert.strictEqual(troca.pressurePsi, 34);
      assert.strictEqual(troca.treadDepthMm, 8.0);

      // Odômetro do veículo deve ter sido atualizado para 21.000 km
      const updatedVehicle = await VehicleRepository.findById(vehicle.id);
      assert.strictEqual(updatedVehicle?.currentOdometer, 21000);

      // 3. Edição (US11.4)
      const edited = await TireAndFluidService.updateTireRecord(calibragem.id, {
        pressurePsi: 33,
        treadDepthMm: 4.2,
      });
      assert.strictEqual(edited?.pressurePsi, 33);
      assert.strictEqual(edited?.treadDepthMm, 4.2);

      // 4. Listagem por veículo (US11.4)
      const listBeforeDelete = await TireAndFluidService.listTireRecordsByVehicle(vehicle.id);
      assert.strictEqual(listBeforeDelete.length, 2);
      assert.strictEqual(listBeforeDelete[0].id, troca.id); // mais recente primeiro

      // 5. Exclusão lógica (US11.4)
      const deleted = await TireAndFluidService.deleteTireRecord(calibragem.id);
      assert.strictEqual(deleted, true);

      const listAfterDelete = await TireAndFluidService.listTireRecordsByVehicle(vehicle.id);
      assert.strictEqual(listAfterDelete.length, 1);
      assert.strictEqual(listAfterDelete[0].id, troca.id);

      // Verifica enfileiramento de sincronização
      const queue = await SyncQueueRepository.listPending();
      assert.ok(queue.some(q => q.endpoint.includes('/sync/registros_pneu')));
    });

    it('US11.3 & US11.4: deve validar e registrar fluidos (óleo do motor, fluido de freio e água do radiador) com nível baixo opcional, editar e excluir', async () => {
      const vehicle = await VehicleRepository.create(
        {
          brand: 'Toyota',
          model: 'Corolla XEi',
          year: 2022,
          plate: 'COR2B22',
          tankCapacityL: 50,
          preferredFuel: 'Gasolina',
          initialOdometer: 40000,
        },
        'user-1',
      );

      // Validação de km inválido
      assert.throws(
        () =>
          validarRegistroFluido({
            vehicleId: vehicle.id,
            fluidType: 'oleo_motor',
            date: '2026-06-10',
            km: 0,
          }),
        /quilometragem/i,
      );

      // 1. Óleo do motor (nível padrão = 'normal')
      const oleo = await TireAndFluidService.createFluidRecord({
        vehicleId: vehicle.id,
        fluidType: 'oleo_motor',
        date: '2026-06-05',
        km: 40200,
      });
      assert.strictEqual(oleo.fluidType, 'oleo_motor');
      assert.strictEqual(oleo.level, 'normal');

      // 2. Fluido de freio (nível baixo opcional marcado)
      const freio = await TireAndFluidService.createFluidRecord({
        vehicleId: vehicle.id,
        fluidType: 'freio',
        date: '2026-06-10',
        km: 40500,
        level: 'baixo',
      });
      assert.strictEqual(freio.fluidType, 'freio');
      assert.strictEqual(freio.level, 'baixo');

      // 3. Água do radiador
      const radiador = await TireAndFluidService.createFluidRecord({
        vehicleId: vehicle.id,
        fluidType: 'radiador',
        date: '2026-06-12',
        km: 40800,
        level: 'normal',
      });
      assert.strictEqual(radiador.fluidType, 'radiador');
      assert.strictEqual(radiador.km, 40800);

      // 4. Editar nível do fluido de freio após reposição/troca (US11.4)
      const freioAtualizado = await TireAndFluidService.updateFluidRecord(freio.id, {
        level: 'normal',
        km: 40900,
      });
      assert.strictEqual(freioAtualizado?.level, 'normal');
      assert.strictEqual(freioAtualizado?.km, 40900);

      // 5. Histórico e exclusão (US11.4)
      const allFluids = await TireAndFluidService.listFluidRecordsByVehicle(vehicle.id);
      assert.strictEqual(allFluids.length, 3);

      await TireAndFluidService.deleteFluidRecord(oleo.id);
      const remainingFluids = await TireAndFluidService.listFluidRecordsByVehicle(vehicle.id);
      assert.strictEqual(remainingFluids.length, 2);

      // Exclusão em cascata ao remover o veículo
      await VehicleService.deleteVehicle(vehicle.id);
      const afterVehicleDelete = await TireAndFluidService.listFluidRecordsByVehicle(vehicle.id);
      assert.strictEqual(afterVehicleDelete.length, 0);
    });
  });

  describe('US11.5 & US11.6 [App/Teste]: Integração com Motor de Regras da US10 (calibragem_pneus, troca_oleo, fluido_freio, agua_radiador)', () => {
    it('US11.5: deve registrar os tipos de serviço calibragem_pneus, troca_oleo, fluido_freio e agua_radiador no motor da US10 sem duplicar lógica', () => {
      assert.ok(SERVICE_TYPE_LABELS.calibragem_pneus);
      assert.ok(SERVICE_TYPE_LABELS.troca_oleo);
      assert.ok(SERVICE_TYPE_LABELS.fluido_freio);
      assert.ok(SERVICE_TYPE_LABELS.agua_radiador);

      const defaultTypes = DEFAULT_MAINTENANCE_RULES.map(r => r.serviceType);
      assert.ok(defaultTypes.includes('calibragem_pneus'));
      assert.ok(defaultTypes.includes('troca_oleo'));
      assert.ok(defaultTypes.includes('fluido_freio'));
      assert.ok(defaultTypes.includes('agua_radiador'));
    });

    it('US11.6: Calibragem de pneus vencendo por dias e reinício automático do ciclo após novo registro de calibragem', async () => {
      const vehicle = await VehicleRepository.create(
        {
          brand: 'Jeep',
          model: 'Compass Longitude',
          year: 2023,
          plate: 'JEP3C23',
          tankCapacityL: 60,
          preferredFuel: 'Gasolina',
          initialOdometer: 30000,
        },
        'user-1',
      );
      await VehicleRepository.updateOdometer(vehicle.id, 30200);

      // Cria regra de calibragem periódica a cada 15 dias (antecedência de 3 dias)
      await MaintenanceRuleRepository.create({
        vehicleId: vehicle.id,
        serviceType: 'calibragem_pneus',
        name: 'Calibragem Periódica dos Pneus',
        intervalKm: null,
        intervalDays: 15,
        advanceKm: 0,
        advanceDays: 3,
        lastServiceKm: 30000,
        lastServiceDate: '2026-05-01T10:00:00.000Z',
        active: true,
      });

      // Registra uma calibragem em 01/05/2026 aos 30.000 km (32 PSI)
      await TireAndFluidService.createTireRecord({
        vehicleId: vehicle.id,
        date: '2026-05-01T10:00:00.000Z',
        km: 30000,
        type: 'calibragem',
        pressurePsi: 32,
        treadDepthMm: 6.0,
      });

      // 1. Em 10/05/2026 (faltam 6 dias > 3 dias de antecedência) -> Nenhum alerta ativo
      let alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-05-10T10:00:00.000Z',
        false,
      );
      assert.strictEqual(alerts.length, 0);

      // 2. Em 14/05/2026 (faltam 2 dias <= 3 dias de antecedência) -> Alerta "proximo" vencendo por dias!
      alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-05-14T10:00:00.000Z',
        false,
      );
      assert.strictEqual(alerts.length, 1);
      assert.strictEqual(alerts[0].serviceType, 'calibragem_pneus');
      assert.strictEqual(alerts[0].status, 'proximo');
      assert.strictEqual(alerts[0].vencePorDias, true);
      assert.strictEqual(alerts[0].remainingDays, 2);

      // 3. Em 18/05/2026 (2 dias após o prazo de 16/05/2026) -> Alerta "vencido" por dias!
      alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-05-18T10:00:00.000Z',
        false,
      );
      assert.strictEqual(alerts.length, 1);
      assert.strictEqual(alerts[0].serviceType, 'calibragem_pneus');
      assert.strictEqual(alerts[0].status, 'vencido');
      assert.strictEqual(alerts[0].vencePorDias, true);
      assert.ok(alerts[0].remainingDays !== null && alerts[0].remainingDays! < 0);

      // 4. Usuário registra nova calibragem em 18/05/2026 -> Ciclo reinicia para +15 dias (02/06/2026), alerta desaparece!
      await TireAndFluidService.createTireRecord({
        vehicleId: vehicle.id,
        date: '2026-05-18T12:00:00.000Z',
        km: 30450,
        type: 'calibragem',
        pressurePsi: 33,
      });

      alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-05-18T12:00:00.000Z',
        false,
      );
      assert.strictEqual(alerts.length, 0);
    });

    it('US11.6: Troca de fluido (óleo, fluido de freio e água do radiador) vencendo por km ou tempo e reinício após novo registro', async () => {
      const vehicle = await VehicleRepository.create(
        {
          brand: 'Hyundai',
          model: 'Creta Platinum',
          year: 2023,
          plate: 'CRE4D23',
          tankCapacityL: 50,
          preferredFuel: 'Gasolina',
          initialOdometer: 10000,
        },
        'user-1',
      );

      // Cria regras no motor da US10 para troca_oleo, fluido_freio e agua_radiador
      await MaintenanceRuleRepository.create({
        vehicleId: vehicle.id,
        serviceType: 'troca_oleo',
        name: 'Troca de Óleo do Motor',
        intervalKm: 10000,
        intervalDays: 180,
        advanceKm: 500,
        advanceDays: 15,
        lastServiceKm: 10000,
        lastServiceDate: '2026-01-01T10:00:00.000Z',
        active: true,
      });

      await MaintenanceRuleRepository.create({
        vehicleId: vehicle.id,
        serviceType: 'fluido_freio',
        name: 'Troca de Fluido de Freio',
        intervalKm: 20000,
        intervalDays: 365,
        advanceKm: 1000,
        advanceDays: 15,
        lastServiceKm: 10000,
        lastServiceDate: '2026-01-01T10:00:00.000Z',
        active: true,
      });

      await MaintenanceRuleRepository.create({
        vehicleId: vehicle.id,
        serviceType: 'agua_radiador',
        name: 'Troca de Água do Radiador',
        intervalKm: 30000,
        intervalDays: 365,
        advanceKm: 1000,
        advanceDays: 15,
        lastServiceKm: 10000,
        lastServiceDate: '2026-01-01T10:00:00.000Z',
        active: true,
      });

      // Registra última troca de óleo em 01/01/2026 aos 10.000 km via registros_fluido
      await TireAndFluidService.createFluidRecord({
        vehicleId: vehicle.id,
        fluidType: 'oleo_motor',
        date: '2026-01-01T10:00:00.000Z',
        km: 10000,
        level: 'normal',
      });

      // Caso A — Vencendo por KM: veículo atinge 19.650 km em 01/04/2026 (faltam 350 km <= 500 km de antecedência para os 20.000 km)
      await VehicleRepository.updateOdometer(vehicle.id, 19650);
      let alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-04-01T10:00:00.000Z',
        false,
      );
      const oilAlertByKm = alerts.find(a => a.serviceType === 'troca_oleo');
      assert.ok(oilAlertByKm, 'Deve gerar alerta para troca_oleo vencendo por km');
      assert.strictEqual(oilAlertByKm?.status, 'proximo');
      assert.strictEqual(oilAlertByKm?.vencePorKm, true);
      assert.strictEqual(oilAlertByKm?.remainingKm, 350);

      // Se registrar apenas nível baixo (inspeção de alerta, sem troca), NÃO deve reiniciar o alerta preventivo!
      await TireAndFluidService.createFluidRecord({
        vehicleId: vehicle.id,
        fluidType: 'oleo_motor',
        date: '2026-04-02T10:00:00.000Z',
        km: 19700,
        level: 'baixo',
      });
      alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-04-02T10:00:00.000Z',
        false,
      );
      assert.ok(
        alerts.find(a => a.serviceType === 'troca_oleo'),
        'Registro com nivel baixo não deve reiniciar o ciclo preventivo de troca_oleo',
      );

      // Registra nova troca de óleo (level: normal) aos 19.800 km em 05/04/2026 -> novo alvo passa a ser 29.800 km!
      await TireAndFluidService.createFluidRecord({
        vehicleId: vehicle.id,
        fluidType: 'oleo_motor',
        date: '2026-04-05T10:00:00.000Z',
        km: 19800,
        level: 'normal',
      });

      alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-04-05T10:00:00.000Z',
        false,
      );
      assert.strictEqual(
        alerts.find(a => a.serviceType === 'troca_oleo'),
        undefined,
        'Alerta de troca_oleo deve sumir após registrar nova troca em registros_fluido',
      );

      // Caso B — Vencendo por TEMPO: em 22/12/2026 (faltam 10 dias <= 15 dias para completar 365 dias de fluido_freio e agua_radiador)
      alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-12-22T10:00:00.000Z',
        false,
      );
      const brakeAlertByTime = alerts.find(a => a.serviceType === 'fluido_freio');
      const radiatorAlertByTime = alerts.find(a => a.serviceType === 'agua_radiador');
      assert.ok(brakeAlertByTime, 'Deve gerar alerta para fluido_freio vencendo por tempo');
      assert.strictEqual(brakeAlertByTime?.status, 'proximo');
      assert.strictEqual(brakeAlertByTime?.vencePorDias, true);

      assert.ok(radiatorAlertByTime, 'Deve gerar alerta para agua_radiador vencendo por tempo');
      assert.strictEqual(radiatorAlertByTime?.status, 'proximo');
      assert.strictEqual(radiatorAlertByTime?.vencePorDias, true);

      // Registra troca de fluido de freio e água do radiador em 23/12/2026 -> ambos os alertas são reiniciados
      await TireAndFluidService.createFluidRecord({
        vehicleId: vehicle.id,
        fluidType: 'freio',
        date: '2026-12-23T10:00:00.000Z',
        km: 22000,
        level: 'normal',
      });
      await TireAndFluidService.createFluidRecord({
        vehicleId: vehicle.id,
        fluidType: 'radiador',
        date: '2026-12-23T10:00:00.000Z',
        km: 22000,
        level: 'normal',
      });

      alerts = await MaintenanceAlertService.evaluateVehicleAlerts(
        vehicle.id,
        '2026-12-23T10:00:00.000Z',
        false,
      );
      assert.strictEqual(
        alerts.find(a => a.serviceType === 'fluido_freio'),
        undefined,
      );
      assert.strictEqual(
        alerts.find(a => a.serviceType === 'agua_radiador'),
        undefined,
      );
    });
  });
});
