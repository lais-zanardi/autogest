import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response } from 'express';
import { createAuditSyncRouter } from '../routes/auditSyncRouter';
import { pool } from '../models/db';

describe('US21.5, US21.7 & US21.9 — API de Sincronização de Auditoria (Somente Inserção)', () => {
  const mockUserId = 'usr_audit_001';

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

  it('deve inserir registro de auditoria no primeiro PUT /:id (201) e ignorar duplicata idêntica no segundo PUT /:id (200 idempotente)', async () => {
    const memoryAuditTable: any[] = [];
    const originalQuery = pool.query;

    pool.query = (async (text: string, params: any[] = []) => {
      if (text.includes('SELECT') && text.includes('FROM auditoria WHERE id = $1')) {
        const found = memoryAuditTable.find(r => r.id === params[0]);
        return { rows: found ? [found] : [] } as any;
      }
      if (text.includes('INSERT INTO auditoria')) {
        const record = {
          id: params[0],
          usuario_id: params[1],
          entidade: params[2],
          entidade_id: params[3],
          acao: params[4],
          alteracoes: typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5],
          data_hora: params[6],
          criado_em: params[7],
        };
        memoryAuditTable.push(record);
        return { rows: [record] } as any;
      }
      return { rows: [] } as any;
    }) as any;

    try {
      const router = createAuditSyncRouter();
      const putHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.put)
        .route.stack[0].handle;

      const payload = {
        entidade: 'veiculos',
        entidade_id: 'veh_123',
        acao: 'edicao',
        alteracoes: {
          antes: { modelo: 'Civic EXL', ano: 2020 },
          depois: { modelo: 'Civic Touring', ano: 2021 },
        },
        data_hora: '2026-11-05T18:30:00.000Z',
      };

      const req1 = {
        params: { id: 'aud_001' },
        body: payload,
        user: { id: mockUserId },
      } as unknown as Request;

      const res1 = createMockResponse();
      await putHandler(req1, res1);

      assert.strictEqual(res1.getStatusCode(), 201);
      assert.strictEqual(res1.getBody().status, 'created');
      assert.strictEqual(memoryAuditTable.length, 1);

      // Segundo PUT com exatamente o mesmo conteúdo -> 200 idempotente (ignora duplicata)
      const res2 = createMockResponse();
      await putHandler(req1, res2);

      assert.strictEqual(res2.getStatusCode(), 200);
      assert.strictEqual(res2.getBody().status, 'duplicate_ignored');
      assert.strictEqual(res2.getBody().applied, false);
      assert.strictEqual(memoryAuditTable.length, 1);
    } finally {
      pool.query = originalQuery;
    }
  });

  it('deve retornar 409 Conflict se o mesmo ID chegar no PUT /:id com conteúdo diferente', async () => {
    const existingRecord = {
      id: 'aud_conflict_001',
      usuario_id: mockUserId,
      entidade: 'despesas',
      entidade_id: 'exp_100',
      acao: 'edicao',
      alteracoes: {
        antes: { valor: 5000 },
        depois: { valor: 7500 },
      },
      data_hora: '2026-11-05T18:30:00.000Z',
    };

    const originalQuery = pool.query;
    pool.query = (async (text: string) => {
      if (text.includes('SELECT') && text.includes('FROM auditoria WHERE id = $1')) {
        return { rows: [existingRecord] } as any;
      }
      return { rows: [] } as any;
    }) as any;

    try {
      const router = createAuditSyncRouter();
      const putHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.put)
        .route.stack[0].handle;

      // Mesmo ID 'aud_conflict_001', mas ação/alterações diferentes
      const reqConflict = {
        params: { id: 'aud_conflict_001' },
        body: {
          entidade: 'despesas',
          entidade_id: 'exp_100',
          acao: 'exclusao',
          alteracoes: {
            antes: { valor: 9999 },
            depois: null,
          },
          data_hora: '2026-11-05T18:30:00.000Z',
        },
        user: { id: mockUserId },
      } as unknown as Request;

      const res = createMockResponse();
      await putHandler(reqConflict, res);

      assert.strictEqual(res.getStatusCode(), 409);
      assert.ok(
        res.getBody().error.toLowerCase().includes('imutável') ||
          res.getBody().error.toLowerCase().includes('conflito') ||
          res.getBody().error.toLowerCase().includes('diferente'),
      );
    } finally {
      pool.query = originalQuery;
    }
  });

  it('deve recusar DELETE /:id com status 405 Method Not Allowed (somente inserção)', async () => {
    const router = createAuditSyncRouter();
    const deleteHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.delete)
      .route.stack[0].handle;

    const req = {
      params: { id: 'aud_001' },
      user: { id: mockUserId },
    } as unknown as Request;

    const res = createMockResponse();
    await deleteHandler(req, res);

    assert.strictEqual(res.getStatusCode(), 405);
  });

  it('deve retornar 400 Bad Request quando entidade, acao ou alteracoes forem inválidos', async () => {
    const router = createAuditSyncRouter();
    const putHandler = (router as any).stack.find((s: any) => s.route && s.route.methods.put).route
      .stack[0].handle;

    // 1. Ação inválida fora do enum
    const reqInvalidAction = {
      params: { id: 'aud_invalid_01' },
      body: {
        entidade: 'veiculos',
        entidade_id: 'veh_1',
        acao: 'acao_inexistente',
        alteracoes: { antes: null, depois: {} },
      },
      user: { id: mockUserId },
    } as unknown as Request;
    const res1 = createMockResponse();
    await putHandler(reqInvalidAction, res1);
    assert.strictEqual(res1.getStatusCode(), 400);

    // 2. Entidade inválida fora do enum
    const reqInvalidEntity = {
      params: { id: 'aud_invalid_02' },
      body: {
        entidade: 'tabela_desconhecida',
        entidade_id: 'x_1',
        acao: 'edicao',
        alteracoes: { antes: {}, depois: {} },
      },
      user: { id: mockUserId },
    } as unknown as Request;
    const res2 = createMockResponse();
    await putHandler(reqInvalidEntity, res2);
    assert.strictEqual(res2.getStatusCode(), 400);
  });
});
