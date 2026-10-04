import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePlate,
  validateYear,
  validateTankCapacity,
  parseDecimalInput,
  validateVehicleForm,
} from '../services/vehicleValidation';

describe('US04.4 - Validações de Veículos', () => {
  describe('Validação de Placa (Formato Antigo e Mercosul)', () => {
    it('deve aceitar placa no formato antigo padrão (ABC-1234 e ABC1234)', () => {
      assert.equal(validatePlate('ABC-1234').isValid, true);
      assert.equal(validatePlate('abc-1234').isValid, true);
      assert.equal(validatePlate('ABC1234').isValid, true);
      assert.equal(validatePlate('kmp-9021').isValid, true);
    });

    it('deve aceitar placa no formato Mercosul (ABC1D23 e BRA2E19)', () => {
      assert.equal(validatePlate('BRA2E19').isValid, true);
      assert.equal(validatePlate('bra2e19').isValid, true);
      assert.equal(validatePlate('BRA-2E19').isValid, true);
      assert.equal(validatePlate('RIO2A18').isValid, true);
      assert.equal(validatePlate('ABC1D23').isValid, true);
    });

    it('deve rejeitar placas inválidas', () => {
      assert.equal(validatePlate('').isValid, false);
      assert.equal(validatePlate('123-ABCD').isValid, false);
      assert.equal(validatePlate('ABCD-123').isValid, false);
      assert.equal(validatePlate('ABC12345').isValid, false);
      assert.equal(validatePlate('ABC-12').isValid, false);
      assert.equal(validatePlate('AB1234').isValid, false);
    });

    it('deve formatar placa sanitizada em maiúsculas', () => {
      const res = validatePlate('bra2e19');
      assert.equal(res.isValid, true);
      assert.equal(res.formattedPlate, 'BRA2E19');
    });
  });

  describe('Validação de Ano de Fabricação', () => {
    const currentYear = new Date().getFullYear();

    it('deve aceitar anos válidos entre 1900 e o próximo ano', () => {
      assert.equal(validateYear(1900).isValid, true);
      assert.equal(validateYear(1995).isValid, true);
      assert.equal(validateYear(2020).isValid, true);
      assert.equal(validateYear(currentYear).isValid, true);
      assert.equal(validateYear(currentYear + 1).isValid, true);
    });

    it('deve rejeitar anos anteriores a 1900 ou muito no futuro', () => {
      assert.equal(validateYear(1899).isValid, false);
      assert.equal(validateYear(1800).isValid, false);
      assert.equal(validateYear(currentYear + 2).isValid, false);
      assert.equal(validateYear(-2020).isValid, false);
      assert.equal(validateYear(NaN).isValid, false);
    });
  });

  describe('Validação de Capacidade do Tanque e Decimais', () => {
    it('deve aceitar capacidade maior que zero tanto com ponto quanto com vírgula', () => {
      assert.equal(validateTankCapacity(50).isValid, true);
      assert.equal(validateTankCapacity('50').isValid, true);
      assert.equal(validateTankCapacity('52.5').isValid, true);
      assert.equal(validateTankCapacity('52,5').isValid, true);
      assert.equal(validateTankCapacity(45.75).isValid, true);
    });

    it('deve converter corretamente decimais com ponto ou vírgula', () => {
      assert.equal(parseDecimalInput('50,5'), 50.5);
      assert.equal(parseDecimalInput('45.75'), 45.75);
      assert.equal(parseDecimalInput('60'), 60);
      assert.equal(parseDecimalInput('0,250'), 0.25);
    });

    it('deve rejeitar capacidade menor ou igual a zero ou valores não numéricos', () => {
      assert.equal(validateTankCapacity(0).isValid, false);
      assert.equal(validateTankCapacity(-10).isValid, false);
      assert.equal(validateTankCapacity('-5,5').isValid, false);
      assert.equal(validateTankCapacity('').isValid, false);
      assert.equal(validateTankCapacity('abc').isValid, false);
    });
  });

  describe('Validação Completa do Formulário de Veículo', () => {
    it('deve aprovar formulário preenchido com todos os campos obrigatórios válidos', () => {
      const result = validateVehicleForm({
        plate: 'BRA2E19',
        model: 'Civic Touring 1.5',
        year: 2020,
        tankCapacityL: '56,0',
        preferredFuel: 'Gasolina',
      });

      assert.equal(result.isValid, true);
      assert.equal(Object.keys(result.errors).length, 0);
      assert.equal(result.data?.tankCapacityL, 56.0);
      assert.equal(result.data?.plate, 'BRA2E19');
    });

    it('deve apontar erros quando campos obrigatórios estiverem ausentes', () => {
      const result = validateVehicleForm({
        plate: '',
        model: '',
        year: '' as any,
        tankCapacityL: '',
        preferredFuel: '' as any,
      });

      assert.equal(result.isValid, false);
      assert.ok(result.errors.plate);
      assert.ok(result.errors.model);
      assert.ok(result.errors.year);
      assert.ok(result.errors.tankCapacityL);
      assert.ok(result.errors.preferredFuel);
    });
  });
});
