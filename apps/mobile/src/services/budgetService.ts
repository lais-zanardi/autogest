import {
  BudgetAlertLevel,
  BudgetEvaluationResult,
  BudgetStatusSummary,
  DEFAULT_BUDGET_WARNING_PERCENTAGE,
  UpsertBudgetDTO,
  VehicleBudget,
} from '@autogest/shared-types';
import { BudgetRepository } from '../repositories/BudgetRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import {
  obterIndicadoresUsoECustoDoPeriodo,
  resolverIntervaloPeriodo,
} from './usageAndCostIndicators';
import { NotificacaoService } from './notificationService';

export { DEFAULT_BUDGET_WARNING_PERCENTAGE };

// Armazena o último banner de mudança de nível por veículo para exibição imediata na UI (US15.4)
const activeBannersByVehicle = new Map<
  string,
  { nivel: BudgetAlertLevel; percentual: number; mensagem: string } | null
>();

/**
 * US15.3 (Decisão #5 da Entrega 2 confirmada):
 * Função pura `avaliarOrcamento(gastoMes, teto, percentualAviso)` → `{ percentual, nivel: normal | aviso | critico, mensagem }`.
 * - Percentual de aviso padrão: 80%.
 * - Funciona identicamente quer `gastoMes` e `teto` estejam ambos em centavos ou ambos em reais.
 */
export function avaliarOrcamento(
  gastoMes: number,
  teto: number,
  percentualAviso: number = DEFAULT_BUDGET_WARNING_PERCENTAGE,
): BudgetEvaluationResult {
  const tetoNum = Number(teto) || 0;
  const gastoNum = Math.max(0, Number(gastoMes) || 0);
  const limiarAviso =
    percentualAviso !== undefined && Number(percentualAviso) > 0
      ? Number(percentualAviso)
      : DEFAULT_BUDGET_WARNING_PERCENTAGE;

  if (tetoNum <= 0) {
    return {
      percentual: 0,
      nivel: 'normal',
      mensagem: 'Sem teto orçamentário definido',
    };
  }

  const percentual = Number(((gastoNum / tetoNum) * 100).toFixed(2));

  if (percentual > 100) {
    return {
      percentual,
      nivel: 'critico',
      mensagem: `Limite ultrapassado (${percentual}% atingido)`,
    };
  }

  if (percentual >= limiarAviso) {
    return {
      percentual,
      nivel: 'aviso',
      mensagem: `Alerta de orçamento: ${percentual}% atingido`,
    };
  }

  return {
    percentual,
    nivel: 'normal',
    mensagem: `Dentro do orçamento (${percentual}% atingido)`,
  };
}

/**
 * Formata uma data no padrão `AAAA-MM` (UTC) para controle mensal de notificações (`aviso_enviado_mes` e `critico_enviado_mes`).
 */
export function formatarMesReferencia(dataReferencia: Date = new Date()): string {
  const yyyy = dataReferencia.getUTCFullYear();
  const mm = String(dataReferencia.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export class BudgetService {
  /**
   * Obtém o banner ativo de mudança de nível para o veículo (US15.4).
   */
  static obterBannerAtivo(
    vehicleId: string,
  ): { nivel: BudgetAlertLevel; percentual: number; mensagem: string } | null {
    return activeBannersByVehicle.get(vehicleId) || null;
  }

  static limparBannerAtivo(vehicleId: string): void {
    activeBannersByVehicle.delete(vehicleId);
  }

  /**
   * US15.3: Calcula o `totalGastoDoMes` usando exatamente a mesma agregação do Dashboard (US13):
   * gastos variáveis do mês (combustível + manutenção + despesas) + custo fixo mensal do período.
   */
  static async calcularTotalGastoDoMesReais(
    vehicleId: string,
    dataReferencia: Date = new Date(),
  ): Promise<number> {
    const { inicio, fim } = resolverIntervaloPeriodo('mes_atual', dataReferencia);
    const indicadoresPeriodo = await obterIndicadoresUsoECustoDoPeriodo(vehicleId, inicio, fim);

    const gastoVariavelMes =
      indicadoresPeriodo.custo.custoCombustivel +
      indicadoresPeriodo.custo.custoManutencaoTotal +
      indicadoresPeriodo.custo.custoOutrasDespesas;
    const custoFixoMes = indicadoresPeriodo.custo.custoFixoProporcional;

    return Number((gastoVariavelMes + custoFixoMes).toFixed(2));
  }

  /**
   * US15.2 & US15.5: Define ou edita o teto mensal do veículo (em centavos), audita a alteração (US21)
   * e reavalia imediatamente (se reduzir o teto abaixo do gasto atual, dispara o nível correspondente na hora).
   */
  static async salvarOrcamento(
    dto: UpsertBudgetDTO,
    dataReferencia: Date = new Date(),
  ): Promise<VehicleBudget> {
    if (!dto.vehicleId || !dto.vehicleId.trim()) {
      throw new Error('Veículo é obrigatório para definir o orçamento.');
    }

    const tetoCentavos =
      dto.tetoMensalCentavos !== undefined
        ? Math.round(Number(dto.tetoMensalCentavos))
        : dto.tetoMensalReais !== undefined
          ? Math.round(Number(dto.tetoMensalReais) * 100)
          : 0;

    if (!Number.isFinite(tetoCentavos) || tetoCentavos <= 0) {
      throw new Error('O teto mensal deve ser maior que zero.');
    }

    const percentualAviso =
      dto.percentualAviso !== undefined
        ? Math.round(Number(dto.percentualAviso))
        : DEFAULT_BUDGET_WARNING_PERCENTAGE;

    if (percentualAviso <= 0 || percentualAviso > 100) {
      throw new Error('O percentual de aviso deve estar entre 1% e 100%.');
    }

    const existing = await BudgetRepository.findByVehicle(dto.vehicleId);
    let saved: VehicleBudget;

    if (existing) {
      const reduziuTeto = tetoCentavos < existing.teto_mensal;
      const aumentouTeto = tetoCentavos > existing.teto_mensal;

      // Calcula para qual nível o novo teto levaria o gasto atual para ajustar as flags mensais quando aplicável
      const gastoAtualReais = await this.calcularTotalGastoDoMesReais(
        dto.vehicleId,
        dataReferencia,
      );
      const gastoAtualCentavos = Math.round(gastoAtualReais * 100);
      const avaliacaoAnterior = avaliarOrcamento(
        gastoAtualCentavos,
        existing.teto_mensal,
        existing.percentual_aviso,
      );
      const avaliacaoNova = avaliarOrcamento(gastoAtualCentavos, tetoCentavos, percentualAviso);

      let avisoEnviadoMes = existing.aviso_enviado_mes;
      let criticoEnviadoMes = existing.critico_enviado_mes;

      // Se o usuário aumentou o teto voltando para um nível inferior, limpa as flags superiores
      if (aumentouTeto) {
        if (avaliacaoNova.nivel === 'normal') {
          avisoEnviadoMes = null;
          criticoEnviadoMes = null;
        } else if (avaliacaoNova.nivel === 'aviso') {
          criticoEnviadoMes = null;
        }
      }

      // US15.5: Reduzir o teto abaixo do gasto atual dispara o nível correspondente na hora
      if (reduziuTeto) {
        if (avaliacaoNova.nivel === 'critico' && avaliacaoAnterior.nivel !== 'critico') {
          criticoEnviadoMes = null;
        } else if (avaliacaoNova.nivel === 'aviso' && avaliacaoAnterior.nivel === 'normal') {
          avisoEnviadoMes = null;
        }
      }

      const updated = await BudgetRepository.update(
        existing.id,
        {
          tetoMensalCentavos: tetoCentavos,
          percentualAviso,
          avisoEnviadoMes,
          criticoEnviadoMes,
        },
        { auditarAlteracaoTeto: true },
      );

      if (!updated) {
        throw new Error('Não foi possível atualizar o orçamento do veículo.');
      }
      saved = updated;

      await SyncQueueRepository.enqueue(
        'UPDATE_BUDGET',
        `/api/v1/sync/orcamentos/${saved.id}`,
        saved,
      );
    } else {
      saved = await BudgetRepository.create({
        vehicleId: dto.vehicleId,
        tetoMensalCentavos: tetoCentavos,
        percentualAviso,
      });

      await SyncQueueRepository.enqueue(
        'CREATE_BUDGET',
        `/api/v1/sync/orcamentos/${saved.id}`,
        saved,
      );
    }

    // Reavalia imediatamente após salvar/editar o teto (US15.5)
    await this.reavaliarOrcamentoDoVeiculo(dto.vehicleId, dataReferencia);

    return (await BudgetRepository.findById(saved.id)) || saved;
  }

  /**
   * US15.2: Remove o teto mensal do veículo ativo e audita a exclusão.
   */
  static async removerOrcamentoDoVeiculo(vehicleId: string): Promise<boolean> {
    const existing = await BudgetRepository.findByVehicle(vehicleId);
    if (!existing) return false;

    const deleted = await BudgetRepository.delete(existing.id);
    if (!deleted) return false;

    this.limparBannerAtivo(vehicleId);

    await SyncQueueRepository.enqueue('DELETE_BUDGET', `/api/v1/sync/orcamentos/${existing.id}`, {
      id: existing.id,
      veiculo_id: vehicleId,
    });

    return true;
  }

  /**
   * US15.4 & US15.5: Reavalia o orçamento do veículo após qualquer criação, edição ou exclusão de gasto,
   * atualizando o banner de mudança de nível e disparando notificação única por nível e por mês
   * (`aviso_enviado_mes` e `critico_enviado_mes` no formato `AAAA-MM`) via `NotificacaoService`.
   */
  static async reavaliarOrcamentoDoVeiculo(
    vehicleId: string,
    dataReferencia: Date = new Date(),
    opcoes?: { gastoMesReaisPreCalculado?: number },
  ): Promise<BudgetStatusSummary | null> {
    const budget = await BudgetRepository.findByVehicle(vehicleId);
    if (!budget || budget.teto_mensal <= 0) {
      this.limparBannerAtivo(vehicleId);
      return null;
    }

    const gastoMesReais =
      opcoes?.gastoMesReaisPreCalculado !== undefined
        ? Number(opcoes.gastoMesReaisPreCalculado.toFixed(2))
        : await this.calcularTotalGastoDoMesReais(vehicleId, dataReferencia);

    const gastoMesCentavos = Math.round(gastoMesReais * 100);
    const tetoMensalCentavos = budget.teto_mensal;
    const tetoMensalReais = Number((tetoMensalCentavos / 100).toFixed(2));

    const avaliacao = avaliarOrcamento(
      gastoMesCentavos,
      tetoMensalCentavos,
      budget.percentual_aviso,
    );
    const mesReferencia = formatarMesReferencia(dataReferencia);

    let notificacaoDisparada = false;
    let updatedBudget = budget;

    if (avaliacao.nivel === 'critico') {
      if (budget.critico_enviado_mes !== mesReferencia) {
        const res = await NotificacaoService.disparar({
          title: '🚨 Teto Orçamentário Ultrapassado!',
          body: `Seus gastos atingiram ${avaliacao.percentual}% (${avaliacao.mensagem}) e ultrapassaram 100% do limite mensal.`,
          channelId: 'orcamento_critico',
          importance: 'high',
          sound: true,
          data: {
            vehicleId,
            nivel: 'critico',
            percentual: avaliacao.percentual,
            mesReferencia,
          },
        });
        notificacaoDisparada = res.sent;

        // Marca tanto critico_enviado_mes quanto aviso_enviado_mes no mês atual,
        // garantindo que uma edição posterior que reduza o gasto para a faixa de 'aviso' não renotifique (US15.7)
        const persisted = await BudgetRepository.update(
          budget.id,
          {
            avisoEnviadoMes: mesReferencia,
            criticoEnviadoMes: mesReferencia,
          },
          { auditarAlteracaoTeto: false },
        );
        if (persisted) {
          updatedBudget = persisted;
        }
      }

      activeBannersByVehicle.set(vehicleId, {
        nivel: 'critico',
        percentual: avaliacao.percentual,
        mensagem: avaliacao.mensagem,
      });
    } else if (avaliacao.nivel === 'aviso') {
      if (budget.aviso_enviado_mes !== mesReferencia) {
        const res = await NotificacaoService.disparar({
          title: '⚠️ Alerta de Teto Orçamentário',
          body: `Atenção: ${avaliacao.percentual}% atingido do seu orçamento mensal neste veículo.`,
          channelId: 'orcamento_avisos',
          importance: 'default',
          sound: false,
          data: {
            vehicleId,
            nivel: 'aviso',
            percentual: avaliacao.percentual,
            mesReferencia,
          },
        });
        notificacaoDisparada = res.sent;

        const persisted = await BudgetRepository.update(
          budget.id,
          {
            avisoEnviadoMes: mesReferencia,
          },
          { auditarAlteracaoTeto: false },
        );
        if (persisted) {
          updatedBudget = persisted;
        }
      }

      activeBannersByVehicle.set(vehicleId, {
        nivel: 'aviso',
        percentual: avaliacao.percentual,
        mensagem: avaliacao.mensagem,
      });
    } else {
      this.limparBannerAtivo(vehicleId);
    }

    return {
      budget: updatedBudget,
      gastoMesReais,
      gastoMesCentavos,
      tetoMensalReais,
      tetoMensalCentavos,
      percentual: avaliacao.percentual,
      nivel: avaliacao.nivel,
      mensagem: avaliacao.mensagem,
      mesReferencia,
      notificacaoDisparada,
      bannerMudancaNivel: this.obterBannerAtivo(vehicleId),
    };
  }

  /**
   * Consulta o status atual do orçamento do veículo sem disparar novas notificações.
   */
  static async obterStatusOrcamento(
    vehicleId: string,
    dataReferencia: Date = new Date(),
  ): Promise<BudgetStatusSummary | null> {
    const budget = await BudgetRepository.findByVehicle(vehicleId);
    if (!budget || budget.teto_mensal <= 0) {
      return null;
    }

    const gastoMesReais = await this.calcularTotalGastoDoMesReais(vehicleId, dataReferencia);
    const gastoMesCentavos = Math.round(gastoMesReais * 100);
    const tetoMensalCentavos = budget.teto_mensal;
    const tetoMensalReais = Number((tetoMensalCentavos / 100).toFixed(2));
    const avaliacao = avaliarOrcamento(
      gastoMesCentavos,
      tetoMensalCentavos,
      budget.percentual_aviso,
    );
    const mesReferencia = formatarMesReferencia(dataReferencia);

    return {
      budget,
      gastoMesReais,
      gastoMesCentavos,
      tetoMensalReais,
      tetoMensalCentavos,
      percentual: avaliacao.percentual,
      nivel: avaliacao.nivel,
      mensagem: avaliacao.mensagem,
      mesReferencia,
      notificacaoDisparada: false,
      bannerMudancaNivel: this.obterBannerAtivo(vehicleId),
    };
  }
}
