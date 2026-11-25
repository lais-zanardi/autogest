import crypto from 'crypto';
import { WeatherCacheRecord } from '@autogest/shared-types';
import { pool } from '../../models/db';

/**
 * US17.4 — Módulo de integração de clima com provedor gratuito (Open-Meteo)
 * e cache persistido de 24h na tabela `cache_clima` (sobrevive a reinício do servidor).
 */

export const CACHE_CLIMA_TTL_MS = 24 * 60 * 60 * 1000;

export type ClimaErrorCode = 'TIMEOUT' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'NOT_FOUND';

export class ClimaIntegrationError extends Error {
  public readonly code: ClimaErrorCode;

  constructor(code: ClimaErrorCode, message: string) {
    super(message);
    this.name = 'ClimaIntegrationError';
    this.code = code;
  }
}

export interface ClimaColetado {
  municipio: string;
  uf?: string | null;
  data: string; // "AAAA-MM-DD"
  temperatura_atual: number | null;
  temperatura_min: number;
  temperatura_max: number;
  condicao: string;
}

export interface ProvedorClima {
  consultarClima(municipio: string, uf?: string): Promise<ClimaColetado>;
}

export type ClimaFetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

/**
 * Traduz códigos meteorológicos WMO (Open-Meteo) para descrições em português.
 */
export function traduzirCodigoClimaWmo(code?: number | null): string {
  if (code === 0) return 'Céu limpo';
  if (code === 1) return 'Predominantemente limpo';
  if (code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Neblina';
  if (code === 51 || code === 53 || code === 55) return 'Garoa';
  if (code === 61 || code === 80) return 'Chuva leve';
  if (code === 63 || code === 81) return 'Chuva moderada';
  if (code === 65 || code === 82) return 'Chuva forte';
  if (code === 95 || code === 96 || code === 99) return 'Tempestade';
  return 'Tempo estável';
}

export class OpenMeteoClimaProvider implements ProvedorClima {
  private readonly timeoutMs: number;
  private readonly fetchFn: ClimaFetchLike;

  constructor(options?: { timeoutMs?: number; fetchFn?: ClimaFetchLike }) {
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.fetchFn = options?.fetchFn || (globalThis.fetch as unknown as ClimaFetchLike);
  }

  private async requestJson<T>(url: string): Promise<T> {
    let lastError: ClimaIntegrationError | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await this.fetchFn(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new ClimaIntegrationError(
            'HTTP_ERROR',
            `Provedor de clima retornou HTTP ${res.status}`,
          );
        }

        return (await res.json()) as T;
      } catch (err: any) {
        if (err instanceof ClimaIntegrationError) {
          lastError = err;
        } else if (err?.name === 'AbortError') {
          lastError = new ClimaIntegrationError(
            'TIMEOUT',
            `Timeout após ${this.timeoutMs}ms ao consultar clima.`,
          );
        } else {
          lastError = new ClimaIntegrationError(
            'NETWORK_ERROR',
            `Erro de rede ao consultar clima: ${err?.message || String(err)}`,
          );
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new ClimaIntegrationError('NETWORK_ERROR', 'Falha ao consultar clima.');
  }

  async consultarClima(municipio: string, uf?: string): Promise<ClimaColetado> {
    const query = encodeURIComponent(municipio.trim());
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=pt&format=json&countryCode=BR`;
    const geo = await this.requestJson<{
      results?: Array<{ latitude: number; longitude: number; name: string }>;
    }>(geoUrl);

    const loc = geo?.results?.[0];
    if (!loc) {
      throw new ClimaIntegrationError(
        'NOT_FOUND',
        `Município não encontrado no provedor de clima: "${municipio}".`,
      );
    }

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      '&current=temperature_2m,weather_code&daily=temperature_2m_min,temperature_2m_max,weather_code' +
      '&timezone=America%2FSao_Paulo&forecast_days=1';

    const forecast = await this.requestJson<{
      current?: { temperature_2m?: number; weather_code?: number };
      daily?: {
        time?: string[];
        temperature_2m_min?: number[];
        temperature_2m_max?: number[];
        weather_code?: number[];
      };
    }>(forecastUrl);

    const data = forecast.daily?.time?.[0] || new Date().toISOString().slice(0, 10);
    const tempMin = Number(forecast.daily?.temperature_2m_min?.[0] ?? forecast.current?.temperature_2m ?? 20);
    const tempMax = Number(forecast.daily?.temperature_2m_max?.[0] ?? forecast.current?.temperature_2m ?? 25);
    const tempAtual =
      forecast.current?.temperature_2m !== undefined ? Number(forecast.current.temperature_2m) : null;
    const weatherCode = forecast.current?.weather_code ?? forecast.daily?.weather_code?.[0];

    return {
      municipio: loc.name || municipio.trim(),
      uf: uf ? uf.trim().toUpperCase() : null,
      data,
      temperatura_atual: tempAtual,
      temperatura_min: tempMin,
      temperatura_max: tempMax,
      condicao: traduzirCodigoClimaWmo(weatherCode),
    };
  }
}

export interface CacheClimaRepository {
  buscarValido(municipio: string, agora: Date): Promise<WeatherCacheRecord | null>;
  salvar(registro: Omit<WeatherCacheRecord, 'id'>): Promise<WeatherCacheRecord>;
  listarTodos(atualizadoDesde?: string): Promise<WeatherCacheRecord[]>;
}

function normalizarMunicipio(municipio: string): string {
  return String(municipio || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export class InMemoryCacheClimaRepository implements CacheClimaRepository {
  private items: WeatherCacheRecord[] = [];

  async buscarValido(municipio: string, agora: Date): Promise<WeatherCacheRecord | null> {
    const alvo = normalizarMunicipio(municipio);
    const agoraMs = agora.getTime();

    const found = this.items
      .filter(
        item =>
          normalizarMunicipio(item.municipio) === alvo &&
          new Date(item.expira_em).getTime() > agoraMs,
      )
      .sort((a, b) => b.expira_em.localeCompare(a.expira_em))[0];

    return found || null;
  }

  async salvar(registro: Omit<WeatherCacheRecord, 'id'>): Promise<WeatherCacheRecord> {
    const alvo = normalizarMunicipio(registro.municipio);
    const idx = this.items.findIndex(
      item => normalizarMunicipio(item.municipio) === alvo && item.data === registro.data,
    );

    if (idx >= 0) {
      const updated: WeatherCacheRecord = {
        ...this.items[idx],
        ...registro,
      };
      this.items[idx] = updated;
      return updated;
    }

    const created: WeatherCacheRecord = {
      id: crypto.randomUUID(),
      ...registro,
    };
    this.items.push(created);
    return created;
  }

  async listarTodos(): Promise<WeatherCacheRecord[]> {
    return [...this.items].sort((a, b) => b.data.localeCompare(a.data));
  }
}

export class PostgresCacheClimaRepository implements CacheClimaRepository {
  async buscarValido(municipio: string, agora: Date): Promise<WeatherCacheRecord | null> {
    const { rows } = await pool.query(
      `SELECT id, municipio, uf, TO_CHAR(data, 'YYYY-MM-DD') AS data,
              temperatura_atual, temperatura_min, temperatura_max, condicao, expira_em
       FROM cache_clima
       WHERE LOWER(municipio) = LOWER($1)
         AND expira_em > $2
       ORDER BY expira_em DESC
       LIMIT 1`,
      [municipio.trim(), agora.toISOString()],
    );

    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      municipio: r.municipio,
      uf: r.uf,
      data: r.data,
      temperatura_atual: r.temperatura_atual !== null ? Number(r.temperatura_atual) : null,
      temperatura_min: Number(r.temperatura_min),
      temperatura_max: Number(r.temperatura_max),
      condicao: r.condicao,
      expira_em: new Date(r.expira_em).toISOString(),
    };
  }

  async salvar(registro: Omit<WeatherCacheRecord, 'id'>): Promise<WeatherCacheRecord> {
    const { rows } = await pool.query(
      `INSERT INTO cache_clima
        (municipio, uf, data, temperatura_atual, temperatura_min, temperatura_max, condicao, expira_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (LOWER(municipio), data)
       DO UPDATE SET
         uf = EXCLUDED.uf,
         temperatura_atual = EXCLUDED.temperatura_atual,
         temperatura_min = EXCLUDED.temperatura_min,
         temperatura_max = EXCLUDED.temperatura_max,
         condicao = EXCLUDED.condicao,
         expira_em = EXCLUDED.expira_em,
         atualizado_em = CURRENT_TIMESTAMP
       RETURNING id, municipio, uf, TO_CHAR(data, 'YYYY-MM-DD') AS data,
                 temperatura_atual, temperatura_min, temperatura_max, condicao, expira_em`,
      [
        registro.municipio,
        registro.uf || null,
        registro.data,
        registro.temperatura_atual ?? null,
        registro.temperatura_min,
        registro.temperatura_max,
        registro.condicao,
        registro.expira_em,
      ],
    );

    const r = rows[0];
    return {
      id: r.id,
      municipio: r.municipio,
      uf: r.uf,
      data: r.data,
      temperatura_atual: r.temperatura_atual !== null ? Number(r.temperatura_atual) : null,
      temperatura_min: Number(r.temperatura_min),
      temperatura_max: Number(r.temperatura_max),
      condicao: r.condicao,
      expira_em: new Date(r.expira_em).toISOString(),
    };
  }

  async listarTodos(atualizadoDesde?: string): Promise<WeatherCacheRecord[]> {
    const params: any[] = [];
    let where = '';
    if (atualizadoDesde) {
      params.push(atualizadoDesde);
      where = 'WHERE atualizado_em >= $1';
    }

    const { rows } = await pool.query(
      `SELECT id, municipio, uf, TO_CHAR(data, 'YYYY-MM-DD') AS data,
              temperatura_atual, temperatura_min, temperatura_max, condicao, expira_em
       FROM cache_clima
       ${where}
       ORDER BY data DESC
       LIMIT 200`,
      params,
    );

    return rows.map(r => ({
      id: r.id,
      municipio: r.municipio,
      uf: r.uf,
      data: r.data,
      temperatura_atual: r.temperatura_atual !== null ? Number(r.temperatura_atual) : null,
      temperatura_min: Number(r.temperatura_min),
      temperatura_max: Number(r.temperatura_max),
      condicao: r.condicao,
      expira_em: new Date(r.expira_em).toISOString(),
    }));
  }
}

/**
 * Serviço de Clima com cache persistido de 24h em `cache_clima`.
 */
export class ClimaIntegrationService {
  private readonly provedor: ProvedorClima;
  private readonly cacheRepo: CacheClimaRepository;
  private readonly nowFn: () => Date;

  constructor(
    provedor: ProvedorClima = new OpenMeteoClimaProvider(),
    cacheRepo: CacheClimaRepository = new PostgresCacheClimaRepository(),
    nowFn: () => Date = () => new Date(),
  ) {
    this.provedor = provedor;
    this.cacheRepo = cacheRepo;
    this.nowFn = nowFn;
  }

  async obterClima(municipio: string, uf?: string): Promise<WeatherCacheRecord> {
    const agora = this.nowFn();
    const cached = await this.cacheRepo.buscarValido(municipio, agora);
    if (cached) {
      return cached;
    }

    const coletado = await this.provedor.consultarClima(municipio, uf);
    const expiraEm = new Date(agora.getTime() + CACHE_CLIMA_TTL_MS).toISOString();

    return this.cacheRepo.salvar({
      municipio: coletado.municipio,
      uf: coletado.uf ?? uf ?? null,
      data: coletado.data,
      temperatura_atual: coletado.temperatura_atual,
      temperatura_min: coletado.temperatura_min,
      temperatura_max: coletado.temperatura_max,
      condicao: coletado.condicao,
      expira_em: expiraEm,
    });
  }
}
