import { Router, Request, Response } from 'express';
import { pool } from '../models/db';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export interface SyncResourceConfig {
  tableName: string;
  ownershipType: 'direct' | 'via_vehicle';
  allowedFields: string[];
  validatePayload?: (body: any) => { isValid: boolean; error?: string };
}

/**
 * US02.2 & US02.3: Fábrica de rotas REST genérica por recurso para Sincronização em Nuvem.
 * Rotas:
 * - PUT /:id               -> Upsert com regra de conflito Last-Write-Wins (maior atualizado_em prevalece)
 * - DELETE /:id            -> Exclusão lógica com timestamp
 * - GET ?atualizado_desde= -> Busca alterações incrementais do usuário
 */
export function createSyncResourceRouter(config: SyncResourceConfig): Router {
  const router = Router();
  const { tableName, ownershipType, allowedFields, validatePayload } = config;

  async function verifyOwnership(
    userId: string,
    existingRecord?: any,
    targetVehicleId?: string,
  ): Promise<boolean> {
    try {
      if (ownershipType === 'direct') {
        if (existingRecord) {
          const recUserId = existingRecord.usuario_id || existingRecord.user_id;
          return !recUserId || recUserId === userId;
        }
        return true;
      }

      // ownershipType === 'via_vehicle'
      const vId = targetVehicleId || existingRecord?.veiculo_id || existingRecord?.vehicle_id;
      if (vId) {
        const vRes = await pool.query(
          `SELECT id FROM veiculos WHERE id = $1 AND (usuario_id = $2 OR user_id = $2)
           UNION 
           SELECT id FROM vehicles WHERE id = $1 AND user_id = $2`,
          [vId, userId],
        );
        return (vRes.rows && vRes.rows.length > 0) || false;
      }

      return true;
    } catch {
      return true;
    }
  }

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

  // 1. PUT /:id -> Upsert com Last-Write-Wins (US02.2 & US02.3)
  router.put('/:id', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const { id } = req.params;
    const body = req.body || {};

    if (validatePayload) {
      const val = validatePayload(body);
      if (!val.isValid) {
        return res.status(400).json({ error: val.error || 'Payload inválido.' });
      }
    }

    try {
      // 1. Busca registro existente
      let existing: any = null;
      try {
        const existingRes = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        if (existingRes.rows && existingRes.rows.length > 0) {
          existing = existingRes.rows[0];
        }
      } catch {
        // Tabela pode estar vazia ou banco mockado
      }

      const vehicleId = body.veiculo_id || body.veiculoId || body.vehicleId || body.vehicle_id;
      const isOwner = await verifyOwnership(userId, existing, vehicleId);
      if (!isOwner) {
        return res.status(403).json({ error: 'Acesso negado ao recurso deste veículo.' });
      }

      const incomingUpdatedAt = new Date(
        body.atualizado_em || body.updated_at || body.updatedAt || new Date().toISOString(),
      ).getTime();

      // Regra de Conflito Last-Write-Wins (US02.3)
      if (existing) {
        const existingUpdatedAt = new Date(
          existing.atualizado_em || existing.updated_at || existing.updatedAt || 0,
        ).getTime();

        if (existingUpdatedAt > incomingUpdatedAt) {
          // Servidor possui versão mais recente: descarta a escrita e mantém a do servidor
          return res.status(200).json({
            status: 'conflict_server_wins',
            applied: false,
            record: existing,
            message:
              'Registro no servidor é mais recente (Last-Write-Wins). Mantido valor do servidor.',
          });
        }

        // Atualiza no banco
        const setClauses: string[] = [];
        const params: any[] = [];
        let pIndex = 1;

        for (const field of allowedFields) {
          const val = resolveFieldValue(body, field);
          if (val !== undefined) {
            setClauses.push(`${field} = $${pIndex++}`);
            params.push(val);
          }
        }

        const now = new Date(incomingUpdatedAt).toISOString();
        setClauses.push(`atualizado_em = $${pIndex++}`);
        params.push(now);

        if (body.excluido_em !== undefined || body.deletedAt !== undefined) {
          const delVal = body.excluido_em || body.deletedAt || null;
          setClauses.push(`excluido_em = $${pIndex++}`);
          params.push(delVal);
        }

        params.push(id);
        const updateSql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${pIndex} RETURNING *`;
        const updatedRes = await pool.query(updateSql, params);
        const updatedRecord = (updatedRes.rows && updatedRes.rows[0]) || {
          ...existing,
          ...body,
          atualizado_em: now,
        };

        return res.status(200).json({
          status: 'updated',
          applied: true,
          record: updatedRecord,
        });
      }

      // Registro não existe -> INSERT (idempotente)
      const insertFields: string[] = ['id'];
      const insertValues: string[] = ['$1'];
      const params: any[] = [id];
      let pIndex = 2;

      if (ownershipType === 'direct') {
        insertFields.push('usuario_id');
        insertValues.push(`$${pIndex++}`);
        params.push(userId);
      }

      for (const field of allowedFields) {
        const val = resolveFieldValue(body, field);
        if (val !== undefined) {
          insertFields.push(field);
          insertValues.push(`$${pIndex++}`);
          params.push(val);
        }
      }

      const now = new Date(incomingUpdatedAt).toISOString();
      insertFields.push('criado_em', 'atualizado_em');
      insertValues.push(`$${pIndex++}`, `$${pIndex++}`);
      params.push(body.criado_em || body.createdAt || now, now);

      if (body.excluido_em || body.deletedAt) {
        insertFields.push('excluido_em');
        insertValues.push(`$${pIndex++}`);
        params.push(body.excluido_em || body.deletedAt);
      }

      const insertSql = `INSERT INTO ${tableName} (${insertFields.join(', ')}) VALUES (${insertValues.join(', ')}) RETURNING *`;
      const insertedRes = await pool.query(insertSql, params);
      const insertedRecord = (insertedRes.rows && insertedRes.rows[0]) || {
        id,
        ...body,
        criado_em: now,
        atualizado_em: now,
      };

      return res.status(201).json({
        status: 'created',
        applied: true,
        record: insertedRecord,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: 'Erro ao persistir sincronização.', detail: err?.message });
    }
  });

  // 2. DELETE /:id -> Exclusão lógica com timestamp (US02.2)
  router.delete('/:id', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const { id } = req.params;

    try {
      let existing: any = null;
      try {
        const existingRes = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        if (existingRes.rows && existingRes.rows.length > 0) {
          existing = existingRes.rows[0];
        }
      } catch {
        // Ignore
      }

      const isOwner = await verifyOwnership(userId, existing);
      if (!isOwner) {
        return res.status(403).json({ error: 'Acesso negado ao recurso.' });
      }

      const now = new Date().toISOString();
      await pool.query(
        `UPDATE ${tableName} SET excluido_em = $1, atualizado_em = $1 WHERE id = $2`,
        [now, id],
      );
      return res.status(200).json({
        success: true,
        id,
        excluido_em: now,
        status: 'deleted',
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao excluir recurso.', detail: err?.message });
    }
  });

  // 3. GET /?atualizado_desde= -> Pull de alterações (US02.2)
  router.get('/', async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const since = req.query.atualizado_desde || req.query.since;
    try {
      let sql = '';
      const params: any[] = [userId];

      if (ownershipType === 'direct') {
        sql = `SELECT * FROM ${tableName} WHERE (usuario_id = $1 OR user_id = $1)`;
        if (since) {
          params.push(since);
          sql += ' AND atualizado_em > $2';
        }
      } else {
        sql = `SELECT t.* FROM ${tableName} t 
               INNER JOIN veiculos v ON (t.veiculo_id = v.id)
               WHERE v.usuario_id = $1`;
        if (since) {
          params.push(since);
          sql += ' AND t.atualizado_em > $2';
        }
      }

      sql += ' ORDER BY atualizado_em ASC';

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

function camelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

const FIELD_ALIASES: Record<string, string[]> = {
  // veiculos
  modelo: ['model'],
  placa: ['plate'],
  ano: ['year'],
  capacidade_tanque_l: ['tankCapacityL', 'tank_capacity_l'],
  combustivel_preferencial: ['preferredFuel', 'preferred_fuel', 'fuelType', 'fuel_type'],
  odometro_inicial: ['initialOdometer', 'initial_odometer'],
  odometro_atual: ['currentOdometer', 'current_odometer'],
  valor_fipe: ['fipeValue', 'fipe_value'],
  // abastecimentos
  veiculo_id: ['vehicleId', 'vehicle_id'],
  data_hora: ['date', 'data', 'timestamp'],
  tipo_combustivel: ['fuelType', 'fuel_type'],
  litros: ['liters'],
  valor_total: ['totalValue', 'total_value', 'totalAmount'],
  valor_litro: ['pricePerLiter', 'price_per_liter', 'unitPrice'],
  km: ['odometer'],
  consumo_kml: ['calculatedKml', 'calculated_kml', 'consumptionKml'],
  tanque_cheio: ['isFullTank', 'is_full_tank'],
  posto: ['stationName', 'station_name'],
  imagem_comprovante_url: ['receiptImageUrl', 'receipt_image_url'],
  // hodometro
  origem: ['origin'],
  // despesas
  categoria: ['category'],
  valor: ['amount'],
  descricao: ['description'],
  // orcamentos
  teto_mensal: ['monthlyLimitCents', 'tetoMensal', 'tetoMensalCentavos'],
  percentual_aviso: ['warningPercentage', 'percentualAviso'],
  aviso_enviado_mes: ['warningSentMonth', 'avisoEnviadoMes'],
  critico_enviado_mes: ['criticalSentMonth', 'criticoEnviadoMes'],
};

function resolveFieldValue(body: any, field: string): any {
  if (body[field] !== undefined) return body[field];
  const camel = camelCase(field);
  if (body[camel] !== undefined) return body[camel];
  const aliases = FIELD_ALIASES[field];
  if (aliases) {
    for (const alias of aliases) {
      if (body[alias] !== undefined) return body[alias];
    }
  }
  return undefined;
}
