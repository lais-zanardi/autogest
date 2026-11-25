import crypto from 'crypto';
import { FuelStationRecord } from '@autogest/shared-types';
import { pool } from '../../models/db';
import {
  ANP_DEFAULT_DATASET_URL,
  normalizarCombustivelAnp,
  parsePrecoAnpCentavos,
} from '../anp';

/**
 * SPK.5 & US34.1 — Provedor de Postos com Coordenadas (backend only)
 * Extrai os postos da fonte ANP (SPK.4) e resolve coordenadas via Nominatim/OpenStreetMap
 * (plano gratuito, sem chave exposta no app mobile, timeout e fallback seguro).
 */

export interface PostoColetado {
  nome: string;
  bandeira: string;
  latitude: number;
  longitude: number;
  municipio: string;
  uf: string;
  endereco?: string | null;
  precos_centavos?: Record<string, number>;
}

export interface ProvedorPostos {
  coletarPostos(): Promise<PostoColetado[]>;
}

export type PostosFetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<any>;
}>;

function normalizarTexto(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export class AnpPostosProvider implements ProvedorPostos {
  private readonly datasetUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: PostosFetchLike;
  private readonly geocodeLimit: number;

  constructor(options?: {
    datasetUrl?: string;
    timeoutMs?: number;
    fetchFn?: PostosFetchLike;
    geocodeLimit?: number;
  }) {
    this.datasetUrl = options?.datasetUrl || ANP_DEFAULT_DATASET_URL;
    this.timeoutMs = options?.timeoutMs ?? 8000;
    this.fetchFn = options?.fetchFn || (globalThis.fetch as unknown as PostosFetchLike);
    this.geocodeLimit = options?.geocodeLimit ?? 100;
  }

  private async fetchWithTimeout(url: string, accept: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: accept,
          'User-Agent': 'AutoGest-Backend/1.0',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async geocodificar(
    endereco: string,
    municipio: string,
    uf: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const query = encodeURIComponent(`${endereco}, ${municipio}, ${uf}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`;
    try {
      const res = await this.fetchWithTimeout(url, 'application/json');
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return null;
      const lat = Number(data[0].lat);
      const lon = Number(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return { latitude: lat, longitude: lon };
    } catch {
      return null;
    }
  }

  async coletarPostos(): Promise<PostoColetado[]> {
    const res = await this.fetchWithTimeout(this.datasetUrl, 'text/csv, text/plain, */*');
    if (!res.ok) {
      throw new Error(`Falha ao baixar lista de postos da ANP (HTTP ${res.status})`);
    }
    const csv = await res.text();
    const lines = csv
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = lines[0].split(';').map(h => normalizarTexto(h));
    const idxUf = headers.findIndex(h => h.includes('ESTADO'));
    const idxMunicipio = headers.findIndex(h => h.includes('MUNICIPIO'));
    const idxRevenda = headers.findIndex(h => h.includes('REVENDA') && !h.includes('CNPJ'));
    const idxRua = headers.findIndex(h => h.includes('NOME DA RUA'));
    const idxNumero = headers.findIndex(h => h.includes('NUMERO RUA'));
    const idxBandeira = headers.findIndex(h => h.includes('BANDEIRA'));
    const idxProduto = headers.findIndex(h => h.includes('PRODUTO'));
    const idxValor = headers.findIndex(h => h.includes('VALOR DE VENDA'));

    if (idxUf < 0 || idxMunicipio < 0 || idxRevenda < 0) {
      return [];
    }

    const grouped = new Map<
      string,
      {
        nome: string;
        bandeira: string;
        municipio: string;
        uf: string;
        endereco: string;
        precos_centavos: Record<string, number>;
      }
    >();

    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(';');
      const nome = (cols[idxRevenda] || '').trim();
      const municipio = normalizarTexto(cols[idxMunicipio] || '');
      const uf = (cols[idxUf] || '').trim().toUpperCase().slice(0, 2);
      if (!nome || !municipio || !uf) continue;

      const bandeira = (idxBandeira >= 0 ? cols[idxBandeira] : 'BRANCA')?.trim() || 'BRANCA';
      const rua = idxRua >= 0 ? (cols[idxRua] || '').trim() : '';
      const numero = idxNumero >= 0 ? (cols[idxNumero] || '').trim() : '';
      const endereco = [rua, numero].filter(Boolean).join(', ');

      const key = `${normalizarTexto(nome)}|${municipio}|${uf}`;
      let entry = grouped.get(key);
      if (!entry) {
        entry = {
          nome,
          bandeira,
          municipio,
          uf,
          endereco,
          precos_centavos: {},
        };
        grouped.set(key, entry);
      }

      if (idxProduto >= 0 && idxValor >= 0 && cols[idxValor]) {
        try {
          const combustivel = String(normalizarCombustivelAnp(cols[idxProduto]));
          const centavos = parsePrecoAnpCentavos(cols[idxValor]);
          entry.precos_centavos[combustivel] = centavos;
        } catch {
          // Ignora linha com preço inválido
        }
      }
    }

    const resultados: PostoColetado[] = [];
    let count = 0;
    for (const item of grouped.values()) {
      if (count >= this.geocodeLimit) break;
      const coords = await this.geocodificar(item.endereco || item.nome, item.municipio, item.uf);
      if (!coords) continue;

      resultados.push({
        nome: item.nome,
        bandeira: item.bandeira,
        latitude: coords.latitude,
        longitude: coords.longitude,
        municipio: item.municipio,
        uf: item.uf,
        endereco: item.endereco || null,
        precos_centavos: item.precos_centavos,
      });
      count += 1;
    }

    return resultados;
  }
}

export interface PostosRepository {
  salvarLote(registros: PostoColetado[]): Promise<number>;
  listarTodos(atualizadoDesde?: string): Promise<FuelStationRecord[]>;
}

export class InMemoryPostosRepository implements PostosRepository {
  private items: FuelStationRecord[] = [];

  async salvarLote(registros: PostoColetado[]): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;

    for (const reg of registros) {
      const idx = this.items.findIndex(
        item =>
          normalizarTexto(item.nome) === normalizarTexto(reg.nome) &&
          normalizarTexto(item.municipio) === normalizarTexto(reg.municipio) &&
          item.uf.toUpperCase() === reg.uf.toUpperCase(),
      );

      if (idx >= 0) {
        this.items[idx] = {
          ...this.items[idx],
          ...reg,
          sincronizado_em: now,
        };
      } else {
        this.items.push({
          id: crypto.randomUUID(),
          ...reg,
          sincronizado_em: now,
        });
      }
      count += 1;
    }

    return count;
  }

  async listarTodos(atualizadoDesde?: string): Promise<FuelStationRecord[]> {
    if (!atualizadoDesde) {
      return [...this.items];
    }
    const sinceMs = new Date(atualizadoDesde).getTime();
    return this.items.filter(item => new Date(item.sincronizado_em || 0).getTime() >= sinceMs);
  }
}

export class PostgresPostosRepository implements PostosRepository {
  async salvarLote(registros: PostoColetado[]): Promise<number> {
    if (!registros.length) return 0;

    const client = await pool.connect();
    let count = 0;
    try {
      await client.query('BEGIN');
      for (const reg of registros) {
        await client.query(
          `INSERT INTO postos
            (nome, bandeira, latitude, longitude, municipio, uf, endereco, precos_centavos, sincronizado_em, atualizado_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (LOWER(nome), LOWER(municipio), UPPER(uf))
           DO UPDATE SET
             bandeira = EXCLUDED.bandeira,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             endereco = EXCLUDED.endereco,
             precos_centavos = EXCLUDED.precos_centavos,
             sincronizado_em = CURRENT_TIMESTAMP,
             atualizado_em = CURRENT_TIMESTAMP`,
          [
            reg.nome,
            reg.bandeira,
            reg.latitude,
            reg.longitude,
            reg.municipio,
            reg.uf.toUpperCase(),
            reg.endereco || null,
            JSON.stringify(reg.precos_centavos || {}),
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

  async listarTodos(atualizadoDesde?: string): Promise<FuelStationRecord[]> {
    const params: any[] = [];
    let where = '';
    if (atualizadoDesde) {
      params.push(atualizadoDesde);
      where = 'WHERE sincronizado_em >= $1';
    }

    const { rows } = await pool.query(
      `SELECT id, nome, bandeira, latitude, longitude, municipio, uf, endereco, precos_centavos, sincronizado_em
       FROM postos
       ${where}
       ORDER BY municipio ASC, nome ASC
       LIMIT 500`,
      params,
    );

    return rows.map(r => ({
      id: r.id,
      nome: r.nome,
      bandeira: r.bandeira,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      municipio: r.municipio,
      uf: r.uf,
      endereco: r.endereco,
      precos_centavos: r.precos_centavos || {},
      sincronizado_em: new Date(r.sincronizado_em).toISOString(),
    }));
  }
}
