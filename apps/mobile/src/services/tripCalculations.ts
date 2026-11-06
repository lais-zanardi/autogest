import { Trip, Refuel, Expense, TripSummary, TripSubtype } from '@autogest/shared-types';

export interface ValidacaoViagemResult {
  isValid: boolean;
  error?: string;
}

/**
 * US07.4: Validação de km final da viagem com a regra validarNovoKm
 * O km final deve ser estritamente superior ao km inicial da viagem.
 */
export function validarFinalizacaoViagem(
  kmInicial: number,
  kmFinal: number,
): ValidacaoViagemResult {
  if (kmFinal === undefined || kmFinal === null || isNaN(kmFinal)) {
    return { isValid: false, error: 'Quilometragem final é obrigatória.' };
  }
  if (kmFinal <= kmInicial) {
    return {
      isValid: false,
      error: `Quilometragem final (${kmFinal} km) deve ser maior que a quilometragem inicial (${kmInicial} km).`,
    };
  }
  return { isValid: true };
}

/**
 * US07.5: Função pura resumoDaViagem
 * Calcula: km percorridos, litros, rendimento da rota (km ÷ litros), custo total, custo/km e total por subtipo.
 * Sem km final ou viagem em andamento, não há cálculo de rendimento.
 */
export function resumoDaViagem(
  viagem: Trip,
  abastecimentos: Refuel[],
  despesas: Expense[],
): TripSummary {
  const kmInicio = Number(viagem.startOdometer ?? (viagem as any).km_inicio ?? 0);
  const kmFim =
    viagem.endOdometer !== undefined && viagem.endOdometer !== null
      ? Number(viagem.endOdometer)
      : (viagem as any).km_fim !== undefined && (viagem as any).km_fim !== null
        ? Number((viagem as any).km_fim)
        : null;

  const distanciaKm = kmFim !== null && kmFim > kmInicio ? kmFim - kmInicio : null;

  // Abastecimentos vinculados à viagem
  const refuelsViagem = (abastecimentos || []).filter(
    r =>
      !r.deletedAt &&
      !(r as any).excluido_em &&
      (r.tripId === viagem.id || (r as any).viagem_id === viagem.id),
  );

  let totalLitros = 0;
  let custoCombustivel = 0;

  for (const r of refuelsViagem) {
    totalLitros += Number(r.liters || 0);
    custoCombustivel += Number(r.totalValue || 0);
  }

  // Despesas vinculadas à viagem
  const despesasViagem = (despesas || []).filter(
    e =>
      !e.deletedAt &&
      !(e as any).excluido_em &&
      (e.tripId === viagem.id || (e as any).viagem_id === viagem.id),
  );

  let custoDespesas = 0;
  const custoPorSubtipo: Record<TripSubtype, number> = {
    pedagio: 0,
    alimentacao: 0,
    hospedagem: 0,
    estacionamento: 0,
    outros: 0,
  };

  for (const e of despesasViagem) {
    const valor = Number(e.amount || 0);
    custoDespesas += valor;

    const subtipo = (e.subtipoViagem || (e as any).subtipo_viagem || 'outros') as TripSubtype;
    if (custoPorSubtipo[subtipo] !== undefined) {
      custoPorSubtipo[subtipo] += valor;
    } else {
      custoPorSubtipo.outros += valor;
    }
  }

  const custoTotal = custoCombustivel + custoDespesas;

  // Rendimento: km ÷ litros (se houver distância e litros > 0)
  const rendimentoKml =
    distanciaKm !== null && totalLitros > 0
      ? Number((distanciaKm / totalLitros).toFixed(2))
      : null;

  // Custo por km: custo total ÷ km
  const custoPorKm =
    distanciaKm !== null && distanciaKm > 0
      ? Number((custoTotal / distanciaKm).toFixed(2))
      : null;

  return {
    distanciaKm,
    totalLitros: Number(totalLitros.toFixed(2)),
    rendimentoKml,
    custoCombustivel: Number(custoCombustivel.toFixed(2)),
    custoDespesas: Number(custoDespesas.toFixed(2)),
    custoTotal: Number(custoTotal.toFixed(2)),
    custoPorKm,
    custoPorSubtipo,
    totalAbastecimentos: refuelsViagem.length,
    totalDespesas: despesasViagem.length,
  };
}
