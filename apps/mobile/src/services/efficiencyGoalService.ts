import {
  DrivingProfile,
  EcoTip,
  GoalSituation,
  GoalStatusResult,
  Refuel,
  RouteType,
} from '@autogest/shared-types';

/**
 * US08.3: Calcula o progresso e situação da meta de eficiência
 * Progresso = consumoMedio / meta
 * atingida quando consumoMedio >= meta
 * abaixo quando consumoMedio < meta
 * sem_dados quando consumoMedio ou meta forem nulos ou <= 0
 */
export function statusDaMeta(
  consumoMedio: number | null | undefined,
  meta: number | null | undefined
): GoalStatusResult {
  if (
    consumoMedio == null ||
    meta == null ||
    consumoMedio <= 0 ||
    meta <= 0 ||
    isNaN(consumoMedio) ||
    isNaN(meta)
  ) {
    return {
      progresso: 0,
      situacao: 'sem_dados',
      percentual: 0,
    };
  }

  const rawProgresso = consumoMedio / meta;
  const progresso = Math.round(rawProgresso * 1000) / 1000;
  const percentual = Math.round(rawProgresso * 100);

  const situacao: GoalSituation =
    consumoMedio >= meta ? 'atingida' : 'abaixo';

  return {
    progresso,
    situacao,
    percentual,
  };
}

/**
 * Validação de valor da meta de consumo (km/l)
 * Deve ser um número estritamente positivo
 */
export function validarMetaConsumo(meta: number | null | undefined): {
  isValid: boolean;
  error?: string;
} {
  if (meta == null || isNaN(meta) || meta <= 0) {
    return {
      isValid: false,
      error: 'A meta de consumo deve ser um valor maior que zero.',
    };
  }
  return { isValid: true };
}

/**
 * US08.4: Determina o perfil de rodagem do veículo ativo
 * Percurso predominante, consumo vs meta, anomalia e calibragem de pneus
 */
export function perfilDeRodagem(
  refuels: Refuel[],
  meta: number | null | undefined,
  temAnomalia: boolean = false,
  calibragemPneusAtrasada: boolean = false
): DrivingProfile {
  // Filtra abastecimentos com consumo válido
  const validRefuels = refuels.filter(
    (r) => r.calculatedKml != null && r.calculatedKml > 0
  );

  let consumoMedioKml: number | null = null;
  if (validRefuels.length > 0) {
    const soma = validRefuels.reduce(
      (acc, r) => acc + (r.calculatedKml as number),
      0
    );
    consumoMedioKml = Math.round((soma / validRefuels.length) * 10) / 10;
  }

  // Contagem de tipo de percurso
  const counts: Record<RouteType, number> = {
    urbano: 0,
    rodoviario: 0,
    misto: 0,
  };

  let totalComPercurso = 0;
  for (const r of refuels) {
    if (r.routeType && counts[r.routeType] !== undefined) {
      counts[r.routeType]++;
      totalComPercurso++;
    }
  }

  let tipoPercursoPredominante: RouteType = 'misto';
  if (totalComPercurso > 0) {
    if (
      counts.urbano > counts.rodoviario &&
      counts.urbano > counts.misto
    ) {
      tipoPercursoPredominante = 'urbano';
    } else if (
      counts.rodoviario > counts.urbano &&
      counts.rodoviario > counts.misto
    ) {
      tipoPercursoPredominante = 'rodoviario';
    } else {
      tipoPercursoPredominante = 'misto';
    }
  }

  const { situacao } = statusDaMeta(consumoMedioKml, meta);

  return {
    tipoPercursoPredominante,
    situacaoMeta: situacao,
    consumoMedioKml,
    metaConsumoKml: meta ?? null,
    temAnomalia,
    calibragemPneusAtrasada,
  };
}

/**
 * US08.7: Validador de catálogo de dicas (schema JSON)
 */
export function validarCatalogoDicas(dicas: any): {
  isValid: boolean;
  error?: string;
} {
  if (!Array.isArray(dicas)) {
    return { isValid: false, error: 'O catálogo deve ser uma lista de dicas' };
  }

  for (const d of dicas) {
    if (!d || typeof d !== 'object') {
      return { isValid: false, error: 'Item do catálogo inválido' };
    }
    if (
      typeof d.id !== 'string' ||
      typeof d.titulo !== 'string' ||
      typeof d.descricao !== 'string' ||
      typeof d.prioridade !== 'number'
    ) {
      return {
        isValid: false,
        error: `Dica com campos obrigatórios ausentes ou tipos inválidos: ${JSON.stringify(
          d
        )}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * US08.5: Recomenda até 3 dicas contextualizadas e priorizadas com base no perfil de rodagem
 */
export function recomendar(
  perfil: DrivingProfile,
  catalogo: EcoTip[]
): EcoTip[] {
  if (!catalogo || catalogo.length === 0) {
    return [];
  }

  // Pontuação/filtro de cada dica para o perfil
  const pontuadas: { dica: EcoTip; score: number }[] = [];

  for (const dica of catalogo) {
    const c = dica.condicao || {};
    let matches = true;
    let score = (10 - (dica.prioridade || 3)) * 10; // Base score por prioridade

    // Condição: calibragemAtrasada
    if (c.calibragemAtrasada != null) {
      if (c.calibragemAtrasada === perfil.calibragemPneusAtrasada) {
        if (perfil.calibragemPneusAtrasada) score += 50;
      } else {
        matches = false;
      }
    }

    // Condição: temAnomalia
    if (c.temAnomalia != null) {
      if (c.temAnomalia === perfil.temAnomalia) {
        if (perfil.temAnomalia) score += 40;
      } else {
        matches = false;
      }
    }

    // Condição: situacaoMeta
    if (c.situacaoMeta != null) {
      if (c.situacaoMeta === perfil.situacaoMeta) {
        score += 30;
      } else {
        matches = false;
      }
    }

    // Condição: percurso
    if (c.percurso != null) {
      if (c.percurso === perfil.tipoPercursoPredominante) {
        score += 20;
      } else {
        matches = false;
      }
    }

    // Dicas gerais (sem condições específicas) combinam sempre
    const isGeneral =
      c.calibragemAtrasada == null &&
      c.temAnomalia == null &&
      c.situacaoMeta == null &&
      c.percurso == null;

    if (matches || isGeneral) {
      pontuadas.push({ dica, score });
    }
  }

  // Ordena por score decrescente (ou prioridade crescente em caso de empate)
  pontuadas.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.dica.prioridade - b.dica.prioridade;
  });

  // Retorna até 3 dicas únicas
  const result: EcoTip[] = [];
  const seenIds = new Set<string>();

  for (const item of pontuadas) {
    if (!seenIds.has(item.dica.id)) {
      seenIds.add(item.dica.id);
      result.push(item.dica);
      if (result.length >= 3) break;
    }
  }

  return result;
}
