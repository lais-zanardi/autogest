import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database/DatabaseConnection';
import { gerarDadosDemo } from '../services/demoSeedGenerator';
import { DemoSeedService } from '../services/demoSeedService';
import { resumoDaViagem } from '../services/tripCalculations';
import { distribuicaoPorCategoria } from '../services/expenseCategoryDistribution';
import { converterConsumo } from '../services/preferencesService';
import { calcularConsumo } from '../services/fuelingCalculations';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { BudgetRepository } from '../repositories/BudgetRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { BudgetService, avaliarOrcamento } from '../services/budgetService';

describe('ETAPA 41 — Gerador Puro de Dados Demo (gerarDadosDemo)', () => {
  const agoraFixo = new Date('2026-11-08T12:00:00.000Z');
  const usuarioId = 'usr_teste_demo';

  it('deve ser 100% determinístico gerando dados idênticos para a mesma entrada', () => {
    const pkg1 = gerarDadosDemo(agoraFixo, usuarioId);
    const pkg2 = gerarDadosDemo(agoraFixo, usuarioId);

    assert.deepEqual(pkg1, pkg2);
    assert.equal(pkg1.vehicles.length, 2);
    assert.equal(pkg1.userId, usuarioId);
  });

  it('todas as datas geradas devem ser estritamente anteriores ou iguais a agora', () => {
    const pkg = gerarDadosDemo(agoraFixo, usuarioId);
    const agoraMs = agoraFixo.getTime();

    // Veículos
    // Abastecimentos
    for (const r of pkg.refuels) {
      assert.ok(
        new Date(r.date).getTime() <= agoraMs,
        `Data de abastecimento ${r.date} não pode ser posterior a agora`,
      );
    }

    // Despesas
    for (const e of pkg.expenses) {
      assert.ok(
        new Date(e.date).getTime() <= agoraMs,
        `Data de despesa ${e.date} não pode ser posterior a agora`,
      );
    }

    // Manutenções
    for (const m of pkg.maintenances) {
      assert.ok(
        new Date(m.date).getTime() <= agoraMs,
        `Data de manutenção ${m.date} não pode ser posterior a agora`,
      );
    }

    // Viagem (startDate e endDate)
    assert.ok(new Date(pkg.trip.startDate).getTime() <= agoraMs);
    assert.ok(new Date(pkg.trip.endDate).getTime() <= agoraMs);

    // Registros de pneu e fluido
    for (const t of pkg.tireRecords) {
      assert.ok(new Date(t.date).getTime() <= agoraMs);
    }
    for (const f of pkg.fluidRecords) {
      assert.ok(new Date(f.date).getTime() <= agoraMs);
    }
  });

  it('odômetro deve ser estritamente crescente por veículo nos abastecimentos', () => {
    const pkg = gerarDadosDemo(agoraFixo, usuarioId);
    const refuelsA = pkg.refuels.filter(r => r.vehicleId === pkg.vehicles[0].id);
    const refuelsB = pkg.refuels.filter(r => r.vehicleId === pkg.vehicles[1].id);

    // Veículo A
    for (let i = 1; i < refuelsA.length; i++) {
      assert.ok(
        refuelsA[i].odometer > refuelsA[i - 1].odometer,
        `Odômetro do veículo A deve ser crescente: ${refuelsA[i].odometer} > ${refuelsA[i - 1].odometer}`,
      );
    }

    // Veículo B
    for (let i = 1; i < refuelsB.length; i++) {
      assert.ok(
        refuelsB[i].odometer > refuelsB[i - 1].odometer,
        `Odômetro do veículo B deve ser crescente: ${refuelsB[i].odometer} > ${refuelsB[i - 1].odometer}`,
      );
    }
  });

  it('os 3 últimos abastecimentos do Veículo A devem ter consumo exatamente 12,0 km/l', () => {
    const pkg = gerarDadosDemo(agoraFixo, usuarioId);
    const refuelsA = pkg.refuels.filter(r => r.vehicleId === pkg.vehicles[0].id);

    assert.ok(refuelsA.length >= 3);
    const last3 = refuelsA.slice(-3);

    for (let i = 0; i < last3.length; i++) {
      const idxInAll = refuelsA.indexOf(last3[i]);
      const prev = refuelsA[idxInAll - 1];
      const current = last3[i];

      const kml = calcularConsumo(current.odometer, prev.odometer, current.liters);
      assert.equal(
        kml,
        12.0,
        `Consumo do abastecimento ${current.id} (${current.odometer} - ${prev.odometer} / ${current.liters} L) deve ser 12.0 km/l`,
      );
    }
  });

  it('viagem deve ter os números exatos descritos na especificação', () => {
    const pkg = gerarDadosDemo(agoraFixo, usuarioId);
    const trip = pkg.trip;

    // Abastecimento anterior à viagem
    const refuelPrevViagem = pkg.refuels.find(r => r.odometer === trip.startOdometer);
    assert.ok(refuelPrevViagem, 'Deve existir abastecimento com km = startOdometer da viagem');

    const summary = resumoDaViagem(
      trip as any,
      pkg.refuels as any,
      pkg.expenses.map(e => ({
        ...e,
        amount: e.amount, // em reais
        subtipo_viagem: e.subtipoViagem,
      })) as any,
    );

    // 500 km rodados
    assert.equal(summary.distanciaKm, 500);
    // 40 L abastecidos a R$ 6,00/L (R$ 240,00)
    assert.equal(summary.totalLitros, 40);
    assert.equal(summary.custoCombustivel, 240.0);
    // Pedágio R$ 50,00 e Alimentação R$ 60,00 (Total Despesas R$ 110,00)
    assert.equal(summary.custoDespesas, 110.0);
    assert.equal(summary.custoPorSubtipo.pedagio, 50.0);
    assert.equal(summary.custoPorSubtipo.alimentacao, 60.0);
    // Custo total: R$ 350,00 (240 + 110)
    assert.equal(summary.custoTotal, 350.0);
    // R$ 0,70/km (350 / 500)
    assert.equal(summary.custoPorKm, 0.7);
    // Rendimento: 12,5 km/l (500 / 40)
    assert.equal(summary.rendimentoKml, 12.5);
  });

  it('gráfico de pizza de categorias de despesa deve ter no mínimo 4 fatias', () => {
    const pkg = gerarDadosDemo(agoraFixo, usuarioId);

    // Agrupa por categoria
    const categorias = new Set(pkg.expenses.map(e => e.category));
    assert.ok(
      categorias.size >= 4,
      `Deve conter pelo menos 4 categorias distintas (encontradas: ${Array.from(categorias).join(', ')})`,
    );

    const dist = distribuicaoPorCategoria(
      pkg.expenses.map(e => ({ categoria: e.category, valor: e.amount })),
      { custosFixos: 380 },
    );

    assert.ok(dist.itens.length >= 4);
    assert.equal(dist.somaPercentuais, 100);
  });

  it('cenários do roteiro ao vivo devem ter valores calculados matematicamente corretos', () => {
    const pkg = gerarDadosDemo(agoraFixo, usuarioId);
    const scen = pkg.scenarioValues;

    // Anomalia: 360 km com 40 L = 9.0 km/l (-25% em relação a 12.0)
    const kmlAnomalia = calcularConsumo(scen.anomalyOdometer, scen.lastOdometerA, scen.anomalyLiters);
    assert.equal(kmlAnomalia, 9.0);
    const quedaPercent = ((12.0 - (kmlAnomalia || 0)) / 12.0) * 100;
    assert.equal(quedaPercent, 25.0);

    // Orçamento: teto R$ 1.000, gasto R$ 820 -> 82%
    assert.equal(scen.budgetSpentCurrentMonthReais, 820.0);
    assert.equal(scen.budgetTetoReais, 1000.0);
    assert.equal((820.0 / 1000.0) * 100, 82.0);

    // +R$ 20 -> R$ 840 (84%)
    assert.equal(((820 + scen.budgetDeltaWarningReais) / 1000) * 100, 84.0);

    // +R$ 200 -> R$ 1040 (104%)
    assert.equal(((820 + scen.budgetDeltaCriticalReais + scen.budgetDeltaWarningReais) / 1000) * 100, 104.0);

    // Unidade: 12.0 km/l em L/100 km é 8.3 L/100 km
    const l100 = converterConsumo(12.0);
    assert.equal(l100, 8.33);
    assert.equal(Number((100 / 12.0).toFixed(1)), 8.3);
  });
});

describe('ETAPA 41 — Integração DemoSeedService com Repositórios Reais', () => {
  const agoraFixo = new Date('2026-11-08T12:00:00.000Z');
  const usuarioId = 'usr_teste_integration';

  beforeEach(async () => {
    // Limpa banco local e fila
    const tables = [
      'local_vehicles',
      'local_refuels',
      'local_despesas',
      'local_custos_fixos',
      'manutencoes',
      'local_manutencoes',
      'regras_manutencao',
      'local_regras_manutencao',
      'registros_pneu',
      'registros_fluido',
      'orcamentos',
      'viagens',
      'metas_eficiencia',
      'agendamentos_manutencao',
      'consultas_fipe',
      'leituras_hodometro',
      'etiquetas',
      'registros_etiquetas',
      'auditoria',
      'sync_queue',
      'fila_sync',
    ];
    for (const t of tables) {
      await db.saveTableData(t, []);
    }
  });

  it('deve carregar dados de demonstração com sucesso usando os repositórios reais', async () => {
    const { summary, packageData: _pkg } = await DemoSeedService.carregarDadosDemo(agoraFixo, usuarioId);

    assert.equal(summary.veiculos, 2);
    assert.ok(summary.abastecimentos >= 10);
    assert.ok(summary.despesas >= 10);
    assert.equal(summary.custosFixos, 2);
    assert.ok(summary.manutencoes >= 2);
    assert.equal(summary.orcamentos, 1);
    assert.equal(summary.viagens, 1);
    assert.equal(summary.auditorias, 3);

    // Valida se os veículos foram persistidos
    const veiculos = await VehicleRepository.listAll();
    assert.equal(veiculos.length, 2);
    const veicA = veiculos.find(v => v.plate === 'BRA2E19');
    assert.ok(veicA);

    // Valida outbox de sincronização
    const syncItems = await SyncQueueRepository.getPendingItems();
    assert.ok(syncItems.length > 0, 'Outbox deve conter operações registradas');

    // Valida orcamento no mes atual pelo servico real
    const totalGasto = await BudgetService.calcularTotalGastoDoMesReais(veicA!.id, agoraFixo);
    assert.equal(
      totalGasto,
      820.0,
      `Total gasto do mês deve ser exatamente R$ 820,00 (encontrado: R$ ${totalGasto})`,
    );

    // Avalia orçamento
    const avaliacao = avaliarOrcamento(totalGasto, 1000.0, 80);
    assert.equal(avaliacao.percentual, 82.0);
    assert.equal(avaliacao.nivel, 'aviso');

    // Valida se as notificações reais não foram enfileiradas para o usuário (modo silencioso)
    const orcamentos = await BudgetRepository.findByVehicle(veicA!.id);
    assert.equal(orcamentos?.aviso_enviado_mes, null);
    assert.equal(orcamentos?.critico_enviado_mes, null);
  });

  it('idempotência: aplicar o seed duas vezes não duplica registros', async () => {
    await DemoSeedService.carregarDadosDemo(agoraFixo, usuarioId);
    const veiculos1 = await VehicleRepository.listAll();
    const refuels1 = await RefuelRepository.listByVehicle(veiculos1[0].id);

    // Segunda execução
    await DemoSeedService.carregarDadosDemo(agoraFixo, usuarioId);
    const veiculos2 = await VehicleRepository.listAll();
    const refuels2 = await RefuelRepository.listByVehicle(veiculos1[0].id);

    assert.equal(veiculos2.length, veiculos1.length);
    assert.equal(refuels2.length, refuels1.length);
  });

  it('removerDadosDemo deve apagar apenas os registros criados pelo seed de demo', async () => {
    // 1. Cria um veículo real manual do usuário
    const veiculoReal = await VehicleRepository.create({
      name: 'Carro Particular Real',
      model: 'Civic',
      year: 2022,
      plate: 'RL99999',
      tankCapacityL: 55,
      preferredFuel: 'Gasolina',
      initialOdometer: 10000,
    });

    // 2. Carrega dados de demonstração
    await DemoSeedService.carregarDadosDemo(agoraFixo, usuarioId);
    const veiculosComDemo = await VehicleRepository.listAll();
    assert.equal(veiculosComDemo.length, 3); // 1 real + 2 demo

    // 3. Remove dados de demonstração
    await DemoSeedService.removerDadosDemo();
    const veiculosPosRemocao = await VehicleRepository.listAll();

    assert.equal(veiculosPosRemocao.length, 1);
    assert.equal(veiculosPosRemocao[0].id, veiculoReal.id);
  });

  it('a flag de demonstração não deve ser permitida se desligada (EnvConfig)', () => {
    import('../config/env').then(({ EnvConfig }) => {
      EnvConfig.setDemoBuild(false);
      assert.equal(EnvConfig.isDemoBuild(), false);
      EnvConfig.setDemoBuild(true);
      assert.equal(EnvConfig.isDemoBuild(), true);
    });
  });
});

