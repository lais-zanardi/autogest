import {
  FuelPriceRecord,
  FuelType,
  LocalPriceHistoryRecord,
  PriceAlertRecord,
  PriceTrendSummary,
} from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { NotificacaoService } from './notificationService';
import { PRECOS_TABLE } from './regionalPricesService';
import { formatarMoeda } from '../utils/formatters';
import {
  avaliarAlertaPreco,
  calcularTendenciaPrecos,
  validarPrecoLimiteCentavos,
} from './priceAlertDomain';

export const HISTORICO_PRECOS_TABLE = 'historico_precos_locais';
export const ALERTAS_PRECO_TABLE = 'alertas_preco';

function normalizarTexto(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function generateId(): string {
  return `alerta_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SalvarAlertaPrecoInput {
  veiculoId: string;
  combustivel: FuelType | string;
  precoLimiteCentavos: number;
  ativo?: boolean;
}

export interface AvaliacaoAlertasResult {
  disparados: number;
  rearmados: number;
  suprimidosPorPausa: number;
}

/**
 * US35.4, US35.5 & US35.6: Serviço de Histórico de Preços Locais e Alertas de Preço-Limite.
 */
export class PriceAlertService {
  static async listarAlertas(veiculoId?: string): Promise<PriceAlertRecord[]> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<PriceAlertRecord>(ALERTAS_PRECO_TABLE)) || [];
    return rows.filter(r => {
      if (r.excluido_em) return false;
      if (veiculoId && r.veiculo_id !== veiculoId) return false;
      return true;
    });
  }

  /**
   * US35.4: Define ou atualiza o preço-limite para um combustível do veículo.
   */
  static async salvarAlertaPreco(input: SalvarAlertaPrecoInput): Promise<PriceAlertRecord> {
    const validacao = validarPrecoLimiteCentavos(input.precoLimiteCentavos);
    if (!validacao.valido) {
      throw new Error(validacao.erro || 'Preço-limite inválido.');
    }

    const db = DatabaseConnection.getInstance();
    const rows = [...((await db.getTableData<PriceAlertRecord>(ALERTAS_PRECO_TABLE)) || [])];
    const now = new Date().toISOString();
    const combNorm = normalizarTexto(input.combustivel);

    const idx = rows.findIndex(
      r =>
        !r.excluido_em &&
        r.veiculo_id === input.veiculoId &&
        normalizarTexto(r.combustivel) === combNorm,
    );

    let salvo: PriceAlertRecord;
    if (idx >= 0) {
      salvo = {
        ...rows[idx],
        preco_limite_centavos: Math.round(input.precoLimiteCentavos),
        ativo: input.ativo !== undefined ? input.ativo : rows[idx].ativo,
        // Ao alterar o limite, rearma o alerta para nova avaliação limpa
        disparado_em: null,
        atualizado_em: now,
      };
      rows[idx] = salvo;
    } else {
      salvo = {
        id: generateId(),
        veiculo_id: input.veiculoId,
        vehicleId: input.veiculoId,
        combustivel: input.combustivel,
        preco_limite_centavos: Math.round(input.precoLimiteCentavos),
        ativo: input.ativo !== undefined ? input.ativo : true,
        disparado_em: null,
        criado_em: now,
        atualizado_em: now,
        excluido_em: null,
      };
      rows.push(salvo);
    }

    await db.saveTableData(ALERTAS_PRECO_TABLE, rows);
    await SyncQueueRepository.enqueue('UPSERT_PRICE_ALERT', '/api/v1/sync/alertas_preco', salvo);
    return salvo;
  }

  static async alternarAtivoAlerta(alertaId: string, ativo: boolean): Promise<PriceAlertRecord | null> {
    const db = DatabaseConnection.getInstance();
    const rows = [...((await db.getTableData<PriceAlertRecord>(ALERTAS_PRECO_TABLE)) || [])];
    const idx = rows.findIndex(r => r.id === alertaId && !r.excluido_em);
    if (idx < 0) return null;

    const now = new Date().toISOString();
    rows[idx] = {
      ...rows[idx],
      ativo,
      disparado_em: ativo ? rows[idx].disparado_em : null,
      atualizado_em: now,
    };

    await db.saveTableData(ALERTAS_PRECO_TABLE, rows);
    await SyncQueueRepository.enqueue('UPSERT_PRICE_ALERT', '/api/v1/sync/alertas_preco', rows[idx]);
    return rows[idx];
  }

  /**
   * US35.5 & US35.6: Avalia alertas ativos ao atualizar os preços regionais.
   * - Dispara 1x pelo NotificacaoService (canal de alta importância) quando precoAtual <= precoLimite.
   * - Não repete enquanto continuar abaixo/igual ao limite.
   * - Rearma automaticamente quando o preço voltar a ficar acima do limite.
   * - Respeita pausa de notificações (US39) e ignora alertas desativados.
   */
  static async avaliarAlertasParaPreco(params: {
    combustivel: FuelType | string;
    precoAtualCentavos: number;
    municipio?: string;
    dataReferencia?: Date;
  }): Promise<AvaliacaoAlertasResult> {
    const agora = params.dataReferencia || new Date();
    const db = DatabaseConnection.getInstance();
    const rows = [...((await db.getTableData<PriceAlertRecord>(ALERTAS_PRECO_TABLE)) || [])];
    const combNorm = normalizarTexto(params.combustivel);

    let disparados = 0;
    let rearmados = 0;
    let suprimidosPorPausa = 0;
    let altered = false;

    for (let i = 0; i < rows.length; i += 1) {
      const alerta = rows[i];
      if (alerta.excluido_em || !alerta.ativo) {
        continue;
      }
      if (normalizarTexto(alerta.combustivel) !== combNorm) {
        continue;
      }

      const atingiuLimite = avaliarAlertaPreco(
        params.precoAtualCentavos,
        alerta.preco_limite_centavos,
      );

      if (atingiuLimite) {
        if (!alerta.disparado_em) {
          const precoTexto = formatarMoeda(params.precoAtualCentavos / 100);
          const limiteTexto = formatarMoeda(alerta.preco_limite_centavos / 100);
          const localTexto = params.municipio ? ` em ${params.municipio}` : '';

          const res = await NotificacaoService.disparar(
            {
              title: `Preço de ${alerta.combustivel} abaixo do limite`,
              body: `A média${localTexto} caiu para ${precoTexto} (limite definido: ${limiteTexto}).`,
              channelId: 'alerta_preco_limite',
              importance: 'high',
              sound: true,
              data: {
                tipo: 'alerta_preco',
                alertaId: alerta.id,
                combustivel: alerta.combustivel,
                precoAtualCentavos: params.precoAtualCentavos,
              },
            },
            agora,
          );

          if (res.sent) {
            rows[i] = {
              ...alerta,
              disparado_em: agora.toISOString(),
              atualizado_em: agora.toISOString(),
            };
            disparados += 1;
            altered = true;
          } else if (res.reason === 'notifications_paused') {
            suprimidosPorPausa += 1;
          }
        }
      } else if (alerta.disparado_em) {
        // Preço voltou a ficar acima do limite -> rearma para o próximo ciclo
        rows[i] = {
          ...alerta,
          disparado_em: null,
          atualizado_em: agora.toISOString(),
        };
        rearmados += 1;
        altered = true;
      }
    }

    if (altered) {
      await db.saveTableData(ALERTAS_PRECO_TABLE, rows);
    }

    return { disparados, rearmados, suprimidosPorPausa };
  }

  /**
   * US35.3: Carrega o histórico local (combinando `historico_precos_locais` com `precos_combustivel` da US17)
   * e calcula a tendência no período escolhido (30 ou 90 dias).
   */
  static async obterHistoricoETendencia(params: {
    municipio: string;
    combustivel: FuelType | string;
    periodoDias: 30 | 90;
    dataReferencia?: Date;
  }): Promise<PriceTrendSummary> {
    const db = DatabaseConnection.getInstance();
    const historico = (await db.getTableData<LocalPriceHistoryRecord>(HISTORICO_PRECOS_TABLE)) || [];
    const precos = (await db.getTableData<FuelPriceRecord>(PRECOS_TABLE)) || [];

    const mNorm = normalizarTexto(params.municipio);
    const cNorm = normalizarTexto(params.combustivel);

    const mapPorData = new Map<string, LocalPriceHistoryRecord>();

    for (const p of precos) {
      if (normalizarTexto(p.municipio) === mNorm && normalizarTexto(p.combustivel) === cNorm) {
        mapPorData.set(p.data_coleta, {
          id: p.id,
          municipio: p.municipio,
          combustivel: p.combustivel,
          preco_centavos: p.preco_centavos,
          data_coleta: p.data_coleta,
        });
      }
    }

    for (const h of historico) {
      if (normalizarTexto(h.municipio) === mNorm && normalizarTexto(h.combustivel) === cNorm) {
        mapPorData.set(h.data_coleta, h);
      }
    }

    return calcularTendenciaPrecos(
      Array.from(mapPorData.values()),
      params.periodoDias,
      params.dataReferencia || new Date(),
    );
  }
}
