/**
 * AutoGest - Tipos e Interfaces Compartilhados
 */

export type FuelType = 'Gasolina' | 'Etanol' | 'Diesel' | 'GNV' | 'Flex';

export interface User {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  name?: string;
  brand?: string;
  model: string;
  year: number;
  plate: string;
  fuelType: FuelType;
  tankCapacityL: number;
  preferredFuel: FuelType;
  initialOdometer: number;
  currentOdometer: number;
  fipeValue?: number | null;
  coverPhotoId?: string | null;
  foto_capa_id?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateVehicleDTO {
  name?: string;
  brand?: string;
  model: string;
  year: number;
  plate: string;
  fuelType?: FuelType;
  tankCapacityL: number;
  preferredFuel: FuelType;
  initialOdometer?: number;
}

export interface UpdateVehicleDTO {
  name?: string;
  brand?: string;
  model?: string;
  year?: number;
  plate?: string;
  fuelType?: FuelType;
  tankCapacityL?: number;
  preferredFuel?: FuelType;
  initialOdometer?: number;
  currentOdometer?: number;
  fipeValue?: number | null;
  coverPhotoId?: string | null;
  foto_capa_id?: string | null;
}

export type RouteType = 'urbano' | 'rodoviario' | 'misto';

export interface Refuel {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  fuelType: FuelType;
  pricePerLiter: number;
  totalValue: number;
  liters: number;
  isFullTank: boolean;
  calculatedKml?: number | null;
  receiptImageUrl?: string | null;
  stationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  routeType?: RouteType | null;
  notes?: string | null;
  tipo_percurso?: RouteType | null;
  nota?: string | null;
  tripId?: string | null;
  viagem_id?: string | null;
  drivingProfile?: DrivingProfileType | null;
  perfil_conducao?: DrivingProfileType | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateRefuelDTO {
  vehicleId: string;
  date: string;
  odometer: number;
  fuelType: FuelType;
  pricePerLiter: number;
  totalValue: number;
  liters: number;
  isFullTank: boolean;
  receiptImageUrl?: string | null;
  stationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  routeType?: RouteType | null;
  notes?: string | null;
  tipo_percurso?: RouteType | null;
  nota?: string | null;
  tripId?: string | null;
  viagem_id?: string | null;
  drivingProfile?: DrivingProfileType | null;
  perfil_conducao?: DrivingProfileType | null;
}

export interface UpdateRefuelDTO {
  date?: string;
  odometer?: number;
  fuelType?: FuelType;
  pricePerLiter?: number;
  totalValue?: number;
  liters?: number;
  isFullTank?: boolean;
  receiptImageUrl?: string | null;
  stationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  routeType?: RouteType | null;
  notes?: string | null;
  tipo_percurso?: RouteType | null;
  nota?: string | null;
  tripId?: string | null;
  viagem_id?: string | null;
}

export type OdometerReadingOrigin = 'abastecimento' | 'manual' | 'manutencao';

export interface OdometerReading {
  id: string;
  vehicleId: string;
  km: number;
  date: string;
  origin: OdometerReadingOrigin;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateOdometerReadingDTO {
  vehicleId: string;
  km: number;
  date?: string;
  origin: OdometerReadingOrigin;
}

export type ExpenseCategory =
  'Combustível' | 'Manutenção' | 'Seguro' | 'Imposto' | 'Lavagem' | 'Outros';

export const MANUAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Seguro',
  'Imposto',
  'Lavagem',
  'Outros',
];

export type TripSubtype =
  | 'pedagio'
  | 'alimentacao'
  | 'hospedagem'
  | 'estacionamento'
  | 'outros';

export interface Expense {
  id: string;
  vehicleId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description?: string | null;
  tripId?: string | null;
  viagem_id?: string | null;
  subtipoViagem?: TripSubtype | null;
  subtipo_viagem?: TripSubtype | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateExpenseDTO {
  vehicleId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description?: string | null;
  tripId?: string | null;
  viagem_id?: string | null;
  subtipoViagem?: TripSubtype | null;
  subtipo_viagem?: TripSubtype | null;
}

export interface UpdateExpenseDTO {
  category?: ExpenseCategory;
  amount?: number;
  date?: string;
  description?: string | null;
  tripId?: string | null;
  viagem_id?: string | null;
  subtipoViagem?: TripSubtype | null;
  subtipo_viagem?: TripSubtype | null;
}

export interface WeatherLog {
  id: string;
  refuelId: string;
  latitude: number;
  longitude: number;
  temperatureCelsius: number;
  condition: string;
  humidity?: number | null;
  createdAt: string;
}

export interface FuelPriceANP {
  id: string;
  state: string;
  city: string;
  fuelType: FuelType;
  avgPriceAnp: number;
  referenceDate: string;
}

export interface FipeQueryResult {
  brand: string;
  model: string;
  modelYear: number;
  fuel: string;
  fipeCode: string;
  referenceMonth: string;
  value: string;
  numericValue: number;
}

export interface OCRScanResult {
  stationName?: string;
  fuelType?: FuelType;
  liters?: number;
  pricePerLiter?: number;
  totalValue?: number;
  date?: string;
  confidenceScore: number;
}

export interface DashboardStats {
  totalSpent: number;
  totalDistance: number;
  averageKml: number;
  totalRefuels: number;
  costPerKm: number | null;
  fuelDistribution: Record<FuelType, number>;
}

export interface DashboardIndicators {
  vehicleId: string;
  monthTotalSpent: number;
  averageCostPerKm: number | null;
  averageConsumptionKml: number;
  totalMileageKm: number;
  projectedAutonomyKm: number;
  nextMaintenance: MaintenanceAlert | null;
  activeAlertsCount: number;
  hasData: boolean;
  loadDurationMs: number;
  updatedAt: string;
}

export type MaintenanceType = 'preventiva' | 'corretiva';

export type MaintenanceServiceType =
  | 'troca_oleo'
  | 'calibragem_pneus'
  | 'fluido_freio'
  | 'agua_radiador'
  | 'filtros'
  | 'correia_dentada'
  | 'velas'
  | 'pneus'
  | 'freios'
  | 'outros';

export type AttachmentUploadStatus = 'pendente' | 'enviado' | 'erro';

export interface MaintenanceAttachment {
  id: string;
  maintenanceId?: string | null;
  localPath: string;
  gcsUrl?: string | null;
  fileSize: number;
  mimeType?: string | null;
  uploadStatus: AttachmentUploadStatus;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Maintenance {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  type: MaintenanceType;
  serviceType: MaintenanceServiceType;
  description: string;
  replacedParts?: string | null;
  workshop?: string | null;
  workshopId?: string | null;
  oficina_id?: string | null;
  mechanic?: string | null;
  executionTimeMin?: number | null;
  totalValue: number;
  notes?: string | null;
  nota?: string | null;
  attachments?: MaintenanceAttachment[];
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateMaintenanceDTO {
  vehicleId: string;
  date: string;
  odometer: number;
  type: MaintenanceType;
  serviceType: MaintenanceServiceType;
  description: string;
  replacedParts?: string | null;
  workshop?: string | null;
  workshopId?: string | null;
  oficina_id?: string | null;
  mechanic?: string | null;
  executionTimeMin?: number | null;
  totalValue: number;
  notes?: string | null;
  nota?: string | null;
  attachmentIds?: string[];
}

export interface UpdateMaintenanceDTO {
  date?: string;
  odometer?: number;
  type?: MaintenanceType;
  serviceType?: MaintenanceServiceType;
  description?: string;
  replacedParts?: string | null;
  workshop?: string | null;
  workshopId?: string | null;
  oficina_id?: string | null;
  mechanic?: string | null;
  executionTimeMin?: number | null;
  totalValue?: number;
  notes?: string | null;
  nota?: string | null;
  attachmentIds?: string[];
}

export interface UploadUrlRequestDTO {
  nomeArquivo: string;
  tipoMime: string;
  tamanhoBytes: number;
  manutencaoId?: string;
}

export interface UploadUrlResponseDTO {
  uploadUrl: string;
  publicUrl: string;
  gcsPath: string;
  expiresIn: number;
}

export interface MaintenanceRule {
  id: string;
  vehicleId: string;
  userId?: string;
  serviceType: MaintenanceServiceType;
  name?: string;
  intervalKm?: number | null;
  intervalDays?: number | null;
  advanceKm: number;
  advanceDays: number;
  lastServiceDate?: string | null;
  lastServiceKm?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateMaintenanceRuleDTO {
  vehicleId: string;
  userId?: string;
  serviceType: MaintenanceServiceType;
  name?: string;
  intervalKm?: number | null;
  intervalDays?: number | null;
  advanceKm?: number;
  advanceDays?: number;
  lastServiceDate?: string | null;
  lastServiceKm?: number | null;
  active?: boolean;
}

export interface UpdateMaintenanceRuleDTO {
  serviceType?: MaintenanceServiceType;
  name?: string;
  intervalKm?: number | null;
  intervalDays?: number | null;
  advanceKm?: number;
  advanceDays?: number;
  lastServiceDate?: string | null;
  lastServiceKm?: number | null;
  active?: boolean;
}

export type MaintenanceAlertStatus = 'ok' | 'proximo' | 'vencido';

export interface MaintenanceDueCalculation {
  status: MaintenanceAlertStatus;
  vencePorKm: boolean;
  vencePorDias: boolean;
  baseKm: number;
  baseDate: string;
  targetKm?: number | null;
  remainingKm?: number | null;
  targetDate?: string | null;
  remainingDays?: number | null;
  estimatedDateByKm?: string | null;
  reason?: string;
}

export interface MaintenanceAlert {
  id: string;
  ruleId: string;
  vehicleId: string;
  serviceType: MaintenanceServiceType;
  serviceName: string;
  status: 'proximo' | 'vencido';
  vencePorKm: boolean;
  vencePorDias: boolean;
  targetKm?: number | null;
  remainingKm?: number | null;
  targetDate?: string | null;
  remainingDays?: number | null;
  estimatedDateByKm?: string | null;
  message: string;
}

export type IndicatorPeriodPreset =
  | 'mes_atual'
  | 'mes_anterior'
  | 'personalizado'
  | 'ultimos_30_dias'
  | 'ultimos_90_dias'
  | 'ano_atual';

export type ExpenseCategoryChartName = ExpenseCategory | 'Custos fixos' | 'Impostos' | string;

export interface CategoryDistributionItem {
  id: string;
  categoria: ExpenseCategoryChartName;
  label: string;
  valor: number;
  value: number;
  valueCents: number;
  percentual: number;
  percentage: number;
  cor: string;
  color: string;
  valorFormatado: string;
  formattedValue: string;
}

export interface CategoryDistributionResult {
  total: number;
  somaPercentuais: number;
  itens: CategoryDistributionItem[];
}

export interface UsageIndicators {
  kmRodados: number;
  diasNoPeriodo: number;
  kmPorDia: number;
  kmPorSemana: number;
  kmPorMes: number;
  possuiKmRodado: boolean;
}

export interface CostPerKmIndicators {
  custoTotal: number;
  custoCombustivel: number;
  custoManutencaoTotal: number;
  custoManutencaoPreventiva: number;
  custoManutencaoCorretiva: number;
  custoOutrasDespesas: number;
  custoFixoProporcional: number;
  custoKmTotal: number | null;
  custoKmCombustivel: number | null;
  custoKmManutencaoTotal: number | null;
  custoKmManutencaoPreventiva: number | null;
  custoKmManutencaoCorretiva: number | null;
}

export interface UsageAndCostIndicators {
  inicio: string;
  fim: string;
  uso: UsageIndicators;
  custo: CostPerKmIndicators;
  semDados: boolean;
  semKmRodado: boolean;
}

export interface FixedCost {
  id: string;
  vehicleId: string;
  description: string;
  monthlyAmount: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateFixedCostDTO {
  vehicleId: string;
  description: string;
  monthlyAmount: number;
}

export interface UpdateFixedCostDTO {
  description?: string;
  monthlyAmount?: number;
}

export type TireRecordType = 'calibragem' | 'troca';

export interface TireRecord {
  id: string;
  vehicleId: string;
  date: string;
  km: number;
  type: TireRecordType;
  pressurePsi: number;
  treadDepthMm?: number | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateTireRecordDTO {
  vehicleId: string;
  date: string;
  km: number;
  type: TireRecordType;
  pressurePsi: number;
  treadDepthMm?: number | null;
}

export interface UpdateTireRecordDTO {
  date?: string;
  km?: number;
  type?: TireRecordType;
  pressurePsi?: number;
  treadDepthMm?: number | null;
}

export type FluidType = 'oleo_motor' | 'freio' | 'radiador';

export type FluidLevel = 'normal' | 'baixo';

export interface FluidRecord {
  id: string;
  vehicleId: string;
  fluidType: FluidType;
  date: string;
  km: number;
  level: FluidLevel;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CreateFluidRecordDTO {
  vehicleId: string;
  fluidType: FluidType;
  date: string;
  km: number;
  level?: FluidLevel;
}

export interface UpdateFluidRecordDTO {
  fluidType?: FluidType;
  date?: string;
  km?: number;
  level?: FluidLevel;
}

/**
 * US21 — Trilha de Auditoria e Backup Local (.agbak)
 */
export type AuditEntityName =
  | 'veiculos'
  | 'abastecimentos'
  | 'despesas'
  | 'manutencoes'
  | 'custos_fixos'
  | 'orcamentos'
  | 'backup';

export type AuditAction =
  'criacao' | 'edicao' | 'exclusao' | 'geracao_backup' | 'restauracao_backup';

export interface AuditChanges {
  antes: Record<string, any> | null;
  depois: Record<string, any> | null;
}

export interface AuditLogRecord {
  id: string;
  usuario_id: string;
  entidade: AuditEntityName;
  entidade_id: string;
  acao: AuditAction;
  alteracoes: AuditChanges;
  data_hora: string;
  criado_em?: string;
}

export interface CreateAuditLogDTO {
  id?: string;
  usuario_id?: string;
  entidade: AuditEntityName;
  entidade_id: string;
  acao: AuditAction;
  alteracoes: AuditChanges;
  data_hora?: string;
}

export interface BackupPayload {
  versao_schema: number;
  usuario_id: string;
  gerado_em: string;
  entidades: Record<string, any[]>;
}

/**
 * US15 — Alertas de Teto Orçamentário Mensal
 */
export const DEFAULT_BUDGET_WARNING_PERCENTAGE = 80;

export type BudgetAlertLevel = 'normal' | 'aviso' | 'critico';

export interface BudgetEvaluationResult {
  percentual: number;
  nivel: BudgetAlertLevel;
  mensagem: string;
}

export interface VehicleBudget {
  id: string;
  vehicleId: string;
  veiculo_id?: string;
  /** Teto mensal em centavos (ex.: 100000 = R$ 1.000,00) */
  teto_mensal: number;
  monthlyLimitCents: number;
  /** Percentual de aviso (padrão 80) */
  percentual_aviso: number;
  warningPercentage: number;
  /** Mês em que o alerta de aviso já foi enviado ('AAAA-MM' ou null) */
  aviso_enviado_mes: string | null;
  warningSentMonth: string | null;
  /** Mês em que o alerta crítico já foi enviado ('AAAA-MM' ou null) */
  critico_enviado_mes: string | null;
  criticalSentMonth: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  excluido_em?: string | null;
}

export interface UpsertBudgetDTO {
  vehicleId: string;
  /** Valor do teto mensal em centavos (ex.: 100000 para R$ 1.000,00) */
  tetoMensalCentavos?: number;
  /** Alternativa em reais (convertida para centavos automaticamente) */
  tetoMensalReais?: number;
  percentualAviso?: number;
}

export interface BudgetStatusSummary {
  budget: VehicleBudget;
  gastoMesReais: number;
  gastoMesCentavos: number;
  tetoMensalReais: number;
  tetoMensalCentavos: number;
  percentual: number;
  nivel: BudgetAlertLevel;
  mensagem: string;
  mesReferencia: string;
  notificacaoDisparada: boolean;
  bannerMudancaNivel?: {
    nivel: BudgetAlertLevel;
    percentual: number;
    mensagem: string;
  } | null;
}

/**
 * US39 — Configurações: Unidade de Consumo e Pausa de Notificações
 */
export type ConsumptionUnit = 'km/l' | 'L/100 km';

export interface UserPreferences {
  unidade_consumo_principal: ConsumptionUnit;
  notificacoes_pausadas_ate: string | null;
  combustivel_principal?: FuelType;
  municipio_padrao?: string;
}

export interface FormattedConsumptionResult {
  principal: string;
  secundario: string;
  textoCompleto: string;
  vazio: boolean;
  kml: number | null;
  lPor100Km: number | null;
  unidadePrincipal: ConsumptionUnit;
}

export interface ScheduledNotificationRecord {
  id: string;
  title: string;
  body: string;
  triggerAt: string;
  channelId: string;
  importance: 'high' | 'default';
  status: 'agendada' | 'cancelada' | 'disparada';
  sourceType?: 'regra_manutencao' | 'agendamento' | 'outro';
  sourceId?: string;
  vehicleId?: string;
  data?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationReconciliationResult {
  agendadasAtivas: ScheduledNotificationRecord[];
  alertasVencidos: MaintenanceAlert[];
  pausaEncerrada: boolean;
  notificacaoResumoId?: string;
}

// US27: Etiquetas e Contexto do Registro
export type RecordType = 'abastecimento' | 'despesa' | 'manutencao';

export interface Tag {
  id: string;
  userId?: string;
  usuario_id?: string;
  name: string;
  nome?: string;
  createdAt?: string;
  criado_em?: string;
  updatedAt?: string;
  atualizado_em?: string;
  deletedAt?: string | null;
  excluido_em?: string | null;
}

export interface CreateTagDTO {
  name: string;
  nome?: string;
  userId?: string;
  usuario_id?: string;
}

export interface RecordTag {
  id: string;
  userId?: string;
  usuario_id?: string;
  tagId: string;
  etiqueta_id?: string;
  recordType: RecordType;
  tipo_registro?: RecordType;
  recordId: string;
  registro_id?: string;
  createdAt?: string;
  criado_em?: string;
  updatedAt?: string;
  atualizado_em?: string;
  deletedAt?: string | null;
  excluido_em?: string | null;
}

export interface CreateRecordTagDTO {
  tagId: string;
  recordType: RecordType;
  recordId: string;
  userId?: string;
}

export interface ConsumptionByRouteTypeItem {
  tipo: RouteType | 'nao_informado';
  rotulo: string;
  mediaKml: number;
  totalRegistros: number;
}

export interface ConsumptionByRouteTypeSummary {
  urbano: ConsumptionByRouteTypeItem;
  rodoviario: ConsumptionByRouteTypeItem;
  misto: ConsumptionByRouteTypeItem;
  naoInformado: ConsumptionByRouteTypeItem;
}

// US33: Busca e Filtros Avançados
export interface UnifiedRecord {
  id: string;
  vehicleId: string;
  date: string;
  recordType: RecordType;
  title: string;
  category?: string | null;
  amount: number;
  odometer?: number | null;
  description?: string | null;
  notes?: string | null;
  workshop?: string | null;
  parts?: string | null;
  routeType?: RouteType | null;
  rawRecord?: any;
}

export interface SearchFilters {
  vehicleId?: string;
  dataInicio?: string | null;
  dataFim?: string | null;
  recordType?: RecordType | 'todos' | null;
  category?: string | null;
  valorMin?: number | null;
  valorMax?: number | null;
  kmMin?: number | null;
  kmMax?: number | null;
  texto?: string | null;
  tagId?: string | null;
  routeType?: RouteType | 'sem_tipo' | 'todos' | null;
}

export interface SearchPaginationOptions {
  page?: number;
  limit?: number;
}

export interface SearchResultPage {
  records: UnifiedRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

// US07: Modo Viagem com Origem e Destino
export type TripStatus = 'em_andamento' | 'finalizada' | 'cancelada';

export interface Trip {
  id: string;
  vehicleId: string;
  veiculo_id?: string;
  origin: string;
  origem?: string;
  destination: string;
  destino?: string;
  startDate: string;
  inicio_em?: string;
  endDate?: string | null;
  fim_em?: string | null;
  startOdometer: number;
  km_inicio?: number;
  endOdometer?: number | null;
  km_fim?: number | null;
  status: TripStatus;
  createdAt: string;
  criado_em?: string;
  updatedAt?: string;
  atualizado_em?: string;
  deletedAt?: string | null;
  excluido_em?: string | null;
}

export interface CreateTripDTO {
  vehicleId: string;
  origin: string;
  destination: string;
  startDate?: string;
  startOdometer?: number;
}

export interface UpdateTripDTO {
  origin?: string;
  destination?: string;
  startDate?: string;
  endDate?: string | null;
  startOdometer?: number;
  endOdometer?: number | null;
  status?: TripStatus;
}

export interface TripSummary {
  distanciaKm: number | null;
  totalLitros: number;
  rendimentoKml: number | null;
  custoCombustivel: number;
  custoDespesas: number;
  custoTotal: number;
  custoPorKm: number | null;
  custoPorSubtipo: Record<TripSubtype, number>;
  totalAbastecimentos: number;
  totalDespesas: number;
}

// US08: Metas de Eficiência e Recomendações
export type GoalSituation = 'atingida' | 'abaixo' | 'sem_dados';

export interface EfficiencyGoal {
  id: string;
  vehicleId: string;
  veiculo_id?: string;
  targetKml: number;
  consumo_alvo_kml?: number;
  active: boolean;
  ativa?: boolean;
  createdAt: string;
  criado_em?: string;
  updatedAt?: string;
  atualizado_em?: string;
  deletedAt?: string | null;
  excluido_em?: string | null;
}

export interface CreateEfficiencyGoalDTO {
  vehicleId: string;
  targetKml: number;
}

export interface GoalStatusResult {
  progresso: number;
  situacao: GoalSituation;
  percentual: number;
}

export interface DrivingProfile {
  tipoPercursoPredominante: RouteType | 'misto';
  situacaoMeta: GoalSituation;
  consumoMedioKml: number | null;
  metaConsumoKml: number | null;
  temAnomalia: boolean;
  calibragemPneusAtrasada: boolean;
}

export interface EcoTipCondition {
  percurso?: RouteType | 'misto';
  situacaoMeta?: GoalSituation;
  calibragemAtrasada?: boolean;
  temAnomalia?: boolean;
}

export interface EcoTip {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: number; // 1 (alta) a 3 (geral)
  condicao: EcoTipCondition;
}

export interface EcoTipsCatalog {
  versao: number;
  dicas: EcoTip[];
}

/**
 * US18: Tabela FIPE e Depreciação de Mercado
 */
export interface FipeBrand {
  codigo: string;
  nome: string;
}

export interface FipeModel {
  codigo: string;
  nome: string;
}

export interface FipeYear {
  codigo: string;
  nome: string;
}

export interface FipePriceQuote {
  codigoFipe: string;
  marca: string;
  modelo: string;
  anoModelo: number;
  combustivel: string;
  siglaCombustivel: string;
  valorFormatado: string;
  valorCentavos: number;
  mesReferenciaTexto: string;
  mesReferenciaIso: string;
}

export interface FipeConsultation {
  id: string;
  vehicleId: string;
  veiculo_id?: string;
  fipeCode: string;
  codigo_fipe?: string;
  brand: string;
  marca?: string;
  model: string;
  modelo?: string;
  modelYear: number;
  ano_modelo?: number;
  fuel: string;
  combustivel?: string;
  referenceMonth: string; // "2026-11"
  mes_referencia?: string;
  valueCentavos: number;
  valor_centavos?: number;
  consultedAt: string;
  consultado_em?: string;
  createdAt: string;
  criado_em?: string;
  updatedAt: string;
  atualizado_em?: string;
  deletedAt?: string | null;
  excluido_em?: string | null;
}

export interface CreateFipeConsultationDTO {
  vehicleId: string;
  fipeCode: string;
  brand: string;
  model: string;
  modelYear: number;
  fuel: string;
  referenceMonth: string;
  valueCentavos: number;
  consultedAt?: string;
}

export interface FipeDepreciationResult {
  valorInicialCentavos: number;
  valorAtualCentavos: number;
  dataInicial: string;
  dataAtual: string;
  variacaoReais: number; // ex: -5000.00
  variacaoPercentual: number; // ex: -10.0 (%)
  variacaoAnualizadaPercentual: number | null; // só preenchido quando intervalo >= 90 dias
  mesesDecorridos: number;
  diasDecorridos: number;
}

/**
 * US30: Agendamento de Manutenções Futuras
 */
export type MaintenanceScheduleStatus = 'agendado' | 'concluido' | 'cancelado';

export interface MaintenanceSchedule {
  id: string;
  vehicleId: string;
  veiculo_id?: string;
  date: string; // "AAAA-MM-DD"
  data?: string;
  reminderTime: string; // "HH:mm", padrão "09:00"
  hora_lembrete?: string;
  serviceType: MaintenanceServiceType;
  tipo_servico?: MaintenanceServiceType;
  description: string;
  descricao?: string;
  status: MaintenanceScheduleStatus;
  maintenanceId?: string | null;
  manutencao_id?: string | null;
  createdAt: string;
  criado_em?: string;
  updatedAt: string;
  atualizado_em?: string;
  deletedAt?: string | null;
  excluido_em?: string | null;
}

export interface CreateMaintenanceScheduleDTO {
  vehicleId: string;
  date: string; // "AAAA-MM-DD"
  reminderTime?: string; // padrão "09:00"
  serviceType: MaintenanceServiceType;
  description: string;
}

export interface UpdateMaintenanceScheduleDTO {
  date?: string;
  reminderTime?: string;
  serviceType?: MaintenanceServiceType;
  description?: string;
  status?: MaintenanceScheduleStatus;
  maintenanceId?: string | null;
}

/**
 * US17: Monitoramento de Preços ANP e Clima
 */
export type PriceGranularity = 'municipal' | 'posto';

export interface FuelPriceRecord {
  id: string;
  municipio: string;
  uf: string;
  combustivel: FuelType | string;
  preco_centavos: number;
  data_coleta: string; // "AAAA-MM-DD"
  fonte: string;
  granularidade: PriceGranularity;
  sincronizado_em: string;
}

export interface WeatherCacheRecord {
  id: string;
  municipio: string;
  uf?: string | null;
  data: string; // "AAAA-MM-DD"
  temperatura_atual?: number | null;
  temperatura_min: number;
  temperatura_max: number;
  condicao: string;
  expira_em: string; // ISO 8601
}

export interface RegionalPriceHistoryPoint {
  data_coleta: string; // "AAAA-MM-DD"
  preco_centavos: number;
}

export interface RegionalPricesResponse {
  municipio: string;
  uf: string;
  combustivel: string;
  preco_medio_centavos: number;
  data_coleta: string;
  fonte: string;
  granularidade: PriceGranularity;
  aviso_granularidade: string | null;
  historico_semana: RegionalPriceHistoryPoint[];
  clima?: WeatherCacheRecord | null;
}

/**
 * US34: Postos Mais Baratos por GPS
 */
export interface FuelStationRecord {
  id: string;
  nome: string;
  bandeira: string;
  latitude: number;
  longitude: number;
  municipio: string;
  uf: string;
  endereco?: string | null;
  /** Preços por combustível em centavos (opcional; fallback para média municipal US17) */
  precos_centavos?: Record<string, number>;
  sincronizado_em?: string;
}

export interface RankedFuelStation extends FuelStationRecord {
  combustivel: string;
  preco_centavos: number;
  distancia_km: number | null;
  fonte_preco: 'posto' | 'media_municipal';
}

/**
 * US35: Histórico de Preços e Alerta de Preço-Limite
 */
export interface LocalPriceHistoryRecord {
  id: string;
  municipio: string;
  combustivel: FuelType | string;
  preco_centavos: number;
  data_coleta: string; // "AAAA-MM-DD"
  criado_em?: string;
  atualizado_em?: string;
}

export interface PriceAlertRecord {
  id: string;
  veiculo_id: string;
  vehicleId?: string;
  combustivel: FuelType | string;
  preco_limite_centavos: number;
  ativo: boolean;
  disparado_em: string | null;
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

export type PriceTrendDirection = 'alta' | 'queda' | 'estavel' | 'dados_insuficientes';

export interface PriceTrendSummary {
  periodoDias: 30 | 90;
  direcao: PriceTrendDirection;
  pontos: LocalPriceHistoryRecord[];
  precoInicialCentavos: number | null;
  precoAtualCentavos: number | null;
  variacaoCentavos: number;
  variacaoPercentual: number;
}

/**
 * US12: Diretório de Oficinas Favoritas
 */
export interface WorkshopRecord {
  id: string;
  nome: string;
  telefone?: string | null;
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  favorita: boolean;
  observacoes?: string | null;
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

export interface CreateWorkshopDTO {
  nome: string;
  telefone?: string | null;
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  favorita?: boolean;
  observacoes?: string | null;
}

export interface UpdateWorkshopDTO {
  nome?: string;
  telefone?: string | null;
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  favorita?: boolean;
  observacoes?: string | null;
}

export interface WorkshopVisitRecord {
  id: string;
  oficina_id: string;
  manutencao_id: string;
  data: string; // "AAAA-MM-DD"
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

export interface WorkshopVisitDetail extends WorkshopVisitRecord {
  descricaoManutencao: string;
  tipoServico: string;
  valorReais: number;
}

export interface WorkshopDetailSummary {
  oficina: WorkshopRecord;
  atendimentos: WorkshopVisitDetail[];
  totalGastoReais: number;
}

/**
 * US36: Mapa de Postos e Oficinas Visitados
 */
export type VisitedPlaceType = 'posto' | 'oficina';

export interface VisitedPlaceRecord {
  id: string;
  tipo: VisitedPlaceType;
  referencia_id: string;
  nome?: string | null;
  latitude: number;
  longitude: number;
  data: string; // "AAAA-MM-DD" ou ISO
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

export interface GroupedVisitedPlace {
  id: string;
  tipo: VisitedPlaceType;
  nome: string;
  latitude: number;
  longitude: number;
  visitas: number;
  ultimaData: string;
  referencias: string[];
}

/**
 * US16: Simulador Financeiro de Viabilidade e Economia
 */
export type SimulationType = 'etanol_gasolina' | 'economia_potencial' | 'custo_viagem';

export interface EtanolGasolinaResult {
  decisao: 'etanol' | 'gasolina';
  etanolCompensa: boolean;
  razaoPercentual: number;
  diferencaPercentual: number;
  pontoEquilibrioCentavos: number;
  mensagem: string;
}

export interface EconomiaPotencialResult {
  custoMensalAtualCentavos: number;
  custoMensalAlternativoCentavos: number;
  economiaMensalCentavos: number;
  economiaAnualCentavos: number;
  alternativaCompensa: boolean;
  mensagem: string;
}

export interface CustoViagemResult {
  litrosEstimados: number;
  custoCombustivelCentavos: number;
  pedagiosCentavos: number;
  alimentacaoCentavos: number;
  custoTotalCentavos: number;
  custoPorKmCentavos: number;
  mensagem: string;
}

export interface SimulationRecord {
  id: string;
  tipo: SimulationType;
  entradas: Record<string, any>;
  resultado: Record<string, any>;
  criado_em: string;
  atualizado_em?: string;
  excluido_em?: string | null;
}

/**
 * US31: Lembretes de Inspeção Visual
 */
export interface InspectionReminderRecord {
  id: string;
  veiculo_id: string;
  vehicleId?: string;
  item: string;
  periodicidade_dias: number;
  ultima_inspecao_em: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

export interface CreateInspectionReminderDTO {
  veiculoId: string;
  item: string;
  periodicidadeDias: number;
  ultimaInspecaoEm?: string | null;
  ativo?: boolean;
}

export interface InspectionCycleRecord {
  id: string;
  lembrete_id: string;
  disparado_em: string;
  ultimo_disparo_em?: string;
  tentativas: number;
  concluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

/**
 * US32: Fotos do Veículo
 */
export interface VehiclePhotoRecord {
  id: string;
  veiculo_id: string;
  vehicleId?: string;
  data: string; // "AAAA-MM-DD"
  legenda?: string | null;
  arquivo_local: string;
  url_gcs?: string | null;
  tamanho_bytes: number;
  mime_type: string;
  status_upload: AttachmentUploadStatus;
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

export interface CreateVehiclePhotoDTO {
  veiculoId: string;
  data: string;
  legenda?: string | null;
  localPath: string;
  fileSize: number;
  mimeType?: string;
}

/**
 * US29: Perfil de Condução
 */
export type DrivingProfileType = 'economico' | 'normal' | 'agressivo';

export interface DrivingProfileRecord {
  id: string;
  veiculo_id: string;
  vehicleId?: string;
  perfil_conducao: DrivingProfileType;
  definido_em: string;
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

export interface DrivingProfileCorrelationItem {
  perfil: DrivingProfileType;
  rotulo: string;
  mediaKml: number | null;
  totalAbastecimentos: number;
}

export interface DrivingProfileCorrelationResult {
  itens: DrivingProfileCorrelationItem[];
  totalRegistrosComConsumo: number;
  dadosSuficientes: boolean;
}

/**
 * US28: Comparativos entre Combustíveis e Veículos
 */
export interface FuelComparisonItem {
  combustivel: FuelType | string;
  mediaKml: number | null;
  custoPorKm: number | null;
  consumoFormatado: string;
  custoPorKmFormatado: string;
  totalGasto: number;
  totalLitros: number;
  totalRegistros: number;
}

export interface VehicleComparisonInput {
  veiculoId: string;
  nome: string;
  placa: string;
  consumoMedioKml: number | null;
  kmRodados: number;
  custoTotal: number;
  custoPorKm: number | null;
}

export interface VehicleComparisonItem extends VehicleComparisonInput {
  consumoFormatado: string;
  custoPorKmFormatado: string;
}

/**
 * US20: Perfil Compartilhável via QR Code
 */
export interface VehicleShareCreatedResponse {
  id: string;
  veiculo_id: string;
  token: string;
  url_publica: string;
  criado_em: string;
  expira_em: string;
}

export interface VehicleShareSummary {
  id: string;
  veiculo_id: string;
  criado_em: string;
  expira_em: string;
  revogado_em: string | null;
}

export interface PublicVehicleMaintenanceItem {
  data: string;
  tipo: string;
  tipo_servico: string;
  descricao: string;
  km: number;
}

export interface PublicVehicleProfileResponse {
  veiculo: {
    modelo: string;
    marca: string | null;
    ano: number;
    placa: string;
    combustivel_preferencial: string;
    odometro_atual: number;
  };
  manutencoes: PublicVehicleMaintenanceItem[];
  expira_em: string;
}

/**
 * US37: Resumo Mensal por E-mail
 */
export interface MonthlySummaryPreferenceRecord {
  id: string;
  usuario_id?: string;
  receber_resumo: boolean;
  email_destino: string;
  criado_em: string;
  atualizado_em: string;
  excluido_em?: string | null;
}

export interface MonthlySummaryMetrics {
  mesReferencia: string; // "AAAA-MM"
  gastosTotaisReais: number;
  consumoMedioKml: number | null;
  kmPercorridos: number;
}
