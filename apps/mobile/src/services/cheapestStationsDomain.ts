import {
  FuelPriceRecord,
  FuelStationRecord,
  RankedFuelStation,
} from '@autogest/shared-types';
import { Coordinates } from './gpsService';

const EARTH_RADIUS_KM = 6371;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normalizarTexto(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * US34.2: Calcula distância geodésica em quilômetros entre dois pontos usando fórmula de Haversine.
 * Função pura e determinística.
 */
export function calcularDistanciaHaversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return Number((EARTH_RADIUS_KM * c).toFixed(3));
}

function resolverPrecoPostoCentavos(
  posto: FuelStationRecord,
  combustivel: string,
  cachePrecosMunicipais?: FuelPriceRecord[],
): { preco_centavos: number; fonte_preco: 'posto' | 'media_municipal' } | null {
  const alvoComb = normalizarTexto(combustivel);

  if (posto.precos_centavos) {
    for (const [key, val] of Object.entries(posto.precos_centavos)) {
      if (normalizarTexto(key) === alvoComb && Number.isFinite(val) && val > 0) {
        return { preco_centavos: Math.round(val), fonte_preco: 'posto' };
      }
    }
  }

  if (cachePrecosMunicipais?.length) {
    const alvoMun = normalizarTexto(posto.municipio);
    const match = cachePrecosMunicipais
      .filter(
        p =>
          normalizarTexto(p.municipio) === alvoMun &&
          normalizarTexto(p.combustivel) === alvoComb &&
          p.preco_centavos > 0,
      )
      .sort((a, b) => b.data_coleta.localeCompare(a.data_coleta))[0];

    if (match) {
      return { preco_centavos: match.preco_centavos, fonte_preco: 'media_municipal' };
    }
  }

  return null;
}

/**
 * US34.2: Filtra postos por raio (quando há posição), ordena por preço crescente e,
 * em empate de preço, por distância crescente.
 * Quando `posicao` é nula (permissão negada — US34.3), filtra por município opcional
 * e ordena somente por preço.
 */
export function ordenarPostosPorPreco(
  postos: FuelStationRecord[],
  posicao: Coordinates | null,
  combustivel: string,
  raioKm: number,
  opcoes?: {
    cachePrecosMunicipais?: FuelPriceRecord[];
    municipioFiltro?: string;
  },
): RankedFuelStation[] {
  if (!Array.isArray(postos) || postos.length === 0) {
    return [];
  }

  if (posicao && (!Number.isFinite(raioKm) || raioKm <= 0)) {
    return [];
  }

  const alvoMunicipio = opcoes?.municipioFiltro
    ? normalizarTexto(opcoes.municipioFiltro)
    : null;

  const candidatos: RankedFuelStation[] = [];

  for (const posto of postos) {
    if (!posicao && alvoMunicipio && normalizarTexto(posto.municipio) !== alvoMunicipio) {
      continue;
    }

    const precoResolvido = resolverPrecoPostoCentavos(
      posto,
      combustivel,
      opcoes?.cachePrecosMunicipais,
    );
    if (!precoResolvido) {
      continue;
    }

    let distanciaKm: number | null = null;
    if (posicao) {
      distanciaKm = calcularDistanciaHaversineKm(posicao, {
        latitude: posto.latitude,
        longitude: posto.longitude,
      });
      if (distanciaKm > raioKm) {
        continue;
      }
    }

    candidatos.push({
      ...posto,
      combustivel,
      preco_centavos: precoResolvido.preco_centavos,
      distancia_km: distanciaKm,
      fonte_preco: precoResolvido.fonte_preco,
    });
  }

  return candidatos.sort((a, b) => {
    if (a.preco_centavos !== b.preco_centavos) {
      return a.preco_centavos - b.preco_centavos;
    }
    if (a.distancia_km !== null && b.distancia_km !== null && a.distancia_km !== b.distancia_km) {
      return a.distancia_km - b.distancia_km;
    }
    return a.nome.localeCompare(b.nome);
  });
}

/**
 * US34.4: Monta URL de rota para abrir diretamente no app de mapas do aparelho.
 */
export function montarUrlMapaRota(latitude: number, longitude: number, nomePosto?: string): string {
  const label = nomePosto ? encodeURIComponent(nomePosto) : 'Posto';
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${label}`;
}
