import { Router } from 'express';
import { createSyncResourceRouter } from './syncResourceRouter';
import { createAuditSyncRouter } from './auditSyncRouter';
import { PrecosController } from '../controllers/precosController';

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
    'foto_capa_id',
  ],
  validatePayload: body => {
    if (!body.modelo && !body.model) return { isValid: false, error: 'Modelo é obrigatório.' };
    if (!body.placa && !body.plate) return { isValid: false, error: 'Placa é obrigatória.' };
    return { isValid: true };
  },
});

// 2. Abastecimentos (US05 / US02.1 / US27.1 / US07.1)
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
    'tipo_percurso',
    'nota',
    'viagem_id',
    'perfil_conducao',
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

// 4. Despesas (US22 / US02.1 / US07.1)
const despesasSyncRouter = createSyncResourceRouter({
  tableName: 'despesas',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'categoria',
    'valor',
    'data_hora',
    'descricao',
    'viagem_id',
    'subtipo_viagem',
  ],
  validatePayload: body => {
    const valor = body.valor !== undefined ? body.valor : body.amount;
    if (valor === undefined || valor === null || Number(valor) <= 0) {
      return { isValid: false, error: 'valor da despesa deve ser maior que zero.' };
    }
    return { isValid: true };
  },
});

// 5. Manutenções (US09.1 / US27.1)
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
    'oficina_id',
    'profissional',
    'tempo_execucao_min',
    'valor',
    'nota',
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

// 11. Auditoria Somente Inserção (US21.7)
const auditoriaSyncRouter = createAuditSyncRouter();
router.use('/auditoria', auditoriaSyncRouter);
router.use('/audit_logs', auditoriaSyncRouter);

// 12. Orçamentos Mensais por Veículo (US15.1)
export const orcamentosSyncRouter = createSyncResourceRouter({
  tableName: 'orcamentos',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'teto_mensal',
    'percentual_aviso',
    'aviso_enviado_mes',
    'critico_enviado_mes',
  ],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };

    const teto =
      body.teto_mensal !== undefined
        ? body.teto_mensal
        : body.monthlyLimitCents !== undefined
          ? body.monthlyLimitCents
          : body.tetoMensalCentavos;
    if (teto === undefined || teto === null || isNaN(Number(teto)) || Number(teto) <= 0) {
      return { isValid: false, error: 'teto_mensal deve ser um valor em centavos maior que zero.' };
    }

    const perc =
      body.percentual_aviso !== undefined ? body.percentual_aviso : body.warningPercentage;
    if (
      perc !== undefined &&
      perc !== null &&
      (isNaN(Number(perc)) || Number(perc) <= 0 || Number(perc) > 100)
    ) {
      return { isValid: false, error: 'percentual_aviso deve estar entre 1 e 100.' };
    }

    return { isValid: true };
  },
});

// 13. Etiquetas (US27.1)
export const etiquetasSyncRouter = createSyncResourceRouter({
  tableName: 'etiquetas',
  ownershipType: 'direct',
  allowedFields: ['nome'],
  validatePayload: body => {
    const nome = body.nome || body.name;
    if (!nome || !String(nome).trim()) {
      return { isValid: false, error: 'nome da etiqueta é obrigatório.' };
    }
    return { isValid: true };
  },
});

// 14. Registros Etiquetas (US27.1)
export const registrosEtiquetasSyncRouter = createSyncResourceRouter({
  tableName: 'registros_etiquetas',
  ownershipType: 'direct',
  allowedFields: ['etiqueta_id', 'tipo_registro', 'registro_id'],
  validatePayload: body => {
    const etId = body.etiqueta_id || body.tagId;
    if (!etId) return { isValid: false, error: 'etiqueta_id é obrigatório.' };
    const tipo = body.tipo_registro || body.recordType;
    if (!tipo || !['abastecimento', 'despesa', 'manutencao'].includes(tipo)) {
      return { isValid: false, error: 'tipo_registro inválido.' };
    }
    const regId = body.registro_id || body.recordId;
    if (!regId) return { isValid: false, error: 'registro_id é obrigatório.' };
    return { isValid: true };
  },
});

// 15. Viagens (US07.1)
export const viagensSyncRouter = createSyncResourceRouter({
  tableName: 'viagens',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'origem',
    'destino',
    'inicio_em',
    'fim_em',
    'km_inicio',
    'km_fim',
    'status',
  ],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    const origem = body.origem || body.origin;
    if (!origem || !String(origem).trim()) return { isValid: false, error: 'origem é obrigatória.' };
    const destino = body.destino || body.destination;
    if (!destino || !String(destino).trim()) return { isValid: false, error: 'destino é obrigatório.' };
    return { isValid: true };
  },
});

// 16. Metas de Eficiência (US08.1)
export const metasEficienciaSyncRouter = createSyncResourceRouter({
  tableName: 'metas_eficiencia',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'consumo_alvo_kml', 'ativa'],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    const alvo =
      body.consumo_alvo_kml !== undefined ? body.consumo_alvo_kml : body.targetKml;
    if (alvo === undefined || alvo === null || isNaN(Number(alvo)) || Number(alvo) <= 0) {
      return { isValid: false, error: 'consumo_alvo_kml deve ser um número maior que zero.' };
    }
    return { isValid: true };
  },
});

// 17. Consultas FIPE (US18.4)
export const consultasFipeSyncRouter = createSyncResourceRouter({
  tableName: 'consultas_fipe',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'codigo_fipe',
    'marca',
    'modelo',
    'ano_modelo',
    'combustivel',
    'mes_referencia',
    'valor_centavos',
    'consultado_em',
  ],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    const mes = body.mes_referencia || body.referenceMonth;
    if (!mes) return { isValid: false, error: 'mes_referencia é obrigatório.' };
    const valor = body.valor_centavos !== undefined ? body.valor_centavos : body.valueCentavos;
    if (valor === undefined || valor === null || Number(valor) <= 0) {
      return { isValid: false, error: 'valor_centavos deve ser maior que zero.' };
    }
    return { isValid: true };
  },
});

// 18. Agendamentos de Manutenção (US30.1)
export const agendamentosManutencaoSyncRouter = createSyncResourceRouter({
  tableName: 'agendamentos_manutencao',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'data',
    'hora_lembrete',
    'tipo_servico',
    'descricao',
    'status',
    'manutencao_id',
  ],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    const data = body.data || body.date;
    if (!data) return { isValid: false, error: 'data é obrigatória.' };
    const desc = body.descricao || body.description;
    if (!desc || !String(desc).trim()) return { isValid: false, error: 'descricao é obrigatória.' };
    return { isValid: true };
  },
});

router.use('/orcamentos', orcamentosSyncRouter);
router.use('/budgets', orcamentosSyncRouter);

router.use('/etiquetas', etiquetasSyncRouter);
router.use('/tags', etiquetasSyncRouter);

router.use('/registros_etiquetas', registrosEtiquetasSyncRouter);
router.use('/record_tags', registrosEtiquetasSyncRouter);

router.use('/viagens', viagensSyncRouter);
router.use('/trips', viagensSyncRouter);

router.use('/metas_eficiencia', metasEficienciaSyncRouter);
router.use('/efficiency_goals', metasEficienciaSyncRouter);

router.use('/consultas_fipe', consultasFipeSyncRouter);
router.use('/fipe_consultations', consultasFipeSyncRouter);

router.use('/agendamentos_manutencao', agendamentosManutencaoSyncRouter);
router.use('/maintenance_schedules', agendamentosManutencaoSyncRouter);

// 19. Preços de Combustível, Cache de Clima, Postos e Histórico Local — somente leitura (US17.1, US34.1, US35.1)
router.get('/precos_combustivel', PrecosController.listPrecosSync as any);
router.get('/cache_clima', PrecosController.listClimaSync as any);
router.get('/postos', PrecosController.listPostosSync as any);
router.get('/historico_precos_locais', PrecosController.listHistoricoPrecosSync as any);

// 20. Alertas de Preço-Limite (US35.1)
export const alertasPrecoSyncRouter = createSyncResourceRouter({
  tableName: 'alertas_preco',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'combustivel', 'preco_limite_centavos', 'ativo', 'disparado_em'],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    if (!body.combustivel) return { isValid: false, error: 'combustivel é obrigatório.' };
    const limite = Number(body.preco_limite_centavos);
    if (!Number.isFinite(limite) || limite <= 0) {
      return { isValid: false, error: 'preco_limite_centavos deve ser maior que zero.' };
    }
    return { isValid: true };
  },
});

router.use('/alertas_preco', alertasPrecoSyncRouter);
router.use('/price_alerts', alertasPrecoSyncRouter);

// 21. Oficinas Favoritas (US12.1)
export const oficinasSyncRouter = createSyncResourceRouter({
  tableName: 'oficinas',
  ownershipType: 'direct',
  allowedFields: [
    'nome',
    'telefone',
    'endereco',
    'latitude',
    'longitude',
    'favorita',
    'observacoes',
  ],
  validatePayload: body => {
    if (!body.nome || !String(body.nome).trim()) {
      return { isValid: false, error: 'nome da oficina é obrigatório.' };
    }
    return { isValid: true };
  },
});

// 22. Atendimentos de Oficina (US12.1)
export const atendimentosOficinaSyncRouter = createSyncResourceRouter({
  tableName: 'atendimentos_oficina',
  ownershipType: 'direct',
  allowedFields: ['oficina_id', 'manutencao_id', 'data'],
  validatePayload: body => {
    if (!body.oficina_id) return { isValid: false, error: 'oficina_id é obrigatório.' };
    if (!body.manutencao_id) return { isValid: false, error: 'manutencao_id é obrigatório.' };
    if (!body.data) return { isValid: false, error: 'data é obrigatória.' };
    return { isValid: true };
  },
});

router.use('/oficinas', oficinasSyncRouter);
router.use('/workshops', oficinasSyncRouter);

router.use('/atendimentos_oficina', atendimentosOficinaSyncRouter);
router.use('/workshop_visits', atendimentosOficinaSyncRouter);

// 23. Locais Visitados (US36.1)
export const locaisVisitadosSyncRouter = createSyncResourceRouter({
  tableName: 'locais_visitados',
  ownershipType: 'direct',
  allowedFields: ['tipo', 'referencia_id', 'nome', 'latitude', 'longitude', 'data'],
  validatePayload: body => {
    if (!body.tipo || !['posto', 'oficina'].includes(body.tipo)) {
      return { isValid: false, error: 'tipo deve ser posto ou oficina.' };
    }
    if (!body.referencia_id) {
      return { isValid: false, error: 'referencia_id é obrigatório.' };
    }
    if (
      body.latitude === undefined ||
      body.latitude === null ||
      body.longitude === undefined ||
      body.longitude === null ||
      !Number.isFinite(Number(body.latitude)) ||
      !Number.isFinite(Number(body.longitude))
    ) {
      return { isValid: false, error: 'latitude e longitude válidas são obrigatórias.' };
    }
    return { isValid: true };
  },
});

router.use('/locais_visitados', locaisVisitadosSyncRouter);
router.use('/visited_places', locaisVisitadosSyncRouter);

// 24. Simulações Financeiras (US16.6)
export const simulacoesSyncRouter = createSyncResourceRouter({
  tableName: 'simulacoes',
  ownershipType: 'direct',
  allowedFields: ['tipo', 'entradas', 'resultado'],
  validatePayload: body => {
    if (
      !body.tipo ||
      !['etanol_gasolina', 'economia_potencial', 'custo_viagem'].includes(body.tipo)
    ) {
      return { isValid: false, error: 'tipo de simulação inválido.' };
    }
    if (!body.entradas || typeof body.entradas !== 'object') {
      return { isValid: false, error: 'entradas (JSON) são obrigatórias.' };
    }
    if (!body.resultado || typeof body.resultado !== 'object') {
      return { isValid: false, error: 'resultado (JSON) é obrigatório.' };
    }
    return { isValid: true };
  },
});

router.use('/simulacoes', simulacoesSyncRouter);
router.use('/simulations', simulacoesSyncRouter);

// 25. Lembretes de Inspeção Visual (US31.1)
export const lembretesInspecaoSyncRouter = createSyncResourceRouter({
  tableName: 'lembretes_inspecao',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'item', 'periodicidade_dias', 'ultima_inspecao_em', 'ativo'],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    if (!body.item || !String(body.item).trim()) {
      return { isValid: false, error: 'item de inspeção é obrigatório.' };
    }
    const dias = Number(body.periodicidade_dias);
    if (!Number.isFinite(dias) || dias <= 0) {
      return { isValid: false, error: 'periodicidade_dias deve ser maior que zero.' };
    }
    return { isValid: true };
  },
});

// 26. Ciclos de Inspeção Visual (US31.1)
export const ciclosInspecaoSyncRouter = createSyncResourceRouter({
  tableName: 'ciclos_inspecao',
  ownershipType: 'direct',
  allowedFields: ['lembrete_id', 'disparado_em', 'ultimo_disparo_em', 'tentativas', 'concluido_em'],
  validatePayload: body => {
    if (!body.lembrete_id) return { isValid: false, error: 'lembrete_id é obrigatório.' };
    if (!body.disparado_em) return { isValid: false, error: 'disparado_em é obrigatório.' };
    return { isValid: true };
  },
});

router.use('/lembretes_inspecao', lembretesInspecaoSyncRouter);
router.use('/inspection_reminders', lembretesInspecaoSyncRouter);

router.use('/ciclos_inspecao', ciclosInspecaoSyncRouter);
router.use('/inspection_cycles', ciclosInspecaoSyncRouter);

// 27. Fotos do Veículo (US32.1)
export const fotosVeiculoSyncRouter = createSyncResourceRouter({
  tableName: 'fotos_veiculo',
  ownershipType: 'via_vehicle',
  allowedFields: [
    'veiculo_id',
    'data',
    'legenda',
    'arquivo_local',
    'url_gcs',
    'tamanho_bytes',
    'mime_type',
    'status_upload',
  ],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    if (!body.data) return { isValid: false, error: 'data é obrigatória.' };
    const tamanho = Number(body.tamanho_bytes);
    if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > 1048576) {
      return { isValid: false, error: 'tamanho_bytes deve estar entre 1 e 1048576 bytes (1 MB).' };
    }
    return { isValid: true };
  },
});

router.use('/fotos_veiculo', fotosVeiculoSyncRouter);
router.use('/vehicle_photos', fotosVeiculoSyncRouter);

// 28. Perfis de Condução (US29.1)
export const perfisConducaoSyncRouter = createSyncResourceRouter({
  tableName: 'perfis_conducao',
  ownershipType: 'via_vehicle',
  allowedFields: ['veiculo_id', 'perfil_conducao', 'definido_em'],
  validatePayload: body => {
    const vId = body.veiculo_id || body.vehicleId;
    if (!vId) return { isValid: false, error: 'veiculo_id é obrigatório.' };
    if (
      !body.perfil_conducao ||
      !['economico', 'normal', 'agressivo'].includes(body.perfil_conducao)
    ) {
      return { isValid: false, error: 'perfil_conducao deve ser economico, normal ou agressivo.' };
    }
    return { isValid: true };
  },
});

router.use('/perfis_conducao', perfisConducaoSyncRouter);
router.use('/driving_profiles', perfisConducaoSyncRouter);

// 29. Preferências de Resumo Mensal por E-mail (US37.1)
export const preferenciasResumoSyncRouter = createSyncResourceRouter({
  tableName: 'preferencias_resumo',
  ownershipType: 'direct',
  allowedFields: ['receber_resumo', 'email_destino'],
  validatePayload: body => {
    if (body.receber_resumo && (!body.email_destino || !String(body.email_destino).includes('@'))) {
      return { isValid: false, error: 'email_destino válido é obrigatório ao ativar o resumo.' };
    }
    return { isValid: true };
  },
});

router.use('/preferencias_resumo', preferenciasResumoSyncRouter);
router.use('/summary_preferences', preferenciasResumoSyncRouter);

export default router;
