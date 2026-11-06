import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../database/DatabaseConnection';
import {
  montarFiltro,
  obterIdCurto,
} from '../services/searchFilterService';
import { SearchRepository } from '../repositories/SearchRepository';
import { TagService } from '../services/tagService';
import {
  UnifiedRecord,
  SearchFilters,
  Refuel,
  Expense,
  Maintenance,
} from '@autogest/shared-types';

describe('US33 — Busca e Filtros Avançados', () => {
  beforeEach(async () => {
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('local_despesas', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('local_manutencoes', []);
    await db.saveTableData('etiquetas', []);
    await db.saveTableData('registros_etiquetas', []);
  });

  describe('US33.2 & US33.6 — Função pura montarFiltro e critérios BDD', () => {
    // Critério BDD do Backlog: Dado registros de R$ 30, R$ 80 e R$ 150, quando filtrar por valor entre R$ 50 e R$ 100, então lista apenas o de R$ 80.
    test('BDD: registros de R$ 30, R$ 80 e R$ 150 com filtro de R$ 50 a R$ 100 listam só o de R$ 80', () => {
      const records: UnifiedRecord[] = [
        {
          id: 'uuid-1111-2222',
          vehicleId: 'veh_1',
          date: '2026-05-10',
          recordType: 'despesa',
          title: 'Lavagem Simples',
          amount: 30,
          odometer: 10000,
        },
        {
          id: 'uuid-3333-4444',
          vehicleId: 'veh_1',
          date: '2026-05-11',
          recordType: 'abastecimento',
          title: 'Gasolina Comum',
          amount: 80,
          odometer: 10200,
        },
        {
          id: 'uuid-5555-6666',
          vehicleId: 'veh_1',
          date: '2026-05-12',
          recordType: 'manutencao',
          title: 'Troca de Óleo',
          amount: 150,
          odometer: 10500,
        },
      ];

      const filtro: SearchFilters = {
        valorMin: 50,
        valorMax: 100,
      };

      const predicate = montarFiltro(filtro);
      const resultado = records.filter(predicate);

      assert.strictEqual(resultado.length, 1);
      assert.strictEqual(resultado[0].amount, 80);
      assert.strictEqual(resultado[0].id, 'uuid-3333-4444');
    });

    test('US33.4: busca por texto na descrição, notas, oficina, peças sem diferenciar maiúsculas', () => {
      const records: UnifiedRecord[] = [
        {
          id: 'uuid-aaaa-1111',
          vehicleId: 'veh_1',
          date: '2026-05-10',
          recordType: 'manutencao',
          title: 'Revisão dos 10k',
          description: 'Troca de pastilhas dianteiras',
          workshop: 'Oficina Bosch Car',
          parts: 'Pastilha Cobreq',
          notes: 'Cliente solicitou checagem do fluido',
          amount: 450,
        },
        {
          id: 'uuid-bbbb-2222',
          vehicleId: 'veh_1',
          date: '2026-05-12',
          recordType: 'abastecimento',
          title: 'Abastecimento Ipiranga',
          notes: 'Viagem para serra com tráfego livre',
          amount: 250,
        },
      ];

      // Busca na oficina (case-insensitive)
      let res = records.filter(montarFiltro({ texto: 'bosch' }));
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, 'uuid-aaaa-1111');

      // Busca nas peças
      res = records.filter(montarFiltro({ texto: 'cobreq' }));
      assert.strictEqual(res.length, 1);

      // Busca nas notas
      res = records.filter(montarFiltro({ texto: 'serra' }));
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, 'uuid-bbbb-2222');
    });

    test('US33.4: busca por ID por prefixo e ID curto com os 8 primeiros caracteres', () => {
      const fullUuid = 'e4b1a8d9-7c22-48a1-9bb3-0123456789ab';
      const shortId = obterIdCurto(fullUuid);
      assert.strictEqual(shortId, 'e4b1a8d9');
      assert.strictEqual(shortId.length, 8);

      const records: UnifiedRecord[] = [
        {
          id: fullUuid,
          vehicleId: 'veh_1',
          date: '2026-05-10',
          recordType: 'abastecimento',
          title: 'Abastecimento',
          amount: 200,
        },
        {
          id: 'f9999999-0000-1111-2222-333333333333',
          vehicleId: 'veh_1',
          date: '2026-05-11',
          recordType: 'despesa',
          title: 'Estacionamento',
          amount: 25,
        },
      ];

      // Busca por ID usando prefixo
      const res = records.filter(montarFiltro({ texto: 'e4b1' }));
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, fullUuid);
    });

    test('combinação de filtros: período, km, tipo e tipo de percurso', () => {
      const records: UnifiedRecord[] = [
        {
          id: '1',
          vehicleId: 'veh_1',
          date: '2026-05-01',
          recordType: 'abastecimento',
          title: 'Urbano 1',
          amount: 100,
          odometer: 1000,
          routeType: 'urbano',
        },
        {
          id: '2',
          vehicleId: 'veh_1',
          date: '2026-05-15',
          recordType: 'abastecimento',
          title: 'Rodoviario 1',
          amount: 200,
          odometer: 1800,
          routeType: 'rodoviario',
        },
        {
          id: '3',
          vehicleId: 'veh_1',
          date: '2026-05-20',
          recordType: 'abastecimento',
          title: 'Rodoviario 2',
          amount: 300,
          odometer: 2500,
          routeType: 'rodoviario',
        },
      ];

      const filtro: SearchFilters = {
        dataInicio: '2026-05-10',
        dataFim: '2026-05-25',
        kmMin: 1500,
        kmMax: 2000,
        routeType: 'rodoviario',
        recordType: 'abastecimento',
      };

      const res = records.filter(montarFiltro(filtro));
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, '2');
    });
  });

  describe('US33.1 & US33.6 — Repositório unificado buscarRegistros com paginação e etiquetas', () => {
    test('unifica registros de abastecimentos, despesas e manutenções ordenados por data decrescente com paginação', async () => {
      // 1. Cria abastecimento
      const refuel: Refuel = {
        id: 'ref-11111111',
        vehicleId: 'veh_1',
        date: '2026-05-05',
        odometer: 10500,
        fuelType: 'Gasolina',
        pricePerLiter: 5.5,
        totalValue: 110,
        liters: 20,
        isFullTank: true,
        routeType: 'urbano',
        notes: 'Abastecimento urbano',
        createdAt: new Date().toISOString(),
      };
      await db.insert('local_refuels', refuel);

      // 2. Cria despesa
      const expense: Expense = {
        id: 'exp-22222222',
        vehicleId: 'veh_1',
        date: '2026-05-10',
        category: 'Lavagem',
        amount: 60,
        description: 'Lavagem rápida ducha',
        createdAt: new Date().toISOString(),
      };
      await db.insert('local_despesas', expense);

      // 3. Cria manutenção
      const maint: Maintenance = {
        id: 'mnt-33333333',
        vehicleId: 'veh_1',
        date: '2026-05-15',
        odometer: 11000,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo mineral',
        totalValue: 200,
        workshop: 'Auto Center Lider',
        createdAt: new Date().toISOString(),
      };
      await db.insert('manutencoes', maint);

      // 4. Cria e vincula etiqueta 'Trabalho' na despesa e na manutenção
      const tagTrabalho = await TagService.obterOuCriarEtiqueta('Trabalho');
      await TagService.vincularEtiquetas('despesa', expense.id, [tagTrabalho.id]);
      await TagService.vincularEtiquetas('manutencao', maint.id, [tagTrabalho.id]);

      // Busca sem filtros: deve retornar os 3 registros ordenados decrescente por data (mnt 15/05, exp 10/05, ref 05/05)
      const resGeral = await SearchRepository.buscarRegistros({ vehicleId: 'veh_1' }, { page: 1, limit: 10 });
      assert.strictEqual(resGeral.total, 3);
      assert.strictEqual(resGeral.records.length, 3);
      assert.strictEqual(resGeral.records[0].id, 'mnt-33333333');
      assert.strictEqual(resGeral.records[1].id, 'exp-22222222');
      assert.strictEqual(resGeral.records[2].id, 'ref-11111111');

      // Teste de paginação: limit 2, page 1 deve retornar 2 itens; page 2 deve retornar 1 item
      const p1 = await SearchRepository.buscarRegistros({ vehicleId: 'veh_1' }, { page: 1, limit: 2 });
      assert.strictEqual(p1.records.length, 2);
      assert.strictEqual(p1.hasNextPage, true);

      const p2 = await SearchRepository.buscarRegistros({ vehicleId: 'veh_1' }, { page: 2, limit: 2 });
      assert.strictEqual(p2.records.length, 1);
      assert.strictEqual(p2.records[0].id, 'ref-11111111');
      assert.strictEqual(p2.hasNextPage, false);

      // Filtro por etiqueta: deve retornar apenas os 2 registros com a tag 'Trabalho'
      const resTag = await SearchRepository.buscarRegistros(
        { vehicleId: 'veh_1', tagId: tagTrabalho.id },
        { page: 1, limit: 10 },
      );
      assert.strictEqual(resTag.total, 2);
      assert.ok(resTag.records.some(r => r.id === 'exp-22222222'));
      assert.ok(resTag.records.some(r => r.id === 'mnt-33333333'));
      assert.ok(!resTag.records.some(r => r.id === 'ref-11111111'));
    });
  });
});
