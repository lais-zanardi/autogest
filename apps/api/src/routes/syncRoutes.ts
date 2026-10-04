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

// Monta rotas em português e inglês para conveniência
router.use('/veiculos', veiculosSyncRouter);
router.use('/vehicles', veiculosSyncRouter);

router.use('/abastecimentos', abastecimentosSyncRouter);
router.use('/refuels', abastecimentosSyncRouter);

router.use('/leituras_hodometro', hodometroSyncRouter);
router.use('/odometer', hodometroSyncRouter);

router.use('/despesas', despesasSyncRouter);
router.use('/expenses', despesasSyncRouter);

export default router;
