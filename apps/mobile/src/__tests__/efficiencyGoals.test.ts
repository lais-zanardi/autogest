import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../database/DatabaseConnection';
import {
  statusDaMeta,
  perfilDeRodagem,
  recomendar,
  validarCatalogoDicas,
  validarMetaConsumo,
} from '../services/efficiencyGoalService';
import { EfficiencyGoalRepository } from '../repositories/EfficiencyGoalRepository';
import {
  DrivingProfile,
  EcoTip,
  Refuel,
} from '@autogest/shared-types';

describe('US08 — Metas de Eficiência e Recomendações', () => {
  beforeEach(async () => {
    await db.saveTableData('metas_eficiencia', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('registros_pneu', []);
  });

  describe('US08.3 & US08.7 — statusDaMeta (Limites exatos e ausência de dados)', () => {
    test('com consumo nulo, <= 0 ou meta nula/zero, retorna situacao: sem_dados e progresso: 0', () => {
      assert.deepStrictEqual(statusDaMeta(null, 12), {
        progresso: 0,
        situacao: 'sem_dados',
        percentual: 0,
      });

      assert.deepStrictEqual(statusDaMeta(0, 12), {
        progresso: 0,
        situacao: 'sem_dados',
        percentual: 0,
      });

      assert.deepStrictEqual(statusDaMeta(12, null), {
        progresso: 0,
        situacao: 'sem_dados',
        percentual: 0,
      });

      assert.deepStrictEqual(statusDaMeta(12, 0), {
        progresso: 0,
        situacao: 'sem_dados',
        percentual: 0,
      });
    });

    test('quando consumo igual ou superior à meta, retorna situacao: atingida e progresso >= 1', () => {
      // Consumo exatamente igual à meta (12 km/l e meta 12 km/l)
      const exato = statusDaMeta(12, 12);
      assert.strictEqual(exato.situacao, 'atingida');
      assert.strictEqual(exato.progresso, 1);
      assert.strictEqual(exato.percentual, 100);

      // Consumo superior (15 km/l e meta 12 km/l -> 125%)
      const superior = statusDaMeta(15, 12);
      assert.strictEqual(superior.situacao, 'atingida');
      assert.strictEqual(superior.progresso, 1.25);
      assert.strictEqual(superior.percentual, 125);
    });

    test('quando consumo inferior à meta, retorna situacao: abaixo e progresso < 1', () => {
      // Consumo 9 km/l com meta 12 km/l -> 75%
      const abaixo = statusDaMeta(9, 12);
      assert.strictEqual(abaixo.situacao, 'abaixo');
      assert.strictEqual(abaixo.progresso, 0.75);
      assert.strictEqual(abaixo.percentual, 75);
    });
  });

  describe('US08.2 — Validação de meta de consumo', () => {
    test('rejeita meta menor ou igual a zero ou inválida e aceita valor positivo', () => {
      assert.strictEqual(validarMetaConsumo(0).isValid, false);
      assert.strictEqual(validarMetaConsumo(-5).isValid, false);
      assert.strictEqual(validarMetaConsumo(NaN).isValid, false);

      const valida = validarMetaConsumo(14.5);
      assert.strictEqual(valida.isValid, true);
    });
  });

  describe('US08.4 — perfilDeRodagem (tipo de percurso predominante, meta e anomalia)', () => {
    test('identifica perfil predominante urbano, abaixo da meta e sem anomalia', () => {
      const refuels: Refuel[] = [
        { id: '1', vehicleId: 'v1', date: '2026-05-01', calculatedKml: 9, routeType: 'urbano', odometer: 1000 } as any,
        { id: '2', vehicleId: 'v1', date: '2026-05-05', calculatedKml: 10, routeType: 'urbano', odometer: 1300 } as any,
        { id: '3', vehicleId: 'v1', date: '2026-05-10', calculatedKml: 14, routeType: 'rodoviario', odometer: 1800 } as any,
      ];

      const perfil = perfilDeRodagem(refuels, 12, false, false);
      assert.strictEqual(perfil.tipoPercursoPredominante, 'urbano');
      assert.strictEqual(perfil.situacaoMeta, 'abaixo');
      assert.strictEqual(perfil.temAnomalia, false);
      assert.strictEqual(perfil.calibragemPneusAtrasada, false);
    });

    test('sem abastecimentos ou sem tipo de percurso, perfil predominante é misto e sem_dados', () => {
      const perfil = perfilDeRodagem([], 12, false, false);
      assert.strictEqual(perfil.tipoPercursoPredominante, 'misto');
      assert.strictEqual(perfil.situacaoMeta, 'sem_dados');
    });
  });

  describe('US08.5 & US08.7 — Catálogo de dicas e recomendação priorizada até 3 dicas', () => {
    const catalogoMock: EcoTip[] = [
      {
        id: 'tip-urban-1',
        titulo: 'Antecipe as paradas no trânsito',
        descricao: 'Evite arrancadas bruscas e use o freio motor para economizar até 15% na cidade.',
        prioridade: 1,
        condicao: { percurso: 'urbano' },
      },
      {
        id: 'tip-urban-2',
        titulo: 'Atenção ao ponto morto',
        descricao: 'Carros com injeção eletrônica cortam combustível quando engrenados em descidas.',
        prioridade: 2,
        condicao: { percurso: 'urbano' },
      },
      {
        id: 'tip-tire-1',
        titulo: 'Calibragem de pneus urgente',
        descricao: 'Pneus com pressão baixa aumentam o arrasto e podem elevar o consumo em até 10%.',
        prioridade: 1,
        condicao: { calibragemAtrasada: true },
      },
      {
        id: 'tip-below-goal',
        titulo: 'Consumo abaixo da meta',
        descricao: 'Mantenha a rotação estável e verifique os filtros de ar e combustível.',
        prioridade: 1,
        condicao: { situacaoMeta: 'abaixo' },
      },
      {
        id: 'tip-highway-1',
        titulo: 'Mantenha velocidade de cruzeiro',
        descricao: 'Na estrada, velocidades acima de 100 km/h aumentam exponencialmente o consumo.',
        prioridade: 1,
        condicao: { percurso: 'rodoviario' },
      },
      {
        id: 'tip-general-1',
        titulo: 'Evite peso desnecessário',
        descricao: 'Retire objetos pesados do porta-malas para diminuir o esforço do motor.',
        prioridade: 3,
        condicao: {},
      },
    ];

    test('validação de schema do catálogo de dicas rejeita catálogo inválido e aceita válido', () => {
      assert.strictEqual(validarCatalogoDicas(catalogoMock).isValid, true);

      const invalido = [{ id: '1' }]; // Falta titulo, descricao, prioridade
      assert.strictEqual(validarCatalogoDicas(invalido as any).isValid, false);
    });

    test('recomenda no máximo 3 dicas priorizadas combinando condições do perfil', () => {
      const perfil: DrivingProfile = {
        tipoPercursoPredominante: 'urbano',
        situacaoMeta: 'abaixo',
        consumoMedioKml: 9.5,
        metaConsumoKml: 12,
        temAnomalia: false,
        calibragemPneusAtrasada: true,
      };

      const dicas = recomendar(perfil, catalogoMock);
      assert.strictEqual(dicas.length, 3, 'Deve retornar no máximo 3 dicas');
      // Deve incluir a de pneu (alta prioridade + flag ativa) e a de abaixo da meta
      assert.ok(dicas.some(d => d.id === 'tip-tire-1'));
      assert.ok(dicas.some(d => d.id === 'tip-below-goal'));
      assert.ok(dicas.some(d => d.id === 'tip-urban-1'));
    });

    test('com perfil sem dados específicos, retorna até 3 dicas gerais', () => {
      const perfilSemDados: DrivingProfile = {
        tipoPercursoPredominante: 'misto',
        situacaoMeta: 'sem_dados',
        consumoMedioKml: null,
        metaConsumoKml: null,
        temAnomalia: false,
        calibragemPneusAtrasada: false,
      };

      const dicas = recomendar(perfilSemDados, catalogoMock);
      assert.ok(dicas.length > 0 && dicas.length <= 3);
    });
  });

  describe('US08.1 — Persistência e repositório de metas_eficiencia', () => {
    test('cria, recupera e atualiza meta de consumo ativa por veículo', async () => {
      const meta = await EfficiencyGoalRepository.setGoal('veh-1', 13.5);
      assert.ok(meta.id);
      assert.strictEqual(meta.vehicleId, 'veh-1');
      assert.strictEqual(meta.targetKml, 13.5);
      assert.strictEqual(meta.active, true);

      // Busca meta ativa do veículo
      const ativa = await EfficiencyGoalRepository.findByVehicle('veh-1');
      assert.ok(ativa);
      assert.strictEqual(ativa?.targetKml, 13.5);

      // Atualiza a meta para um novo valor
      const atualizada = await EfficiencyGoalRepository.setGoal('veh-1', 14.0);
      assert.strictEqual(atualizada.targetKml, 14.0);

      const todas = await EfficiencyGoalRepository.listAll();
      // Não deve duplicar meta ativa para o mesmo veículo
      assert.strictEqual(todas.filter(m => m.vehicleId === 'veh-1' && m.active).length, 1);
    });
  });
});
