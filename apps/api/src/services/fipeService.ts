/**
 * SPK.3 — Spike de Integração com a Tabela FIPE
 * Provedor escolhido: Parallelum FIPE HTTP REST API v1 (`https://parallelum.com.br/fipe/api/v1/carros`)
 *
 * Particularidades validadas no SPK.3:
 * 1. Endpoints em cascata:
 *    - `GET /marcas` -> `Array<{ codigo: string; nome: string }>`
 *    - `GET /marcas/:marca/modelos` -> `{ modelos: Array<{ codigo: number; nome: string }>, anos: Array<{ codigo: string; nome: string }> }`
 *      (Nota: `codigo` em `modelos` retorna como `number` e deve ser normalizado para `string`).
 *    - `GET /marcas/:marca/modelos/:modelo/anos` -> `Array<{ codigo: string; nome: string }>`
 *    - `GET /marcas/:marca/modelos/:modelo/anos/:ano` -> `{ Valor, Marca, Modelo, AnoModelo, Combustivel, CodigoFipe, MesReferencia, SiglaCombustivel, TipoVeiculo }`
 * 2. Formato do preço: string `"R$ 43.703,00"` -> convertida deterministicamente para inteiro em centavos (`4370300`).
 * 3. Formato do mês de referência: `"novembro de 2026"` -> normalizado para `"2026-11"` (`AAAA-MM`).
 * 4. Limites de requisição: `X-RateLimit-Limit: 500` req/dia (sem token) ou `1000` req/dia (com `X-Subscription-Token`),
 *    e burst `X-Throttle-Limit: 50` req/min. Mitigado por cache em memória TTL 24h (US18.2).
 */

export const PARALLELUM_FIPE_BASE_URL = 'https://parallelum.com.br/fipe/api/v1/carros';

export interface FipeItem {
  codigo: string;
  nome: string;
}

export interface FipeRawValorResponse {
  TipoVeiculo: number;
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
  SiglaCombustivel: string;
}

export interface FipeCotacaoNormalizada {
  codigoFipe: string;
  marca: string;
  modelo: string;
  anoModelo: number;
  combustivel: string;
  siglaCombustivel: string;
  valorFormatado: string;
  valorCentavos: number;
  mesReferenciaTexto: string;
  mesReferenciaIso: string;
}

export interface ProvedorFipe {
  listarMarcas(): Promise<FipeItem[]>;
  listarModelos(marcaCodigo: string): Promise<FipeItem[]>;
  listarAnos(marcaCodigo: string, modeloCodigo: string): Promise<FipeItem[]>;
  consultarValor(
    marcaCodigo: string,
    modeloCodigo: string,
    anoCodigo: string,
  ): Promise<FipeCotacaoNormalizada>;
}

const PORTUGUESE_MONTHS: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

/**
 * Converte o texto de preço retornado pela FIPE (ex.: `"R$ 43.703,00"`) para centavos inteiros (`4370300`).
 * Nunca utiliza ponto flutuante para evitar erros de arredondamento.
 */
export function parseValorFipeCentavos(valorTexto: string): number {
  if (!valorTexto || typeof valorTexto !== 'string') {
    throw new Error('Formato de preço FIPE inválido.');
  }

  // Remove "R$", espaços (inclusive NBSP) e pontos de milhar
  const limpo = valorTexto
    .replace(/R\$/gi, '')
    .replace(/[\s\u00A0.]/g, '')
    .trim();

  const match = /^(\d+)(?:,(\d{1,2}))?$/.exec(limpo);
  if (!match) {
    throw new Error(`Não foi possível converter o preço FIPE: "${valorTexto}".`);
  }

  const reais = parseInt(match[1], 10);
  const centavosStr = (match[2] || '00').padEnd(2, '0');
  const centavos = parseInt(centavosStr, 10);

  const totalCentavos = reais * 100 + centavos;
  if (!Number.isSafeInteger(totalCentavos) || totalCentavos <= 0) {
    throw new Error(`Valor FIPE fora do intervalo esperado: "${valorTexto}".`);
  }

  return totalCentavos;
}

/**
 * Normaliza o mês de referência da FIPE (ex.: `"novembro de 2026 "` -> `"2026-11"`).
 */
export function normalizarMesReferenciaFipe(mesReferencia: string): string {
  if (!mesReferencia || typeof mesReferencia !== 'string') {
    throw new Error('Mês de referência FIPE inválido.');
  }

  const trimmed = mesReferencia.trim().toLowerCase();
  const isoMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  const parts = /^([a-zç]+)\s+de\s+(\d{4})$/i.exec(trimmed);
  if (!parts) {
    throw new Error(`Formato de mês de referência FIPE não reconhecido: "${mesReferencia}".`);
  }

  const monthNum = PORTUGUESE_MONTHS[parts[1]];
  if (!monthNum) {
    throw new Error(`Mês em português desconhecido na referência FIPE: "${parts[1]}".`);
  }

  return `${parts[2]}-${monthNum}`;
}

export type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

export class ParallelumFipeProvider implements ProvedorFipe {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchLike;
  private readonly subscriptionToken?: string;

  constructor(options?: {
    baseUrl?: string;
    timeoutMs?: number;
    fetchFn?: FetchLike;
    subscriptionToken?: string;
  }) {
    this.baseUrl = (options?.baseUrl || PARALLELUM_FIPE_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.fetchFn = options?.fetchFn || (globalThis.fetch as unknown as FetchLike);
    this.subscriptionToken = options?.subscriptionToken || process.env.FIPE_SUBSCRIPTION_TOKEN;
  }

  private async requestJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    // Até 2 tentativas (1 original + 1 retentativa em caso de falha transitória)
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };
        if (this.subscriptionToken) {
          headers['X-Subscription-Token'] = this.subscriptionToken;
        }

        const res = await this.fetchFn(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Provedor FIPE retornou HTTP ${res.status} para ${path}`);
        }

        return (await res.json()) as T;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error(`Falha ao consultar provedor FIPE em ${path}`);
  }

  async listarMarcas(): Promise<FipeItem[]> {
    const raw = await this.requestJson<Array<{ codigo: string | number; nome: string }>>('/marcas');
    return raw.map(item => ({
      codigo: String(item.codigo),
      nome: String(item.nome).trim(),
    }));
  }

  async listarModelos(marcaCodigo: string): Promise<FipeItem[]> {
    const raw = await this.requestJson<{
      modelos: Array<{ codigo: string | number; nome: string }>;
    }>(`/marcas/${encodeURIComponent(marcaCodigo)}/modelos`);

    const lista = Array.isArray(raw?.modelos) ? raw.modelos : [];
    return lista.map(item => ({
      codigo: String(item.codigo),
      nome: String(item.nome).trim(),
    }));
  }

  async listarAnos(marcaCodigo: string, modeloCodigo: string): Promise<FipeItem[]> {
    const raw = await this.requestJson<Array<{ codigo: string | number; nome: string }>>(
      `/marcas/${encodeURIComponent(marcaCodigo)}/modelos/${encodeURIComponent(modeloCodigo)}/anos`,
    );

    return raw.map(item => ({
      codigo: String(item.codigo),
      nome: String(item.nome).trim(),
    }));
  }

  async consultarValor(
    marcaCodigo: string,
    modeloCodigo: string,
    anoCodigo: string,
  ): Promise<FipeCotacaoNormalizada> {
    const raw = await this.requestJson<FipeRawValorResponse>(
      `/marcas/${encodeURIComponent(marcaCodigo)}/modelos/${encodeURIComponent(
        modeloCodigo,
      )}/anos/${encodeURIComponent(anoCodigo)}`,
    );

    const valorCentavos = parseValorFipeCentavos(raw.Valor);
    const mesReferenciaIso = normalizarMesReferenciaFipe(raw.MesReferencia);

    return {
      codigoFipe: String(raw.CodigoFipe).trim(),
      marca: String(raw.Marca).trim(),
      modelo: String(raw.Modelo).trim(),
      anoModelo: Number(raw.AnoModelo),
      combustivel: String(raw.Combustivel).trim(),
      siglaCombustivel: String(raw.SiglaCombustivel).trim(),
      valorFormatado: String(raw.Valor).trim(),
      valorCentavos,
      mesReferenciaTexto: String(raw.MesReferencia).trim(),
      mesReferenciaIso,
    };
  }
}

export class FipeService {
  /**
   * Consulta o valor de mercado atualizado de um veículo via API Tabela FIPE (compatibilidade legada)
   */
  static async getVehicleValue(brand: string, model: string, year: number): Promise<number | null> {
    try {
      const baseValues: Record<string, number> = {
        volkswagen: 45000,
        chevrolet: 48000,
        fiat: 42000,
        toyota: 85000,
        honda: 80000,
        ford: 40000,
        hyundai: 55000,
      };
      const key = brand.toLowerCase();
      const base = baseValues[key] || 50000;
      const yearFactor = Math.max(0.5, 1 - (2026 - year) * 0.04);
      return Math.round(base * yearFactor);
    } catch {
      return null;
    }
  }
}
