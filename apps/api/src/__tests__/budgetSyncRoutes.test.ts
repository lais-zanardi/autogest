import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response } from 'express';
import { orcamentosSyncRouter } from '../routes/syncRoutes';
import { pool } from '../models/db';

describe('US15.1 — API de Sincronização de Orçamentos (/api/v1/sync/orcamentos)', () => {
  const mockUserId = 'usr_budget_api_01';

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

  it('deve validar teto_mensal > 0 e sincronizar orçamento vinculado a veículo do usuário via PUT /:id', async () => {
    const memoryOrcamentos: any[] = [];
    const originalQuery = pool.query;

    pool.query = (async (text: string, params: any[] = []) => {
      if (text.includes('FROM veiculos WHERE id = $1')) {
        return { rows: [{ id: params[0], usuario_id: mockUserId }] } as any;
      }
      if (text.includes('SELECT * FROM orcamentos WHERE id = $1')) {
        const found = memoryOrcamentos.find(o => o.id === params[0]);
        return { rows: found ? [found] : [] } as any;
      }
      if (text.includes('INSERT INTO orcamentos')) {
        const created = {
          id: params[0],
          veiculo_id: params[1],
          teto_mensal: Number(params[2]),
          percentual_aviso: Number(params[3] ?? 80),
          aviso_enviado_mes: params[4] ?? null,
          critico_enviado_mes: params[5] ?? null,
          criado_em: params[6],
          atualizado_em: params[7],
          excluido_em: params[8],
        };
        memoryOrcamentos.push(created);
        return { rows: [created] } as any;
      }
      return { rows: [] } as any;
    }) as any;

    try {
      const putHandler = (orcamentosSyncRouter as any).stack.find(
        (s: any) => s.route && s.route.methods.put,
      ).route.stack[0].handle;

      // 1. Rejeita teto_mensal inválido (<= 0)
      const reqInvalido = {
        params: { id: 'orc_001' },
        body: {
          veiculo_id: 'veh_001',
          teto_mensal: 0,
        },
        user: { id: mockUserId },
      } as unknown as Request;
      const resInvalido = createMockResponse();
      await putHandler(reqInvalido, resInvalido);
      assert.strictEqual(resInvalido.getStatusCode(), 400);

      // 2. Insere teto_mensal válido (R$ 1.000,00 = 100000 centavos)
      const reqValido = {
        params: { id: 'orc_001' },
        body: {
          veiculo_id: 'veh_001',
          teto_mensal: 100000,
          percentual_aviso: 80,
          aviso_enviado_mes: '2026-11',
          critico_enviado_mes: null,
        },
        user: { id: mockUserId },
      } as unknown as Request;
      const resValido = createMockResponse();
      await putHandler(reqValido, resValido);
      assert.strictEqual(resValido.getStatusCode(), 201);
      assert.strictEqual(resValido.getBody().record.teto_mensal, 100000);
      assert.strictEqual(resValido.getBody().record.percentual_aviso, 80);
    } finally {
      pool.query = originalQuery;
    }
  });
});
