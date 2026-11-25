import {
  FuelComparisonItem,
  Refuel,
  VehicleComparisonInput,
  VehicleComparisonItem,
} from '@autogest/shared-types';
import { formatarConsumo, formatarMoeda } from '../utils/formatters';

/**
 * US28.1 — Função pura que calcula consumo médio e custo por km por combustível
 * para um veículo específico. Combustíveis sem registros ficam de fora.
 */
export function consumoPorCombustivel(
  abastecimentos: Refuel[],
  veiculoId: string,
  periodo?: { inicio?: string; fim?: string },
): FuelComparisonItem[] {
  if (!Array.isArray(abastecimentos) || !abastecimentos.length || !veiculoId) {
    return [];
  }

  const startMs = periodo?.inicio ? new Date(`${periodo.inicio}T00:00:00.000Z`).getTime() : null;
  const endMs = periodo?.fim ? new Date(`${periodo.fim}T23:59:59.999Z`).getTime() : null;

  const filtrados = abastecimentos.filter(r => {
    if (!r || r.deletedAt || r.vehicleId !== veiculoId) return false;
    if (startMs !== null || endMs !== null) {
      const ms = new Date(r.date).getTime();
      if (!Number.isFinite(ms)) return false;
      if (startMs !== null && ms < startMs) return false;
      if (endMs !== null && ms > endMs) return false;
    }
    return true;
  });

  if (!filtrados.length) return [];

  const buckets = new Map<
    string,
    {
      somaKml: number;
      qtdKml: number;
      totalGasto: number;
      totalLitros: number;
      totalRegistros: number;
    }
  >();

  for (const r of filtrados) {
    const key = String(r.fuelType || 'Outro').trim();
    const existing = buckets.get(key) || {
      somaKml: 0,
      qtdKml: 0,
      totalGasto: 0,
      totalLitros: 0,
      totalRegistros: 0,
    };

    const kml = Number(r.calculatedKml);
    if (Number.isFinite(kml) && kml > 0) {
      existing.somaKml += kml;
      existing.qtdKml += 1;
    }

    existing.totalGasto += Number(r.totalValue) || 0;
    existing.totalLitros += Number(r.liters) || 0;
    existing.totalRegistros += 1;

    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .filter(([, b]) => b.totalRegistros > 0)
    .map(([combustivel, b]) => {
      const mediaKml = b.qtdKml > 0 ? Number((b.somaKml / b.qtdKml).toFixed(2)) : null;
      const precoMedioLitro = b.totalLitros > 0 ? b.totalGasto / b.totalLitros : null;
      const custoPorKm =
        mediaKml && mediaKml > 0 && precoMedioLitro !== null
          ? Number((precoMedioLitro / mediaKml).toFixed(2))
          : null;

      return {
        combustivel,
        mediaKml,
        custoPorKm,
        consumoFormatado: mediaKml ? formatarConsumo(mediaKml) : '--',
        custoPorKmFormatado:
          custoPorKm !== null ? `${formatarMoeda(custoPorKm)}/km` : '--',
        totalGasto: Number(b.totalGasto.toFixed(2)),
        totalLitros: Number(b.totalLitros.toFixed(2)),
        totalRegistros: b.totalRegistros,
      };
    })
    .sort((a, b) => (b.mediaKml || 0) - (a.mediaKml || 0));
}

/**
 * US28.1 — Função pura que compara múltiplos veículos a partir de seus resumos
 * (reaproveitando os indicadores consolidados da US24).
 * Veículo sem km rodados exibe "--" (nunca zero).
 */
export function compararVeiculos(resumos: VehicleComparisonInput[]): VehicleComparisonItem[] {
  if (!Array.isArray(resumos) || !resumos.length) {
    return [];
  }

  return resumos.map(v => {
    const semKm = !Number.isFinite(v.kmRodados) || v.kmRodados <= 0;
    const custoPorKmValido =
      !semKm && v.custoPorKm !== null && Number.isFinite(v.custoPorKm) && v.custoPorKm > 0
        ? Number(v.custoPorKm.toFixed(2))
        : null;
    const consumoValido =
      v.consumoMedioKml !== null &&
      Number.isFinite(v.consumoMedioKml) &&
      v.consumoMedioKml > 0
        ? Number(v.consumoMedioKml.toFixed(2))
        : null;

    return {
      ...v,
      consumoMedioKml: consumoValido,
      custoPorKm: custoPorKmValido,
      consumoFormatado: consumoValido ? formatarConsumo(consumoValido) : '--',
      custoPorKmFormatado:
        custoPorKmValido !== null ? `${formatarMoeda(custoPorKmValido)}/km` : '--',
    };
  });
}
