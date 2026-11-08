// @ts-expect-error uuid typings fallback
import { v5 as uuidv5 } from 'uuid';

/**
 * Namespace fixo para geração determinística de UUIDs v5 do AutoGest Demo
 */
export const AUTOGEST_DEMO_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function makeDemoId(entity: string, seedKey: string | number): string {
  return uuidv5(`autogest:demo:${entity}:${seedKey}`, AUTOGEST_DEMO_NAMESPACE);
}

export interface DemoVehicleData {
  id: string;
  userId: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  fuelType: string;
  tankCapacityL: number;
  preferredFuel: string;
  initialOdometer: number;
  currentOdometer: number;
}

export interface DemoRefuelData {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  fuelType: string;
  pricePerLiter: number;
  totalValue: number;
  liters: number;
  isFullTank: boolean;
  stationName: string;
  routeType: 'urbano' | 'rodoviario' | 'misto';
  notes: string;
  tags: string[];
  tripId?: string;
  expectedKml?: number;
}

export interface DemoExpenseData {
  id: string;
  vehicleId: string;
  category: 'Seguro' | 'Imposto' | 'Lavagem' | 'Outros';
  amount: number; // em reais no serviço/repositório
  date: string;
  description: string;
  tripId?: string;
  subtipoViagem?: 'pedagio' | 'alimentacao' | 'hospedagem' | 'estacionamento' | 'outros';
}

export interface DemoFixedCostData {
  id: string;
  vehicleId: string;
  description: string;
  monthlyAmount: number; // em reais no serviço
}

export interface DemoMaintenanceData {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  type: 'preventiva' | 'corretiva';
  serviceType: string;
  description: string;
  workshop: string;
  totalValue: number;
  notes?: string;
}

export interface DemoMaintenanceRuleData {
  id: string;
  vehicleId: string;
  serviceType: string;
  name: string;
  intervalKm: number;
  intervalDays: number;
  advanceKm: number;
  advanceDays: number;
  lastServiceDate: string;
  lastServiceKm: number;
}

export interface DemoTireRecordData {
  id: string;
  vehicleId: string;
  date: string;
  km: number;
  type: 'calibragem' | 'troca' | 'rotacao';
  pressurePsi: number;
  treadDepthMm: number;
}

export interface DemoFluidRecordData {
  id: string;
  vehicleId: string;
  date: string;
  km: number;
  fluidType: 'oleo_motor' | 'freio' | 'arrefecimento' | 'transmissao';
  level: 'normal' | 'baixo' | 'critico';
}

export interface DemoBudgetData {
  id: string;
  vehicleId: string;
  tetoMensalCentavos: number;
  percentualAviso: number;
}

export interface DemoTripData {
  id: string;
  vehicleId: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  startOdometer: number;
  endOdometer: number;
  status: 'concluida';
}

export interface DemoEfficiencyGoalData {
  id: string;
  vehicleId: string;
  targetKml: number;
}

export interface DemoMaintenanceScheduleData {
  id: string;
  vehicleId: string;
  date: string;
  reminderTime: string;
  serviceType: string;
  description: string;
  status: 'agendado';
}

export interface DemoFipeData {
  id: string;
  vehicleId: string;
  fipeCode: string;
  brand: string;
  model: string;
  modelYear: number;
  fuel: string;
  referenceMonth: string; // ex: "2026-08"
  valueCentavos: number;
  consultedAt: string;
}

export interface DemoDataPackage {
  generatedAt: string;
  userId: string;
  vehicles: DemoVehicleData[];
  refuels: DemoRefuelData[];
  expenses: DemoExpenseData[];
  fixedCosts: DemoFixedCostData[];
  maintenances: DemoMaintenanceData[];
  maintenanceRules: DemoMaintenanceRuleData[];
  tireRecords: DemoTireRecordData[];
  fluidRecords: DemoFluidRecordData[];
  budgets: DemoBudgetData[];
  trip: DemoTripData;
  efficiencyGoals: DemoEfficiencyGoalData[];
  maintenanceSchedules: DemoMaintenanceScheduleData[];
  fipeConsultations: DemoFipeData[];
  scenarioValues: {
    lastOdometerA: number;
    anomalyOdometer: number;
    anomalyLiters: number;
    anomalyExpectedKml: number;
    budgetTetoReais: number;
    budgetWarningThreshold: number;
    budgetSpentCurrentMonthReais: number;
    budgetDeltaWarningReais: number;
    budgetDeltaCriticalReais: number;
    unitDemoKml: number;
    unitDemoL100: number;
  };
}

/**
 * Função utilitária pura para manipular datas relativas em UTC sem Math.random
 */
function toIsoDate(d: Date): string {
  return d.toISOString();
}

function toIsoDay(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Gera os dados puros de demonstração de forma totalmente determinística.
 * Todas as datas geradas são <= agora e cobrem ~5 meses.
 */
export function gerarDadosDemo(agora: Date = new Date(), usuarioId: string = 'demo_user'): DemoDataPackage {
  const agoraMs = agora.getTime();

  // Veículo A: 2019, placa Mercosul fictícia BRA2E19, tanque 50L
  const vehicleAId = makeDemoId('veiculo', 'A');
  const vehicleBId = makeDemoId('veiculo', 'B');

  const vehicleA: DemoVehicleData = {
    id: vehicleAId,
    userId: usuarioId,
    name: 'Corolla Altis 2019',
    brand: 'Toyota',
    model: 'Corolla Altis 2.0',
    year: 2019,
    plate: 'BRA2E19',
    fuelType: 'Gasolina',
    tankCapacityL: 50,
    preferredFuel: 'Gasolina',
    initialOdometer: 45000,
    currentOdometer: 52400, // será sincronizado com o último refuel
  };

  const vehicleB: DemoVehicleData = {
    id: vehicleBId,
    userId: usuarioId,
    name: 'Gol Trend 2015',
    brand: 'Volkswagen',
    model: 'Gol Trendline 1.6',
    year: 2015,
    plate: 'ABC1234',
    fuelType: 'Flex',
    tankCapacityL: 45,
    preferredFuel: 'Gasolina',
    initialOdometer: 82000,
    currentOdometer: 82800,
  };

  // Cálculo das datas relativas a 'agora':
  // Mês atual (M0), Mês -1 (M1), Mês -2 (M2), Mês -3 (M3), Mês -4 (M4)
  const anoAtual = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth(); // 0-11
  const diaAtual = agora.getUTCDate();

  // Dia no mês atual seguro (<= diaAtual e <= 28)
  const safeDayM0 = Math.max(1, Math.min(diaAtual, 28));

  // Funções determinísticas para criar instâncias de Date passadas
  const getDateMonthsAgo = (monthsAgo: number, dayOfMonth: number, hourUtc = 10, minUtc = 0): Date => {
    let targetYear = anoAtual;
    let targetMonth = mesAtual - monthsAgo;
    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear -= 1;
    }
    const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    let d = Math.min(dayOfMonth, maxDay);
    if (monthsAgo === 0 && d > diaAtual) {
      d = diaAtual;
    }
    const res = new Date(Date.UTC(targetYear, targetMonth, d, hourUtc, minUtc, 0));
    // Garantir rigorosamente <= agoraMs
    if (res.getTime() > agoraMs) {
      return new Date(agoraMs - 1000 * 60 * (monthsAgo + 1));
    }
    return res;
  };

  // ==========================================
  // CUSTOS FIXOS (Veículo A)
  // Seguro de R$ 300,00 e Rastreamento de R$ 80,00 -> Total R$ 380,00 por mês
  // ==========================================
  const fixedCost1: DemoFixedCostData = {
    id: makeDemoId('custo_fixo', 'seguro_A'),
    vehicleId: vehicleAId,
    description: 'Seguro Auto Porto',
    monthlyAmount: 300.0,
  };
  const fixedCost2: DemoFixedCostData = {
    id: makeDemoId('custo_fixo', 'rastreador_A'),
    vehicleId: vehicleAId,
    description: 'Rastreador Veicular',
    monthlyAmount: 80.0,
  };
  const fixedCosts: DemoFixedCostData[] = [fixedCost1, fixedCost2];
  // Total Custo Fixo Mensal no Veículo A = R$ 380,00

  // ==========================================
  // ORÇAMENTO (Veículo A)
  // Teto R$ 1.000,00, aviso em 80%.
  // Gasto total do mês atual deve ser EXATAMENTE R$ 820,00 (82% -> Nível Aviso).
  // Custo fixo = R$ 380,00.
  // Gastos variáveis no mês atual devem somar EXATAMENTE: R$ 820,00 - R$ 380,00 = R$ 440,00!
  // ==========================================
  const budgetA: DemoBudgetData = {
    id: makeDemoId('orcamento', 'A'),
    vehicleId: vehicleAId,
    tetoMensalCentavos: 100000, // R$ 1.000,00
    percentualAviso: 80,
  };

  // ==========================================
  // ABASTECIMENTOS VEÍCULO A (~5 meses)
  // Requisitos:
  // - A cada ~450-520 km, 38-42 L.
  // - Consumo varia ao longo do tempo (urbano ~11, rodoviário 12.5-14, misto ~12).
  // - Etiquetas e notas.
  // - Os 3 ÚLTIMOS abastecimentos do A devem ter consumo EXATAMENTE 12.0 km/l!
  //   (Ex.: +480 km com 40.0 L cada -> 480 / 40 = 12.0 km/l)
  // - No mês atual: 1 abastecimento de 40 L a R$ 6,00/L = R$ 240,00 (+480 km, cons = 12.0 km/l).
  //   Gastos variáveis necessários no mês atual = R$ 440,00.
  //   Com R$ 240,00 em combustível, sobra R$ 200,00 em despesas variáveis no mês atual!
  // ==========================================
  const refuels: DemoRefuelData[] = [];

  // Mês -4 (início do histórico)
  // Refuel 1: primeiro abastecimento (odômetro inicial = 45000, cons = null)
  const dRefuel1 = getDateMonthsAgo(4, 5, 8, 30);
  refuels.push({
    id: makeDemoId('abastecimento', 1),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel1),
    odometer: 45000,
    fuelType: 'Gasolina',
    pricePerLiter: 5.89,
    totalValue: 235.6,
    liters: 40.0,
    isFullTank: true,
    stationName: 'Posto Shell Jardins',
    routeType: 'misto',
    notes: 'Primeiro abastecimento de referência',
    tags: ['dia a dia'],
  });

  // Refuel 2: Mês -4 (+462 km, 42 L -> 462 / 42 = 11.0 km/l urbano)
  const dRefuel2 = getDateMonthsAgo(4, 20, 14, 0);
  refuels.push({
    id: makeDemoId('abastecimento', 2),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel2),
    odometer: 45462,
    fuelType: 'Gasolina',
    pricePerLiter: 5.92,
    totalValue: 248.64,
    liters: 42.0,
    isFullTank: true,
    stationName: 'Posto Ipiranga Centro',
    routeType: 'urbano',
    notes: 'Trânsito pesado na semana',
    tags: ['trabalho'],
    expectedKml: 11.0,
  });

  // Refuel 3: Mês -3 (+540 km, 40 L -> 540 / 40 = 13.5 km/l rodoviário)
  const dRefuel3 = getDateMonthsAgo(3, 8, 9, 15);
  refuels.push({
    id: makeDemoId('abastecimento', 3),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel3),
    odometer: 46002,
    fuelType: 'Gasolina',
    pricePerLiter: 5.85,
    totalValue: 234.0,
    liters: 40.0,
    isFullTank: true,
    stationName: 'Graal Rodovia',
    routeType: 'rodoviario',
    notes: 'Viagem de fim de semana',
    tags: ['viagem'],
    expectedKml: 13.5,
  });

  // Refuel 4: Mês -3 (+476 km, 40 L -> 476 / 40 = 11.9 km/l misto)
  const dRefuel4 = getDateMonthsAgo(3, 24, 18, 0);
  refuels.push({
    id: makeDemoId('abastecimento', 4),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel4),
    odometer: 46478,
    fuelType: 'Gasolina',
    pricePerLiter: 5.89,
    totalValue: 235.6,
    liters: 40.0,
    isFullTank: true,
    stationName: 'Posto Petrobras Nações',
    routeType: 'misto',
    notes: 'Percurso misto',
    tags: ['dia a dia'],
    expectedKml: 11.9,
  });

  // Refuel 5: Mês -2 (+494 km, 38 L -> 494 / 38 = 13.0 km/l rodoviário)
  const dRefuel5 = getDateMonthsAgo(2, 10, 11, 30);
  refuels.push({
    id: makeDemoId('abastecimento', 5),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel5),
    odometer: 46972,
    fuelType: 'Gasolina',
    pricePerLiter: 5.95,
    totalValue: 226.1,
    liters: 38.0,
    isFullTank: true,
    stationName: 'Posto Shell Castelo',
    routeType: 'rodoviario',
    notes: 'Estrada com ar ligado',
    tags: ['viagem'],
    expectedKml: 13.0,
  });

  // Refuel 6 (O anterior à Viagem do Mês -1): km = 47440 (+468 km, 39 L -> 12.0 km/l misto)
  const dRefuel6 = getDateMonthsAgo(1, 5, 10, 0);
  refuels.push({
    id: makeDemoId('abastecimento', 6),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel6),
    odometer: 47440,
    fuelType: 'Gasolina',
    pricePerLiter: 5.99,
    totalValue: 233.61,
    liters: 39.0,
    isFullTank: true,
    stationName: 'Posto BR Bandeirantes',
    routeType: 'misto',
    notes: 'Tanque cheio antes da viagem',
    tags: ['dia a dia'],
    expectedKml: 12.0,
  });

  // ==========================================
  // VIAGEM NO MÊS ANTERIOR (M1):
  // Requisitos:
  // - Concluída no mês anterior.
  // - km inicial = km do abastecimento anterior = 47440.
  // - 500 km rodados -> km final = 47940.
  // - 40 L abastecidos a R$ 6,00/L (R$ 240,00).
  // - Pedágios de R$ 50,00 e Alimentação de R$ 60,00.
  // - Custo total: R$ 350,00; R$ 0,70/km; Rendimento 12,5 km/l (500 km / 40 L).
  // - Abastecimento e despesas vinculados à viagem!
  // ==========================================
  const tripId = makeDemoId('viagem', 'litoral_m1');
  const dTripStart = getDateMonthsAgo(1, 12, 7, 0);
  const dTripEnd = getDateMonthsAgo(1, 14, 18, 0);

  const trip: DemoTripData = {
    id: tripId,
    vehicleId: vehicleAId,
    origin: 'São Paulo, SP',
    destination: 'Ubatuba, SP',
    startDate: toIsoDate(dTripStart),
    endDate: toIsoDate(dTripEnd),
    startOdometer: 47440,
    endOdometer: 47940,
    status: 'concluida',
  };

  // Refuel 7: Abastecimento vinculado à viagem!
  // Hodômetro = 47940 (+500 km desde 47440, 40 L -> 500 / 40 = 12.5 km/l)
  const dRefuel7 = getDateMonthsAgo(1, 14, 17, 30);
  refuels.push({
    id: makeDemoId('abastecimento', 7),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel7),
    odometer: 47940,
    fuelType: 'Gasolina',
    pricePerLiter: 6.0,
    totalValue: 240.0,
    liters: 40.0,
    isFullTank: true,
    stationName: 'Posto Petrobras Litoral',
    routeType: 'rodoviario',
    notes: 'Abastecimento da viagem ao litoral',
    tags: ['viagem'],
    tripId: tripId,
    expectedKml: 12.5,
  });

  // ==========================================
  // OS 3 ÚLTIMOS ABASTECIMENTOS DO VEÍCULO A:
  // Requisito estrito: consumo EXATAMENTE 12.0 km/l!
  // Refuel 8 (Mês -1): +480 km, 40 L -> 12.0 km/l (km = 47940 + 480 = 48420)
  // Refuel 9 (Mês -1): +480 km, 40 L -> 12.0 km/l (km = 48420 + 480 = 48900)
  // Refuel 10 (Mês 0 - atual): +480 km, 40 L -> 12.0 km/l (km = 48900 + 480 = 49380)
  // ==========================================
  const dRefuel8 = getDateMonthsAgo(1, 22, 10, 0);
  refuels.push({
    id: makeDemoId('abastecimento', 8),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel8),
    odometer: 48420,
    fuelType: 'Gasolina',
    pricePerLiter: 6.05,
    totalValue: 242.0,
    liters: 40.0,
    isFullTank: true,
    stationName: 'Posto Ipiranga Anchieta',
    routeType: 'misto',
    notes: 'Percurso de volta',
    tags: ['trabalho'],
    expectedKml: 12.0,
  });

  const dRefuel9 = getDateMonthsAgo(1, 28, 16, 30);
  refuels.push({
    id: makeDemoId('abastecimento', 9),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel9),
    odometer: 48900,
    fuelType: 'Gasolina',
    pricePerLiter: 6.1,
    totalValue: 244.0,
    liters: 40.0,
    isFullTank: true,
    stationName: 'Posto Shell Pinheiros',
    routeType: 'urbano',
    notes: 'Abastecimento fim de mês',
    tags: ['dia a dia'],
    expectedKml: 12.0,
  });

  // Refuel 10 (Mês atual): Dia seguro (<= safeDayM0)
  // 40 L a R$ 6,00/L = R$ 240,00 (+480 km -> km = 49380, cons = 12.0 km/l)
  const dRefuel10 = getDateMonthsAgo(0, safeDayM0, 9, 0);
  refuels.push({
    id: makeDemoId('abastecimento', 10),
    vehicleId: vehicleAId,
    date: toIsoDate(dRefuel10),
    odometer: 49380,
    fuelType: 'Gasolina',
    pricePerLiter: 6.0,
    totalValue: 240.0,
    liters: 40.0,
    isFullTank: true,
    stationName: 'Posto Shell Morumbi',
    routeType: 'misto',
    notes: 'Abastecimento recente do mês',
    tags: ['dia a dia'],
    expectedKml: 12.0,
  });

  // Atualiza odômetro corrente do Veículo A
  vehicleA.currentOdometer = 49380;

  // Abastecimento no Veículo B (poucos registros para seletor de veículos)
  const dRefuelB1 = getDateMonthsAgo(2, 15, 10, 0);
  const dRefuelB2 = getDateMonthsAgo(1, 18, 15, 0);
  refuels.push(
    {
      id: makeDemoId('abastecimento_b', 1),
      vehicleId: vehicleBId,
      date: toIsoDate(dRefuelB1),
      odometer: 82000,
      fuelType: 'Gasolina',
      pricePerLiter: 5.85,
      totalValue: 204.75,
      liters: 35.0,
      isFullTank: true,
      stationName: 'Posto Ipiranga Santana',
      routeType: 'urbano',
      notes: 'Carro secundário',
      tags: ['dia a dia'],
    },
    {
      id: makeDemoId('abastecimento_b', 2),
      vehicleId: vehicleBId,
      date: toIsoDate(dRefuelB2),
      odometer: 82420,
      fuelType: 'Gasolina',
      pricePerLiter: 5.9,
      totalValue: 206.5,
      liters: 35.0,
      isFullTank: true,
      stationName: 'Posto Shell Lapa',
      routeType: 'urbano',
      notes: 'Segundo abastecimento',
      tags: ['dia a dia'],
      expectedKml: 12.0,
    },
  );
  vehicleB.currentOdometer = 82420;

  // ==========================================
  // DESPESAS
  // Requisitos:
  // - Categorias: Seguro, Imposto, Lavagem, Outros ao longo dos meses.
  // - ≥ 4 fatias no gráfico de pizza de categorias.
  // - Despesas vinculadas à viagem: Pedágio R$ 50,00 e Alimentação R$ 60,00.
  // - No mês atual: Custo Fixo = R$ 380,00, Combustível = R$ 240,00.
  //   Para o total do mês atual ser EXATAMENTE R$ 820,00:
  //   Despesa variável no mês atual = R$ 820,00 - R$ 380,00 - R$ 240,00 = R$ 200,00!
  //   Calibramos uma despesa "Outros" no mês atual de EXATAMENTE R$ 200,00.
  // ==========================================
  const expenses: DemoExpenseData[] = [
    // Despesas da Viagem (Mês -1)
    {
      id: makeDemoId('despesa', 'viagem_pedagio'),
      vehicleId: vehicleAId,
      category: 'Outros',
      amount: 50.0, // R$ 50,00
      date: toIsoDate(getDateMonthsAgo(1, 13, 8, 30)),
      description: 'Pedágios da Tamoios',
      tripId: tripId,
      subtipoViagem: 'pedagio',
    },
    {
      id: makeDemoId('despesa', 'viagem_refeicao'),
      vehicleId: vehicleAId,
      category: 'Outros',
      amount: 60.0, // R$ 60,00
      date: toIsoDate(getDateMonthsAgo(1, 13, 13, 0)),
      description: 'Almoço na estrada',
      tripId: tripId,
      subtipoViagem: 'alimentacao',
    },
    // Despesas históricas para garantir fatias: Seguro, Imposto, Lavagem, Outros
    // Mês -4: Imposto (IPVA Parcela 1) R$ 450,00
    {
      id: makeDemoId('despesa', 'ipva_m4'),
      vehicleId: vehicleAId,
      category: 'Imposto',
      amount: 450.0,
      date: toIsoDate(getDateMonthsAgo(4, 15, 10, 0)),
      description: 'IPVA 2026 Parcela 1',
    },
    // Mês -3: Lavagem R$ 80,00
    {
      id: makeDemoId('despesa', 'lavagem_m3'),
      vehicleId: vehicleAId,
      category: 'Lavagem',
      amount: 80.0,
      date: toIsoDate(getDateMonthsAgo(3, 12, 11, 0)),
      description: 'Lavagem Completa com Cera',
    },
    // Mês -3: Seguro avulso/franquia R$ 250,00
    {
      id: makeDemoId('despesa', 'seguro_m3'),
      vehicleId: vehicleAId,
      category: 'Seguro',
      amount: 250.0,
      date: toIsoDate(getDateMonthsAgo(3, 20, 14, 0)),
      description: 'Seguro Proteção Extra Faróis',
    },
    // Mês -2: Lavagem R$ 75,00
    {
      id: makeDemoId('despesa', 'lavagem_m2'),
      vehicleId: vehicleAId,
      category: 'Lavagem',
      amount: 75.0,
      date: toIsoDate(getDateMonthsAgo(2, 18, 15, 0)),
      description: 'Lavagem simples e aspiração',
    },
    // Mês -2: Outros (Estacionamento mensal) R$ 120,00
    {
      id: makeDemoId('despesa', 'estac_m2'),
      vehicleId: vehicleAId,
      category: 'Outros',
      amount: 120.0,
      date: toIsoDate(getDateMonthsAgo(2, 25, 9, 0)),
      description: 'Estacionamento Eventos',
    },
    // Mês -1: Lavagem R$ 90,00
    {
      id: makeDemoId('despesa', 'lavagem_m1'),
      vehicleId: vehicleAId,
      category: 'Lavagem',
      amount: 90.0,
      date: toIsoDate(getDateMonthsAgo(1, 20, 16, 0)),
      description: 'Lavagem pós-viagem',
    },
    // MÊS ATUAL (M0): Despesa "Outros" calibrada para fechar EXATAMENTE R$ 820,00!
    // R$ 380 (fixo) + R$ 240 (refuel 10) + R$ 200 = R$ 820,00 (82% de R$ 1.000,00)
    {
      id: makeDemoId('despesa', 'calibrada_m0'),
      vehicleId: vehicleAId,
      category: 'Outros',
      amount: 200.0, // R$ 200,00
      date: toIsoDate(getDateMonthsAgo(0, safeDayM0, 10, 0)),
      description: 'Acessórios e Organização Interna',
    },
    // Despesas no Veículo B (para trilha de auditoria: 2 edições e 1 exclusão)
    {
      id: makeDemoId('despesa_b', 1),
      vehicleId: vehicleBId,
      category: 'Lavagem',
      amount: 60.0,
      date: toIsoDate(getDateMonthsAgo(2, 10, 14, 0)),
      description: 'Ducha rápida Gol',
    },
    {
      id: makeDemoId('despesa_b', 2),
      vehicleId: vehicleBId,
      category: 'Outros',
      amount: 45.0,
      date: toIsoDate(getDateMonthsAgo(1, 15, 11, 0)),
      description: 'Palhetas limpador Gol',
    },
    {
      id: makeDemoId('despesa_b', 3),
      vehicleId: vehicleBId,
      category: 'Outros',
      amount: 30.0,
      date: toIsoDate(getDateMonthsAgo(1, 25, 9, 0)),
      description: 'Aromatizante Gol (para exclusão na auditoria)',
    },
  ];

  // ==========================================
  // MANUTENÇÕES E ALERTAS
  // Requisitos:
  // - Preventivas e corretivas com km e data coerentes.
  // - Regra: Troca de óleo a cada 5.000 km ou 6 meses.
  //   Última troca feita há 4.700 km (alert status 'proximo' pois 4.700 >= 5.000 - 500 = 4.500).
  //   Hodômetro atual = 49.380 km.
  //   Portanto, última troca de óleo feita no km: 49.380 - 4.700 = 44.680 km!
  // - Regra / Alerta: Calibragem de pneus vencida ('vencido').
  // ==========================================
  const maintenances: DemoMaintenanceData[] = [
    // Troca de óleo preventiva anterior (há 4.700 km)
    {
      id: makeDemoId('manutencao', 'oleo_prev'),
      vehicleId: vehicleAId,
      date: toIsoDate(getDateMonthsAgo(4, 2, 9, 0)),
      odometer: 44680,
      type: 'preventiva',
      serviceType: 'Troca de Óleo',
      description: 'Óleo sintético 0W20 e filtro de óleo',
      workshop: 'Concessionária Toyota',
      totalValue: 380.0,
      notes: 'Troca de óleo preventiva e filtro',
    },
    // Troca de pastilhas de freio (corretiva há 3 meses)
    {
      id: makeDemoId('manutencao', 'freio_m3'),
      vehicleId: vehicleAId,
      date: toIsoDate(getDateMonthsAgo(3, 15, 14, 0)),
      odometer: 46200,
      type: 'corretiva',
      serviceType: 'Freios',
      description: 'Substituição das pastilhas de freio dianteiras',
      workshop: 'Oficina Freios & Cia',
      totalValue: 420.0,
      notes: 'Substituição das pastilhas desgastadas',
    },
  ];

  // Regras de Manutenção
  const maintenanceRules: DemoMaintenanceRuleData[] = [
    // Troca de óleo: a cada 5.000 km ou 180 dias.
    // Último serviço feito no km 44.680 (há 4.700 km sobre 49.380).
    // Com margem de 500 km, ativa status 'proximo' (4.700 >= 4.500).
    {
      id: makeDemoId('regra', 'oleo_5k'),
      vehicleId: vehicleAId,
      serviceType: 'Troca de Óleo',
      name: 'Troca de Óleo e Filtro',
      intervalKm: 5000,
      intervalDays: 180,
      advanceKm: 500,
      advanceDays: 15,
      lastServiceDate: toIsoDate(getDateMonthsAgo(4, 2, 9, 0)),
      lastServiceKm: 44680,
    },
    // Calibragem de pneus: a cada 15 dias.
    // Última calibragem feita há 45 dias -> vencida!
    {
      id: makeDemoId('regra', 'calibragem_quinzenal'),
      vehicleId: vehicleAId,
      serviceType: 'Pneus',
      name: 'Calibragem Quinzenal dos Pneus',
      intervalKm: 1000,
      intervalDays: 15,
      advanceKm: 100,
      advanceDays: 3,
      lastServiceDate: toIsoDate(getDateMonthsAgo(1, 15, 8, 0)), // há ~45 dias
      lastServiceKm: 47940,
    },
  ];

  // Registros de Pneus e Fluidos
  const tireRecords: DemoTireRecordData[] = [
    {
      id: makeDemoId('pneu', 1),
      vehicleId: vehicleAId,
      date: toIsoDate(getDateMonthsAgo(1, 15, 8, 0)),
      km: 47940,
      type: 'calibragem',
      pressurePsi: 32,
      treadDepthMm: 6.5,
    },
  ];

  const fluidRecords: DemoFluidRecordData[] = [
    {
      id: makeDemoId('fluido', 1),
      vehicleId: vehicleAId,
      date: toIsoDate(getDateMonthsAgo(1, 15, 8, 15)),
      km: 47940,
      fluidType: 'oleo_motor',
      level: 'normal',
    },
    {
      id: makeDemoId('fluido', 2),
      vehicleId: vehicleAId,
      date: toIsoDate(getDateMonthsAgo(1, 15, 8, 20)),
      km: 47940,
      fluidType: 'arrefecimento',
      level: 'normal',
    },
  ];

  // ==========================================
  // AGENDAMENTO DE MANUTENÇÃO (para daqui a 10 dias)
  // ==========================================
  const dSchedule = new Date(agoraMs + 10 * 24 * 60 * 60 * 1000);
  const maintenanceSchedules: DemoMaintenanceScheduleData[] = [
    {
      id: makeDemoId('agendamento', 'revisao_10dias'),
      vehicleId: vehicleAId,
      date: toIsoDay(dSchedule),
      reminderTime: '09:00',
      serviceType: 'Revisão Preventiva',
      description: 'Revisão dos 50.000 km na concessionária',
      status: 'agendado',
    },
  ];

  // ==========================================
  // META DE EFICIÊNCIA (13,0 km/l - acima da média de 12,0 para mostrar dicas)
  // ==========================================
  const efficiencyGoals: DemoEfficiencyGoalData[] = [
    {
      id: makeDemoId('meta_eficiencia', 'A'),
      vehicleId: vehicleAId,
      targetKml: 13.0,
    },
  ];

  // ==========================================
  // CONSULTAS FIPE (4 meses com leve queda para demonstrar depreciação)
  // Usar código FIPE e dados coerentes (ex: Toyota Corolla Altis 2019 Gasolina)
  // Mês -3: R$ 115.000,00
  // Mês -2: R$ 114.200,00
  // Mês -1: R$ 113.500,00
  // Mês 0:  R$ 112.800,00
  // ==========================================
  const fipeConsultations: DemoFipeData[] = [
    {
      id: makeDemoId('fipe', 'm3'),
      vehicleId: vehicleAId,
      fipeCode: '002166-0',
      brand: 'Toyota',
      model: 'Corolla Altis 2.0 16V Flex Aut.',
      modelYear: 2019,
      fuel: 'Gasolina',
      referenceMonth: toIsoDay(getDateMonthsAgo(3, 1)).substring(0, 7),
      valueCentavos: 11500000,
      consultedAt: toIsoDate(getDateMonthsAgo(3, 5)),
    },
    {
      id: makeDemoId('fipe', 'm2'),
      vehicleId: vehicleAId,
      fipeCode: '002166-0',
      brand: 'Toyota',
      model: 'Corolla Altis 2.0 16V Flex Aut.',
      modelYear: 2019,
      fuel: 'Gasolina',
      referenceMonth: toIsoDay(getDateMonthsAgo(2, 1)).substring(0, 7),
      valueCentavos: 11420000,
      consultedAt: toIsoDate(getDateMonthsAgo(2, 5)),
    },
    {
      id: makeDemoId('fipe', 'm1'),
      vehicleId: vehicleAId,
      fipeCode: '002166-0',
      brand: 'Toyota',
      model: 'Corolla Altis 2.0 16V Flex Aut.',
      modelYear: 2019,
      fuel: 'Gasolina',
      referenceMonth: toIsoDay(getDateMonthsAgo(1, 1)).substring(0, 7),
      valueCentavos: 11350000,
      consultedAt: toIsoDate(getDateMonthsAgo(1, 5)),
    },
    {
      id: makeDemoId('fipe', 'm0'),
      vehicleId: vehicleAId,
      fipeCode: '002166-0',
      brand: 'Toyota',
      model: 'Corolla Altis 2.0 16V Flex Aut.',
      modelYear: 2019,
      fuel: 'Gasolina',
      referenceMonth: toIsoDay(getDateMonthsAgo(0, 1)).substring(0, 7),
      valueCentavos: 11280000,
      consultedAt: toIsoDate(getDateMonthsAgo(0, safeDayM0)),
    },
  ];

  // Cenários do "Roteiro ao vivo":
  // 1. Anomalia: novo abastecimento com km = último km (49380) + 360 = 49740 e 40 L -> 360 / 40 = 9.0 km/l (-25% sobre a média 12.0)
  // 2. Orçamento: total atual = R$ 820,00 (82%). +R$ 20,00 -> R$ 840,00 (84% aviso). +R$ 200,00 -> R$ 1.040,00 (104% crítico).
  // 3. Unidade: alternar para L/100 km mostra 12,0 km/l como 8,3 L/100 km (100 / 12 = 8.33).
  const scenarioValues = {
    lastOdometerA: 49380,
    anomalyOdometer: 49380 + 360,
    anomalyLiters: 40,
    anomalyExpectedKml: 9.0,
    budgetTetoReais: 1000.0,
    budgetWarningThreshold: 80,
    budgetSpentCurrentMonthReais: 820.0,
    budgetDeltaWarningReais: 20.0,
    budgetDeltaCriticalReais: 200.0,
    unitDemoKml: 12.0,
    unitDemoL100: 8.3,
  };

  return {
    generatedAt: toIsoDate(agora),
    userId: usuarioId,
    vehicles: [vehicleA, vehicleB],
    refuels,
    expenses,
    fixedCosts,
    maintenances,
    maintenanceRules,
    tireRecords,
    fluidRecords,
    budgets: [budgetA],
    trip,
    efficiencyGoals,
    maintenanceSchedules,
    fipeConsultations,
    scenarioValues,
  };
}
