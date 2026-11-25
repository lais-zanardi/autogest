import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  compararEtanolGasolina,
  custoEconomiaPotencial,
  custoPrevistoViagem,
} from '../services/simulatorDomain';
import { SimulatorService } from '../services/simulatorService';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';

describe('US16 — Simulador Financeiro de Viabilidade e Economia', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('simulacoes', []);
    await db.saveTableData('precos_combustivel', []);
    await db.saveTableData('fila_sync', []);
  });

  describe('US16.1 & US16.7: compararEtanolGasolina (Regra dos 70% em centavos)', () => {
    it('BDD: etanol exatamente a 70% da gasolina (R$ 4,20 vs R$ 6,00) está no limite e compensa', () => {
      const res = compararEtanolGasolina(420, 600);
      assert.strictEqual(res.etanolCompensa, true);
      assert.strictEqual(res.decisao, 'etanol');
      assert.strictEqual(res.razaoPercentual, 70);
      assert.strictEqual(res.pontoEquilibrioCentavos, 420);
    });

    it('BDD: etanol acima de 70% da gasolina (R$ 4,21 vs R$ 6,00) NÃO compensa', () => {
      const res = compararEtanolGasolina(421, 600);
      assert.strictEqual(res.etanolCompensa, false);
      assert.strictEqual(res.decisao, 'gasolina');
      assert.ok(res.razaoPercentual > 70);
    });

    it('gera texto claro de decisão (ex.: 68% da gasolina)', () => {
      const res = compararEtanolGasolina(408, 600);
      assert.strictEqual(res.etanolCompensa, true);
      assert.strictEqual(res.razaoPercentual, 68);
      assert.strictEqual(
        res.mensagem,
        'Compensa abastecer com etanol: custo 68% do da gasolina',
      );
    });

    it('rejeita preços zerados ou negativos', () => {
      assert.throws(() => compararEtanolGasolina(0, 600));
      assert.throws(() => compararEtanolGasolina(400, 0));
    });
  });

  describe('US16.2 & US16.7: custoEconomiaPotencial', () => {
    it('calcula custos mensais e economia potencial com valores fechados', () => {
      // Atual: 10 km/l, R$ 6,00/L (600c), 1000 km/mês -> 100 L -> R$ 600,00 (60000c)
      // Alternativo: 12,5 km/l, R$ 6,00/L (600c), 1000 km/mês -> 80 L -> R$ 480,00 (48000c)
      // Economia: R$ 120,00/mês (12000c), R$ 1.440,00/ano (144000c)
      const res = custoEconomiaPotencial(10, 12.5, 600, 600, 1000);
      assert.strictEqual(res.custoMensalAtualCentavos, 60000);
      assert.strictEqual(res.custoMensalAlternativoCentavos, 48000);
      assert.strictEqual(res.economiaMensalCentavos, 12000);
      assert.strictEqual(res.economiaAnualCentavos, 144000);
      assert.strictEqual(res.alternativaCompensa, true);
    });

    it('consumo zero não divide por zero', () => {
      assert.throws(() => custoEconomiaPotencial(0, 12, 600, 600, 1000));
      assert.throws(() => custoEconomiaPotencial(10, 0, 600, 600, 1000));
    });
  });

  describe('US16.3 & US16.7: custoPrevistoViagem', () => {
    it('BDD do enunciado: 500 km, 12,5 km/l, R$ 6,00/L, R$ 50 pedágio e R$ 60 alimentação = R$ 350,00', () => {
      const res = custoPrevistoViagem(500, 12.5, 600, 5000, 6000);
      assert.strictEqual(res.litrosEstimados, 40);
      assert.strictEqual(res.custoCombustivelCentavos, 24000);
      assert.strictEqual(res.custoTotalCentavos, 35000);
      assert.strictEqual(res.custoPorKmCentavos, 70);
    });

    it('consumo zero ou distância zero não divide por zero', () => {
      assert.throws(() => custoPrevistoViagem(500, 0, 600, 0, 0));
      assert.throws(() => custoPrevistoViagem(0, 12.5, 600, 0, 0));
    });
  });

  describe('US16.4 & US16.6: Preços padrão da US17, persistência e sync de simulacoes', () => {
    it('obtém preços padrão do cache local US17 e salva/lista últimas simulações', async () => {
      const db = DatabaseConnection.getInstance();
      await db.saveTableData('precos_combustivel', [
        {
          id: 'p-gas',
          municipio: 'São Paulo',
          uf: 'SP',
          combustivel: 'Gasolina',
          preco_centavos: 600,
          data_coleta: '2026-11-24',
          fonte: 'ANP',
          granularidade: 'municipal',
          sincronizado_em: '2026-11-25T10:00:00Z',
        },
        {
          id: 'p-eta',
          municipio: 'São Paulo',
          uf: 'SP',
          combustivel: 'Etanol',
          preco_centavos: 408,
          data_coleta: '2026-11-24',
          fonte: 'ANP',
          granularidade: 'municipal',
          sincronizado_em: '2026-11-25T10:00:00Z',
        },
      ]);

      const padroes = await SimulatorService.obterPrecosPadrao('São Paulo');
      assert.strictEqual(padroes.gasolinaCentavos, 600);
      assert.strictEqual(padroes.etanolCentavos, 408);

      const resultado = compararEtanolGasolina(408, 600);
      await SimulatorService.salvarSimulacao(
        'etanol_gasolina',
        { precoEtanolCentavos: 408, precoGasolinaCentavos: 600 },
        resultado,
      );

      const ultimas = await SimulatorService.listarUltimas();
      assert.strictEqual(ultimas.length, 1);
      assert.strictEqual(ultimas[0].tipo, 'etanol_gasolina');
      assert.strictEqual(ultimas[0].resultado.decisao, 'etanol');
    });

    it('simulacoes está registrada em SyncEntityRegistry', () => {
      const entities = SyncEntityRegistry.listRegisteredEntities();
      assert.ok(entities.includes('simulacoes'));
    });
  });
});
