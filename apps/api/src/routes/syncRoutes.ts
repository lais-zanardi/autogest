import { Router } from 'express';
import { createSyncResourceRouter } from './syncResourceRouter';

const router = Router();

// 1. Veículos (US04 / US02.1)
const veiculosSyncRouter = createSyncResourceRouter({
  tableName: 'veiculos',
  ownershipType: 'direct',
  allowedFields: [
    'nome',
    'marca',
    'modelo',
    'ano',
    'placa',
    'capacidade_tanque_l',
    'combustivel_preferencial',
    'odometro_inicial',
    'odometro_atual',
    'valor_fipe',
  ],
  validatePayload: body => {
    if (!body.modelo && !body.model) return { isValid: false, error: 'Modelo é obrigatório.' };
    if (!body.placa && !body.plate) return { isValid: false, error: 'Placa é obrigatória.' };
    return { isValid: true };
  },
});

// 2. Abastecimentos (US05 / US02.1)
const abastecimentosSyncRouter = createSyncResourceRouter({
  tableName: 'abastecimentos',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'data_hora',
    'tipo_combustivel',
    'litros',
    'valor_total',
    'valor_litro',
    'km',
    'consumo_kml',
    'latitude',
    'longitude',
    'tanque_cheio',
    'posto',
    'imagem_comprovante_url',
  ],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    return { isValid: true };
  },
});

// 3. Leituras de Hodômetro (US06 / US02.1)
const hodometroSyncRouter = createSyncResourceRouter({
  tableName: 'leituras_hodometro',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'km', 'data_hora', 'origem'],
  validatePayload: body => {
    const km = body.km;
    if (km === undefined || km === null || Number(km) <= 0) {
      return { isValid: false, error: 'km deve ser maior que zero.' };
    }
    return { isValid: true };
  },
});

// 4. Despesas (US22 / US02.1)
const despesasSyncRouter = createSyncResourceRouter({
  tableName: 'despesas',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'categoria', 'valor', 'data_hora', 'descricao'],
  validatePayload: body => {
    const valor = body.valor !== undefined ? body.valor : body.amount;
    if (valor === undefined || valor === null || Number(valor) <= 0) {
      return { isValid: false, error: 'valor da despesa deve ser maior que zero.' };
    }
    return { isValid: true };
  },
});

// 5. Manutenções (US09.1)
const manutencoesSyncRouter = createSyncResourceRouter({
  tableName: 'manutencoes',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'data',
    'km',
    'tipo',
    'tipo_servico',
    'descricao',
    'pecas',
    'oficina',
    'profissional',
    'tempo_execucao_min',
    'valor',
  ],
  validatePayload: body => {
    if (!body.veiculo_id && !body.vehicleId) {
      return { isValid: false, error: 'veiculo_id é obrigatório.' };
    }
    if (!body.tipo) {
      return { isValid: false, error: 'tipo (preventiva ou corretiva) é obrigatório.' };
    }
    return { isValid: true };
  },
});

// 6. Anexos de Manutenção (US09.1)
const anexosSyncRouter = createSyncResourceRouter({
  tableName: 'anexos',
  ownershipType: 'direct',
  allowedFields: [
    'manutencao_id',
    'arquivo_local',
    'url_gcs',
    'tamanho',
    'status_upload',
    'tipo_mime',
  ],
  validatePayload: body => {
    const tamanho = body.tamanho !== undefined ? body.tamanho : body.fileSize;
    if (tamanho === undefined || tamanho === null || Number(tamanho) <= 0) {
      return { isValid: false, error: 'tamanho do anexo é obrigatório e deve ser positivo.' };
    }
    return { isValid: true };
  },
});

// 7. Regras Preventivas de Manutenção (US10.1)
const regrasManutencaoSyncRouter = createSyncResourceRouter({
  tableName: 'regras_manutencao',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'tipo_servico',
    'nome',
    'intervalo_km',
    'intervalo_dias',
    'antecedencia_km',
    'antecedencia_dias',
    'ultima_troca_data',
    'ultima_troca_km',
    'ativo',
  ],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    const tipo = body.tipo_servico || body.serviceType;
    if (!tipo) return { isValid: false, error: 'tipo_servico é obrigatório.' };
    return { isValid: true };
  },
});

// 8. Custos Fixos Mensais (US23.1)
const custosFixosSyncRouter = createSyncResourceRouter({
  tableName: 'custos_fixos',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'descricao', 'valor_mensal'],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    const desc = body.descricao || body.description;
    if (!desc || !String(desc).trim()) {
      return { isValid: false, error: 'descricao é obrigatória.' };
    }
    const valor = body.valor_mensal !== undefined ? body.valor_mensal : body.monthlyAmount;
    if (valor === undefined || valor === null || Number(valor) <= 0) {
      return { isValid: false, error: 'valor_mensal deve ser maior que zero.' };
    }
    return { isValid: true };
  },
});

// 9. Registros de Pneu (US11.1)
const registrosPneuSyncRouter = createSyncResourceRouter({
  tableName: 'registros_pneu',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'data', 'km', 'tipo', 'pressao_psi', 'sulco_mm'],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    const tipo = body.tipo || body.type;
    if (!tipo || !['calibragem', 'troca'].includes(tipo)) {
      return { isValid: false, error: 'tipo deve ser calibragem ou troca.' };
    }
    const km = body.km;
    if (km === undefined || km === null || isNaN(Number(km)) || Number(km) <= 0) {
      return { isValid: false, error: 'km deve ser maior que zero.' };
    }
    const pressao = body.pressao_psi !== undefined ? body.pressao_psi : body.pressurePsi;
    if (pressao === undefined || pressao === null || Number(pressao) <= 0) {
      return { isValid: false, error: 'pressao_psi deve ser maior que zero.' };
    }
    const sulco = body.sulco_mm !== undefined ? body.sulco_mm : body.treadDepthMm;
    if (sulco !== undefined && sulco !== null && (isNaN(Number(sulco)) || Number(sulco) < 0)) {
      return { isValid: false, error: 'sulco_mm deve ser maior ou igual a zero.' };
    }
    return { isValid: true };
  },
});

// 10. Registros de Fluido (US11.1)
const registrosFluidoSyncRouter = createSyncResourceRouter({
  tableName: 'registros_fluido',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'tipo_fluido', 'data', 'km', 'nivel'],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    const tipoFluido = body.tipo_fluido || body.fluidType;
    if (!tipoFluido || !['oleo_motor', 'freio', 'radiador'].includes(tipoFluido)) {
      return {
        isValid: false,
        error: 'tipo_fluido deve ser oleo_motor, freio ou radiador.',
      };
    }
    const km = body.km;
    if (km === undefined || km === null || isNaN(Number(km)) || Number(km) <= 0) {
      return { isValid: false, error: 'km deve ser maior que zero.' };
    }
    return { isValid: true };
  },
});

// Monta rotas em português e inglês para conveniência
router.use('/veiculos', veiculosSyncRouter);
router.use('/vehicles', veiculosSyncRouter);

router.use('/abastecimentos', abastecimentosSyncRouter);
router.use('/refuels', abastecimentosSyncRouter);

router.use('/leituras_hodometro', hodometroSyncRouter);
router.use('/odometer', hodometroSyncRouter);

router.use('/despesas', despesasSyncRouter);
router.use('/expenses', despesasSyncRouter);

router.use('/manutencoes', manutencoesSyncRouter);
router.use('/maintenances', manutencoesSyncRouter);

router.use('/anexos', anexosSyncRouter);
router.use('/attachments', anexosSyncRouter);

router.use('/regras_manutencao', regrasManutencaoSyncRouter);
router.use('/maintenance_rules', regrasManutencaoSyncRouter);

router.use('/custos_fixos', custosFixosSyncRouter);
router.use('/fixed_costs', custosFixosSyncRouter);

router.use('/registros_pneu', registrosPneuSyncRouter);
router.use('/tire_records', registrosPneuSyncRouter);

router.use('/registros_fluido', registrosFluidoSyncRouter);
router.use('/fluid_records', registrosFluidoSyncRouter);

export default router;
