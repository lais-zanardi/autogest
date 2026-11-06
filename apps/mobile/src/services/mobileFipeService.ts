import { api } from './api';
import { FipeRepository } from '../repositories/FipeRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import {
  FipeBrand,
  FipeModel,
  FipeYear,
  FipePriceQuote,
  FipeConsultation,
} from '@autogest/shared-types';

export class MobileFipeService {
  /**
   * Lista marcas disponíveis na API FIPE
   */
  static async listarMarcas(): Promise<FipeBrand[]> {
    const res = await api.get('/fipe/marcas');
    return res.data;
  }

  /**
   * Lista modelos de uma marca
   */
  static async listarModelos(marcaCodigo: string): Promise<FipeModel[]> {
    const res = await api.get(`/fipe/marcas/${encodeURIComponent(marcaCodigo)}/modelos`);
    return res.data;
  }

  /**
   * Lista anos de um modelo
   */
  static async listarAnos(marcaCodigo: string, modeloCodigo: string): Promise<FipeYear[]> {
    const res = await api.get(
      `/fipe/marcas/${encodeURIComponent(marcaCodigo)}/modelos/${encodeURIComponent(modeloCodigo)}/anos`
    );
    return res.data;
  }

  /**
   * Consulta cotação na API FIPE
   */
  static async consultarCotacao(
    marcaCodigo: string,
    modeloCodigo: string,
    anoCodigo: string
  ): Promise<FipePriceQuote> {
    const res = await api.get('/fipe/valor', {
      params: { marca: marcaCodigo, modelo: modeloCodigo, ano: anoCodigo },
    });
    return res.data;
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
