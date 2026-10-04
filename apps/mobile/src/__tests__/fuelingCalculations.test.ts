import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularConsumo,
  validarNovoKm,
  calcularValorTotal,
  calcularValorLitro,
  calcularLitros,
} from '../services/fuelingCalculations';

describe('US05 - Cálculos e Validações de Abastecimento (BDD e Regras de Negócio)', () => {
  describe('US05.5: Critério BDD - Cálculo de Consumo (km/l)', () => {
    it('(BDD US05) Dado último hodômetro de 10.000 km e novo registro de 10.500 km com 40 L, ao salvar, calcula média de 12,5 km/l', () => {
      const consumo = calcularConsumo(10500, 10000, 40);
      assert.equal(consumo, 12.5);
    });

    it('Primeiro abastecimento deve ficar sem consumo (retorna null)', () => {
      assert.equal(calcularConsumo(10000, null, 40), null);
      assert.equal(calcularConsumo(10000, undefined, 40), null);
      assert.equal(calcularConsumo(10000, 0, 40), null);
    });

    it('Deve retornar null se a quilometragem atual for menor ou igual à anterior', () => {
      assert.equal(calcularConsumo(10000, 10000, 40), null);
      assert.equal(calcularConsumo(9500, 10000, 40), null);
    });

    it('Deve retornar null se a quantidade de litros for menor ou igual a zero', () => {
      assert.equal(calcularConsumo(10500, 10000, 0), null);
      assert.equal(calcularConsumo(10500, 10000, -10), null);
    });

    it('Deve calcular consumo com precisão de 2 casas decimais', () => {
      // 450 km / 32 L = 14.0625 -> 14.06 km/l
      assert.equal(calcularConsumo(10450, 10000, 32), 14.06);
    });
  });

  describe('US05.3: Validação de Novo Km (validarNovoKm)', () => {
    it('deve aprovar km estritamente superior ao último consolidado', () => {
      const res = validarNovoKm(10500, 10000);
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it('deve reprovar km igual ao último consolidado com mensagem contendo o valor anterior', () => {
      const res = validarNovoKm(10000, 10000);
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /10\.?000|10000/);
    });

    it('deve reprovar km inferior ao último consolidado com mensagem contendo o valor anterior', () => {
      const res = validarNovoKm(9800, 10000);
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /10\.?000|10000/);
    });

    it('deve aprovar qualquer km positivo quando não houver km anterior consolidado', () => {
      assert.equal(validarNovoKm(150, 0).isValid, true);
      assert.equal(validarNovoKm(150, null).isValid, true);
    });
  });

  describe('US05.2: Cálculo Bidirecional de Litros e Preço', () => {
    it('deve calcular valor total a partir de litros e valor por litro', () => {
      // 40 L * R$ 5,89/L = R$ 235,60
      const total = calcularValorTotal(40, 5.89);
      assert.equal(total, 235.6);
    });

    it('deve calcular valor por litro a partir de valor total e litros', () => {
      // R$ 200,00 / 40 L = R$ 5,00/L
      const valorLitro = calcularValorLitro(200, 40);
      assert.equal(valorLitro, 5.0);
    });

    it('deve calcular litros a partir de valor total e valor por litro', () => {
      // R$ 200,00 / R$ 5,00/L = 40 L
      const litros = calcularLitros(200, 5);
      assert.equal(litros, 40);
    });

    it('deve tratar divisão por zero retornando zero ou null', () => {
      assert.equal(calcularValorLitro(200, 0), null);
      assert.equal(calcularLitros(200, 0), null);
    });
  });
});
