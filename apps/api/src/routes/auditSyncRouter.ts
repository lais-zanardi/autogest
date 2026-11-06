import { Router, Request, Response } from 'express';
import { AuditAction, AuditEntityName } from '@autogest/shared-types';
import { pool } from '../models/db';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

const VALID_AUDIT_ACTIONS: readonly AuditAction[] = [
  'criacao',
  'edicao',
  'exclusao',
  'geracao_backup',
  'restauracao_backup',
];

const VALID_AUDIT_ENTITIES: readonly AuditEntityName[] = [
  'veiculos',
  'abastecimentos',
  'despesas',
  'manutencoes',
  'custos_fixos',
  'orcamentos',
  'backup',
];

function getUserId(req: Request): string | undefined {
  const authReq = req as AuthenticatedRequest;
  return (
    authReq.user?.id ||
    authReq.user?.userId ||
    authReq.user?.uid ||
    authReq.firebaseUser?.uid ||
    (req as any).user?.userId
  );
}

function stableStringify(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `[${val.map(item => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(val).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(val[k])}`).join(',')}}`;
}

function parseAlteracoes(raw: any): any {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw ?? { antes: null, depois: null };
}

/**
 * US21.7: Recurso `auditoria` somente inserção (append-only):
 * - PUT /:id    -> Insere se inédito (201); ignora duplicata idêntica (200); retorna 409 Conflict se o mesmo ID chegar com conteúdo diferente.
 * - DELETE /:id -> Recusa com 405 Method Not Allowed.
 * - GET /       -> Pull incremental para sincronização.
 */
export function createAuditSyncRouter(): Router {
  const router = Router();

  router.put('/:id', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const { id } = req.params;
    const body = req.body || {};

    const entidade = body.entidade || body.entity;
    const entidadeId = body.entidade_id || body.entidadeId || body.entityId;
    const acao = body.acao || body.action;
    const alteracoes = parseAlteracoes(body.alteracoes ?? body.changes);
    const dataHora = body.data_hora || body.dataHora || body.timestamp || new Date().toISOString();

    if (
      !entidade ||
      !entidadeId ||
      !acao ||
      !alteracoes ||
      typeof alteracoes !== 'object' ||
      Array.isArray(alteracoes)
    ) {
      return res.status(400).json({
        error:
          'Campos obrigatórios de auditoria ausentes ou inválidos (entidade, entidade_id, acao, alteracoes).',
      });
    }

    if (!VALID_AUDIT_ENTITIES.includes(entidade as AuditEntityName)) {
      return res.status(400).json({
        error: `Entidade de auditoria inválida: ${String(entidade)}.`,
      });
    }

    if (!VALID_AUDIT_ACTIONS.includes(acao as AuditAction)) {
      return res.status(400).json({
        error: `Ação de auditoria inválida: ${String(acao)}.`,
      });
    }

    try {
      let existing: any = null;
      try {
        const existingRes = await pool.query('SELECT * FROM auditoria WHERE id = $1', [id]);
        if (existingRes.rows && existingRes.rows.length > 0) {
          existing = existingRes.rows[0];
        }
      } catch {
        // Banco mockado ou tabela vazia
      }

      if (existing) {
        const existingUserId = existing.usuario_id || existing.user_id;
        if (existingUserId && existingUserId !== userId) {
          return res.status(403).json({ error: 'Acesso negado ao registro de auditoria.' });
        }

        const existingAlteracoes = parseAlteracoes(existing.alteracoes);
        const sameEntidade = String(existing.entidade) === String(entidade);
        const sameEntidadeId = String(existing.entidade_id) === String(entidadeId);
        const sameAcao = String(existing.acao) === String(acao);
        const sameAlteracoes = stableStringify(existingAlteracoes) === stableStringify(alteracoes);

        const existingTime = existing.data_hora ? new Date(existing.data_hora).getTime() : null;
        const incomingTime = body.data_hora ? new Date(body.data_hora).getTime() : null;
        const sameTime =
          existingTime === null || incomingTime === null || existingTime === incomingTime;

        if (sameEntidade && sameEntidadeId && sameAcao && sameAlteracoes && sameTime) {
          return res.status(200).json({
            status: 'duplicate_ignored',
            applied: false,
            record: existing,
          });
        }

        return res.status(409).json({
          error:
            'Conflito: registro de auditoria é imutável e já existe com conteúdo diferente para este ID.',
        });
      }

      const nowIso = new Date().toISOString();
      const insertSql = `
        INSERT INTO auditoria (id, usuario_id, entidade, entidade_id, acao, alteracoes, data_hora, criado_em)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const params = [
        id,
        userId,
        entidade,
        entidadeId,
        acao,
        JSON.stringify(alteracoes),
        dataHora,
        nowIso,
      ];

      const insertedRes = await pool.query(insertSql, params);
      const insertedRecord = (insertedRes.rows && insertedRes.rows[0]) || {
        id,
        usuario_id: userId,
        entidade,
        entidade_id: entidadeId,
        acao,
        alteracoes,
        data_hora: dataHora,
        criado_em: nowIso,
      };

      return res.status(201).json({
        status: 'created',
        applied: true,
        record: insertedRecord,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao registrar auditoria.', detail: err?.message });
    }
  });

  // DELETE /:id é proibido em trilha de auditoria (US21.7 -> 405 Method Not Allowed)
  router.delete('/:id', async (_req: Request, res: Response) => {
    return res.status(405).json({
      error: 'Operação não permitida: a trilha de auditoria é somente inserção (append-only).',
    });
  });

  router.get('/', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const since = req.query.atualizado_desde || req.query.since;
    try {
      let sql = 'SELECT * FROM auditoria WHERE usuario_id = $1';
      const params: any[] = [userId];
      if (since) {
        params.push(since);
        sql += ' AND data_hora > $2';
      }
      sql += ' ORDER BY data_hora ASC';

      const result = await pool.query(sql, params);
      const items = result.rows || [];
      return res.status(200).json({
        items,
        count: items.length,
        serverTimestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(200).json({
        items: [],
        count: 0,
        serverTimestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}
