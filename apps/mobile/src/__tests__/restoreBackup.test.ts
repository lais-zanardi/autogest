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
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import { useAppStore } from '../store/useAppStore';
import { empacotarArquivoAgbak, serializarCabecalhoAgbak } from '../backup/formato';
import { cifrarBackupAgbak } from '../backup/cifra';
import { criarBackupLocal } from '../backup/exportador';
import {
  aplicarRestauracaoBackup,
  ErroRestauracaoBackup,
  lerEValidarBackupAgbak,
  restaurarBackupAgbakCompleto,
} from '../backup/restaurador';
import {
  AGBAK_NONCE_BYTES,
  AGBAK_SALT_BYTES,
  deriveKeyPbkdf2Sha256,
  encryptAes256GcmWithAad,
} from '../services/cryptoSpike';

async function capturarSnapshotBanco(): Promise<Record<string, any[]>> {
  const snapshot: Record<string, any[]> = {};
  for (const def of SyncEntityRegistry.getAll()) {
    const rows = await db.getTableData(def.localTable);
    snapshot[def.localTable] = JSON.parse(JSON.stringify(rows));
  }
  snapshot.fila_sync = JSON.parse(JSON.stringify(await db.getTableData('fila_sync')));
  return snapshot;
}

describe('US38 — Restauração de Backup (.agbak)', () => {
  beforeEach(async () => {
    for (const def of SyncEntityRegistry.getAll()) {
      await db.saveTableData(def.localTable, []);
    }
    await db.saveTableData('auditoria', []);
    await db.saveTableData('fila_sync', []);
    await db.saveTableData('sync_queue', []);
    useAppStore.getState().logout();
    await localMigrator.runMigrations();
  });

  describe('US38.2, US38.3, US38.6 & US38.8 · Validações de Leitura, Mensagens Distintas e Imutabilidade do Banco em Erros', () => {
    it('deve rejeitar arquivo inválido (magic incorreto ou truncado), versão futura, senha errada/arquivo corrompido, payload com campo inválido e outro usuario_id deixando o banco idêntico', async () => {
      // Prepara estado inicial no banco que deve permanecer 100% intacto após todas as falhas
      const veiculoExistente = await VehicleRepository.create(
        {
          model: 'Onix Premier',
          plate: 'ABC1D23',
          year: 2023,
          tankCapacityL: 44,
          preferredFuel: 'Gasolina',
          initialOdometer: 15000,
        },
        'usr_dono_atual',
      );
      await RefuelRepository.create({
        vehicleId: veiculoExistente.id,
        date: '2026-11-01T12:00:00.000Z',
        odometer: 15300,
        fuelType: 'Gasolina',
        pricePerLiter: 560,
        totalValue: 16800,
        liters: 30,
        isFullTank: true,
      });

      const snapshotAntes = await capturarSnapshotBanco();

      // 1. Arquivo inválido (magic != AGBAK ou truncado)
      const bytesInvalidos = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      await assert.rejects(
        async () => {
          await restaurarBackupAgbakCompleto({
            arquivoBytes: bytesInvalidos,
            senha: 'QualquerSenha',
            usuarioAtualId: 'usr_dono_atual',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ErroRestauracaoBackup);
          assert.strictEqual(err.codigo, 'ARQUIVO_INVALIDO');
          assert.match(err.message, /arquivo inválido/i);
          return true;
        },
      );

      const bytesMagicErrado = new Uint8Array(60).fill(65); // 'AAAAA...'
      await assert.rejects(
        async () => {
          await restaurarBackupAgbakCompleto({
            arquivoBytes: bytesMagicErrado,
            senha: 'QualquerSenha',
            usuarioAtualId: 'usr_dono_atual',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ErroRestauracaoBackup);
          assert.strictEqual(err.codigo, 'ARQUIVO_INVALIDO');
          return true;
        },
      );

      // 2. Versão futura não suportada no cabeçalho binário (ex.: versão 2)
      const salt = new Uint8Array(AGBAK_SALT_BYTES).fill(1);
      const nonce = new Uint8Array(AGBAK_NONCE_BYTES).fill(2);
      const headerVersaoFutura = serializarCabecalhoAgbak({
        versaoFormato: 2,
        kdfId: 1,
        iteracoes: 10_000,
        salt,
        nonce,
      });
      const arquivoVersaoFutura = empacotarArquivoAgbak({
        cabecalhoBytes: headerVersaoFutura,
        ciphertext: new Uint8Array(32).fill(9),
        tag: new Uint8Array(16).fill(8),
      });

      await assert.rejects(
        async () => {
          await restaurarBackupAgbakCompleto({
            arquivoBytes: arquivoVersaoFutura,
            senha: 'Senha123',
            usuarioAtualId: 'usr_dono_atual',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ErroRestauracaoBackup);
          assert.strictEqual(err.codigo, 'VERSAO_NAO_SUPORTADA');
          assert.match(err.message, /versão.*não suportada/i);
          return true;
        },
      );

      // Gera um backup válido para testar senha errada e corrupção de bytes
      const backupValido = await criarBackupLocal({
        usuarioId: 'usr_dono_atual',
        senha: 'SenhaCorreta!2026',
        iteracoesKdf: 10_000,
      });
      // Reverte a auditoria de geração do backup apenas para manter o snapshotAntes como referência
      await db.saveTableData('auditoria', snapshotAntes.auditoria);
      await db.saveTableData('fila_sync', snapshotAntes.fila_sync);

      // 3. Senha incorreta -> SENHA_OU_ARQUIVO_CORROMPIDO
      await assert.rejects(
        async () => {
          await restaurarBackupAgbakCompleto({
            arquivoBytes: backupValido.arquivoBytes,
            senha: 'SenhaErrada!999',
            usuarioAtualId: 'usr_dono_atual',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ErroRestauracaoBackup);
          assert.strictEqual(err.codigo, 'SENHA_OU_ARQUIVO_CORROMPIDO');
          assert.match(err.message, /senha incorreta ou arquivo.*corrompido/i);
          return true;
        },
      );

      // 4. Arquivo corrompido (1 byte alterado no ciphertext) -> SENHA_OU_ARQUIVO_CORROMPIDO
      const bytesCorrompidos = new Uint8Array(backupValido.arquivoBytes);
      bytesCorrompidos[44] ^= 0xff;
      await assert.rejects(
        async () => {
          await restaurarBackupAgbakCompleto({
            arquivoBytes: bytesCorrompidos,
            senha: 'SenhaCorreta!2026',
            usuarioAtualId: 'usr_dono_atual',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ErroRestauracaoBackup);
          assert.strictEqual(err.codigo, 'SENHA_OU_ARQUIVO_CORROMPIDO');
          assert.match(err.message, /senha incorreta ou arquivo.*corrompido/i);
          return true;
        },
      );

      // 5. Payload cifrado corretamente mas com versao_schema futura (ex.: versao_schema: 99)
      const headerV1 = serializarCabecalhoAgbak({
        versaoFormato: 1,
        kdfId: 1,
        iteracoes: 10_000,
        salt,
        nonce,
      });
      const key = deriveKeyPbkdf2Sha256('SenhaCorreta!2026', salt, 10_000);
      const cifradoSchemaFuturo = encryptAes256GcmWithAad({
        plaintextUtf8: JSON.stringify({
          versao_schema: 99,
          usuario_id: 'usr_dono_atual',
          gerado_em: '2026-11-05T19:00:00.000Z',
          entidades: {},
        }),
        key,
        nonce,
        aadHeader: headerV1,
      });
      const arquivoSchemaFuturo = empacotarArquivoAgbak({
        cabecalhoBytes: headerV1,
        ciphertext: cifradoSchemaFuturo.ciphertext,
        tag: cifradoSchemaFuturo.tag,
      });

      await assert.rejects(
        async () => {
          await restaurarBackupAgbakCompleto({
            arquivoBytes: arquivoSchemaFuturo,
            senha: 'SenhaCorreta!2026',
            usuarioAtualId: 'usr_dono_atual',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ErroRestauracaoBackup);
          assert.strictEqual(err.codigo, 'VERSAO_NAO_SUPORTADA');
          return true;
        },
      );

      // 6. Payload com campo obrigatório inválido (ex.: veículo sem placa/modelo ou abastecimento com km inválido)
      const cifradoPayloadInvalido = encryptAes256GcmWithAad({
        plaintextUtf8: JSON.stringify({
          versao_schema: 1,
          usuario_id: 'usr_dono_atual',
          gerado_em: '2026-11-05T19:00:00.000Z',
          entidades: {
            veiculos: [
              {
                id: 'veh_invalido',
                // falta plate e model, e year é string inválida
                year: 'nao_eh_numero',
              },
            ],
          },
        }),
        key,
        nonce,
        aadHeader: headerV1,
      });
      const arquivoPayloadInvalido = empacotarArquivoAgbak({
        cabecalhoBytes: headerV1,
        ciphertext: cifradoPayloadInvalido.ciphertext,
        tag: cifradoPayloadInvalido.tag,
      });

      await assert.rejects(
        async () => {
          await restaurarBackupAgbakCompleto({
            arquivoBytes: arquivoPayloadInvalido,
            senha: 'SenhaCorreta!2026',
            usuarioAtualId: 'usr_dono_atual',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ErroRestauracaoBackup);
          assert.strictEqual(err.codigo, 'PAYLOAD_INVALIDO');
          return true;
        },
      );

      // 6b. Payload com entidades secundárias inválidas (leituras_hodometro, anexos, regras_manutencao, registros_pneu, registros_fluido)
      const entidadesSecundariasInvalidas: Array<Record<string, unknown>> = [
        { leituras_hodometro: [{ id: 'odo_invalido', vehicleId: 'veh_1', km: 'invalido' }] },
        { anexos: [{ id: 'att_invalido' }] },
        { regras_manutencao: [{ id: 'rule_invalido', vehicleId: '' }] },
        { registros_pneu: [{ id: 'tire_invalido', vehicleId: 'veh_1', odometer: Number.NaN }] },
        { registros_fluido: [{ id: 'fluid_invalido', vehicleId: '' }] },
      ];

      for (const entidadesInvalidas of entidadesSecundariasInvalidas) {
        const cifradoSecundario = encryptAes256GcmWithAad({
          plaintextUtf8: JSON.stringify({
            versao_schema: 1,
            usuario_id: 'usr_dono_atual',
            gerado_em: '2026-11-05T19:00:00.000Z',
            entidades: entidadesInvalidas,
          }),
          key,
          nonce,
          aadHeader: headerV1,
        });
        const arquivoSecundario = empacotarArquivoAgbak({
          cabecalhoBytes: headerV1,
          ciphertext: cifradoSecundario.ciphertext,
          tag: cifradoSecundario.tag,
        });

        await assert.rejects(
          async () => {
            await restaurarBackupAgbakCompleto({
              arquivoBytes: arquivoSecundario,
              senha: 'SenhaCorreta!2026',
              usuarioAtualId: 'usr_dono_atual',
            });
          },
          (err: any) => {
            assert.ok(err instanceof ErroRestauracaoBackup);
            assert.strictEqual(err.codigo, 'PAYLOAD_INVALIDO');
            return true;
          },
        );
      }

      // 7. Backup de outro usuario_id -> USUARIO_DIVERGENTE (US38.6)
      const backupOutroUsuario = cifrarBackupAgbak(
        {
          versao_schema: 1,
          usuario_id: 'usr_outra_conta_999',
          gerado_em: '2026-11-05T19:00:00.000Z',
          entidades: {
            veiculos: [
              {
                id: 'veh_outro',
                userId: 'usr_outra_conta_999',
                model: 'HB20',
                plate: 'XYZ9A88',
                year: 2022,
                tankCapacityL: 50,
                preferredFuel: 'Gasolina',
                initialOdometer: 0,
                currentOdometer: 0,
                createdAt: '2026-11-01T10:00:00.000Z',
                updatedAt: '2026-11-01T10:00:00.000Z',
                deletedAt: null,
              },
            ],
          },
        },
        'SenhaCorreta!2026',
        { iteracoes: 10_000 },
      );

      await assert.rejects(
        async () => {
          await restaurarBackupAgbakCompleto({
            arquivoBytes: backupOutroUsuario,
            senha: 'SenhaCorreta!2026',
            usuarioAtualId: 'usr_dono_atual',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ErroRestauracaoBackup);
          assert.strictEqual(err.codigo, 'USUARIO_DIVERGENTE');
          assert.match(err.message, /outro usuário/i);
          return true;
        },
      );

      // Compara snapshot completo do banco antes e depois de todas as falhas: deve ser 100% idêntico!
      const snapshotDepois = await capturarSnapshotBanco();
      assert.deepStrictEqual(snapshotDepois, snapshotAntes);
    });
  });

  describe('US38.4, US38.5, US38.7 & US38.8 · BDD: Restaurar em Banco Vazio e Mesclagem Transacional por atualizado_em', () => {
    it('(BDD) Dado um arquivo .agbak válido, ao selecioná-lo e confirmar em banco vazio, deve reproduzir todos os dados originais, recalcular indicadores/alertas, enfileirar na outbox e gravar auditoria', async () => {
      const usuarioId = 'usr_bdd_restore';
      useAppStore.getState().setUser({
        id: usuarioId,
        email: 'restore@autogest.app',
        name: 'Condutor Restore',
      } as any);

      // 1. Popula dados originais completos
      const v1 = await VehicleRepository.create(
        {
          model: 'Corolla Cross XRE',
          brand: 'Toyota',
          plate: 'BRA2E19',
          year: 2024,
          tankCapacityL: 47,
          preferredFuel: 'Gasolina',
          initialOdometer: 5000,
        },
        usuarioId,
      );

      await RefuelRepository.create(
        {
          vehicleId: v1.id,
          date: '2026-10-10T10:00:00.000Z',
          odometer: 5000,
          fuelType: 'Gasolina',
          pricePerLiter: 580,
          totalValue: 23200,
          liters: 40,
          isFullTank: true,
        },
        null,
      );

      await RefuelRepository.create(
        {
          vehicleId: v1.id,
          date: '2026-10-20T10:00:00.000Z',
          odometer: 5400,
          fuelType: 'Gasolina',
          pricePerLiter: 580,
          totalValue: 23200,
          liters: 40,
          isFullTank: true,
        },
        10,
      );

      await ExpenseRepository.create({
        vehicleId: v1.id,
        category: 'Seguro',
        amount: 25000,
        date: '2026-10-15T10:00:00.000Z',
        description: 'Parcela Seguro',
      });

      await MaintenanceRepository.create({
        vehicleId: v1.id,
        date: '2026-10-18T10:00:00.000Z',
        odometer: 5300,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Revisão 5.000 km',
        totalValue: 45000,
      });

      await FixedCostRepository.create({
        vehicleId: v1.id,
        description: 'Tag Pedágio',
        monthlyAmount: 2990,
      });

      // 2. Gera o backup .agbak
      const backup = await criarBackupLocal({
        usuarioId,
        senha: 'SenhaBackup@2026',
        iteracoesKdf: 10_000,
      });

      // Captura os dados originais de negócio antes de limpar o banco
      const veiculosOriginais = await db.getTableData('local_vehicles');
      const abastecimentosOriginais = await db.getTableData('local_refuels');
      const despesasOriginais = await db.getTableData('local_despesas');
      const manutencoesOriginais = await db.getTableData('manutencoes');
      const custosFixosOriginais = await db.getTableData('custos_fixos');

      // 3. Limpa completamente o banco local (simulando troca/perda de aparelho)
      for (const def of SyncEntityRegistry.getAll()) {
        await db.saveTableData(def.localTable, []);
      }
      await db.saveTableData('fila_sync', []);
      await db.saveTableData('sync_queue', []);
      useAppStore.getState().setVehicles([]);

      assert.strictEqual((await VehicleRepository.listAll()).length, 0);

      // 4. Passo 1 da UI (US38.4): Lê, decifra em memória e gera resumo para confirmação sem tocar no banco
      const inspecao = lerEValidarBackupAgbak({
        arquivoBytes: backup.arquivoBytes,
        senha: 'SenhaBackup@2026',
        usuarioAtualId: usuarioId,
      });

      assert.strictEqual(inspecao.resumo.usuarioId, usuarioId);
      assert.strictEqual(inspecao.resumo.contagemPorEntidade.veiculos, 1);
      assert.strictEqual(inspecao.resumo.contagemPorEntidade.abastecimentos, 2);
      assert.strictEqual(inspecao.resumo.contagemPorEntidade.despesas, 1);
      assert.strictEqual(inspecao.resumo.contagemPorEntidade.manutencoes, 1);
      assert.strictEqual(inspecao.resumo.contagemPorEntidade.custos_fixos, 1);
      // Confirma que a simples inspeção não gravou nada no banco ainda
      assert.strictEqual((await VehicleRepository.listAll()).length, 0);

      // 5. Passo 2 da UI (US38.5 & US38.7): Confirma e aplica a restauração
      const resultado = await aplicarRestauracaoBackup({
        payload: inspecao.payload,
        usuarioAtualId: usuarioId,
        nomeArquivo: backup.nomeArquivo,
      });

      assert.ok(resultado.inseridos >= 6);
      assert.strictEqual(resultado.atualizados, 0);

      // Verifica se os dados restaurados em banco vazio reproduzem o original
      const veiculosRestaurados = await db.getTableData('local_vehicles');
      const despesasRestauradas = await db.getTableData('local_despesas');
      const manutencoesRestauradas = await db.getTableData('manutencoes');
      const custosFixosRestaurados = await db.getTableData('custos_fixos');

      assert.deepStrictEqual(veiculosRestaurados, veiculosOriginais);
      assert.deepStrictEqual(despesasRestauradas, despesasOriginais);
      assert.deepStrictEqual(manutencoesRestauradas, manutencoesOriginais);
      assert.deepStrictEqual(custosFixosRestaurados, custosFixosOriginais);

      const abastecimentosRestaurados = await db.getTableData<any>('local_refuels');
      assert.strictEqual(abastecimentosRestaurados.length, abastecimentosOriginais.length);
      assert.strictEqual(abastecimentosRestaurados[1].calculatedKml, 10);

      // Verifica se os veículos e indicadores ficaram disponíveis na store global (US38.7)
      const state = useAppStore.getState();
      assert.strictEqual(state.vehicles.length, 1);
      assert.strictEqual(state.selectedVehicle?.id, v1.id);
      assert.ok(state.dashboardIndicators !== null);
      assert.strictEqual(state.dashboardIndicators?.averageConsumptionKml, 10);

      // Verifica se os registros restaurados foram enfileirados na outbox (US38.7)
      const filaOutbox = await SyncQueueRepository.getPendingItems();
      assert.ok(filaOutbox.length >= 6);

      // Verifica se a auditoria de restauração foi gravada (US38.7)
      const logsRestauracao = (await AuditRepository.listFiltered({ entidade: 'backup' })).filter(
        l => l.acao === 'restauracao_backup',
      );
      assert.strictEqual(logsRestauracao.length, 1);
      assert.strictEqual(logsRestauracao[0].entidade_id, backup.nomeArquivo);
    });

    it('deve mesclar por atualizado_em (inserir ausentes, atualizar quando backup for mais recente e manter local quando local for mais recente) e fazer rollback integral se ocorrer falha na transação', async () => {
      const usuarioId = 'usr_merge_test';

      // No banco local temos 2 veículos:
      // - veh_local_newer: atualizado em 2026-11-05T15:00:00.000Z (mais recente que o backup)
      // - veh_local_older: atualizado em 2026-11-01T10:00:00.000Z (mais antigo que o backup)
      await db.saveTableData('local_vehicles', [
        {
          id: 'veh_local_newer',
          userId: usuarioId,
          name: 'Civic Local Mais Novo',
          brand: 'Honda',
          model: 'Civic Touring Atualizado Localmente',
          year: 2024,
          plate: 'NEW1A11',
          fuelType: 'Gasolina',
          tankCapacityL: 56,
          preferredFuel: 'Gasolina',
          initialOdometer: 1000,
          currentOdometer: 2500,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-11-05T15:00:00.000Z',
          deletedAt: null,
        },
        {
          id: 'veh_local_older',
          userId: usuarioId,
          name: 'Tracker Versao Antiga',
          brand: 'Chevrolet',
          model: 'Tracker LT Antiga',
          year: 2022,
          plate: 'OLD2B22',
          fuelType: 'Gasolina',
          tankCapacityL: 44,
          preferredFuel: 'Gasolina',
          initialOdometer: 5000,
          currentOdometer: 6000,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-11-01T10:00:00.000Z',
          deletedAt: null,
        },
      ]);

      // O backup contém:
      // - veh_local_newer com updatedAt antigo (2026-11-02T10:00:00.000Z) -> NÃO deve sobrescrever o local
      // - veh_local_older com updatedAt mais novo (2026-11-04T18:00:00.000Z) -> DEVE vencer e atualizar o local
      // - veh_missing_in_local (ausente localmente) -> DEVE ser inserido
      const payloadBackup = {
        versao_schema: 1,
        usuario_id: usuarioId,
        gerado_em: '2026-11-04T19:00:00.000Z',
        entidades: {
          veiculos: [
            {
              id: 'veh_local_newer',
              userId: usuarioId,
              name: 'Civic Backup Antigo',
              brand: 'Honda',
              model: 'Civic Touring Antigo no Backup',
              year: 2023,
              plate: 'NEW1A11',
              fuelType: 'Gasolina',
              tankCapacityL: 56,
              preferredFuel: 'Gasolina',
              initialOdometer: 1000,
              currentOdometer: 1200,
              createdAt: '2026-10-01T10:00:00.000Z',
              updatedAt: '2026-11-02T10:00:00.000Z',
              deletedAt: null,
            },
            {
              id: 'veh_local_older',
              userId: usuarioId,
              name: 'Tracker Premier Atualizada no Backup',
              brand: 'Chevrolet',
              model: 'Tracker Premier 1.2 Turbo',
              year: 2023,
              plate: 'OLD2B22',
              fuelType: 'Gasolina',
              tankCapacityL: 44,
              preferredFuel: 'Gasolina',
              initialOdometer: 5000,
              currentOdometer: 9500,
              createdAt: '2026-10-01T10:00:00.000Z',
              updatedAt: '2026-11-04T18:00:00.000Z',
              deletedAt: null,
            },
            {
              id: 'veh_missing_in_local',
              userId: usuarioId,
              name: 'Nivus Highline Novo',
              brand: 'Volkswagen',
              model: 'Nivus Highline',
              year: 2024,
              plate: 'NIV3C33',
              fuelType: 'Gasolina',
              tankCapacityL: 52,
              preferredFuel: 'Gasolina',
              initialOdometer: 0,
              currentOdometer: 3200,
              createdAt: '2026-10-15T10:00:00.000Z',
              updatedAt: '2026-11-03T12:00:00.000Z',
              deletedAt: null,
            },
          ],
        },
      };

      const agbakBytes = cifrarBackupAgbak(payloadBackup, 'SenhaMerge123', { iteracoes: 10_000 });

      // Teste de atomicidade / rollback em caso de falha no meio da transação
      const snapshotAntesRollback = await capturarSnapshotBanco();
      await assert.rejects(async () => {
        await aplicarRestauracaoBackup({
          payload: payloadBackup,
          usuarioAtualId: usuarioId,
          nomeArquivo: 'falha-simulada.agbak',
          simularFalhaTransacional: true,
        });
      });
      const snapshotAposRollback = await capturarSnapshotBanco();
      assert.deepStrictEqual(snapshotAposRollback, snapshotAntesRollback);

      // Agora aplica normalmente sem falha
      const resultado = await restaurarBackupAgbakCompleto({
        arquivoBytes: agbakBytes,
        senha: 'SenhaMerge123',
        usuarioAtualId: usuarioId,
        nomeArquivo: 'merge-sucesso.agbak',
      });

      assert.strictEqual(resultado.inseridos, 1); // veh_missing_in_local
      assert.strictEqual(resultado.atualizados, 1); // veh_local_older
      assert.strictEqual(resultado.ignoradosPorVersaoLocalMaisRecente, 1); // veh_local_newer

      const veiculosFinais = await VehicleRepository.listAll();
      assert.strictEqual(veiculosFinais.length, 3);

      const vNewer = await VehicleRepository.findById('veh_local_newer');
      assert.strictEqual(vNewer?.model, 'Civic Touring Atualizado Localmente');
      assert.strictEqual(vNewer?.currentOdometer, 2500);

      const vOlder = await VehicleRepository.findById('veh_local_older');
      assert.strictEqual(vOlder?.model, 'Tracker Premier 1.2 Turbo');
      assert.strictEqual(vOlder?.currentOdometer, 9500);

      const vMissing = await VehicleRepository.findById('veh_missing_in_local');
      assert.strictEqual(vMissing?.model, 'Nivus Highline');
      assert.strictEqual(vMissing?.currentOdometer, 3200);
    });
  });
});
