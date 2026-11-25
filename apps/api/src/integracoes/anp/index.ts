import { FuelType, PriceGranularity } from '@autogest/shared-types';

/**
 * SPK.4 & US17.2 — Módulo de integração com Dados Abertos da ANP
 * Fonte escolhida: Série Histórica / Levantamento de Preços de Combustíveis da ANP (média municipal).
 * Quando a granularidade for municipal, a API expõe aviso explícito ao cliente.
 */

export const ANP_DEFAULT_DATASET_URL =
  process.env.ANP_PRICES_URL ||
  'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/dsan/ultimas-4-semanas-gasolina-etanol.csv';

export type AnpErrorCode = 'TIMEOUT' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'PARSE_ERROR';

export class AnpIntegrationError extends Error {
  public readonly code: AnpErrorCode;
  public readonly statusCode?: number;

  constructor(code: AnpErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'AnpIntegrationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface PrecoCombustivelColetado {
  municipio: string;
  uf: string;
  combustivel: FuelType | string;
  preco_centavos: number;
  data_coleta: string; // "AAAA-MM-DD"
  fonte: string;
  granularidade: PriceGranularity;
}

export interface ProvedorPrecos {
  coletarPrecos(filtros?: { municipio?: string; uf?: string }): Promise<PrecoCombustivelColetado[]>;
}

export type AnpFetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json?(): Promise<any>;
}>;

/**
 * Converte string de preço da ANP (ex.: "5,89", "6,129", "R$ 3,95") para centavos inteiros.
 * Arredonda a terceira casa decimal (padrão de bomba de combustível) de forma determinística.
 */
export function parsePrecoAnpCentavos(valorTexto: string): number {
  if (!valorTexto || typeof valorTexto !== 'string') {
    throw new AnpIntegrationError('PARSE_ERROR', 'Preço ANP vazio ou inválido.');
  }

  const limpo = valorTexto
    .replace(/R\$/gi, '')
    .replace(/[\s\u00A0]/g, '')
    .replace(/\.(?=\d{3}(?:,|$))/g, '')
    .replace(',', '.')
    .trim();

  if (!/^\d+(?:\.\d{1,4})?$/.test(limpo)) {
    throw new AnpIntegrationError('PARSE_ERROR', `Formato de preço ANP inválido: "${valorTexto}".`);
  }

  const [reaisStr, decStr = ''] = limpo.split('.');
  const reais = parseInt(reaisStr, 10);
  const padded = decStr.padEnd(3, '0');
  const centavosBase = parseInt(padded.slice(0, 2), 10);
  const terceiroDigito = parseInt(padded.slice(2, 3), 10);
  const totalCentavos = reais * 100 + centavosBase + (terceiroDigito >= 5 ? 1 : 0);

  if (!Number.isSafeInteger(totalCentavos) || totalCentavos <= 0) {
    throw new AnpIntegrationError('PARSE_ERROR', `Preço ANP fora da faixa válida: "${valorTexto}".`);
  }

  return totalCentavos;
}

/**
 * Normaliza a nomenclatura de produto da ANP para o domínio AutoGest.
 */
export function normalizarCombustivelAnp(produto: string): FuelType | string {
  const upper = String(produto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  if (upper.includes('GASOLINA')) return 'Gasolina';
  if (upper.includes('ETANOL')) return 'Etanol';
  if (upper.includes('DIESEL')) return 'Diesel';
  if (upper.includes('GNV')) return 'GNV';
  return produto.trim();
}

/**
 * Normaliza data ANP ("DD/MM/AAAA" ou "AAAA-MM-DD") para ISO "AAAA-MM-DD".
 */
export function normalizarDataAnp(dataTexto: string): string {
  const trimmed = String(dataTexto || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  throw new AnpIntegrationError('PARSE_ERROR', `Data ANP inválida: "${dataTexto}".`);
}

function normalizarTextoChave(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Faz o parse do CSV oficial dos Dados Abertos da ANP (separado por ';')
 * e calcula a média municipal em centavos inteiros.
 */
export function parseAnpCsvParaMediasMunicipais(csvContent: string): PrecoCombustivelColetado[] {
  if (!csvContent || typeof csvContent !== 'string') {
    throw new AnpIntegrationError('PARSE_ERROR', 'Conteúdo CSV da ANP vazio.');
  }

  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(';').map(h => normalizarTextoChave(h));
  const idxUf = headers.findIndex(h => h.includes('ESTADO'));
  const idxMunicipio = headers.findIndex(h => h.includes('MUNICIPIO'));
  const idxProduto = headers.findIndex(h => h.includes('PRODUTO'));
  const idxData = headers.findIndex(h => h.includes('DATA DA COLETA') || h === 'DATA');
  const idxValor = headers.findIndex(h => h.includes('VALOR DE VENDA') || h.includes('PRECO'));

  if (idxUf < 0 || idxMunicipio < 0 || idxProduto < 0 || idxData < 0 || idxValor < 0) {
    throw new AnpIntegrationError(
      'PARSE_ERROR',
      'Cabeçalho CSV da ANP não contém as colunas obrigatórias.',
    );
  }

  const buckets = new Map<
    string,
    {
      municipio: string;
      uf: string;
      combustivel: FuelType | string;
      data_coleta: string;
      somaCentavos: number;
      quantidade: number;
    }
  >();

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(';');
    if (cols.length <= Math.max(idxUf, idxMunicipio, idxProduto, idxData, idxValor)) {
      continue;
    }

    const uf = cols[idxUf].trim().toUpperCase().slice(0, 2);
    const municipio = normalizarTextoChave(cols[idxMunicipio]);
    const combustivel = normalizarCombustivelAnp(cols[idxProduto]);
    const valorRaw = cols[idxValor].trim();
    const dataRaw = cols[idxData].trim();

    if (!uf || !municipio || !combustivel || !valorRaw || !dataRaw) {
      continue;
    }

    let precoCentavos: number;
    let dataColeta: string;
    try {
      precoCentavos = parsePrecoAnpCentavos(valorRaw);
      dataColeta = normalizarDataAnp(dataRaw);
    } catch {
      continue;
    }

    const key = `${municipio}|${uf}|${combustivel}|${dataColeta}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.somaCentavos += precoCentavos;
      existing.quantidade += 1;
    } else {
      buckets.set(key, {
        municipio,
        uf,
        combustivel,
        data_coleta: dataColeta,
        somaCentavos: precoCentavos,
        quantidade: 1,
      });
    }
  }

  return Array.from(buckets.values()).map(bucket => ({
    municipio: bucket.municipio,
    uf: bucket.uf,
    combustivel: bucket.combustivel,
    preco_centavos: Math.round(bucket.somaCentavos / bucket.quantidade),
    data_coleta: bucket.data_coleta,
    fonte: 'ANP',
    granularidade: 'municipal',
  }));
}

export class AnpDadosAbertosProvider implements ProvedorPrecos {
  private readonly datasetUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: AnpFetchLike;

  constructor(options?: {
    datasetUrl?: string;
    timeoutMs?: number;
    fetchFn?: AnpFetchLike;
  }) {
    this.datasetUrl = options?.datasetUrl || ANP_DEFAULT_DATASET_URL;
    this.timeoutMs = options?.timeoutMs ?? 8000;
    this.fetchFn = options?.fetchFn || (globalThis.fetch as unknown as AnpFetchLike);
  }

  private async fetchWithRetry(): Promise<string> {
    let lastError: AnpIntegrationError | null = null;

    // 1 tentativa inicial + 1 retentativa em falha transitória
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await this.fetchFn(this.datasetUrl, {
          method: 'GET',
          headers: { Accept: 'text/csv, text/plain, */*' },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new AnpIntegrationError(
            'HTTP_ERROR',
            `Provedor ANP retornou HTTP ${res.status}`,
            res.status,
          );
        }

        return await res.text();
      } catch (err: any) {
        if (err instanceof AnpIntegrationError) {
          lastError = err;
        } else if (err?.name === 'AbortError' || String(err?.message || '').includes('abort')) {
          lastError = new AnpIntegrationError(
            'TIMEOUT',
            `Timeout após ${this.timeoutMs}ms ao consultar dados da ANP.`,
          );
        } else {
          lastError = new AnpIntegrationError(
            'NETWORK_ERROR',
            `Erro de rede ao consultar dados da ANP: ${err?.message || String(err)}`,
          );
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new AnpIntegrationError('NETWORK_ERROR', 'Falha ao consultar dados da ANP.');
  }

  async coletarPrecos(filtros?: {
    municipio?: string;
    uf?: string;
  }): Promise<PrecoCombustivelColetado[]> {
    const csv = await this.fetchWithRetry();
    const registros = parseAnpCsvParaMediasMunicipais(csv);

    if (!filtros?.municipio && !filtros?.uf) {
      return registros;
    }

    const alvoMunicipio = filtros.municipio ? normalizarTextoChave(filtros.municipio) : null;
    const alvoUf = filtros.uf ? filtros.uf.trim().toUpperCase() : null;

    return registros.filter(r => {
      if (alvoMunicipio && normalizarTextoChave(r.municipio) !== alvoMunicipio) return false;
      if (alvoUf && r.uf.toUpperCase() !== alvoUf) return false;
      return true;
    });
  }
}
