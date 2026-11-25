import {
  DrivingProfileCorrelationItem,
  DrivingProfileCorrelationResult,
  DrivingProfileType,
  Refuel,
} from '@autogest/shared-types';

export const MINIMO_REGISTROS_GRAFICO_PERFIL = 3;

export const PERFIS_CONDUCAO_OPCOES: Array<{
  valor: DrivingProfileType;
  rotulo: string;
  descricao: string;
}> = [
  {
    valor: 'economico',
    rotulo: 'Econômico',
    descricao: 'Acelerações suaves, trocas de marcha cedo e velocidade constante.',
  },
  {
    valor: 'normal',
    rotulo: 'Normal',
    descricao: 'Ritmo equilibrado no dia a dia, acompanhando o fluxo do trânsito.',
  },
  {
    valor: 'agressivo',
    rotulo: 'Dinâmico',
    descricao: 'Retomadas mais rápidas, giros mais altos e condução mais ágil.',
  },
];

const ROTULOS: Record<DrivingProfileType, string> = {
  economico: 'Econômico',
  normal: 'Normal',
  agressivo: 'Dinâmico',
};

/**
 * US29.2: Função pura que agrupa o consumo médio (km/l) pelo perfil de condução
 * registrado em cada abastecimento. Perfis sem registros retornam `mediaKml: null`
 * e `totalAbastecimentos: 0` sem divisão por zero.
 */
export function correlacaoPerfilConsumo(registros: Refuel[]): DrivingProfileCorrelationResult {
  const buckets: Record<DrivingProfileType, { soma: number; count: number }> = {
    economico: { soma: 0, count: 0 },
    normal: { soma: 0, count: 0 },
    agressivo: { soma: 0, count: 0 },
  };

  let totalComConsumo = 0;

  for (const reg of registros || []) {
    if (!reg || reg.deletedAt) continue;
    const kml = Number(reg.calculatedKml);
    if (!Number.isFinite(kml) || kml <= 0) continue;

    const perfil = (reg.perfil_conducao || reg.drivingProfile) as DrivingProfileType | undefined;
    if (!perfil || !buckets[perfil]) continue;

    buckets[perfil].soma += kml;
    buckets[perfil].count += 1;
    totalComConsumo += 1;
  }

  const ordem: DrivingProfileType[] = ['economico', 'normal', 'agressivo'];
  const itens: DrivingProfileCorrelationItem[] = ordem.map(perfil => {
    const b = buckets[perfil];
    return {
      perfil,
      rotulo: ROTULOS[perfil],
      mediaKml: b.count > 0 ? Number((b.soma / b.count).toFixed(2)) : null,
      totalAbastecimentos: b.count,
    };
  });

  return {
    itens,
    totalRegistrosComConsumo: totalComConsumo,
    dadosSuficientes: totalComConsumo >= MINIMO_REGISTROS_GRAFICO_PERFIL,
  };
}
