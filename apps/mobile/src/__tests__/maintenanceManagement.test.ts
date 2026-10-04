import test from 'node:test';
import assert from 'node:assert/strict';
import { MaintenanceService } from '../services/maintenanceService';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';
import { AttachmentRepository } from '../repositories/AttachmentRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { AttachmentUploadQueue } from '../services/attachmentUploadQueue';
import { gastosDoPeriodo } from '../services/expenseAggregation';
import { db } from '../database/DatabaseConnection';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';

test('US09 — Histórico de Manutenções com Anexos', async t => {
  // Limpeza de tabelas envolvidas antes dos testes
  await db.saveTableData('manutencoes', []);
  await db.saveTableData('anexos', []);
  await db.saveTableData('veiculos', []);
  await db.saveTableData('leituras_hodometro', []);
  await db.saveTableData('despesas', []);
  await db.saveTableData('abastecimentos', []);
  await db.saveTableData('fila_sync', []);

  // Cria veículo para os testes
  const vehicle = await VehicleRepository.create({
    model: 'Corolla Altis',
    year: 2022,
    plate: 'BRA2E19',
    tankCapacityL: 50,
    preferredFuel: 'Flex',
    initialOdometer: 30000,
  });

  await t.test(
    'US09 BDD: Dado registro de manutenção de R$ 350 com troca de óleo e nota fiscal anexada, ao salvar, grava peças trocadas, atualiza odômetro se for maior que o consolidado, inclui no valor de gastosDoPeriodo e enfileira upload de anexo e sincronização',
    async () => {
      // 1. Cria anexo pré-armazenado localmente
      const attachment = await AttachmentRepository.create({
        localPath: 'file:///data/user/0/app/cache/nf_troca_oleo.jpg',
        fileSize: 450000, // 450 KB (< 1 MB)
        mimeType: 'image/jpeg',
      });

      assert.equal(attachment.uploadStatus, 'pendente');

      // 2. Registra manutenção com km (35.000 km > 30.000 km atual)
      const maintenance = await MaintenanceService.createMaintenance({
        vehicleId: vehicle.id,
        date: '2026-05-10',
        odometer: 35000,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo sintético 0W20 e filtro de óleo',
        replacedParts: 'Filtro de óleo Fram, 4.2L Óleo Mobil 0W20',
        workshop: 'Oficina Central Auto',
        mechanic: 'Carlos Mecânico',
        executionTimeMin: 45,
        totalValue: 350.0,
        attachmentIds: [attachment.id],
      });

      // Valida gravação da manutenção
      assert.ok(maintenance.id);
      assert.equal(maintenance.totalValue, 350.0);
      assert.equal(maintenance.replacedParts, 'Filtro de óleo Fram, 4.2L Óleo Mobil 0W20');
      assert.equal(maintenance.type, 'preventiva');

      // Valida vínculo do anexo à manutenção
      const attached = await AttachmentRepository.findById(attachment.id);
      assert.equal(attached?.maintenanceId, maintenance.id);

      // Valida atualização do hodômetro consolidado do veículo (35.000 km)
      const updatedVehicle = await VehicleRepository.findById(vehicle.id);
      assert.equal(updatedVehicle?.currentOdometer, 35000);

      // Valida registro em leituras_hodometro com origem 'manutencao'
      const readings = await OdometerRepository.listByVehicle(vehicle.id);
      const maintReading = readings.find(r => r.km === 35000);
      assert.ok(maintReading, 'deve ter gerado leitura de hodômetro');
      assert.equal(maintReading?.origin, 'manutencao');

      // Valida inclusão na camada de agregação gastosDoPeriodo (US09.3)
      const gastoManutencao = await gastosDoPeriodo(
        vehicle.id,
        '2026-05-01',
        '2026-05-31',
        'Manutenção',
      );
      assert.equal(gastoManutencao, 350.0);

      const gastoTotalPeriodo = await gastosDoPeriodo(vehicle.id, '2026-05-01', '2026-05-31');
      assert.equal(gastoTotalPeriodo, 350.0);

      // Valida enfileiramento na outbox de sync (fila_sync)
      const pendingSync = await SyncQueueRepository.getPendingItems();
      const maintSync = pendingSync.find(p => p.payload?.id === maintenance.id);
      assert.ok(maintSync, 'deve ter enfileirado operação de sincronização da manutenção');
    },
  );

  await t.test(
    'US09.3: Manutenção antiga (km <= km atual) permite salvar histórico sem regredir hodômetro do veículo',
    async () => {
      // Veículo atualmente com 35.000 km
      // Usuário lança revisão antiga feita em 2025 aos 20.000 km
      const oldMaintenance = await MaintenanceService.createMaintenance({
        vehicleId: vehicle.id,
        date: '2025-08-15',
        odometer: 20000,
        type: 'preventiva',
        serviceType: 'filtros',
        description: 'Troca antiga do filtro de ar e ar-condicionado',
        totalValue: 120.0,
      });

      assert.ok(oldMaintenance.id);

      // O hodômetro atual do veículo deve continuar intacto em 35.000 km
      const v = await VehicleRepository.findById(vehicle.id);
      assert.equal(v?.currentOdometer, 35000);

      // Não deve ter gravado leitura de hodômetro que cause regressão
      const readings = await OdometerRepository.listByVehicle(vehicle.id);
      const regressedReading = readings.find(r => r.km === 20000);
      assert.equal(regressedReading, undefined);
    },
  );

  await t.test(
    'US09.4 & US09.8: Validação e compressão de anexo respeita o limite de 1 MB',
    async () => {
      // Anexo excedendo 1 MB (1.048.576 bytes) deve ser rejeitado
      await assert.rejects(async () => {
        await MaintenanceService.validateAndPrepareAttachment({
          localPath: 'file:///path/to/heavy.png',
          fileSize: 1048577, // > 1 MB
          mimeType: 'image/png',
        });
      }, /1 MB/i);

      // Anexo dentro do limite de 1 MB deve ser aceito
      const valid = await MaintenanceService.validateAndPrepareAttachment({
        localPath: 'file:///path/to/receipt.jpg',
        fileSize: 850000, // ~830 KB (< 1 MB)
        mimeType: 'image/jpeg',
      });
      assert.equal(valid.fileSize, 850000);
    },
  );

  await t.test(
    'US09.6: Fila de upload de anexos processa arquivos pendentes e atualiza status para enviado',
    async () => {
      const att = await AttachmentRepository.create({
        localPath: 'file:///data/cache/receipt_queue.jpg',
        fileSize: 300000,
        mimeType: 'image/jpeg',
      });

      assert.equal(att.uploadStatus, 'pendente');

      // Processa fila com mock de upload bem-sucedido
      const processed = await AttachmentUploadQueue.processPending(async () => {
        return {
          gcsUrl:
            'https://storage.googleapis.com/autogest-bucket/users/u1/manutencoes/receipt_queue.jpg',
        };
      });

      assert.ok(processed.successCount >= 1);

      const updated = await AttachmentRepository.findById(att.id);
      assert.equal(updated?.uploadStatus, 'enviado');
      assert.ok(updated?.gcsUrl?.includes('storage.googleapis.com'));
    },
  );

  await t.test(
    'US09.7: Histórico por veículo com filtro por tipo (preventiva / corretiva), edição e exclusão',
    async () => {
      // Cadastra uma manutenção corretiva
      const corrective = await MaintenanceService.createMaintenance({
        vehicleId: vehicle.id,
        date: '2026-06-01',
        odometer: 36000,
        type: 'corretiva',
        serviceType: 'freios',
        description: 'Troca de pastilhas de freio dianteiras desgastadas',
        totalValue: 420.0,
      });

      // Filtro 'corretiva'
      const correctives = await MaintenanceRepository.listByVehicle(vehicle.id, 'corretiva');
      assert.equal(correctives.length, 1);
      assert.equal(correctives[0].id, corrective.id);

      // Filtro 'preventiva'
      const preventives = await MaintenanceRepository.listByVehicle(vehicle.id, 'preventiva');
      assert.ok(preventives.length >= 1);
      assert.ok(preventives.every(m => m.type === 'preventiva'));

      // Edição
      await MaintenanceService.updateMaintenance(corrective.id, {
        totalValue: 450.0,
        description: 'Troca de pastilhas e fluído de freio',
      });
      const edited = await MaintenanceRepository.findById(corrective.id);
      assert.equal(edited?.totalValue, 450.0);

      // Exclusão lógica
      await MaintenanceService.deleteMaintenance(corrective.id);
      const afterDelete = await MaintenanceRepository.listByVehicle(vehicle.id, 'corretiva');
      assert.equal(afterDelete.length, 0);

      // Registro excluído não soma mais em gastosDoPeriodo
      const gastoPosDelete = await gastosDoPeriodo(
        vehicle.id,
        '2026-06-01',
        '2026-06-30',
        'Manutenção',
      );
      assert.equal(gastoPosDelete, 0);
    },
  );
});
