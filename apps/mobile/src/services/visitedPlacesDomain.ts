import { GroupedVisitedPlace, VisitedPlaceRecord, VisitedPlaceType } from '@autogest/shared-types';
import { calcularDistanciaHaversineKm } from './cheapestStationsDomain';
import { colors } from '../theme/colors';

export const RAIO_AGRUPAMENTO_METROS = 50;

export const MENSAGEM_MAPA_VAZIO =
  'Registre um abastecimento ou manutenção com localização para ver seus locais aqui.';

/**
 * US36.3 & US36.5: Legenda acessível que combina cor E ícone distintos para cada tipo de local.
 */
export const LEGENDA_MAPA_LOCAIS: Record<
  VisitedPlaceType,
  { rotulo: string; cor: string; icone: 'Fuel' | 'Wrench' }
> = {
  posto: {
    rotulo: 'Posto de combustível',
    cor: colors.lime,
    icone: 'Fuel',
  },
  oficina: {
    rotulo: 'Oficina mecânica',
    cor: colors.amber,
    icone: 'Wrench',
  },
};

function normalizarDataIso(data: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(data || '').trim());
  return match ? match[1] : String(data || '');
}

/**
 * US36.2: Função pura que remove duplicados por proximidade (até 50 m por padrão),
 * separa por tipo (`posto` vs `oficina`), conta o número de visitas e preserva a última data.
 * Registros sem coordenadas válidas são descartados.
 */
export function agruparLocaisVisitados(
  locais: VisitedPlaceRecord[],
  raioMetros: number = RAIO_AGRUPAMENTO_METROS,
): GroupedVisitedPlace[] {
  if (!Array.isArray(locais) || locais.length === 0) {
    return [];
  }

  const raioKm = Math.max(0, raioMetros) / 1000;
  const grupos: GroupedVisitedPlace[] = [];

  for (const local of locais) {
    if (!local || local.excluido_em) continue;

    const lat = Number(local.latitude);
    const lon = Number(local.longitude);
    if (
      local.latitude === null ||
      local.latitude === undefined ||
      local.longitude === null ||
      local.longitude === undefined ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    const dataNorm = normalizarDataIso(local.data);
    const nomePadrao = local.tipo === 'posto' ? 'Posto visitado' : 'Oficina visitada';
    const nomeLocal = (local.nome || '').trim() || nomePadrao;

    const existente = grupos.find(g => {
      if (g.tipo !== local.tipo) return false;
      const distKm = calcularDistanciaHaversineKm(
        { latitude: g.latitude, longitude: g.longitude },
        { latitude: lat, longitude: lon },
      );
      return distKm <= raioKm;
    });

    if (existente) {
      existente.visitas += 1;
      existente.referencias.push(local.referencia_id);
      if (dataNorm > existente.ultimaData) {
        existente.ultimaData = dataNorm;
        if (local.nome && local.nome.trim()) {
          existente.nome = local.nome.trim();
        }
      }
    } else {
      grupos.push({
        id: local.id,
        tipo: local.tipo,
        nome: nomeLocal,
        latitude: lat,
        longitude: lon,
        visitas: 1,
        ultimaData: dataNorm,
        referencias: [local.referencia_id],
      });
    }
  }

  return grupos.sort((a, b) => b.visitas - a.visitas || b.ultimaData.localeCompare(a.ultimaData));
}
