import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import {
  VehicleShareCreatedResponse,
  VehicleShareSummary,
} from '@autogest/shared-types';
import { pool } from '../models/db';
import {
  gerarTokenOpacoSeguro,
  hashTokenOpaco,
  serializarPerfilPublicoVeiculo,
  VALIDADE_PADRAO_COMPARTILHAMENTO_DIAS,
} from '../services/publicProfileDomain';

const PUBLIC_NOT_FOUND_MESSAGE = 'Perfil indisponível ou link expirado.';

export interface StoredShareRow {
  id: string;
  veiculo_id: string;
  usuario_id: string;
  token_opaco_hash: string;
  criado_em: string;
  expira_em: string;
  revogado_em: string | null;
}

export interface ShareRepository {
  verificarTitularidadeVeiculo(veiculoId: string, usuarioId: string): Promise<boolean>;
  criarCompartilhamento(params: {
    veiculoId: string;
    usuarioId: string;
    tokenHash: string;
    criadoEm: string;
    expiraEm: string;
  }): Promise<StoredShareRow>;
  listarPorVeiculo(veiculoId: string, usuarioId: string): Promise<VehicleShareSummary[]>;
  revogar(veiculoId: string, usuarioId: string, compartilhamentoId?: string): Promise<boolean>;
  buscarPorHash(tokenHash: string): Promise<StoredShareRow | null>;
  obterDadosPublicosVeiculo(
    veiculoId: string,
  ): Promise<{ veiculo: Record<string, any> | null; manutencoes: Array<Record<string, any>> }>;
}

/**
 * US20.3: Rate limiter próprio por IP para o endpoint público `/api/v1/publico/perfil/:token`.
 */
export class PublicProfileRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(maxRequests: number = 30, windowMs: number = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  allow(ip: string, nowMs: number = Date.now()): boolean {
    const key = ip || 'unknown';
    const cutoff = nowMs - this.windowMs;
    const recent = (this.hits.get(key) || []).filter(ts => ts > cutoff);
    if (recent.length >= this.maxRequests) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return true;
  }
}

export class InMemoryShareRepository implements ShareRepository {
  private vehicles = new Map<string, Record<string, any>>();
  private maintenances = new Map<string, Array<Record<string, any>>>();
  private shares: StoredShareRow[] = [];

  seedVehicle(v: Record<string, any>) {
    this.vehicles.set(v.id, v);
  }

  seedMaintenances(veiculoId: string, items: Array<Record<string, any>>) {
    this.maintenances.set(veiculoId, items);
  }

  dumpRawShares(): StoredShareRow[] {
    return [...this.shares];
  }

  async verificarTitularidadeVeiculo(veiculoId: string, usuarioId: string): Promise<boolean> {
    const v = this.vehicles.get(veiculoId);
    return Boolean(v && v.usuario_id === usuarioId && !v.excluido_em);
  }

  async criarCompartilhamento(params: {
    veiculoId: string;
    usuarioId: string;
    tokenHash: string;
    criadoEm: string;
    expiraEm: string;
  }): Promise<StoredShareRow> {
    const row: StoredShareRow = {
      id: crypto.randomUUID(),
      veiculo_id: params.veiculoId,
      usuario_id: params.usuarioId,
      token_opaco_hash: params.tokenHash,
      criado_em: params.criadoEm,
      expira_em: params.expiraEm,
      revogado_em: null,
    };
    this.shares.push(row);
    return row;
  }

  async listarPorVeiculo(veiculoId: string, usuarioId: string): Promise<VehicleShareSummary[]> {
    return this.shares
      .filter(s => s.veiculo_id === veiculoId && s.usuario_id === usuarioId)
      .map(s => ({
        id: s.id,
        veiculo_id: s.veiculo_id,
        criado_em: s.criado_em,
        expira_em: s.expira_em,
        revogado_em: s.revogado_em,
      }));
  }

  async revogar(
    veiculoId: string,
    usuarioId: string,
    compartilhamentoId?: string,
  ): Promise<boolean> {
    const now = new Date().toISOString();
    let count = 0;
    for (const s of this.shares) {
      if (
        s.veiculo_id === veiculoId &&
        s.usuario_id === usuarioId &&
        !s.revogado_em &&
        (!compartilhamentoId || s.id === compartilhamentoId)
      ) {
        s.revogado_em = now;
        count += 1;
      }
    }
    return count > 0;
  }

  async buscarPorHash(tokenHash: string): Promise<StoredShareRow | null> {
    return this.shares.find(s => s.token_opaco_hash === tokenHash) || null;
  }

  async obterDadosPublicosVeiculo(veiculoId: string) {
    return {
      veiculo: this.vehicles.get(veiculoId) || null,
      manutencoes: this.maintenances.get(veiculoId) || [],
    };
  }
}

export class PostgresShareRepository implements ShareRepository {
  async verificarTitularidadeVeiculo(veiculoId: string, usuarioId: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT 1 FROM veiculos WHERE id = $1 AND usuario_id = $2 AND excluido_em IS NULL LIMIT 1',
      [veiculoId, usuarioId],
    );
    return rows.length > 0;
  }

  async criarCompartilhamento(params: {
    veiculoId: string;
    usuarioId: string;
    tokenHash: string;
    criadoEm: string;
    expiraEm: string;
  }): Promise<StoredShareRow> {
    const { rows } = await pool.query(
      `INSERT INTO compartilhamentos (veiculo_id, usuario_id, token_opaco_hash, criado_em, expira_em)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, veiculo_id, usuario_id, token_opaco_hash, criado_em, expira_em, revogado_em`,
      [params.veiculoId, params.usuarioId, params.tokenHash, params.criadoEm, params.expiraEm],
    );
    const r = rows[0];
    return {
      id: r.id,
      veiculo_id: r.veiculo_id,
      usuario_id: r.usuario_id,
      token_opaco_hash: r.token_opaco_hash,
      criado_em: new Date(r.criado_em).toISOString(),
      expira_em: new Date(r.expira_em).toISOString(),
      revogado_em: r.revogado_em ? new Date(r.revogado_em).toISOString() : null,
    };
  }

  async listarPorVeiculo(veiculoId: string, usuarioId: string): Promise<VehicleShareSummary[]> {
    const { rows } = await pool.query(
      `SELECT id, veiculo_id, criado_em, expira_em, revogado_em
       FROM compartilhamentos
       WHERE veiculo_id = $1 AND usuario_id = $2
       ORDER BY criado_em DESC`,
      [veiculoId, usuarioId],
    );
    return rows.map(r => ({
      id: r.id,
      veiculo_id: r.veiculo_id,
      criado_em: new Date(r.criado_em).toISOString(),
      expira_em: new Date(r.expira_em).toISOString(),
      revogado_em: r.revogado_em ? new Date(r.revogado_em).toISOString() : null,
    }));
  }

  async revogar(
    veiculoId: string,
    usuarioId: string,
    compartilhamentoId?: string,
  ): Promise<boolean> {
    const query = compartilhamentoId
      ? 'UPDATE compartilhamentos SET revogado_em = CURRENT_TIMESTAMP WHERE veiculo_id = $1 AND usuario_id = $2 AND id = $3 AND revogado_em IS NULL'
      : 'UPDATE compartilhamentos SET revogado_em = CURRENT_TIMESTAMP WHERE veiculo_id = $1 AND usuario_id = $2 AND revogado_em IS NULL';
    const params = compartilhamentoId
      ? [veiculoId, usuarioId, compartilhamentoId]
      : [veiculoId, usuarioId];
    const res = await pool.query(query, params);
    return (res.rowCount || 0) > 0;
  }

  async buscarPorHash(tokenHash: string): Promise<StoredShareRow | null> {
    const { rows } = await pool.query(
      `SELECT id, veiculo_id, usuario_id, token_opaco_hash, criado_em, expira_em, revogado_em
       FROM compartilhamentos
       WHERE token_opaco_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      veiculo_id: r.veiculo_id,
      usuario_id: r.usuario_id,
      token_opaco_hash: r.token_opaco_hash,
      criado_em: new Date(r.criado_em).toISOString(),
      expira_em: new Date(r.expira_em).toISOString(),
      revogado_em: r.revogado_em ? new Date(r.revogado_em).toISOString() : null,
    };
  }

  async obterDadosPublicosVeiculo(veiculoId: string) {
    const { rows: vRows } = await pool.query(
      `SELECT modelo, marca, ano, placa, combustivel_preferencial, odometro_atual
       FROM veiculos
       WHERE id = $1 AND excluido_em IS NULL
       LIMIT 1`,
      [veiculoId],
    );
    if (!vRows.length) return { veiculo: null, manutencoes: [] };

    const { rows: mRows } = await pool.query(
      `SELECT TO_CHAR(data, 'YYYY-MM-DD') AS data, tipo, tipo_servico, descricao, km
       FROM manutencoes
       WHERE veiculo_id = $1 AND excluido_em IS NULL
       ORDER BY data DESC`,
      [veiculoId],
    );

    return { veiculo: vRows[0], manutencoes: mRows };
  }
}

function resolveUserId(req: any): string | null {
  return req.user?.id || req.user?.userId || req.firebaseUser?.uid || null;
}

export class ShareController {
  private static shareRepo: ShareRepository = new PostgresShareRepository();
  private static rateLimiter: PublicProfileRateLimiter = new PublicProfileRateLimiter(30, 60_000);
  private static nowFn: () => Date = () => new Date();

  static setDependencies(deps: {
    shareRepo?: ShareRepository;
    rateLimiter?: PublicProfileRateLimiter;
    nowFn?: () => Date;
  }) {
    if (deps.shareRepo) this.shareRepo = deps.shareRepo;
    if (deps.rateLimiter) this.rateLimiter = deps.rateLimiter;
    if (deps.nowFn) this.nowFn = deps.nowFn;
  }

  /**
   * US20.2: POST /api/v1/veiculos/:id/compartilhamentos (autenticado)
   */
  static async createShare(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = resolveUserId(req);
      const veiculoId = String(req.params.id || '').trim();
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });
      if (!veiculoId) return res.status(400).json({ error: 'Veículo obrigatório.' });

      const owns = await ShareController.shareRepo.verificarTitularidadeVeiculo(veiculoId, userId);
      if (!owns) {
        return res.status(404).json({ error: 'Veículo não encontrado.' });
      }

      const token = gerarTokenOpacoSeguro();
      const tokenHash = hashTokenOpaco(token);
      const now = ShareController.nowFn();
      const dias = Math.max(
        1,
        Math.min(
          90,
          Number(req.body?.diasValidade) || VALIDADE_PADRAO_COMPARTILHAMENTO_DIAS,
        ),
      );
      const expiraEm = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();

      const saved = await ShareController.shareRepo.criarCompartilhamento({
        veiculoId,
        usuarioId: userId,
        tokenHash,
        criadoEm: now.toISOString(),
        expiraEm,
      });

      const baseUrl = (process.env.PUBLIC_API_BASE_URL || 'https://api.autogest.app').replace(
        /\/+$/,
        '',
      );
      const payload: VehicleShareCreatedResponse = {
        id: saved.id,
        veiculo_id: saved.veiculo_id,
        token,
        url_publica: `${baseUrl}/api/v1/publico/perfil/${token}`,
        criado_em: saved.criado_em,
        expira_em: saved.expira_em,
      };

      return res.status(201).json(payload);
    } catch (error) {
      return next(error);
    }
  }

  static async listShares(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = resolveUserId(req);
      const veiculoId = String(req.params.id || '').trim();
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const owns = await ShareController.shareRepo.verificarTitularidadeVeiculo(veiculoId, userId);
      if (!owns) return res.status(404).json({ error: 'Veículo não encontrado.' });

      const items = await ShareController.shareRepo.listarPorVeiculo(veiculoId, userId);
      return res.status(200).json({ items });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * US20.2: DELETE /api/v1/veiculos/:id/compartilhamentos(/:compartilhamentoId)
   */
  static async revokeShare(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = resolveUserId(req);
      const veiculoId = String(req.params.id || '').trim();
      const compartilhamentoId = req.params.compartilhamentoId
        ? String(req.params.compartilhamentoId)
        : undefined;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const owns = await ShareController.shareRepo.verificarTitularidadeVeiculo(veiculoId, userId);
      if (!owns) return res.status(404).json({ error: 'Veículo não encontrado.' });

      const revoked = await ShareController.shareRepo.revogar(
        veiculoId,
        userId,
        compartilhamentoId,
      );
      return res.status(200).json({ revogado: revoked });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * US20.3: GET /api/v1/publico/perfil/:token (sem autenticação, com rate limit próprio
   * e resposta idêntica para token inexistente, revogado ou expirado).
   */
  static async getPublicProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const now = ShareController.nowFn();
      const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');

      if (!ShareController.rateLimiter.allow(ip, now.getTime())) {
        return res.status(429).json({
          error: 'Muitas consultas em pouco tempo. Tente novamente em instantes.',
        });
      }

      const token = String(req.params.token || '').trim();
      if (!token) {
        return res.status(404).json({ error: PUBLIC_NOT_FOUND_MESSAGE });
      }

      const tokenHash = hashTokenOpaco(token);
      const share = await ShareController.shareRepo.buscarPorHash(tokenHash);

      const expired = share ? new Date(share.expira_em).getTime() <= now.getTime() : true;
      if (!share || share.revogado_em || expired) {
        return res.status(404).json({ error: PUBLIC_NOT_FOUND_MESSAGE });
      }

      const { veiculo, manutencoes } = await ShareController.shareRepo.obterDadosPublicosVeiculo(
        share.veiculo_id,
      );
      if (!veiculo) {
        return res.status(404).json({ error: PUBLIC_NOT_FOUND_MESSAGE });
      }

      const publicProfile = serializarPerfilPublicoVeiculo(veiculo, manutencoes, share.expira_em);
      return res.status(200).json(publicProfile);
    } catch (error) {
      return next(error);
    }
  }
}
