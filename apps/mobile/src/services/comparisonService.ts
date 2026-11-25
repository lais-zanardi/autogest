import {
  FuelComparisonItem,
  IndicatorPeriodPreset,
  VehicleComparisonInput,
  VehicleComparisonItem,
} from '@autogest/shared-types';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import {
  obterIndicadoresUsoECustoDoPeriodo,
  resolverIntervaloPeriodo,
} from './usageAndCostIndicators';
import { compararVeiculos, consumoPorCombustivel } from './comparisonDomain';

export const PERIODO_PADRAO_COMPARATIVOS: IndicatorPeriodPreset = 'ultimos_90_dias';

/**
 * US28.1 & US28.4: Serviço de Comparativos entre Combustíveis e Veículos
 * reutilizando `resolverIntervaloPeriodo` e `obterIndicadoresUsoECustoDoPeriodo` da US24.
 */
export class ComparisonService {
  static async compararCombustiveisDoVeiculo(
    veiculoId: string,
    preset: IndicatorPeriodPreset = PERIODO_PADRAO_COMPARATIVOS,
    dataReferencia: Date = new Date(),
  ): Promise<{
    inicio: string;
    fim: string;
    label: string;
    itens: FuelComparisonItem[];
  }> {
    const intervalo = resolverIntervaloPeriodo(preset, dataReferencia);
    const abastecimentos = await RefuelRepository.listByVehicle(veiculoId);
    const itens = consumoPorCombustivel(abastecimentos, veiculoId, {
      inicio: intervalo.inicio,
      fim: intervalo.fim,
    });

    return {
      inicio: intervalo.inicio,
      fim: intervalo.fim,
      label: intervalo.label,
      itens,
    };
  }

  static async compararVeiculosDaFrota(
    preset: IndicatorPeriodPreset = PERIODO_PADRAO_COMPARATIVOS,
    dataReferencia: Date = new Date(),
  ): Promise<{
    inicio: string;
    fim: string;
    label: string;
    itens: VehicleComparisonItem[];
  }> {
    const intervalo = resolverIntervaloPeriodo(preset, dataReferencia);
    const veiculos = await VehicleRepository.listAll();

    const startMs = new Date(`${intervalo.inicio}T00:00:00.000Z`).getTime();
    const endMs = new Date(`${intervalo.fim}T23:59:59.999Z`).getTime();

    const resumos: VehicleComparisonInput[] = [];
    for (const veiculo of veiculos) {
      const indicadores = await obterIndicadoresUsoECustoDoPeriodo(
        veiculo.id,
        intervalo.inicio,
        intervalo.fim,
      );
      const refuels = await RefuelRepository.listByVehicle(veiculo.id);
      const kmlsNoPeriodo = refuels
        .filter(r => {
          if (r.deletedAt) return false;
          const ms = new Date(r.date).getTime();
          return (
            Number.isFinite(ms) &&
            ms >= startMs &&
            ms <= endMs &&
            Number.isFinite(Number(r.calculatedKml)) &&
            Number(r.calculatedKml) > 0
          );
        })
        .map(r => Number(r.calculatedKml));

      const consumoMedioKml =
        kmlsNoPeriodo.length > 0
          ? Number(
              (kmlsNoPeriodo.reduce((acc, v) => acc + v, 0) / kmlsNoPeriodo.length).toFixed(2),
            )
          : null;

      resumos.push({
        veiculoId: veiculo.id,
        nome: veiculo.name || `${veiculo.brand || ''} ${veiculo.model}`.trim(),
        placa: veiculo.plate,
        consumoMedioKml,
        kmRodados: indicadores.uso.kmRodados,
        custoTotal: indicadores.custo.custoTotal,
        custoPorKm: indicadores.uso.kmRodados > 0 ? indicadores.custo.custoKmTotal : null,
      });
    }

    return {
      inicio: intervalo.inicio,
      fim: intervalo.fim,
      label: intervalo.label,
      itens: compararVeiculos(resumos),
    };
  }
}
