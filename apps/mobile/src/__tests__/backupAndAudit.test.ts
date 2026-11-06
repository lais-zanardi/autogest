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
import '../database/migrations/011_create_local_auditoria';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';
import { FixedCostRepository } from '../repositories/FixedCostRepository';
import { AttachmentRepository } from '../repositories/AttachmentRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import {
  gerarNomeArquivoBackup,
  lerCabecalhoAgbak,
  lerPayloadBackup,
  serializarCabecalhoAgbak,
  serializarPayloadBackup,
} from '../backup/formato';
import { cifrarBackupAgbak, decifrarBackupAgbak } from '../backup/cifra';
import { criarBackupLocal, gerarPayloadExportacao } from '../backup/exportador';
import { AuditService, resolverInicioPeriodoAuditoria } from '../services/auditService';
import { useAppStore } from '../store/useAppStore';

describe('US21 — Trilha de Auditoria e Backup Local (.agbak)', () => {
  beforeEach(async () => {
    for (const def of SyncEntityRegistry.getAll()) {
      await db.saveTableData(def.localTable, []);
    }
    await db.saveTableData('auditoria', []);
    await db.saveTableData('sync_queue', []);
    await localMigrator.runMigrations();
  });

  describe('US21.1 · Módulo backup/formato (Cabeçalho binário .agbak e Payload JSON)', () => {
    it('deve serializar e ler o cabeçalho de 39 bytes do arquivo .agbak (versão 1)', () => {
      const salt = new Uint8Array(16).fill(7);
      const nonce = new Uint8Array(12).fill(9);
      const headerBytes = serializarCabecalhoAgbak({
        versaoFormato: 1,
        kdfId: 1,
        iteracoes: 600_000,
        salt,
        nonce,
      });

      assert.strictEqual(headerBytes.length, 39);

      const parsed = lerCabecalhoAgbak(headerBytes);
      assert.strictEqual(parsed.magic, 'AGBAK');
      assert.strictEqual(parsed.versaoFormato, 1);
      assert.strictEqual(parsed.kdfId, 1);
      assert.strictEqual(parsed.iteracoes, 600_000);
      assert.deepStrictEqual(parsed.salt, salt);
      assert.deepStrictEqual(parsed.nonce, nonce);
    });

    it('deve serializar e ler o payload JSON e formatar o nome autogest-AAAAMMDD-HHmm.agbak', () => {
      const samplePayload = {
        versao_schema: 1,
        usuario_id: 'usr_01',
        gerado_em: '2026-11-05T18:45:00.000Z',
        entidades: {
          veiculos: [{ id: 'veh_1', model: 'Civic' }],
        },
      };

      const serialized = serializarPayloadBackup(samplePayload);
      const restored = lerPayloadBackup(serialized);
      assert.deepStrictEqual(restored, samplePayload);

      const fileName = gerarNomeArquivoBackup(new Date(2026, 10, 5, 18, 45, 0));
      assert.strictEqual(fileName, 'autogest-20261105-1845.agbak');
    });
  });

  describe('US21.2, US21.3 & US21.9 · Ciclo Exportar → Cifrar → Decifrar → Comparar e Casos de Segurança', () => {
    it('deve exportar todas as entidades da lista central (incluindo exclusões lógicas e anexos só como metadados url_gcs), cifrar e decifrar fielmente', async () => {
      // Cria veículo, abastecimento (e exclui logicamente um segundo), despesa e anexo pendente + enviado
      const vehicle = await VehicleRepository.create(
        {
          model: 'Compass Longitude',
          plate: 'BRA2E19',
          year: 2022,
          tankCapacityL: 60,
          preferredFuel: 'Gasolina',
          initialOdometer: 10000,
        },
        'usr_backup_1',
      );

      const refuelAtivo = await RefuelRepository.create({
        vehicleId: vehicle.id,
        date: '2026-11-01T10:00:00.000Z',
        odometer: 10450,
        fuelType: 'Gasolina',
        pricePerLiter: 580,
        totalValue: 23200,
        liters: 40,
        isFullTank: true,
      });

      const refuelExcluido = await RefuelRepository.create({
        vehicleId: vehicle.id,
        date: '2026-11-02T10:00:00.000Z',
        odometer: 10800,
        fuelType: 'Gasolina',
        pricePerLiter: 580,
        totalValue: 17400,
        liters: 30,
        isFullTank: true,
      });
      await RefuelRepository.delete(refuelExcluido.id);

      // Anexo 1: enviado com url_gcs
      await AttachmentRepository.create({
        maintenanceId: 'maint_1',
        localPath: 'file:///data/user/0/com.autogest/cache/nota1.jpg',
        gcsUrl: 'https://storage.googleapis.com/autogest-bucket/nota1.jpg',
        fileSize: 120_000,
        mimeType: 'image/jpeg',
        uploadStatus: 'enviado',
      });

      // Anexo 2: pendente sem url_gcs
      await AttachmentRepository.create({
        maintenanceId: 'maint_1',
        localPath: 'file:///data/user/0/com.autogest/cache/nota2.jpg',
        gcsUrl: null,
        fileSize: 95_000,
        mimeType: 'image/jpeg',
        uploadStatus: 'pendente',
      });

      const exportResult = await gerarPayloadExportacao('usr_backup_1');

      // 1. O backup contém todas as entidades da lista central de sync
      const registeredEntities = SyncEntityRegistry.listRegisteredEntities();
      for (const entityName of registeredEntities) {
        assert.ok(
          entityName in exportResult.payload.entidades,
          `Entidade sincronizável "${entityName}" deve estar presente no backup`,
        );
      }

      // 2. Inclui exclusões lógicas
      const exportedRefuels = exportResult.payload.entidades.abastecimentos;
      assert.strictEqual(exportedRefuels.length, 2);
      const foundDeleted = exportedRefuels.find((r: any) => r.id === refuelExcluido.id);
      assert.ok(foundDeleted && (foundDeleted.deletedAt || foundDeleted.excluido_em));
      const foundActive = exportedRefuels.find((r: any) => r.id === refuelAtivo.id);
      assert.ok(foundActive && !foundActive.deletedAt);

      // 3. Anexos entram apenas como metadados (url_gcs, sem caminho local do dispositivo) e avisa pendentes
      assert.strictEqual(exportResult.anexosPendentesUpload, 1);
      const exportedAttachments = exportResult.payload.entidades.anexos;
      assert.strictEqual(exportedAttachments.length, 2);
      assert.strictEqual(
        exportedAttachments[0].url_gcs,
        'https://storage.googleapis.com/autogest-bucket/nota1.jpg',
      );
      assert.strictEqual(exportedAttachments[0].arquivo_local, null);
      assert.strictEqual(exportedAttachments[0].localPath, undefined);

      // 4. Ciclo completo: exportar -> cifrar -> decifrar -> comparar
      const backupCriado = await criarBackupLocal({
        usuarioId: 'usr_backup_1',
        senha: 'SenhaForte!Backup2026',
        iteracoesKdf: 10_000,
      });

      assert.strictEqual(backupCriado.anexosPendentesUpload, 1);
      assert.ok(backupCriado.nomeArquivo.endsWith('.agbak'));

      const payloadDecifrado = decifrarBackupAgbak(
        backupCriado.arquivoBytes,
        'SenhaForte!Backup2026',
      );
      assert.strictEqual(payloadDecifrado.usuario_id, 'usr_backup_1');
      assert.strictEqual(payloadDecifrado.entidades.veiculos.length, 1);
      assert.strictEqual(payloadDecifrado.entidades.veiculos[0].id, vehicle.id);
      assert.strictEqual(payloadDecifrado.entidades.abastecimentos.length, 2);
    });

    it('deve falhar ao decifrar com senha errada ou com 1 byte alterado no cabeçalho, payload ou tag', () => {
      const samplePayload = {
        versao_schema: 1,
        usuario_id: 'usr_sec_01',
        gerado_em: '2026-11-05T19:00:00.000Z',
        entidades: { veiculos: [{ id: 'v1', plate: 'ABC-1234' }] },
      };

      const agbakBytes = cifrarBackupAgbak(samplePayload, 'MinhaSenhaCorreta123', {
        iteracoes: 10_000,
      });

      // 1. Senha errada
      assert.throws(() => {
        decifrarBackupAgbak(agbakBytes, 'SenhaIncorreta999');
      });

      // 2. 1 byte alterado no payload cifrado
      const corruptedPayload = new Uint8Array(agbakBytes);
      corruptedPayload[42] ^= 0xff;
      assert.throws(() => {
        decifrarBackupAgbak(corruptedPayload, 'MinhaSenhaCorreta123');
      });

      // 3. 1 byte alterado no cabeçalho autenticado (ex.: número de iterações ou versão)
      const corruptedHeader = new Uint8Array(agbakBytes);
      corruptedHeader[10] ^= 0x01;
      assert.throws(() => {
        decifrarBackupAgbak(corruptedHeader, 'MinhaSenhaCorreta123');
      });

      // 4. 1 byte alterado na tag GCM final
      const corruptedTag = new Uint8Array(agbakBytes);
      corruptedTag[corruptedTag.length - 1] ^= 0xff;
      assert.throws(() => {
        decifrarBackupAgbak(corruptedTag, 'MinhaSenhaCorreta123');
      });
    });

    it('dois backups dos mesmos dados e mesma senha devem ter salt, nonce e conteúdo cifrado diferentes', () => {
      const samplePayload = {
        versao_schema: 1,
        usuario_id: 'usr_nonce_01',
        gerado_em: '2026-11-05T19:00:00.000Z',
        entidades: { veiculos: [{ id: 'v1', plate: 'BRA2E19' }] },
      };

      const backup1 = cifrarBackupAgbak(samplePayload, 'MesmaSenha123', { iteracoes: 10_000 });
      const backup2 = cifrarBackupAgbak(samplePayload, 'MesmaSenha123', { iteracoes: 10_000 });

      const header1 = lerCabecalhoAgbak(backup1);
      const header2 = lerCabecalhoAgbak(backup2);

      // Nonces de 12 bytes devem ser diferentes
      assert.notDeepStrictEqual(header1.nonce, header2.nonce);
      // Salts de 16 bytes devem ser diferentes
      assert.notDeepStrictEqual(header1.salt, header2.salt);
      // Conteúdo cifrado completo deve ser diferente
      assert.notDeepStrictEqual(backup1, backup2);

      // Mas ambos decifram para o mesmo payload
      assert.deepStrictEqual(decifrarBackupAgbak(backup1, 'MesmaSenha123'), samplePayload);
      assert.deepStrictEqual(decifrarBackupAgbak(backup2, 'MesmaSenha123'), samplePayload);
    });
  });

  describe('US21.5, US21.6, US21.8 & US21.9 · Auditoria na Camada de Repositórios e Filtros de Histórico', () => {
    it('deve registrar auditoria na criação/edição/exclusão de veículos e na edição/exclusão de abastecimentos, despesas, manutenções e custos fixos', async () => {
      // 1. Veículo: criação, edição e exclusão geram auditoria
      const v = await VehicleRepository.create(
        {
          model: 'Corolla XEi',
          plate: 'ABC-1234',
          year: 2021,
          tankCapacityL: 50,
          preferredFuel: 'Gasolina',
          initialOdometer: 20000,
        },
        'usr_aud_1',
      );
      await VehicleRepository.update(v.id, { model: 'Corolla Altis Hybrid', year: 2022 });

      // 2. Abastecimento: criação NÃO audita; edição e exclusão auditam
      const ref = await RefuelRepository.create({
        vehicleId: v.id,
        date: '2026-11-03T10:00:00.000Z',
        odometer: 20400,
        fuelType: 'Gasolina',
        pricePerLiter: 550,
        totalValue: 22000,
        liters: 40,
        isFullTank: true,
      });
      await RefuelRepository.update(ref.id, { totalValue: 23500, pricePerLiter: 587 });
      await RefuelRepository.delete(ref.id);

      // 3. Despesa: edição e exclusão auditam
      const exp = await ExpenseRepository.create({
        vehicleId: v.id,
        category: 'Seguro',
        amount: 250000,
        date: '2026-11-03T12:00:00.000Z',
        description: 'Seguro anual',
      });
      await ExpenseRepository.update(exp.id, { amount: 265000, description: 'Seguro total' });
      await ExpenseRepository.delete(exp.id);

      // 4. Manutenção: edição e exclusão auditam
      const maint = await MaintenanceRepository.create({
        vehicleId: v.id,
        date: '2026-11-04T09:00:00.000Z',
        odometer: 20500,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo 5W30',
        totalValue: 45000,
      });
      await MaintenanceRepository.update(maint.id, { totalValue: 49000 });
      await MaintenanceRepository.delete(maint.id);

      // 5. Custo Fixo: edição e exclusão auditam
      const fc = await FixedCostRepository.create({
        vehicleId: v.id,
        description: 'Estacionamento Mensal',
        monthlyAmount: 30000,
      });
      await FixedCostRepository.update(fc.id, { monthlyAmount: 35000 });
      await FixedCostRepository.delete(fc.id);

      // Exclui o veículo por último
      await VehicleRepository.delete(v.id);

      const allLogs = await AuditRepository.listAll();

      // Verifica eventos de veículos (criacao, edicao, exclusao)
      const vehicleLogs = await AuditRepository.listFiltered({ entidade: 'veiculos' });
      assert.strictEqual(vehicleLogs.length, 3);
      assert.deepStrictEqual(vehicleLogs.map(l => l.acao).sort(), [
        'criacao',
        'edicao',
        'exclusao',
      ]);

      const vehicleEditLog = vehicleLogs.find(l => l.acao === 'edicao')!;
      assert.strictEqual(vehicleEditLog.alteracoes.antes?.model, 'Corolla XEi');
      assert.strictEqual(vehicleEditLog.alteracoes.depois?.model, 'Corolla Altis Hybrid');

      // Verifica eventos de abastecimentos (edicao, exclusao)
      const refuelLogs = await AuditRepository.listFiltered({ entidade: 'abastecimentos' });
      assert.strictEqual(refuelLogs.length, 2);
      assert.deepStrictEqual(refuelLogs.map(l => l.acao).sort(), ['edicao', 'exclusao']);
      const refuelEditLog = refuelLogs.find(l => l.acao === 'edicao')!;
      assert.strictEqual(refuelEditLog.alteracoes.antes?.totalValue, 22000);
      assert.strictEqual(refuelEditLog.alteracoes.depois?.totalValue, 23500);

      // Verifica eventos de despesas (edicao, exclusao)
      const expenseLogs = await AuditRepository.listFiltered({ entidade: 'despesas' });
      assert.strictEqual(expenseLogs.length, 2);

      // Verifica eventos de manutenções (edicao, exclusao)
      const maintLogs = await AuditRepository.listFiltered({ entidade: 'manutencoes' });
      assert.strictEqual(maintLogs.length, 2);

      // Verifica eventos de custos fixos (edicao, exclusao)
      const fcLogs = await AuditRepository.listFiltered({ entidade: 'custos_fixos' });
      assert.strictEqual(fcLogs.length, 2);

      assert.strictEqual(allLogs.length, 11);

      // Verifica que os registros de auditoria não possuem atualizado_em nem excluido_em
      for (const log of allLogs) {
        assert.strictEqual((log as any).atualizado_em, undefined);
        assert.strictEqual((log as any).excluido_em, undefined);
      }

      // Verifica resolução automática de usuario_id pela sessão ativa (useAppStore) e consulta via AuditService
      useAppStore.getState().setAuth(
        {
          id: 'usr_session_99',
          firebaseUid: 'fb_99',
          name: 'Motorista Auditado',
          email: 'audit@autogest.app',
          createdAt: '2026-11-05T10:00:00.000Z',
          updatedAt: '2026-11-05T10:00:00.000Z',
        },
        true,
      );

      const expSession = await ExpenseRepository.create({
        vehicleId: v.id,
        category: 'Lavagem',
        amount: 6000,
        date: '2026-11-05T15:00:00.000Z',
        description: 'Lavagem simples',
      });
      await ExpenseRepository.update(expSession.id, { amount: 7500 });

      const sessionLogs = await AuditService.listarHistorico({
        entidade: 'despesas',
        periodo: 'todos',
        usuarioId: 'usr_session_99',
      });
      assert.strictEqual(sessionLogs.length, 1);
      assert.strictEqual(sessionLogs[0].usuario_id, 'usr_session_99');

      const refDate = new Date('2026-11-05T18:00:00.000Z');
      const inicio7Dias = resolverInicioPeriodoAuditoria('7dias', refDate);
      assert.ok(inicio7Dias instanceof Date);
      assert.strictEqual(refDate.getTime() - inicio7Dias!.getTime(), 7 * 24 * 60 * 60 * 1000);
      assert.strictEqual(resolverInicioPeriodoAuditoria('todos', refDate), undefined);

      useAppStore.getState().setAuth(null, false);
    });
  });
});
