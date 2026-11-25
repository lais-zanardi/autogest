import {
  FuelPriceRecord,
  FuelStationRecord,
  FuelType,
  RankedFuelStation,
} from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { Coordinates, GPSService } from './gpsService';
import { PreferencesService } from './preferencesService';
import { PRECOS_TABLE } from './regionalPricesService';
import { ordenarPostosPorPreco } from './cheapestStationsDomain';

export const POSTOS_TABLE = 'postos';

export interface CheapestStationsResult {
  postos: RankedFuelStation[];
  posicao: Coordinates | null;
  permissaoNegada: boolean;
  combustivel: string;
  municipioAplicado: string | null;
  raioKm: number;
}

/**
 * US34.3 & US34.5: Serviço de consulta de postos mais baratos usando exclusivamente
 * o cache local (`postos` e `precos_combustivel` da US17) e a posição sob demanda.
 */
export class CheapestStationsService {
  static async buscarPostosMaisBaratos(params?: {
    combustivel?: FuelType | string;
    raioKm?: number;
    municipioFallback?: string;
    posicaoJaObtida?: Coordinates | null;
    forcarSemPosicao?: boolean;
  }): Promise<CheapestStationsResult> {
    const combustivel = String(
      params?.combustivel || (await PreferencesService.obterCombustivelPrincipal()),
    ).trim();
    const raioKm = params?.raioKm ?? 10;

    let posicao: Coordinates | null = null;
    let permissaoNegada = false;

    if (params?.forcarSemPosicao) {
      posicao = null;
      permissaoNegada = true;
    } else if (params?.posicaoJaObtida !== undefined) {
      posicao = params.posicaoJaObtida;
      permissaoNegada = posicao === null;
    } else {
      const gps = await GPSService.obterPosicaoComPermissao();
      posicao = gps.coords;
      permissaoNegada = gps.permissaoNegada;
    }

    const db = DatabaseConnection.getInstance();
    const postosLocais = (await db.getTableData<FuelStationRecord>(POSTOS_TABLE)) || [];
    const precosLocais = (await db.getTableData<FuelPriceRecord>(PRECOS_TABLE)) || [];

    const municipioAplicado = permissaoNegada
      ? (params?.municipioFallback || (await PreferencesService.obterMunicipioPadrao())).trim()
      : null;

    const postos = ordenarPostosPorPreco(postosLocais, posicao, combustivel, raioKm, {
      cachePrecosMunicipais: precosLocais,
      municipioFiltro: municipioAplicado || undefined,
    });

    return {
      postos,
      posicao,
      permissaoNegada,
      combustivel,
      municipioAplicado,
      raioKm,
    };
  }
}
