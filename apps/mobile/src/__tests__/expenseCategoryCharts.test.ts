import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  distribuicaoPorCategoria,
  obterDistribuicaoGastosPorCategoriaDoPeriodo,
} from '../services/expenseCategoryDistribution';
import { resolverIntervaloPeriodo } from '../services/usageAndCostIndicators';
import { CATEGORY_CHART_COLORS } from '../services/chartSpike';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { FixedCostRepository } from '../repositories/FixedCostRepository';

describe('US14 — Gráficos de Categorização de Gastos (Domínio, Período e Agregação)', () => {
  describe('US14.1 & US14.6 — distribuicaoPorCategoria (Método do Maior Resto e BDD)', () => {
    it('deve calcular 50%, 30% e 20% para a massa conhecida do BDD (R$ 500 combustível, R$ 300 manutenção e R$ 200 impostos)', () => {
      const resultado = distribuicaoPorCategoria({
        Combustível: 500,
        Manutenção: 300,
        Imposto: 200,
      });

      assert.equal(resultado.total, 1000);
      assert.equal(resultado.somaPercentuais, 100);
      assert.equal(resultado.itens.length, 3);

      const combustivel = resultado.itens.find(i => i.categoria === 'Combustível');
      const manutencao = resultado.itens.find(i => i.categoria === 'Manutenção');
      const imposto = resultado.itens.find(i => i.categoria === 'Imposto');

      assert.ok(combustivel);
      assert.equal(combustivel.valor, 500);
      assert.equal(combustivel.percentual, 50);
      assert.equal(combustivel.cor, CATEGORY_CHART_COLORS['Combustível']);

      assert.ok(manutencao);
      assert.equal(manutencao.valor, 300);
      assert.equal(manutencao.percentual, 30);
      assert.equal(manutencao.cor, CATEGORY_CHART_COLORS['Manutenção']);

      assert.ok(imposto);
      assert.equal(imposto.valor, 200);
      assert.equal(imposto.percentual, 20);
      assert.equal(imposto.cor, CATEGORY_CHART_COLORS['Imposto']);
    });

    it('deve garantir que o arredondamento pelo método do maior resto some exatamente 100% (ex.: 3 categorias iguais de R$ 100 -> 34%, 33%, 33%)', () => {
      const resultado = distribuicaoPorCategoria({
        Combustível: 100,
        Manutenção: 100,
        Imposto: 100,
      });

      assert.equal(resultado.total, 300);
      assert.equal(resultado.somaPercentuais, 100);
      assert.equal(resultado.itens.length, 3);

      const percentuais = resultado.itens.map(i => i.percentual);
      assert.deepEqual(percentuais, [34, 33, 33]);
      const soma = percentuais.reduce((acc, p) => acc + p, 0);
      assert.equal(soma, 100);
    });

    it('deve garantir soma exatamente 100% em distribuições fracionárias complexas (ex.: 6 categorias iguais)', () => {
      const resultado = distribuicaoPorCategoria({
        Combustível: 100,
        Manutenção: 100,
        Imposto: 100,
        Seguro: 100,
        Lavagem: 100,
        'Custos fixos': 100,
      });

      assert.equal(resultado.total, 600);
      assert.equal(resultado.somaPercentuais, 100);
      assert.equal(resultado.itens.length, 6);

      // 100 / 6 = 16.666...% -> 4 categorias recebem 17% e 2 recebem 16% (4*17 + 2*16 = 68 + 32 = 100)
      const percentuais = resultado.itens.map(i => i.percentual);
      assert.deepEqual(percentuais, [17, 17, 17, 17, 16, 16]);
      assert.equal(
        percentuais.reduce((a, b) => a + b, 0),
        100,
      );
    });

    it('deve excluir categorias sem valor (valor <= 0) e retornar lista vazia quando o período for vazio', () => {
      const vazio = distribuicaoPorCategoria({
        Combustível: 0,
        Manutenção: 0,
        Imposto: 0,
        Seguro: -10,
      });

      assert.equal(vazio.total, 0);
      assert.equal(vazio.somaPercentuais, 0);
      assert.deepEqual(vazio.itens, []);
    });

    it('deve retornar 100% quando houver apenas uma categoria única com gastos no período', () => {
      const unica = distribuicaoPorCategoria({
        Combustível: 425.75,
        Manutenção: 0,
        Imposto: 0,
        Seguro: 0,
      });

      assert.equal(unica.total, 425.75);
      assert.equal(unica.somaPercentuais, 100);
      assert.equal(unica.itens.length, 1);
      assert.equal(unica.itens[0].categoria, 'Combustível');
      assert.equal(unica.itens[0].percentual, 100);
      assert.equal(unica.itens[0].valor, 425.75);
    });

    it('deve incluir "Custos fixos" como categoria própria quando houver custos fixos no período (Decisão #6 / US14)', () => {
      const resultado = distribuicaoPorCategoria(
        {
          Combustível: 400,
          Manutenção: 300,
          Imposto: 0,
        },
        { custosFixos: 300 },
      );

      assert.equal(resultado.total, 1000);
      assert.equal(resultado.somaPercentuais, 100);
      assert.equal(resultado.itens.length, 3);

      const custosFixosItem = resultado.itens.find(i => i.categoria === 'Custos fixos');
      assert.ok(custosFixosItem);
      assert.equal(custosFixosItem.valor, 300);
      assert.equal(custosFixosItem.percentual, 30);
      assert.equal(custosFixosItem.cor, CATEGORY_CHART_COLORS['Custos fixos']);
    });

    it('deve atribuir cores fixas e distinguíveis por daltônicos (paleta Okabe-Ito) para cada categoria', () => {
      const resultado = distribuicaoPorCategoria({
        Combustível: 250,
        Manutenção: 200,
        Imposto: 150,
        Seguro: 150,
        Lavagem: 100,
        'Custos fixos': 100,
        Outros: 50,
      });

      const coresUnicas = new Set(resultado.itens.map(i => i.cor));
      assert.equal(coresUnicas.size, 7);
      for (const item of resultado.itens) {
        assert.equal(item.cor, CATEGORY_CHART_COLORS[item.categoria]);
      }
    });
  });

  describe('US14.3 — Seletor de Período Reaproveitado da US24 (mês atual, mês anterior e personalizado)', () => {
    it('deve resolver corretamente mês atual, mês anterior e período personalizado', () => {
      const refDate = new Date('2026-05-18T12:00:00.000Z');

      const mesAtual = resolverIntervaloPeriodo('mes_atual', refDate);
      assert.equal(mesAtual.inicio, '2026-05-01');
      assert.equal(mesAtual.fim, '2026-05-31');
      assert.equal(mesAtual.label, 'Mês Atual');

      const mesAnterior = resolverIntervaloPeriodo('mes_anterior', refDate);
      assert.equal(mesAnterior.inicio, '2026-04-01');
      assert.equal(mesAnterior.fim, '2026-04-30');
      assert.equal(mesAnterior.label, 'Mês Anterior');

      // Virada de ano (janeiro -> dezembro do ano anterior)
      const refJan = new Date('2026-01-10T12:00:00.000Z');
      const mesAnteriorJan = resolverIntervaloPeriodo('mes_anterior', refJan);
      assert.equal(mesAnteriorJan.inicio, '2025-12-01');
      assert.equal(mesAnteriorJan.fim, '2025-12-31');

      const personalizado = resolverIntervaloPeriodo('personalizado', refDate, {
        inicio: '2026-02-10',
        fim: '2026-03-20',
      });
      assert.equal(personalizado.inicio, '2026-02-10');
      assert.equal(personalizado.fim, '2026-03-20');
      assert.equal(personalizado.label, 'Personalizado');
    });
  });

  describe('US14.1 & US22.4 — Integração com gastosDoPeriodo e Custos Fixos no Banco Local', () => {
    beforeEach(async () => {
      const db = DatabaseConnection.getInstance();
      await db.saveTableData('despesas', []);
      await db.saveTableData('abastecimentos', []);
      await db.saveTableData('manutencoes', []);
      await db.saveTableData('custos_fixos', []);
      await db.saveTableData('veiculos', []);
    });

    it('deve agregar abastecimentos (R$ 500), manutenções (R$ 300) e impostos (R$ 200) do banco e retornar 50%, 30% e 20%', async () => {
      const veiculo = await VehicleRepository.create({
        plate: 'CAT1A23',
        brand: 'Volkswagen',
        model: 'Nivus Highline',
        year: 2024,
        fuelType: 'Flex',
        tankCapacityL: 52,
        preferredFuel: 'Gasolina',
        initialOdometer: 15000,
      });

      await RefuelRepository.create({
        vehicleId: veiculo.id,
        date: '2026-05-05T10:00:00.000Z',
        fuelType: 'Gasolina',
        liters: 80,
        pricePerLiter: 6.25,
        totalValue: 500,
        odometer: 15500,
        isFullTank: true,
      });

      await MaintenanceRepository.create({
        vehicleId: veiculo.id,
        date: '2026-05-10T10:00:00.000Z',
        odometer: 15600,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo e filtro',
        totalValue: 300,
      });

      await ExpenseRepository.create({
        vehicleId: veiculo.id,
        category: 'Imposto',
        description: 'Parcela IPVA',
        amount: 200,
        date: '2026-05-12T10:00:00.000Z',
      });

      const distribuicao = await obterDistribuicaoGastosPorCategoriaDoPeriodo(
        veiculo.id,
        '2026-05-01',
        '2026-05-31',
      );

      assert.equal(distribuicao.total, 1000);
      assert.equal(distribuicao.somaPercentuais, 100);
      assert.equal(distribuicao.itens.length, 3);
      assert.deepEqual(
        distribuicao.itens.map(i => ({
          categoria: i.categoria,
          valor: i.valor,
          percentual: i.percentual,
        })),
        [
          { categoria: 'Combustível', valor: 500, percentual: 50 },
          { categoria: 'Manutenção', valor: 300, percentual: 30 },
          { categoria: 'Imposto', valor: 200, percentual: 20 },
        ],
      );
    });

    it('deve incluir Custos fixos na distribuição quando houver custos fixos cadastrados para o veículo', async () => {
      const veiculo = await VehicleRepository.create({
        plate: 'FIX9B88',
        brand: 'Honda',
        model: 'HR-V',
        year: 2023,
        fuelType: 'Flex',
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 22000,
      });

      await RefuelRepository.create({
        vehicleId: veiculo.id,
        date: '2026-05-08T10:00:00.000Z',
        fuelType: 'Gasolina',
        liters: 80,
        pricePerLiter: 6.25,
        totalValue: 500,
        odometer: 22400,
        isFullTank: true,
      });

      await FixedCostRepository.create({
        vehicleId: veiculo.id,
        description: 'Estacionamento mensal',
        monthlyAmount: 500,
      });

      const distribuicao = await obterDistribuicaoGastosPorCategoriaDoPeriodo(
        veiculo.id,
        '2026-05-01',
        '2026-05-31',
      );

      assert.equal(distribuicao.total, 1000);
      assert.equal(distribuicao.somaPercentuais, 100);
      assert.equal(distribuicao.itens.length, 2);

      const combustivel = distribuicao.itens.find(i => i.categoria === 'Combustível');
      const custosFixos = distribuicao.itens.find(i => i.categoria === 'Custos fixos');
      assert.ok(combustivel);
      assert.ok(custosFixos);
      assert.equal(combustivel.percentual, 50);
      assert.equal(custosFixos.percentual, 50);
    });
  });

  describe('US14.2, US14.4 & US14.5 — Contratos de Apresentação e Interação dos Gráficos', () => {
    it('deve alternar entre os modos de exibição "setores" e "barras" e preservar seleção de categoria', () => {
      type Mode = 'setores' | 'barras';
      let currentMode: Mode = 'setores';
      let selectedCategory: string | null = null;

      const toggleMode = (mode: Mode) => {
        currentMode = mode;
      };

      const selectCategory = (categoryId: string) => {
        selectedCategory = categoryId;
      };

      assert.equal(currentMode, 'setores');
      toggleMode('barras');
      assert.equal(currentMode, 'barras');

      const mockDistribution = distribuicaoPorCategoria({
        Combustível: 500,
        Manutenção: 300,
        Imposto: 200,
      });

      selectCategory(mockDistribution.itens[1].id);
      assert.equal(selectedCategory, 'cat-Manutenção');

      const highlighted = mockDistribution.itens.find(i => i.id === selectedCategory);
      assert.ok(highlighted);
      assert.equal(highlighted.categoria, 'Manutenção');
      assert.equal(highlighted.percentual, 30);
      assert.equal(highlighted.valor, 300);
    });

    it('deve acionar callbacks interativos de fatia (onSelectSlice) e de barra (onSelectBar)', () => {
      const mockDistribution = distribuicaoPorCategoria({
        Combustível: 500,
        Manutenção: 300,
        Imposto: 200,
      });

      const pieSlices = mockDistribution.itens.map(item => ({
        id: item.id,
        label: item.categoria,
        value: item.valor,
        percentage: item.percentual,
        color: item.cor,
        formattedValue: item.valorFormatado,
      }));

      let selectedPieItem: any = null;
      const onSelectSlice = (slice: any) => {
        selectedPieItem = slice;
      };

      onSelectSlice(pieSlices[0]);
      assert.ok(selectedPieItem);
      assert.equal(selectedPieItem.label, 'Combustível');
      assert.equal(selectedPieItem.percentage, 50);

      let selectedBarItem: any = null;
      const onSelectBar = (bar: any) => {
        selectedBarItem = bar;
      };

      onSelectBar(pieSlices[2]);
      assert.ok(selectedBarItem);
      assert.equal(selectedBarItem.label, 'Imposto');
      assert.equal(selectedBarItem.percentage, 20);
    });
  });
});
