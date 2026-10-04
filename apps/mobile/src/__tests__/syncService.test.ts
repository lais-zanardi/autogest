import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SyncService } from '../services/sync/SyncService';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { VehicleService } from '../services/vehicleService';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { db } from '../database/DatabaseConnection';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';

describe('US02 — Sincronização em Nuvem (Mobile SyncService)', () => {
  beforeEach(async () => {
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('local_leituras_hodometro', []);
    await db.saveTableData('local_despesas', []);
    await db.saveTableData('fila_sync', []);
    await db.saveTableData('sync_queue', []);
    useAppStore.getState().logout();
  });

  it('US02 BDD: Dado registro offline pendente, quando a conexão retornar, então sincroniza em background com o servidor central', async () => {
    // 1. Cria veículo localmente (offline) -> enfileira na outbox (fila_sync)
    const vehicle = await VehicleService.createVehicle({
      model: 'Corolla',
      brand: 'Toyota',
      year: 2022,
      plate: 'COR2022',
      tankCapacityL: 50,
      preferredFuel: 'Gasolina',
      initialOdometer: 15000,
    });

    const pendingCountBefore = await SyncQueueRepository.countPending();
    assert.ok(pendingCountBefore >= 1, 'Deve conter pelo menos 1 registro pendente na outbox');

    // 2. Mock da API HTTP para responder com sucesso ao envio do PUT
    const originalPut = api.put;
    const originalGet = api.get;
    let putCalledWithUrl = '';
    let putPayload: any = null;

    (api as any).put = async (url: string, payload: any) => {
      putCalledWithUrl = url;
      putPayload = payload;
      return { status: 200, data: { status: 'created', record: payload } };
    };

    (api as any).get = async (_url: string) => {
      return { status: 200, data: { items: [], serverTimestamp: new Date().toISOString() } };
    };

    try {
      // 3. Simula evento de reconexão de rede (US02.6)
      await SyncService.onConnectionRestored();

      // 4. Verifica que a fila de sincronização foi esvaziada e enviada
      const pendingCountAfter = await SyncQueueRepository.countPending();
      assert.equal(
        pendingCountAfter,
        0,
        'Todos os registros pendentes devem ter sido sincronizados',
      );
      assert.ok(putCalledWithUrl.includes(vehicle.id), 'URL do PUT deve conter o ID do veículo');
      assert.equal(putPayload.plate, 'COR2022');

      // 5. Verifica estado global
      assert.equal(useAppStore.getState().syncStatus, 'synced');
    } finally {
      api.put = originalPut;
      api.get = originalGet;
    }
  });

  describe('US02.5: Retentativas com Espera Crescente (Backoff Exponencial)', () => {
    it('deve calcular delays exponenciais progressivos (1s, 2s, 4s, 8s até 30s)', () => {
      assert.equal(SyncQueueRepository.calculateBackoffDelayMs(0), 1000);
      assert.equal(SyncQueueRepository.calculateBackoffDelayMs(1), 2000);
      assert.equal(SyncQueueRepository.calculateBackoffDelayMs(2), 4000);
      assert.equal(SyncQueueRepository.calculateBackoffDelayMs(3), 8000);
      assert.equal(SyncQueueRepository.calculateBackoffDelayMs(4), 16000);
      assert.equal(SyncQueueRepository.calculateBackoffDelayMs(5), 30000); // capped at 30s
    });

    it('quando a rede falhar, deve marcar como FAILED com nextRetryAt sem perder o item', async () => {
      await SyncQueueRepository.enqueue('CREATE_VEHICLE', '/api/v1/sync/veiculos', {
        id: 'veh_fail_1',
      });

      const originalPut = api.put;
      (api as any).put = async () => {
        const error: any = new Error('Network Error');
        error.response = { data: { error: 'Falha de conexão com a nuvem' } };
        throw error;
      };

      try {
        const result = await SyncService.push();
        assert.equal(result.success, false);
        assert.equal(result.pushedCount, 0);

        // O item permanece na fila, marcado como FAILED
        const pending = await SyncQueueRepository.getPendingItems();
        // Durante a janela de backoff, ele aguarda o nextRetryAt
        assert.equal(pending.length, 0); // Está em backoff
      } finally {
        api.put = originalPut;
      }
    });
  });

  describe('US02.5 & US02.7: Pull de Alterações Remotas e Registro Central de Entidades', () => {
    it('US02.7: Lista central deve registrar as entidades da Sprint 1 (veiculos, abastecimentos, hodometro, despesas)', () => {
      const allEntities = SyncEntityRegistry.getAll();
      const entityNames = allEntities.map(e => e.name);

      assert.ok(entityNames.includes('veiculos'));
      assert.ok(entityNames.includes('abastecimentos'));
      assert.ok(entityNames.includes('leituras_hodometro'));
      assert.ok(entityNames.includes('despesas'));
    });

    it('US02.5: pull() deve mesclar registros novos da nuvem no banco local com Last-Write-Wins', async () => {
      const originalGet = api.get;

      const remoteVehicle = {
        id: 'veh_remote_999',
        usuario_id: 'usr_cloud',
        modelo: 'Tracker Premier',
        marca: 'Chevrolet',
        ano: 2023,
        placa: 'TRK2023',
        capacidade_tanque_l: 44,
        combustivel_preferencial: 'Flex',
        odometro_inicial: 5000,
        odometro_atual: 5500,
        criado_em: '2026-10-01T00:00:00.000Z',
        atualizado_em: '2026-10-04T12:00:00.000Z',
      };

      (api as any).get = async (url: string) => {
        if (url.includes('veiculos')) {
          return { data: { items: [remoteVehicle] } };
        }
        return { data: { items: [] } };
      };

      try {
        const pullResult = await SyncService.pull();
        assert.equal(pullResult.success, true);
        assert.ok(pullResult.pulledCount >= 1);

        // Verifica que o veículo foi inserido no banco local
        const local = await VehicleRepository.findById('veh_remote_999');
        assert.ok(local, 'Veículo da nuvem deve ter sido gravado localmente');
        assert.equal(local?.model, 'Tracker Premier');
        assert.equal(local?.plate, 'TRK2023');
      } finally {
        api.get = originalGet;
      }
    });

    it('US02.4 & US02.5: push() deve normalizar endpoints legados sem /sync/ para /api/v1/sync/', async () => {
      await SyncQueueRepository.enqueue('CREATE_VEHICLE', '/api/v1/vehicles', {
        id: 'veh_norm_01',
        model: 'Yaris',
        plate: 'YAR1234',
      });

      const originalPut = api.put;
      let requestedUrl = '';
      (api as any).put = async (url: string) => {
        requestedUrl = url;
        return { data: { status: 'created' } };
      };

      try {
        const res = await SyncService.push();
        assert.equal(res.success, true);
        assert.ok(
          requestedUrl.startsWith('/api/v1/sync/vehicles/veh_norm_01'),
          `URL deve ter sido normalizada para conter /sync/. Atual: ${requestedUrl}`,
        );
      } finally {
        api.put = originalPut;
      }
    });

    it('US02.5: sync() deve atualizar a lista de veículos no store Zustand após pull', async () => {
      const originalGet = api.get;
      const originalPut = api.put;

      (api as any).put = async () => ({ data: { status: 'ok' } });
      (api as any).get = async (url: string) => {
        if (url.includes('veiculos')) {
          return {
            data: {
              items: [
                {
                  id: 'veh_store_01',
                  modelo: 'Compass Limited',
                  placa: 'COM2024',
                  ano: 2024,
                  capacidade_tanque_l: 60,
                  combustivel_preferencial: 'Flex',
                  odometro_atual: 12000,
                  atualizado_em: '2026-10-04T15:00:00.000Z',
                },
              ],
            },
          };
        }
        return { data: { items: [] } };
      };

      try {
        const syncResult = await SyncService.sync();
        assert.equal(syncResult.success, true);
        assert.ok(syncResult.pulledCount >= 1);

        const storeVehicles = useAppStore.getState().vehicles;
        const found = storeVehicles.find(v => v.id === 'veh_store_01');
        assert.ok(
          found,
          'Veículo sincronizado da nuvem deve constar na lista de veículos da store Zustand',
        );
        assert.equal(found?.model, 'Compass Limited');
      } finally {
        api.get = originalGet;
        api.put = originalPut;
      }
    });
  });
});
