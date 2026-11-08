import test from 'node:test';
import assert from 'node:assert/strict';
import { MobileFipeService } from '../services/mobileFipeService';
import { EnvConfig } from '../config/env';
import { api } from '../services/api';
import { db } from '../database/DatabaseConnection';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { FipeRepository } from '../repositories/FipeRepository';

test('US18 — MobileFipeService (Consulta Tabela FIPE, Modo Mock e Fallback Offline)', async t => {
  await db.saveTableData('local_vehicles', []);
  await db.saveTableData('local_fipe_consultations', []);

  await t.test('MobileFipeService.listarMarcas em Modo Mock retorna marcas de referência locais', async () => {
    await EnvConfig.setMockMode(true);
    const marcas = await MobileFipeService.listarMarcas();

    assert.ok(Array.isArray(marcas));
    assert.ok(marcas.length >= 7, 'Deve conter pelo menos 7 marcas principais');
    const vw = marcas.find(m => m.nome.includes('VolksWagen') || m.codigo === '59');
    const fiat = marcas.find(m => m.nome === 'Fiat' || m.codigo === '21');
    assert.ok(vw, 'Deve conter VolksWagen');
    assert.ok(fiat, 'Deve conter Fiat');
  });

  await t.test('MobileFipeService.listarMarcas recorre ao fallback local quando a API sofre timeout', async () => {
    await EnvConfig.setMockMode(false);
    const origGet = api.get;

    (api as any).get = async () => {
      const err: any = new Error('timeout of 10000ms exceeded');
      err.code = 'ECONNABORTED';
      throw err;
    };

    try {
      const marcas = await MobileFipeService.listarMarcas();
      assert.ok(Array.isArray(marcas));
      assert.ok(marcas.length > 0, 'Fallback local deve fornecer lista de marcas mesmo com timeout');
    } finally {
      api.get = origGet;
      await EnvConfig.resetToEnvDefault();
    }
  });

  await t.test('MobileFipeService.listarModelos retorna modelos da marca selecionada', async () => {
    await EnvConfig.setMockMode(true);
    const modelosVW = await MobileFipeService.listarModelos('59');

    assert.ok(Array.isArray(modelosVW));
    assert.ok(modelosVW.length > 0);
    const gol = modelosVW.find(m => m.nome.includes('Gol'));
    assert.ok(gol, 'Deve listar o Gol entre os modelos da VW');
  });

  await t.test('MobileFipeService.listarAnos retorna faixas de anos disponíveis', async () => {
    await EnvConfig.setMockMode(true);
    const anos = await MobileFipeService.listarAnos('59', '8323');

    assert.ok(Array.isArray(anos));
    assert.ok(anos.length > 0);
    assert.ok(anos.some(a => a.nome.includes('Flex') || a.nome.includes('Gasolina')));
  });

  await t.test('MobileFipeService.consultarCotacao gera cotação estruturada e determinística', async () => {
    await EnvConfig.setMockMode(true);
    const quote = await MobileFipeService.consultarCotacao('59', '8323', '2022-5');

    assert.ok(quote);
    assert.ok(quote.codigoFipe);
    assert.equal(quote.marca, 'VW - VolksWagen');
    assert.ok(quote.modelo.includes('Gol'));
    assert.equal(quote.anoModelo, 2022);
    assert.ok(quote.valorCentavos > 0);
    assert.ok(quote.valorFormatado.startsWith('R$ '));
    assert.ok(quote.mesReferenciaIso.length >= 7);
  });

  await t.test('MobileFipeService.consultarEAtualizarVeiculo salva consulta e atualiza metadados do veículo', async () => {
    await EnvConfig.setMockMode(true);

    const vehicle = await VehicleRepository.create({
      brand: 'VW',
      model: 'Gol 1.0',
      plate: 'GOL2022',
      year: 2022,
      tankCapacityL: 50,
      preferredFuel: 'Flex',
      initialOdometer: 20000,
    });

    const result = await MobileFipeService.consultarEAtualizarVeiculo({
      vehicleId: vehicle.id,
      marcaCodigo: '59',
      modeloCodigo: '8323',
      anoCodigo: '2022-5',
    });

    assert.ok(result.consultation);
    assert.ok(result.quote);
    assert.equal(result.consultation.vehicleId, vehicle.id);

    // Verifica se histórico local foi salvo
    const { consultas, ultimaConsulta } = await MobileFipeService.obterHistorico(vehicle.id);
    assert.equal(consultas.length, 1);
    assert.ok(ultimaConsulta);
    assert.equal(ultimaConsulta?.fipeCode, result.quote.codigoFipe);

    // Verifica se metadados no veículo foram atualizados
    const updatedVehicle = await VehicleRepository.findById(vehicle.id);
    assert.ok(updatedVehicle?.fipeValue && updatedVehicle.fipeValue > 0);
    assert.equal((updatedVehicle as any).fipe_codigo_marca, '59');
  });
});
