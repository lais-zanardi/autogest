import test from 'node:test';
import assert from 'node:assert/strict';
import { MobileOCRService } from '../services/ocrService';
import { EnvConfig } from '../config/env';

test('US05 — MobileOCRService (Processamento e Extração de Comprovante OCR)', async t => {
  await t.test('MobileOCRService.scanReceipt rejeita imagem vazia ou em branco', async () => {
    await assert.rejects(
      async () => {
        await MobileOCRService.scanReceipt('');
      },
      /Imagem inválida para escaneamento OCR/,
    );
  });

  await t.test('MobileOCRService.scanReceipt em Mock Mode retorna dados estruturados de abastecimento', async () => {
    await EnvConfig.setMockMode(true);
    const result = await MobileOCRService.scanReceipt('BASE64_VALIDA_DE_CUPOM');

    assert.ok(result);
    assert.equal(result.stationName, 'Posto Shell Select');
    assert.equal(result.fuelType, 'Gasolina');
    assert.equal(result.liters, 42.5);
    assert.equal(result.pricePerLiter, 5.89);
    assert.equal(result.totalValue, 250.32);
    assert.ok(result.confidenceScore >= 0.9);
  });

  await t.test('MobileOCRService.scanReceipt realiza fallback gracioso quando API externa falhar', async () => {
    await EnvConfig.setMockMode(false);
    // Como a API não está rodando nesta porta/IP nos testes unitários, o fallback é acionado
    const result = await MobileOCRService.scanReceipt('BASE64_TESTE_FALLBACK');

    assert.ok(result);
    assert.equal(result.stationName, 'Posto Shell Select');
    assert.equal(result.fuelType, 'Gasolina');
    assert.equal(result.liters, 42.5);
    assert.equal(result.totalValue, 250.32);
  });
});
