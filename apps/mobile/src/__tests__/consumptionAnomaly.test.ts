import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliarAnomaliaConsumo,
  LIMIAR_ANOMALIA_PADRAO,
  identificarAnomaliasNoHistorico,
} from '../services/consumptionAnomalyService';
import { Refuel } from '@autogest/shared-types';

describe('US26 — Alerta de Anomalia de Consumo', () => {
  describe('US26.1 & US26.5 — Regras Puras de Detecção de Anomalia', () => {
    it('(BDD US26) Dado média de 12 km/l nos três últimos abastecimentos e novo abastecimento com 9 km/l, ao salvar, exibe alerta de possível problema mecânico', () => {
      const anteriores = [12, 12, 12];
      const novo = 9;

      const resultado = avaliarAnomaliaConsumo(anteriores, novo, LIMIAR_ANOMALIA_PADRAO);

      assert.equal(resultado.isAnomalia, true);
      assert.equal(resultado.mediaAnterior, 12.0);
      assert.equal(resultado.consumoNovo, 9.0);
      // Queda: (12 - 9) / 12 = 3 / 12 = 0.25 -> 25%
      assert.equal(resultado.percentualQueda, 25.0);
      assert.match(
        resultado.mensagemAlerta!,
        /Possível problema mecânico: consumo 25,0% abaixo da média recente/i,
      );
    });

    it('quando a queda for exatamente no limiar (ex.: 15%), não deve alertar (queda deve SUPERAR o limiar)', () => {
      // Média = 10 km/l. Novo = 8.5 km/l -> Queda = (10 - 8.5) / 10 = 1.5 / 10 = 15%
      const anteriores = [10, 10, 10];
      const novo = 8.5;

      const resultado = avaliarAnomaliaConsumo(anteriores, novo, 0.15);

      assert.equal(resultado.isAnomalia, false);
      assert.equal(resultado.percentualQueda, 15.0);
      assert.equal(resultado.mensagemAlerta, null);
    });

    it('quando houver menos de 3 abastecimentos anteriores com consumo, não deve alertar', () => {
      // 0 anteriores
      assert.equal(avaliarAnomaliaConsumo([], 8).isAnomalia, false);
      // 1 anterior
      assert.equal(avaliarAnomaliaConsumo([12], 8).isAnomalia, false);
      // 2 anteriores
      assert.equal(avaliarAnomaliaConsumo([12, 12], 8).isAnomalia, false);
    });

    it('quando o consumo for igual ou melhor que a média anterior, não deve alertar', () => {
      const anteriores = [10, 11, 12]; // média = 11

      // Consumo igual
      const resIgual = avaliarAnomaliaConsumo(anteriores, 11);
      assert.equal(resIgual.isAnomalia, false);
      assert.equal(resIgual.percentualQueda, 0);

      // Consumo melhor (ex: 13 km/l)
      const resMelhor = avaliarAnomaliaConsumo(anteriores, 13);
      assert.equal(resMelhor.isAnomalia, false);
      assert.equal(resMelhor.percentualQueda, null);
    });

    it('deve desconsiderar consumos nulos, zero ou negativos e avaliar apenas os 3 abastecimentos mais recentes com consumo', () => {
      // Apenas os 3 últimos com consumo apurado devem ser considerados: [11, 13, 12] -> média = 12
      const anterioresComMaisPontos = [18, 20, 11, 13, 12];
      const res = avaliarAnomaliaConsumo(anterioresComMaisPontos, 9.6); // queda: (12 - 9.6)/12 = 2.4/12 = 20%
      assert.equal(res.isAnomalia, true);
      assert.equal(res.mediaAnterior, 12.0);
      assert.equal(res.percentualQueda, 20.0);

      // Primeiro abastecimento sem consumo (novo = null ou <= 0) não alerta
      assert.equal(avaliarAnomaliaConsumo([12, 12, 12], null).isAnomalia, false);
      assert.equal(avaliarAnomaliaConsumo([12, 12, 12], 0).isAnomalia, false);
    });
  });

  describe('US26.4 — Identificação Dinâmica de Anomalias no Histórico', () => {
    const criarRefuelMock = (
      id: string,
      date: string,
      odometer: number,
      calculatedKml: number | null,
    ): Refuel => ({
      id,
      vehicleId: 'v1',
      date,
      odometer,
      fuelType: 'Gasolina',
      pricePerLiter: 5.5,
      totalValue: 200,
      liters: 36,
      isFullTank: true,
      calculatedKml,
      createdAt: date,
    });

    it('deve marcar o ícone de anomalia apenas nos abastecimentos que sofreram queda > limiar em relação aos 3 imediatamente anteriores', () => {
      const historico: Refuel[] = [
        criarRefuelMock('1', '2026-01-01T10:00:00.000Z', 10000, null), // 1º base
        criarRefuelMock('2', '2026-01-10T10:00:00.000Z', 10500, 12.0), // 1º com consumo
        criarRefuelMock('3', '2026-01-20T10:00:00.000Z', 11000, 12.0), // 2º com consumo
        criarRefuelMock('4', '2026-01-30T10:00:00.000Z', 11500, 12.0), // 3º com consumo (média = 12)
        criarRefuelMock('5', '2026-02-10T10:00:00.000Z', 12000, 9.0), // 4º -> ANOMALIA (queda 25%)
        criarRefuelMock('6', '2026-02-20T10:00:00.000Z', 12500, 9.5), // Anteriores: 12, 12, 9 -> média 11. (11 - 9.5)/11 = 1.5/11 = 13.6% (<= 15%, não anômalo)
      ];

      const anomaliasMap = identificarAnomaliasNoHistorico(historico);

      assert.equal(anomaliasMap.has('1'), false);
      assert.equal(anomaliasMap.has('2'), false);
      assert.equal(anomaliasMap.has('3'), false);
      assert.equal(anomaliasMap.has('4'), false);
      assert.equal(anomaliasMap.has('5'), true);
      assert.equal(anomaliasMap.get('5')?.percentualQueda, 25.0);
      assert.equal(anomaliasMap.has('6'), false);
    });

    it('ao editar ou excluir um abastecimento anterior, o mapa recalculado deve refletir dinamicamente a nova média', () => {
      const historico: Refuel[] = [
        criarRefuelMock('1', '2026-01-01T10:00:00.000Z', 10000, null),
        criarRefuelMock('2', '2026-01-10T10:00:00.000Z', 10500, 12.0),
        criarRefuelMock('3', '2026-01-20T10:00:00.000Z', 11000, 12.0),
        criarRefuelMock('4', '2026-01-30T10:00:00.000Z', 11500, 12.0),
        criarRefuelMock('5', '2026-02-10T10:00:00.000Z', 12000, 9.0), // Anômalo com média 12
      ];

      // Se o abastecimento '4' for editado para 9.0 km/l:
      // Anteriores ao '5' viram: 12, 12, 9 -> média = 11.0. Queda de 9 = (11 - 9) / 11 = 18.18% (ainda anômalo)
      // Se '3' e '4' forem editados para 9.0 km/l:
      // Anteriores ao '5' viram: 12, 9, 9 -> média = 10.0. Queda de 9 = (10 - 9) / 10 = 10% (deixa de ser anômalo!)
      const historicoModificado: Refuel[] = [
        historico[0],
        historico[1],
        { ...historico[2], calculatedKml: 9.0 },
        { ...historico[3], calculatedKml: 9.0 },
        historico[4],
      ];

      const novoMapa = identificarAnomaliasNoHistorico(historicoModificado);
      assert.equal(novoMapa.has('5'), false);
    });
  });
});
