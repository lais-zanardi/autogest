import axios from 'axios';
import { api } from './api';
import { FipeRepository } from '../repositories/FipeRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { EnvConfig } from '../config/env';
import {
  FIPE_LOCAL_BRANDS,
  FIPE_LOCAL_MODELS,
  FIPE_LOCAL_YEARS,
  getMockFipeQuote,
  parseValorFipeCentavos,
  normalizarMesReferenciaFipe,
} from './fipeCatalog';
import {
  FipeBrand,
  FipeModel,
  FipeYear,
  FipePriceQuote,
  FipeConsultation,
} from '@autogest/shared-types';

const PARALLELUM_PUBLIC_BASE = 'https://parallelum.com.br/fipe/api/v1/carros';
const fipeMemoryCache = new Map<string, any>();

export class MobileFipeService {
  /**
   * Lista todas as marcas disponíveis na Tabela FIPE oficial.
   * Tenta primeiro a API do backend local; caso inalcançável, busca na API pública oficial da FIPE (Parallelum).
   * Em modo mock ou falha de rede total, recorre ao catálogo local com mais de 25 marcas.
   */
  static async listarMarcas(): Promise<FipeBrand[]> {
    if (EnvConfig.isMockMode()) {
      return FIPE_LOCAL_BRANDS;
    }

    const cacheKey = 'marcas';
    if (fipeMemoryCache.has(cacheKey)) {
      return fipeMemoryCache.get(cacheKey);
    }

    // 1. Tenta API backend do AutoGest (timeout curto para não travar se o backend estiver desligado)
    try {
      const res = await api.get('/fipe/marcas', { timeout: 3500 });
      if (Array.isArray(res.data) && res.data.length > 0) {
        fipeMemoryCache.set(cacheKey, res.data);
        return res.data;
      }
    } catch {
      // Backend local inacessível; prossegue para a API pública oficial da FIPE
    }

    // 2. Consulta diretamente a API oficial pública da FIPE (Parallelum)
    try {
      const res = await axios.get(`${PARALLELUM_PUBLIC_BASE}/marcas`, { timeout: 7000 });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const marcas: FipeBrand[] = res.data.map((m: any) => ({
          codigo: String(m.codigo),
          nome: String(m.nome),
        }));
        fipeMemoryCache.set(cacheKey, marcas);
        return marcas;
      }
    } catch (err: any) {
      console.warn('API FIPE pública inacessível. Utilizando catálogo de referência local:', err?.message);
    }

    // 3. Fallback estático
    return FIPE_LOCAL_BRANDS;
  }

  /**
   * Lista todos os modelos de uma marca.
   */
  static async listarModelos(marcaCodigo: string): Promise<FipeModel[]> {
    if (EnvConfig.isMockMode()) {
      return FIPE_LOCAL_MODELS[marcaCodigo] || [];
    }

    const cacheKey = `modelos:${marcaCodigo}`;
    if (fipeMemoryCache.has(cacheKey)) {
      return fipeMemoryCache.get(cacheKey);
    }

    // 1. Tenta backend local
    try {
      const res = await api.get(`/fipe/marcas/${encodeURIComponent(marcaCodigo)}/modelos`, {
        timeout: 3500,
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        fipeMemoryCache.set(cacheKey, res.data);
        return res.data;
      }
    } catch {
      // Fallback
    }

    // 2. Tenta API pública da FIPE
    try {
      const res = await axios.get(
        `${PARALLELUM_PUBLIC_BASE}/marcas/${encodeURIComponent(marcaCodigo)}/modelos`,
        { timeout: 7000 }
      );
      const rawModelos = res.data?.modelos || (Array.isArray(res.data) ? res.data : []);
      if (Array.isArray(rawModelos) && rawModelos.length > 0) {
        const modelos: FipeModel[] = rawModelos.map((m: any) => ({
          codigo: String(m.codigo),
          nome: String(m.nome),
        }));
        fipeMemoryCache.set(cacheKey, modelos);
        return modelos;
      }
    } catch (err: any) {
      console.warn('Falha ao buscar modelos na FIPE pública. Usando modelos locais:', err?.message);
    }

    // 3. Fallback estático
    return FIPE_LOCAL_MODELS[marcaCodigo] || [];
  }

  /**
   * Lista anos disponíveis para um modelo.
   */
  static async listarAnos(marcaCodigo: string, modeloCodigo: string): Promise<FipeYear[]> {
    if (EnvConfig.isMockMode()) {
      return FIPE_LOCAL_YEARS;
    }

    const cacheKey = `anos:${marcaCodigo}:${modeloCodigo}`;
    if (fipeMemoryCache.has(cacheKey)) {
      return fipeMemoryCache.get(cacheKey);
    }

    // 1. Tenta backend local
    try {
      const res = await api.get(
        `/fipe/marcas/${encodeURIComponent(marcaCodigo)}/modelos/${encodeURIComponent(modeloCodigo)}/anos`,
        { timeout: 3500 }
      );
      if (Array.isArray(res.data) && res.data.length > 0) {
        fipeMemoryCache.set(cacheKey, res.data);
        return res.data;
      }
    } catch {
      // Fallback
    }

    // 2. Tenta API pública
    try {
      const res = await axios.get(
        `${PARALLELUM_PUBLIC_BASE}/marcas/${encodeURIComponent(marcaCodigo)}/modelos/${encodeURIComponent(modeloCodigo)}/anos`,
        { timeout: 7000 }
      );
      if (Array.isArray(res.data) && res.data.length > 0) {
        const anos: FipeYear[] = res.data.map((a: any) => ({
          codigo: String(a.codigo),
          nome: String(a.nome),
        }));
        fipeMemoryCache.set(cacheKey, anos);
        return anos;
      }
    } catch (err: any) {
      console.warn('Falha ao buscar anos na FIPE pública. Usando anos locais:', err?.message);
    }

    return FIPE_LOCAL_YEARS;
  }

  /**
   * Consulta cotação oficial do veículo na FIPE.
   */
  static async consultarCotacao(
    marcaCodigo: string,
    modeloCodigo: string,
    anoCodigo: string
  ): Promise<FipePriceQuote> {
    if (EnvConfig.isMockMode()) {
      return getMockFipeQuote(marcaCodigo, modeloCodigo, anoCodigo);
    }

    // 1. Tenta backend local
    try {
      const res = await api.get('/fipe/valor', {
        params: { marca: marcaCodigo, modelo: modeloCodigo, ano: anoCodigo },
        timeout: 4000,
      });
      if (res.data && res.data.valorCentavos) {
        return res.data;
      }
    } catch {
      // Fallback
    }

    // 2. Tenta API pública oficial
    try {
      const res = await axios.get(
        `${PARALLELUM_PUBLIC_BASE}/marcas/${encodeURIComponent(marcaCodigo)}/modelos/${encodeURIComponent(modeloCodigo)}/anos/${encodeURIComponent(anoCodigo)}`,
        { timeout: 8000 }
      );
      const raw = res.data;
      if (raw && raw.Valor) {
        const valorCentavos = parseValorFipeCentavos(raw.Valor);
        const mesReferenciaIso = normalizarMesReferenciaFipe(raw.MesReferencia);
        return {
          codigoFipe: raw.CodigoFipe || `FIPE-${marcaCodigo}-${modeloCodigo}`,
          marca: raw.Marca,
          modelo: raw.Modelo,
          anoModelo: Number(raw.AnoModelo) || 2022,
          combustivel: raw.Combustivel || 'Flex',
          siglaCombustivel: raw.SiglaCombustivel || 'F',
          valorFormatado: raw.Valor,
          valorCentavos,
          mesReferenciaTexto: raw.MesReferencia,
          mesReferenciaIso,
        };
      }
    } catch (err: any) {
      console.warn('Falha ao obter cotação na FIPE pública. Gerando cotação local:', err?.message);
    }

    return getMockFipeQuote(marcaCodigo, modeloCodigo, anoCodigo);
  }

  /**
   * US18.5 & US18.6: Consulta o valor de mercado atual do veículo, salva consulta idempotente
   * e atualiza o valor FIPE no cadastro do veículo.
   */
  static async consultarEAtualizarVeiculo(params: {
    vehicleId: string;
    marcaCodigo: string;
    modeloCodigo: string;
    anoCodigo: string;
  }): Promise<{ consultation: FipeConsultation; quote: FipePriceQuote }> {
    const quote = await this.consultarCotacao(
      params.marcaCodigo,
      params.modeloCodigo,
      params.anoCodigo
    );

    // Salva consulta (1 por mês de referência)
    const consultation = await FipeRepository.saveConsultation({
      vehicleId: params.vehicleId,
      fipeCode: quote.codigoFipe,
      brand: quote.marca,
      model: quote.modelo,
      modelYear: quote.anoModelo,
      fuel: quote.combustivel,
      referenceMonth: quote.mesReferenciaIso,
      valueCentavos: quote.valorCentavos,
      consultedAt: new Date().toISOString(),
    });

    // Enfileira para sync
    await SyncQueueRepository.enqueue('CREATE_FIXED_COST' as any, '/sync/consultas_fipe', {
      id: consultation.id,
      veiculo_id: consultation.vehicleId,
      codigo_fipe: consultation.fipeCode,
      marca: consultation.brand,
      modelo: consultation.model,
      ano_modelo: consultation.modelYear,
      combustivel: consultation.fuel,
      mes_referencia: consultation.referenceMonth,
      valor_centavos: consultation.valueCentavos,
      consultado_em: consultation.consultedAt,
      criado_em: consultation.createdAt,
      atualizado_em: consultation.updatedAt,
    }).catch(() => {});

    // Atualiza metadados no veículo
    const valorReais = quote.valorCentavos / 100;
    await VehicleRepository.update(params.vehicleId, {
      fipeValue: valorReais,
      valor_fipe: valorReais,
      fipe_codigo_marca: params.marcaCodigo,
      fipe_codigo_modelo: params.modeloCodigo,
      fipe_codigo_ano: params.anoCodigo,
      fipe_mes_referencia: quote.mesReferenciaIso,
    } as any);

    return { consultation, quote };
  }

  /**
   * Retorna histórico de consultas salvas e última consulta (US18.5 fallback offline)
   */
  static async obterHistorico(vehicleId: string): Promise<{
    consultas: FipeConsultation[];
    ultimaConsulta: FipeConsultation | null;
  }> {
    const consultas = await FipeRepository.listByVehicle(vehicleId);
    const ultimaConsulta = await FipeRepository.findLatestByVehicle(vehicleId);
    return { consultas, ultimaConsulta };
  }
}
