import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../database/DatabaseConnection';
import { consumoPorTipoPercurso, validarNota } from '../services/routeContextService';
import { TagRepository } from '../repositories/TagRepository';
import { TagService } from '../services/tagService';
import { Refuel } from '@autogest/shared-types';

describe('US27 — Contexto do Registro: Percurso, Etiquetas e Notas', () => {
  beforeEach(async () => {
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('etiquetas', []);
    await db.saveTableData('registros_etiquetas', []);
    await db.saveTableData('local_vehicles', []);
  });

  describe('US27.6 — consumoPorTipoPercurso(abastecimentos)', () => {
    test('calcula a média de consumo por tipo e agrupa não informados', () => {
      const mockRefuels: Partial<Refuel>[] = [
        { id: '1', calculatedKml: 10, routeType: 'urbano' },
        { id: '2', calculatedKml: 12, routeType: 'urbano' },
        { id: '3', calculatedKml: 16, routeType: 'rodoviario' },
        { id: '4', calculatedKml: 14, routeType: 'rodoviario' },
        { id: '5', calculatedKml: 11, routeType: 'misto' },
        // Sem tipo definido (registros antigos)
        { id: '6', calculatedKml: 9, routeType: null },
        { id: '7', calculatedKml: 13 },
        // Registros sem consumo calculado (primeiro abastecimento ou tanque não cheio) não devem entrar na média
        { id: '8', calculatedKml: null, routeType: 'urbano' },
        { id: '9', calculatedKml: 0, routeType: 'rodoviario' },
      ];

      const resultado = consumoPorTipoPercurso(mockRefuels as Refuel[]);

      // urbano: (10 + 12) / 2 = 11.0
      assert.strictEqual(resultado.urbano.mediaKml, 11);
      assert.strictEqual(resultado.urbano.totalRegistros, 2);

      // rodoviario: (16 + 14) / 2 = 15.0
      assert.strictEqual(resultado.rodoviario.mediaKml, 15);
      assert.strictEqual(resultado.rodoviario.totalRegistros, 2);

      // misto: 11.0
      assert.strictEqual(resultado.misto.mediaKml, 11);
      assert.strictEqual(resultado.misto.totalRegistros, 1);

      // nao_informado: (9 + 13) / 2 = 11.0
      assert.strictEqual(resultado.naoInformado.mediaKml, 11);
      assert.strictEqual(resultado.naoInformado.totalRegistros, 2);
    });

    test('retorna zero e contagem zero para categorias sem registros', () => {
      const resultado = consumoPorTipoPercurso([]);
      assert.strictEqual(resultado.urbano.mediaKml, 0);
      assert.strictEqual(resultado.urbano.totalRegistros, 0);
      assert.strictEqual(resultado.rodoviario.mediaKml, 0);
      assert.strictEqual(resultado.rodoviario.totalRegistros, 0);
      assert.strictEqual(resultado.misto.mediaKml, 0);
      assert.strictEqual(resultado.misto.totalRegistros, 0);
      assert.strictEqual(resultado.naoInformado.mediaKml, 0);
      assert.strictEqual(resultado.naoInformado.totalRegistros, 0);
    });
  });

  describe('US27.4 — Validação de nota (limite de 500 caracteres)', () => {
    test('aceita nota com até 500 caracteres ou nula/vazia', () => {
      assert.strictEqual(validarNota(null).isValid, true);
      assert.strictEqual(validarNota(undefined).isValid, true);
      assert.strictEqual(validarNota('').isValid, true);
      assert.strictEqual(validarNota('Nota válida sobre o trajeto').isValid, true);
      assert.strictEqual(validarNota('a'.repeat(500)).isValid, true);
    });

    test('rejeita nota com mais de 500 caracteres', () => {
      const res = validarNota('a'.repeat(501));
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /500 caracteres/i);
    });
  });

  describe('US27.3 — Gestão de etiquetas (autocomplete, case-insensitive, vínculo polimórfico e exclusão)', () => {
    test('cria etiqueta com nome único sem diferenciar maiúsculas/minúsculas', async () => {
      const tag1 = await TagService.obterOuCriarEtiqueta('Trabalho');
      assert.ok(tag1.id);
      assert.strictEqual(tag1.name, 'Trabalho');

      // Tenta criar com variação de caixa e espaços
      const tag2 = await TagService.obterOuCriarEtiqueta('  trabalho  ');
      assert.strictEqual(
        tag2.id,
        tag1.id,
        'Deve reutilizar a etiqueta existente ignorando case/espaços',
      );

      const all = await TagRepository.listAll();
      assert.strictEqual(all.length, 1);
    });

    test('vincula etiquetas a abastecimento, despesa e manutenção e busca vínculos', async () => {
      const tagViagem = await TagService.obterOuCriarEtiqueta('Viagem');
      const tagTrabalho = await TagService.obterOuCriarEtiqueta('Trabalho');

      // Vincula tags a um abastecimento
      await TagService.vincularEtiquetas('abastecimento', 'refuel_1', [
        tagViagem.id,
        tagTrabalho.id,
      ]);

      let tagsAbastecimento = await TagService.listarEtiquetasDoRegistro(
        'abastecimento',
        'refuel_1',
      );
      assert.strictEqual(tagsAbastecimento.length, 2);
      assert.ok(tagsAbastecimento.some(t => t.name === 'Viagem'));
      assert.ok(tagsAbastecimento.some(t => t.name === 'Trabalho'));

      // Vincula tag a uma manutenção
      await TagService.vincularEtiquetas('manutencao', 'maint_1', [tagViagem.id]);
      const tagsMaint = await TagService.listarEtiquetasDoRegistro('manutencao', 'maint_1');
      assert.strictEqual(tagsMaint.length, 1);
      assert.strictEqual(tagsMaint[0].name, 'Viagem');

      // Atualiza vínculos do abastecimento removendo uma
      await TagService.vincularEtiquetas('abastecimento', 'refuel_1', [tagViagem.id]);
      tagsAbastecimento = await TagService.listarEtiquetasDoRegistro('abastecimento', 'refuel_1');
      assert.strictEqual(tagsAbastecimento.length, 1);
      assert.strictEqual(tagsAbastecimento[0].name, 'Viagem');
    });

    test('exclusão de etiqueta remove os vínculos polimórficos', async () => {
      const tagUrgente = await TagService.obterOuCriarEtiqueta('Urgente');
      await TagService.vincularEtiquetas('despesa', 'desp_1', [tagUrgente.id]);

      let vinculadas = await TagService.listarEtiquetasDoRegistro('despesa', 'desp_1');
      assert.strictEqual(vinculadas.length, 1);

      // Exclui a etiqueta
      await TagService.excluirEtiqueta(tagUrgente.id);

      // Etiqueta não deve mais aparecer na listagem
      const all = await TagRepository.listAll();
      assert.strictEqual(all.length, 0);

      // Vínculo não deve mais existir
      vinculadas = await TagService.listarEtiquetasDoRegistro('despesa', 'desp_1');
      assert.strictEqual(vinculadas.length, 0);
    });
  });

  describe('US27.5 — Filtros por tipo de percurso e por etiqueta', () => {
    test('filtra abastecimentos por tipo de percurso e por etiqueta', async () => {
      const tagFerias = await TagService.obterOuCriarEtiqueta('Férias');
      const tagTrabalho = await TagService.obterOuCriarEtiqueta('Trabalho');

      const refuels: Refuel[] = [
        {
          id: 'ref_1',
          vehicleId: 'veh_1',
          date: '2026-05-01',
          odometer: 1000,
          fuelType: 'Gasolina',
          pricePerLiter: 5,
          totalValue: 250,
          liters: 50,
          isFullTank: true,
          routeType: 'rodoviario',
          notes: 'Ida para a praia',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'ref_2',
          vehicleId: 'veh_1',
          date: '2026-05-05',
          odometer: 1500,
          fuelType: 'Gasolina',
          pricePerLiter: 5,
          totalValue: 250,
          liters: 50,
          isFullTank: true,
          routeType: 'urbano',
          notes: 'Cidade diária',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'ref_3',
          vehicleId: 'veh_1',
          date: '2026-05-10',
          odometer: 2000,
          fuelType: 'Gasolina',
          pricePerLiter: 5,
          totalValue: 250,
          liters: 50,
          isFullTank: true,
          routeType: 'misto',
          notes: null,
          createdAt: new Date().toISOString(),
        },
      ];

      await TagService.vincularEtiquetas('abastecimento', 'ref_1', [tagFerias.id]);
      await TagService.vincularEtiquetas('abastecimento', 'ref_2', [tagTrabalho.id]);

      // Mapeamento de tags por registro
      const mapTags = await TagService.obterMapaTagsRegistros('abastecimento', [
        'ref_1',
        'ref_2',
        'ref_3',
      ]);

      // 1. Filtro por tipo de percurso
      const apenasRodoviario = refuels.filter(r => r.routeType === 'rodoviario');
      assert.strictEqual(apenasRodoviario.length, 1);
      assert.strictEqual(apenasRodoviario[0].id, 'ref_1');

      // 2. Filtro por etiqueta
      const apenasFerias = refuels.filter(r =>
        (mapTags[r.id] || []).some(t => t.id === tagFerias.id),
      );
      assert.strictEqual(apenasFerias.length, 1);
      assert.strictEqual(apenasFerias[0].id, 'ref_1');

      // 3. Filtro combinado tipo + etiqueta
      const mistoComTrabalho = refuels.filter(
        r => r.routeType === 'misto' && (mapTags[r.id] || []).some(t => t.id === tagTrabalho.id),
      );
      assert.strictEqual(mistoComTrabalho.length, 0);
    });
  });
});
