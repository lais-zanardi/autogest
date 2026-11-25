import {
  FuelPriceRecord,
  FuelType,
  PriceGranularity,
  RegionalPriceHistoryPoint,
  RegionalPricesResponse,
  WeatherCacheRecord,
} from '@autogest/shared-types';
import { api } from './api';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { PreferencesService } from './preferencesService';
import { formatarDataColeta } from '../utils/formatters';

export const PRECOS_TABLE = 'precos_combustivel';
export const CLIMA_TABLE = 'cache_clima';
export const LOCAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const AVISO_GRANULARIDADE_MUNICIPAL_MOBILE =
  'Preços médios municipais (ANP). Os valores podem variar entre postos da região.';

export interface RegionalPricesViewData {
  municipio: string;
  uf: string;
  combustivel: string;
  preco_medio_centavos: number;
  data_coleta: string;
  aviso_data: string;
  fonte: string;
  granularidade: PriceGranularity;
  aviso_granularidade: string | null;
  historico_semana: RegionalPriceHistoryPoint[];
  clima: WeatherCacheRecord | null;
  origem: 'rede' | 'cache' | 'offline';
  offline: boolean;
}

export interface HttpGetClient {
  get: (url: string) => Promise<{ data: any }>;
}

function normalizarTexto(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Monta o aviso exigido pela US17.6: "Dados de [dd/mm/aaaa]".
 */
export function montarAvisoDadosDe(dataColeta?: string | null): string {
  const formatada = formatarDataColeta(dataColeta);
  return formatada ? `Dados de ${formatada}` : 'Data de coleta indisponível';
}

export class RegionalPricesService {
  private static httpClient: HttpGetClient = api;

  static setHttpClient(client: HttpGetClient): void {
    this.httpClient = client;
  }

  static resetClient(): void {
    this.httpClient = api;
  }

  static async salvarPrecosLocais(registros: FuelPriceRecord[]): Promise<void> {
    if (!registros.length) return;
    const db = DatabaseConnection.getInstance();
    const existentes = await db.getTableData<FuelPriceRecord>(PRECOS_TABLE);
    const lista = [...(existentes || [])];

    for (const reg of registros) {
      const idx = lista.findIndex(
        item =>
          normalizarTexto(item.municipio) === normalizarTexto(reg.municipio) &&
          normalizarTexto(item.combustivel) === normalizarTexto(reg.combustivel) &&
          item.data_coleta === reg.data_coleta,
      );
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...reg };
      } else {
        lista.push(reg);
      }
    }

    await db.saveTableData(PRECOS_TABLE, lista);
  }

  static async salvarClimaLocal(clima: WeatherCacheRecord): Promise<void> {
    const db = DatabaseConnection.getInstance();
    const existentes = await db.getTableData<WeatherCacheRecord>(CLIMA_TABLE);
    const lista = [...(existentes || [])];
    const idx = lista.findIndex(
      item =>
        normalizarTexto(item.municipio) === normalizarTexto(clima.municipio) &&
        item.data === clima.data,
    );
    if (idx >= 0) {
      lista[idx] = { ...lista[idx], ...clima };
    } else {
      lista.push(clima);
    }
    await db.saveTableData(CLIMA_TABLE, lista);
  }

  static async obterUltimaColetaLocal(
    municipio: string,
    combustivel: string,
  ): Promise<{
    maisRecente: FuelPriceRecord | null;
    historicoSemana: RegionalPriceHistoryPoint[];
    clima: WeatherCacheRecord | null;
  }> {
    const db = DatabaseConnection.getInstance();
    const precos = await db.getTableData<FuelPriceRecord>(PRECOS_TABLE);
    const climas = await db.getTableData<WeatherCacheRecord>(CLIMA_TABLE);

    const mNorm = normalizarTexto(municipio);
    const cNorm = normalizarTexto(combustivel);

    const filtrados = (precos || [])
      .filter(
        p =>
          normalizarTexto(p.municipio) === mNorm &&
          normalizarTexto(p.combustivel) === cNorm,
      )
      .sort((a, b) => b.data_coleta.localeCompare(a.data_coleta))
      .slice(0, 7);

    const clima =
      (climas || [])
        .filter(c => normalizarTexto(c.municipio) === mNorm)
        .sort((a, b) => b.data.localeCompare(a.data))[0] || null;

    return {
      maisRecente: filtrados[0] || null,
      historicoSemana: [...filtrados]
        .reverse()
        .map(item => ({
          data_coleta: item.data_coleta,
          preco_centavos: item.preco_centavos,
        })),
      clima,
    };
  }

  /**
   * US17.6 & US17.7: Consulta preços da região e clima com cache local de 24h.
   * Sem conexão, retorna a última coleta salva localmente.
   */
  static async consultarPrecosRegiao(params?: {
    municipio?: string;
    combustivel?: FuelType | string;
    forceRefresh?: boolean;
    now?: Date;
  }): Promise<RegionalPricesViewData> {
    const agora = params?.now || new Date();
    const municipio = (params?.municipio || (await PreferencesService.obterMunicipioPadrao())).trim();
    const combustivel = String(
      params?.combustivel || (await PreferencesService.obterCombustivelPrincipal()),
    ).trim();

    const local = await this.obterUltimaColetaLocal(municipio, combustivel);

    // Verifica se o cache local ainda está dentro da janela de 24h
    if (!params?.forceRefresh && local.maisRecente) {
      const syncMs = new Date(local.maisRecente.sincronizado_em || 0).getTime();
      const cacheValido = Number.isFinite(syncMs) && agora.getTime() - syncMs < LOCAL_CACHE_TTL_MS;
      if (cacheValido) {
        return {
          municipio: local.maisRecente.municipio,
          uf: local.maisRecente.uf,
          combustivel: local.maisRecente.combustivel,
          preco_medio_centavos: local.maisRecente.preco_centavos,
          data_coleta: local.maisRecente.data_coleta,
          aviso_data: montarAvisoDadosDe(local.maisRecente.data_coleta),
          fonte: local.maisRecente.fonte,
          granularidade: local.maisRecente.granularidade,
          aviso_granularidade:
            local.maisRecente.granularidade === 'municipal'
              ? AVISO_GRANULARIDADE_MUNICIPAL_MOBILE
              : null,
          historico_semana: local.historicoSemana,
          clima: local.clima,
          origem: 'cache',
          offline: false,
        };
      }
    }

    try {
      const url = `/api/v1/precos?municipio=${encodeURIComponent(municipio)}&combustivel=${encodeURIComponent(combustivel)}`;
      const response = await this.httpClient.get(url);
      const data = response.data as RegionalPricesResponse;

      if (!data || !data.preco_medio_centavos) {
        throw new Error('Resposta de preços da região inválida.');
      }

      const syncIso = agora.toISOString();
      const registrosParaSalvar: FuelPriceRecord[] = (
        data.historico_semana?.length
          ? data.historico_semana
          : [{ data_coleta: data.data_coleta, preco_centavos: data.preco_medio_centavos }]
      ).map(pt => ({
        id: `${normalizarTexto(data.municipio)}_${normalizarTexto(data.combustivel)}_${pt.data_coleta}`,
        municipio: data.municipio,
        uf: data.uf,
        combustivel: data.combustivel,
        preco_centavos: pt.preco_centavos,
        data_coleta: pt.data_coleta,
        fonte: data.fonte,
        granularidade: data.granularidade,
        sincronizado_em: syncIso,
      }));

      await this.salvarPrecosLocais(registrosParaSalvar);
      if (data.clima) {
        await this.salvarClimaLocal(data.clima);
      }

      // US35.5: Ao atualizar preços, avalia alertas de preço-limite ativos
      try {
        const { PriceAlertService } = await import('./priceAlertService');
        await PriceAlertService.avaliarAlertasParaPreco({
          combustivel: data.combustivel,
          precoAtualCentavos: data.preco_medio_centavos,
          municipio: data.municipio,
          dataReferencia: agora,
        });
      } catch {
        // Não bloqueia retorno dos preços
      }

      return {
        municipio: data.municipio,
        uf: data.uf,
        combustivel: data.combustivel,
        preco_medio_centavos: data.preco_medio_centavos,
        data_coleta: data.data_coleta,
        aviso_data: montarAvisoDadosDe(data.data_coleta),
        fonte: data.fonte,
        granularidade: data.granularidade,
        aviso_granularidade: data.aviso_granularidade,
        historico_semana: data.historico_semana || [],
        clima: data.clima || local.clima,
        origem: 'rede',
        offline: false,
      };
    } catch (err) {
      // Sem conexão ou erro de rede -> exibe a última coleta salva localmente (US17.7)
      if (local.maisRecente) {
        return {
          municipio: local.maisRecente.municipio,
          uf: local.maisRecente.uf,
          combustivel: local.maisRecente.combustivel,
          preco_medio_centavos: local.maisRecente.preco_centavos,
          data_coleta: local.maisRecente.data_coleta,
          aviso_data: montarAvisoDadosDe(local.maisRecente.data_coleta),
          fonte: local.maisRecente.fonte,
          granularidade: local.maisRecente.granularidade,
          aviso_granularidade:
            local.maisRecente.granularidade === 'municipal'
              ? AVISO_GRANULARIDADE_MUNICIPAL_MOBILE
              : null,
          historico_semana: local.historicoSemana,
          clima: local.clima,
          origem: 'offline',
          offline: true,
        };
      }

      throw err;
    }
  }

  /**
   * US17.7: Sincroniza preços e clima silenciosamente ao abrir o app ou na rotina de sync.
   */
  static async sincronizarAoAbrir(): Promise<void> {
    try {
      await this.consultarPrecosRegiao();
    } catch {
      // Falha silenciosa offline: preserva a última coleta local
    }
  }
}
