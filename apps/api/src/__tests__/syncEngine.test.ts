import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response } from 'express';
import { createSyncResourceRouter } from '../routes/syncResourceRouter';
import { pool } from '../models/db';

describe('US02 — Sincronização em Nuvem (API & Engine)', () => {
  const mockUser = {
    id: 'usr_owner_111',
    name: 'Dono do Veículo',
    email: 'dono@autogest.com',
  };

  function createMockResponse() {
    let statusCode = 200;
    let responseBody: any = null;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        return this;
      },
      getStatusCode: () => statusCode,
      getBody: () => responseBody,
    };

    return res as unknown as Response & { getStatusCode: () => number; getBody: () => any };
  }

  describe('US02.3 & US02.8: Regra de Conflito Last-Write-Wins (LWW) e Idempotência', () => {
    it('deve inserir novo registro com sucesso via PUT /:id (idempotência)', async () => {
      const memoryStore: any[] = [];

      const originalQuery = pool.query;
      pool.query = (async (text: string, params: any[] = []) => {
        if (text.includes('SELECT') && text.includes('WHERE id = $1')) {
          const found = memoryStore.find(r => r.id === params[0]);
          return { rows: found ? [found] : [] } as any;
        }
        if (text.includes('INSERT INTO veiculos')) {
          const newRecord = {
            id: params[0],
            usuario_id: params[1],
            modelo: params[2],
            placa: params[3],
            criado_em: params[4],
            atualizado_em: params[5],
          };
          memoryStore.push(newRecord);
          return { rows: [newRecord] } as any;
        }
        if (text.includes('UPDATE veiculos')) {
          return { rows: [memoryStore[0]] } as any;
        }
        return { rows: [] } as any;
      }) as any;

      try {
        const router = createSyncResourceRouter({
          tableName: 'veiculos',
          ownershipType: 'direct',
          allowedFields: ['modelo', 'placa'],
        });

        const putHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.put)
          .route.stack[0].handle;

        const req1 = {
          params: { id: 'veh_sync_001' },
          body: {
            modelo: 'Civic',
            placa: 'BRA2E19',
            atualizado_em: '2026-10-04T10:00:00.000Z',
          },
          user: { id: mockUser.id },
        } as unknown as Request;

        const res1 = createMockResponse();
        await putHandler(req1, res1);

        assert.equal(res1.getStatusCode(), 201);
        assert.equal(res1.getBody().status, 'created');
        assert.equal(res1.getBody().record.id, 'veh_sync_001');

        // Idempotência: mesmo PUT enviado pela segunda vez não duplica o registro
        const res2 = createMockResponse();
        await putHandler(req1, res2);

        assert.equal(res2.getStatusCode(), 200);
        assert.equal(res2.getBody().status, 'updated');
        assert.equal(memoryStore.length, 1, 'Não deve duplicar registros no banco');
      } finally {
        pool.query = originalQuery;
      }
    });

    it('US02.3: deve descartar atualização se registro do servidor for mais recente (Last-Write-Wins)', async () => {
      const serverRecord = {
        id: 'veh_conflict_01',
        usuario_id: mockUser.id,
        modelo: 'Civic Versão Nuvem Mais Nova',
        placa: 'BRA2E19',
        atualizado_em: '2026-10-04T12:00:00.000Z', // Servidor em 12:00
      };

      const originalQuery = pool.query;
      pool.query = (async (text: string, _params: any[] = []) => {
        if (text.includes('SELECT') && text.includes('WHERE id = $1')) {
          return { rows: [serverRecord] } as any;
        }
        return { rows: [] } as any;
      }) as any;

      try {
        const router = createSyncResourceRouter({
          tableName: 'veiculos',
          ownershipType: 'direct',
          allowedFields: ['modelo', 'placa'],
        });

        const putHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.put)
          .route.stack[0].handle;

        // Cliente tenta sincronizar versão antiga (offline atrasado em 09:00)
        const staleReq = {
          params: { id: 'veh_conflict_01' },
          body: {
            modelo: 'Civic Versão Antiga do Celular',
            placa: 'BRA2E19',
            atualizado_em: '2026-10-04T09:00:00.000Z', // Cliente em 09:00 (mais antigo)
          },
          user: { id: mockUser.id },
        } as unknown as Request;

        const res = createMockResponse();
        await putHandler(staleReq, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().status, 'conflict_server_wins');
        assert.equal(res.getBody().applied, false);
        assert.equal(res.getBody().record.modelo, 'Civic Versão Nuvem Mais Nova');
      } finally {
        pool.query = originalQuery;
      }
    });

    it('US02.3: deve aceitar atualização se payload for mais recente que o servidor', async () => {
      let currentServerRecord = {
        id: 'veh_conflict_02',
        usuario_id: mockUser.id,
        modelo: 'Civic',
        placa: 'BRA2E19',
        atualizado_em: '2026-10-04T08:00:00.000Z', // Servidor em 08:00
      };

      const originalQuery = pool.query;
      pool.query = (async (text: string, params: any[] = []) => {
        if (text.includes('SELECT') && text.includes('WHERE id = $1')) {
          return { rows: [currentServerRecord] } as any;
        }
        if (text.includes('UPDATE veiculos')) {
          currentServerRecord = {
            ...currentServerRecord,
            modelo: params[0],
            atualizado_em: params[1],
          };
          return { rows: [currentServerRecord] } as any;
        }
        return { rows: [] } as any;
      }) as any;

      try {
        const router = createSyncResourceRouter({
          tableName: 'veiculos',
          ownershipType: 'direct',
          allowedFields: ['modelo', 'placa'],
        });

        const putHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.put)
          .route.stack[0].handle;

        // Cliente envia atualização mais nova (11:00)
        const newerReq = {
          params: { id: 'veh_conflict_02' },
          body: {
            modelo: 'Civic Atualizado com Aerofólio',
            atualizado_em: '2026-10-04T11:00:00.000Z',
          },
          user: { id: mockUser.id },
        } as unknown as Request;

        const res = createMockResponse();
        await putHandler(newerReq, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().status, 'updated');
        assert.equal(res.getBody().applied, true);
        assert.equal(currentServerRecord.modelo, 'Civic Atualizado com Aerofólio');
      } finally {
        pool.query = originalQuery;
      }
    });

    it('US02.2: deve filtrar estritamente pelo usuario_id do token no GET incremental ?atualizado_desde=', async () => {
      let executedSql = '';
      let executedParams: any[] = [];

      const originalQuery = pool.query;
      pool.query = (async (text: string, params: any[] = []) => {
        executedSql = text;
        executedParams = params;
        return { rows: [] } as any;
      }) as any;

      try {
        const router = createSyncResourceRouter({
          tableName: 'veiculos',
          ownershipType: 'direct',
          allowedFields: ['modelo'],
        });

        const getHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.get)
          .route.stack[0].handle;

        const req = {
          query: { atualizado_desde: '2026-10-01T00:00:00.000Z' },
          user: { id: mockUser.id },
        } as unknown as Request;

        const res = createMockResponse();
        await getHandler(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.match(executedSql, /usuario_id = \$1/);
        assert.match(executedSql, /atualizado_em > \$2/);
        assert.equal(executedParams[0], mockUser.id);
        assert.equal(executedParams[1], '2026-10-01T00:00:00.000Z');
      } finally {
        pool.query = originalQuery;
      }
    });

    it('US02.2: deve realizar exclusão lógica via DELETE /:id com gravação de excluido_em', async () => {
      let executedSql = '';
      let executedParams: any[] = [];

      const originalQuery = pool.query;
      pool.query = (async (text: string, params: any[] = []) => {
        if (text.includes('SELECT')) {
          return { rows: [{ id: 'veh_del_01', usuario_id: mockUser.id }] } as any;
        }
        if (text.includes('UPDATE')) {
          executedSql = text;
          executedParams = params;
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      }) as any;

      try {
        const router = createSyncResourceRouter({
          tableName: 'veiculos',
          ownershipType: 'direct',
          allowedFields: ['modelo'],
        });

        const deleteHandler = (router as any).stack.find(
          (s: any) => s.route && s.route.methods.delete,
        ).route.stack[0].handle;

        const req = {
          params: { id: 'veh_del_01' },
          user: { id: mockUser.id },
        } as unknown as Request;

        const res = createMockResponse();
        await deleteHandler(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().status, 'deleted');
        assert.match(
          executedSql,
          /UPDATE veiculos SET excluido_em = \$1, atualizado_em = \$1 WHERE id = \$2/,
        );
        assert.equal(executedParams[1], 'veh_del_01');
      } finally {
        pool.query = originalQuery;
      }
    });

    it('US02.3: deve resolver aliases em inglês (model, plate) para colunas do PostgreSQL (modelo, placa)', async () => {
      let insertedParams: any[] = [];
      const originalQuery = pool.query;
      pool.query = (async (text: string, params: any[] = []) => {
        if (text.includes('SELECT')) return { rows: [] } as any;
        if (text.includes('INSERT INTO veiculos')) {
          insertedParams = params;
          return {
            rows: [
              {
                id: params[0],
                usuario_id: params[1],
                modelo: params[2],
                placa: params[3],
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      }) as any;

      try {
        const router = createSyncResourceRouter({
          tableName: 'veiculos',
          ownershipType: 'direct',
          allowedFields: ['modelo', 'placa'],
        });

        const putHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.put)
          .route.stack[0].handle;

        const req = {
          params: { id: 'veh_alias_01' },
          body: {
            model: 'Corolla Cross',
            plate: 'BRA2E19',
          },
          user: { id: mockUser.id },
        } as unknown as Request;

        const res = createMockResponse();
        await putHandler(req, res);

        assert.equal(res.getStatusCode(), 201);
        assert.equal(insertedParams[2], 'Corolla Cross');
        assert.equal(insertedParams[3], 'BRA2E19');
      } finally {
        pool.query = originalQuery;
      }
    });

    it('US02.3: deve validar payloads das entidades (abastecimentos, hodometro, despesas)', async () => {
      const router = createSyncResourceRouter({
        tableName: 'abastecimentos',
        ownershipType: 'via_vehicle',
        allowedFields: ['veiculo_id', 'litros', 'valor_total'],
        validatePayload: body => {
          const vId = body.veiculo_id || body.vehicleId;
          if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
          return { isValid: true };
        },
      });

      const putHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.put)
        .route.stack[0].handle;

      const reqInvalid = {
        params: { id: 'ref_inv_01' },
        body: { litros: 40 }, // sem veiculo_id
        user: { id: mockUser.id },
      } as unknown as Request;

      const resInvalid = createMockResponse();
      await putHandler(reqInvalid, resInvalid);

      assert.equal(resInvalid.getStatusCode(), 400);
      assert.equal(resInvalid.getBody().error, 'veiculo_id é obrigatório.');
    });
  });
});
