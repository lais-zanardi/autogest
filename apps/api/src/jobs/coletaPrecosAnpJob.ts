import crypto from 'crypto';
import { FuelPriceRecord, LocalPriceHistoryRecord } from '@autogest/shared-types';
import { pool } from '../models/db';
import {
  AnpDadosAbertosProvider,
  PrecoCombustivelColetado,
  ProvedorPrecos,
} from '../integracoes/anp';
import {
  PostosRepository,
  ProvedorPostos,
} from '../integracoes/postos';

export interface JobLogger {
  info(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

export interface PrecosCombustivelRepository {
  salvarLote(registros: PrecoCombustivelColetado[]): Promise<number>;
  buscarPorMunicipioECombustivel(
    municipio: string,
    combustivel: string,
    limiteDias?: number,
  ): Promise<FuelPriceRecord[]>;
  listarTodos(atualizadoDesde?: string): Promise<FuelPriceRecord[]>;
}

function normalizarTexto(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Repositório em memória para testes unitários sem banco PostgreSQL
 */
export class InMemoryPrecosRepository implements PrecosCombustivelRepository {
  private items: FuelPriceRecord[] = [];

  async salvarLote(registros: PrecoCombustivelColetado[]): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;

    for (const reg of registros) {
      const idx = this.items.findIndex(
        item =>
          normalizarTexto(item.municipio) === normalizarTexto(reg.municipio) &&
          item.uf.toUpperCase() === reg.uf.toUpperCase() &&
          normalizarTexto(item.combustivel) === normalizarTexto(reg.combustivel) &&
          item.data_coleta === reg.data_coleta,
      );

      if (idx >= 0) {
        this.items[idx] = {
          ...this.items[idx],
          preco_centavos: reg.preco_centavos,
          fonte: reg.fonte,
          granularidade: reg.granularidade,
          sincronizado_em: now,
        };
      } else {
        this.items.push({
          id: crypto.randomUUID(),
          municipio: reg.municipio,
          uf: reg.uf,
          combustivel: reg.combustivel,
          preco_centavos: reg.preco_centavos,
          data_coleta: reg.data_coleta,
          fonte: reg.fonte,
          granularidade: reg.granularidade,
          sincronizado_em: now,
        });
      }
      count += 1;
    }

    return count;
  }

  async buscarPorMunicipioECombustivel(
    municipio: string,
    combustivel: string,
    limiteDias: number = 7,
  ): Promise<FuelPriceRecord[]> {
    const mNorm = normalizarTexto(municipio);
    const cNorm = normalizarTexto(combustivel);

    return this.items
      .filter(
        item =>
          normalizarTexto(item.municipio) === mNorm &&
          normalizarTexto(item.combustivel) === cNorm,
      )
      .sort((a, b) => b.data_coleta.localeCompare(a.data_coleta))
      .slice(0, limiteDias);
  }

  async listarTodos(atualizadoDesde?: string): Promise<FuelPriceRecord[]> {
    if (!atualizadoDesde) {
      return [...this.items].sort((a, b) => b.data_coleta.localeCompare(a.data_coleta));
    }
    const sinceMs = new Date(atualizadoDesde).getTime();
    return this.items
      .filter(item => new Date(item.sincronizado_em).getTime() >= sinceMs)
      .sort((a, b) => b.data_coleta.localeCompare(a.data_coleta));
  }
}

/**
 * Repositório PostgreSQL para a tabela `precos_combustivel` (US17.1 & US17.3)
 */
export class PostgresPrecosRepository implements PrecosCombustivelRepository {
  async salvarLote(registros: PrecoCombustivelColetado[]): Promise<number> {
    if (!registros.length) return 0;

    const client = await pool.connect();
    let count = 0;
    try {
      await client.query('BEGIN');
      for (const reg of registros) {
        await client.query(
          `INSERT INTO precos_combustivel
            (municipio, uf, combustivel, preco_centavos, data_coleta, fonte, granularidade, sincronizado_em, atualizado_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (LOWER(municipio), UPPER(uf), LOWER(combustivel), data_coleta)
           DO UPDATE SET
             preco_centavos = EXCLUDED.preco_centavos,
             fonte = EXCLUDED.fonte,
             granularidade = EXCLUDED.granularidade,
             sincronizado_em = CURRENT_TIMESTAMP,
             atualizado_em = CURRENT_TIMESTAMP`,
          [
            reg.municipio,
            reg.uf.toUpperCase(),
            reg.combustivel,
            reg.preco_centavos,
            reg.data_coleta,
            reg.fonte,
            reg.granularidade,
          ],
        );
        count += 1;
      }
      await client.query('COMMIT');
      return count;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async buscarPorMunicipioECombustivel(
    municipio: string,
    combustivel: string,
    limiteDias: number = 7,
  ): Promise<FuelPriceRecord[]> {
    const { rows } = await pool.query(
      `SELECT id, municipio, uf, combustivel, preco_centavos,
              TO_CHAR(data_coleta, 'YYYY-MM-DD') AS data_coleta,
              fonte, granularidade, sincronizado_em
       FROM precos_combustivel
       WHERE LOWER(municipio) = LOWER($1)
         AND LOWER(combustivel) = LOWER($2)
       ORDER BY data_coleta DESC
       LIMIT $3`,
      [municipio.trim(), combustivel.trim(), limiteDias],
    );

    return rows.map(row => ({
      id: row.id,
      municipio: row.municipio,
      uf: row.uf,
      combustivel: row.combustivel,
      preco_centavos: Number(row.preco_centavos),
      data_coleta: row.data_coleta,
      fonte: row.fonte,
      granularidade: row.granularidade,
      sincronizado_em: new Date(row.sincronizado_em).toISOString(),
    }));
  }

  async listarTodos(atualizadoDesde?: string): Promise<FuelPriceRecord[]> {
    const params: any[] = [];
    let where = '';
    if (atualizadoDesde) {
      params.push(atualizadoDesde);
      where = 'WHERE sincronizado_em >= $1';
    }

    const { rows } = await pool.query(
      `SELECT id, municipio, uf, combustivel, preco_centavos,
              TO_CHAR(data_coleta, 'YYYY-MM-DD') AS data_coleta,
              fonte, granularidade, sincronizado_em
       FROM precos_combustivel
       ${where}
       ORDER BY data_coleta DESC
       LIMIT 500`,
      params,
    );

    return rows.map(row => ({
      id: row.id,
      municipio: row.municipio,
      uf: row.uf,
      combustivel: row.combustivel,
      preco_centavos: Number(row.preco_centavos),
      data_coleta: row.data_coleta,
      fonte: row.fonte,
      granularidade: row.granularidade,
      sincronizado_em: new Date(row.sincronizado_em).toISOString(),
    }));
  }
}

export interface HistoricoPrecosRepository {
  salvarLote(registros: PrecoCombustivelColetado[]): Promise<number>;
  listarTodos(atualizadoDesde?: string): Promise<LocalPriceHistoryRecord[]>;
}

export class InMemoryHistoricoPrecosRepository implements HistoricoPrecosRepository {
  private items: LocalPriceHistoryRecord[] = [];

  async salvarLote(registros: PrecoCombustivelColetado[]): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;

    for (const reg of registros) {
      const idx = this.items.findIndex(
        item =>
          normalizarTexto(item.municipio) === normalizarTexto(reg.municipio) &&
          normalizarTexto(item.combustivel) === normalizarTexto(reg.combustivel) &&
          item.data_coleta === reg.data_coleta,
      );

      if (idx >= 0) {
        this.items[idx] = {
          ...this.items[idx],
          preco_centavos: reg.preco_centavos,
          atualizado_em: now,
        };
      } else {
        this.items.push({
          id: crypto.randomUUID(),
          municipio: reg.municipio,
          combustivel: reg.combustivel,
          preco_centavos: reg.preco_centavos,
          data_coleta: reg.data_coleta,
          criado_em: now,
          atualizado_em: now,
        });
      }
      count += 1;
    }

    return count;
  }

  async listarTodos(atualizadoDesde?: string): Promise<LocalPriceHistoryRecord[]> {
    if (!atualizadoDesde) {
      return [...this.items].sort((a, b) => a.data_coleta.localeCompare(b.data_coleta));
    }
    const sinceMs = new Date(atualizadoDesde).getTime();
    return this.items
      .filter(item => new Date(item.atualizado_em || 0).getTime() >= sinceMs)
      .sort((a, b) => a.data_coleta.localeCompare(b.data_coleta));
  }
}

export class PostgresHistoricoPrecosRepository implements HistoricoPrecosRepository {
  async salvarLote(registros: PrecoCombustivelColetado[]): Promise<number> {
    if (!registros.length) return 0;

    const client = await pool.connect();
    let count = 0;
    try {
      await client.query('BEGIN');
      for (const reg of registros) {
        await client.query(
          `INSERT INTO historico_precos_locais
            (municipio, combustivel, preco_centavos, data_coleta, atualizado_em)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (LOWER(municipio), LOWER(combustivel), data_coleta)
           DO UPDATE SET
             preco_centavos = EXCLUDED.preco_centavos,
             atualizado_em = CURRENT_TIMESTAMP`,
          [reg.municipio, reg.combustivel, reg.preco_centavos, reg.data_coleta],
        );
        count += 1;
      }
      await client.query('COMMIT');
      return count;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listarTodos(atualizadoDesde?: string): Promise<LocalPriceHistoryRecord[]> {
    const params: any[] = [];
    let where = '';
    if (atualizadoDesde) {
      params.push(atualizadoDesde);
      where = 'WHERE atualizado_em >= $1';
    }

    const { rows } = await pool.query(
      `SELECT id, municipio, combustivel, preco_centavos,
              TO_CHAR(data_coleta, 'YYYY-MM-DD') AS data_coleta,
              criado_em, atualizado_em
       FROM historico_precos_locais
       ${where}
       ORDER BY data_coleta ASC
       LIMIT 1000`,
      params,
    );

    return rows.map(row => ({
      id: row.id,
      municipio: row.municipio,
      combustivel: row.combustivel,
      preco_centavos: Number(row.preco_centavos),
      data_coleta: row.data_coleta,
      criado_em: new Date(row.criado_em).toISOString(),
      atualizado_em: new Date(row.atualizado_em).toISOString(),
    }));
  }
}

export interface ResultadoJobColetaPrecos {
  sucesso: boolean;
  registrosGravados: number;
  postosGravados?: number;
  historicoGravados?: number;
  erro?: string;
  executadoEm: string;
}

const defaultLogger: JobLogger = {
  info: (msg, meta) => console.log(`[ColetaPrecosAnpJob] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ColetaPrecosAnpJob] ${msg}`, meta || ''),
};

/**
 * US17.3, US34.1 & US35.1 — Job diário que coleta os preços da ANP, grava em `precos_combustivel`,
 * alimenta `historico_precos_locais` e, quando configurado, carrega a tabela `postos`.
 * Em caso de falha, mantém os dados do dia anterior intactos e registra o erro em log.
 */
export class ColetaPrecosAnpJob {
  private readonly provedor: ProvedorPrecos;
  private readonly repository: PrecosCombustivelRepository;
  private readonly logger: JobLogger;
  private readonly provedorPostos?: ProvedorPostos;
  private readonly postosRepository?: PostosRepository;
  private readonly historicoRepository?: HistoricoPrecosRepository;

  constructor(
    provedor: ProvedorPrecos = new AnpDadosAbertosProvider(),
    repository: PrecosCombustivelRepository = new PostgresPrecosRepository(),
    logger: JobLogger = defaultLogger,
    provedorPostos?: ProvedorPostos,
    postosRepository?: PostosRepository,
    historicoRepository?: HistoricoPrecosRepository,
  ) {
    this.provedor = provedor;
    this.repository = repository;
    this.logger = logger;
    this.provedorPostos = provedorPostos;
    this.postosRepository = postosRepository;
    this.historicoRepository = historicoRepository;
  }

  async executar(): Promise<ResultadoJobColetaPrecos> {
    const executadoEm = new Date().toISOString();
    let postosGravados = 0;
    let historicoGravados = 0;

    try {
      const registros = await this.provedor.coletarPrecos();
      let gravados = 0;
      if (!registros.length) {
        this.logger.info('Coleta ANP retornou 0 registros; mantendo dados anteriores.');
      } else {
        gravados = await this.repository.salvarLote(registros);
        this.logger.info(`Coleta ANP concluída com ${gravados} registros gravados.`);

        if (this.historicoRepository) {
          historicoGravados = await this.historicoRepository.salvarLote(registros);
        }
      }

      if (this.provedorPostos && this.postosRepository) {
        try {
          const postos = await this.provedorPostos.coletarPostos();
          if (postos.length > 0) {
            postosGravados = await this.postosRepository.salvarLote(postos);
            this.logger.info(`Carga de postos concluída com ${postosGravados} postos gravados.`);
          }
        } catch (postoErr: any) {
          this.logger.error(
            `Falha ao carregar postos (mantendo postos anteriores): ${postoErr?.message || String(postoErr)}`,
          );
        }
      }

      return {
        sucesso: true,
        registrosGravados: gravados,
        postosGravados,
        historicoGravados,
        executadoEm,
      };
    } catch (err: any) {
      const mensagem = err?.message || String(err);
      this.logger.error(
        `Falha na coleta diária de preços ANP; dados do dia anterior mantidos: ${mensagem}`,
        { code: err?.code, statusCode: err?.statusCode },
      );
      return {
        sucesso: false,
        registrosGravados: 0,
        postosGravados: 0,
        historicoGravados: 0,
        erro: mensagem,
        executadoEm,
      };
    }
  }
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Agenda a execução diária do job de coleta ANP (retorna função para cancelar o timer).
 */
export function agendarJobColetaPrecosAnp(
  job: ColetaPrecosAnpJob = new ColetaPrecosAnpJob(),
  intervaloMs: number = UM_DIA_MS,
): () => void {
  const timer = setInterval(() => {
    job.executar().catch(() => {});
  }, intervaloMs);

  if (typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }

  return () => clearInterval(timer);
}
