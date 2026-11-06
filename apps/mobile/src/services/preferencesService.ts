import {
  ConsumptionUnit,
  FormattedConsumptionResult,
  UserPreferences,
} from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';

const PREFS_TABLE = 'preferencias';

export interface PreferenceRow {
  id: string;
  chave: 'unidade_consumo_principal' | 'notificacoes_pausadas_ate' | string;
  valor: any;
  atualizado_em: string;
}

let cachedPreferences: UserPreferences = {
  unidade_consumo_principal: 'km/l',
  notificacoes_pausadas_ate: null,
};

/**
 * US39.2: Converte consumo de km/l para L/100 km (L/100 km = 100 ÷ km/l).
 * Zero, nulo, indefinido ou negativo devolve vazio (`null`).
 */
export function converterConsumo(kml?: number | null): number | null {
  if (
    kml === null ||
    kml === undefined ||
    typeof kml !== 'number' ||
    !Number.isFinite(kml) ||
    kml <= 0
  ) {
    return null;
  }
  return Number((100 / kml).toFixed(2));
}

function formatOneDecimalPtBr(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/**
 * US39.2: Formata o consumo retornando a unidade principal em destaque e a secundária ao lado,
 * ambas no formato pt-BR com 1 casa decimal.
 */
export function formatarConsumoDetalhado(
  kml?: number | null,
  unidadePrincipal?: ConsumptionUnit,
): FormattedConsumptionResult {
  const unit: ConsumptionUnit =
    unidadePrincipal || cachedPreferences.unidade_consumo_principal || 'km/l';

  const lPor100Km = converterConsumo(kml);
  if (lPor100Km === null || kml === null || kml === undefined || kml <= 0) {
    return {
      principal: '',
      secundario: '',
      textoCompleto: '',
      vazio: true,
      kml: null,
      lPor100Km: null,
      unidadePrincipal: unit,
    };
  }

  const kmlFormatted = `${formatOneDecimalPtBr(kml)} km/l`;
  const l100Formatted = `${formatOneDecimalPtBr(lPor100Km)} L/100 km`;

  if (unit === 'L/100 km') {
    return {
      principal: l100Formatted,
      secundario: kmlFormatted,
      textoCompleto: `${l100Formatted} (${kmlFormatted})`,
      vazio: false,
      kml,
      lPor100Km,
      unidadePrincipal: unit,
    };
  }

  return {
    principal: kmlFormatted,
    secundario: l100Formatted,
    textoCompleto: `${kmlFormatted} (${l100Formatted})`,
    vazio: false,
    kml,
    lPor100Km,
    unidadePrincipal: unit,
  };
}

/**
 * US39.2 & US39.4: Formata consumo com a unidade principal em destaque e a outra ao lado,
 * no formato pt-BR com 1 casa decimal (ex.: "12,5 km/l (8,0 L/100 km)" ou "8,0 L/100 km (12,5 km/l)").
 * Zero ou nulo devolve vazio ("").
 */
export function formatarConsumo(kml?: number | null, unidadePrincipal?: ConsumptionUnit): string {
  return formatarConsumoDetalhado(kml, unidadePrincipal).textoCompleto;
}

/**
 * US39.5: Formata o texto da faixa de pausa ("Notificações pausadas até dd/mm") quando ativa.
 */
export function formatarFaixaPausaNotificacoes(
  notificacoesPausadasAte?: string | null,
  dataReferencia: Date = new Date(),
): string | null {
  if (!notificacoesPausadasAte) return null;
  const endDate = new Date(notificacoesPausadasAte);
  if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= dataReferencia.getTime()) {
    return null;
  }

  const dd = String(endDate.getUTCDate()).padStart(2, '0');
  const mm = String(endDate.getUTCMonth() + 1).padStart(2, '0');
  return `Notificações pausadas até ${dd}/${mm}`;
}

export interface PausarNotificacoesOptions {
  duracaoDias?: number;
  duracaoHoras?: number;
  dataFinal?: string | Date;
}

function resolverDataFinalPausa(
  opcoes: PausarNotificacoesOptions,
  dataReferencia: Date = new Date(),
): Date {
  if (opcoes.dataFinal !== undefined && opcoes.dataFinal !== null && opcoes.dataFinal !== '') {
    if (opcoes.dataFinal instanceof Date) {
      if (Number.isNaN(opcoes.dataFinal.getTime())) {
        throw new Error('Data final inválida para pausa de notificações.');
      }
      return opcoes.dataFinal;
    }

    const raw = String(opcoes.dataFinal).trim();
    // Suporta DD/MM/AAAA
    const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    if (brMatch) {
      const [, dd, mm, yyyy] = brMatch;
      const parsed = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Data final inválida.');
      }
      return parsed;
    }

    // Suporta AAAA-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parsed = new Date(`${raw}T23:59:59.999Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Data final inválida.');
      }
      return parsed;
    }

    const parsedIso = new Date(raw);
    if (Number.isNaN(parsedIso.getTime())) {
      throw new Error('Data final inválida para pausa de notificações.');
    }
    return parsedIso;
  }

  if (opcoes.duracaoDias !== undefined && Number(opcoes.duracaoDias) > 0) {
    const ms = Number(opcoes.duracaoDias) * 24 * 60 * 60 * 1000;
    return new Date(dataReferencia.getTime() + ms);
  }

  if (opcoes.duracaoHoras !== undefined && Number(opcoes.duracaoHoras) > 0) {
    const ms = Number(opcoes.duracaoHoras) * 60 * 60 * 1000;
    return new Date(dataReferencia.getTime() + ms);
  }

  throw new Error('Informe a duração ou data final obrigatória para pausar as notificações.');
}

/**
 * US39.1, US39.3 & US39.5: Serviço de Preferências Locais (`preferencias`)
 * Gerencia `unidade_consumo_principal` (padrão 'km/l') e `notificacoes_pausadas_ate`.
 */
export class PreferencesService {
  static resetCache(): void {
    cachedPreferences = {
      unidade_consumo_principal: 'km/l',
      notificacoes_pausadas_ate: null,
    };
  }

  static obterCacheSincrono(): UserPreferences {
    return { ...cachedPreferences };
  }

  static async obterPreferencias(): Promise<UserPreferences> {
    const db = DatabaseConnection.getInstance();
    const rows = await db.getTableData<PreferenceRow>(PREFS_TABLE);

    let unidade: ConsumptionUnit = 'km/l';
    let pausadasAte: string | null = null;

    for (const row of rows || []) {
      if (
        row.chave === 'unidade_consumo_principal' &&
        (row.valor === 'km/l' || row.valor === 'L/100 km')
      ) {
        unidade = row.valor;
      } else if (row.chave === 'notificacoes_pausadas_ate') {
        pausadasAte = typeof row.valor === 'string' && row.valor.trim() ? row.valor : null;
      }
    }

    cachedPreferences = {
      unidade_consumo_principal: unidade,
      notificacoes_pausadas_ate: pausadasAte,
    };

    return { ...cachedPreferences };
  }

  private static async salvarChave(
    chave: 'unidade_consumo_principal' | 'notificacoes_pausadas_ate',
    valor: any,
  ): Promise<void> {
    const db = DatabaseConnection.getInstance();
    const rows = await db.getTableData<PreferenceRow>(PREFS_TABLE);
    const now = new Date().toISOString();
    const idx = rows.findIndex(r => r.chave === chave);

    if (idx >= 0) {
      rows[idx] = {
        ...rows[idx],
        valor,
        atualizado_em: now,
      };
    } else {
      rows.push({
        id: `pref_${chave}`,
        chave,
        valor,
        atualizado_em: now,
      });
    }

    await db.saveTableData(PREFS_TABLE, rows);
  }

  static async definirUnidadeConsumoPrincipal(unidade: ConsumptionUnit): Promise<UserPreferences> {
    if (unidade !== 'km/l' && unidade !== 'L/100 km') {
      throw new Error('Unidade de consumo inválida. Escolha entre "km/l" ou "L/100 km".');
    }

    await this.salvarChave('unidade_consumo_principal', unidade);
    cachedPreferences = {
      ...cachedPreferences,
      unidade_consumo_principal: unidade,
    };

    return { ...cachedPreferences };
  }

  static async definirNotificacoesPausadasAte(
    isoTimestamp: string | null,
  ): Promise<UserPreferences> {
    await this.salvarChave('notificacoes_pausadas_ate', isoTimestamp);
    cachedPreferences = {
      ...cachedPreferences,
      notificacoes_pausadas_ate: isoTimestamp,
    };
    return { ...cachedPreferences };
  }

  static async pausarNotificacoes(
    opcoes: PausarNotificacoesOptions,
    dataReferencia: Date = new Date(),
  ): Promise<UserPreferences> {
    const targetDate = resolverDataFinalPausa(opcoes, dataReferencia);
    if (targetDate.getTime() <= dataReferencia.getTime()) {
      throw new Error('A data final da pausa deve estar no futuro (posterior à data atual).');
    }

    return this.definirNotificacoesPausadasAte(targetDate.toISOString());
  }

  static async estaEmPausa(dataReferencia: Date = new Date()): Promise<boolean> {
    const prefs = await this.obterPreferencias();
    if (!prefs.notificacoes_pausadas_ate) return false;
    const endMs = new Date(prefs.notificacoes_pausadas_ate).getTime();
    return Number.isFinite(endMs) && endMs > dataReferencia.getTime();
  }
}
