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
}

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

export interface Expense {
  id: string;
  vehicleId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description?: string | null;
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
}

export interface UpdateExpenseDTO {
  category?: ExpenseCategory;
  amount?: number;
  date?: string;
  description?: string | null;
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
  costPerKm: number;
  fuelDistribution: Record<FuelType, number>;
}

export type MaintenanceType = 'preventiva' | 'corretiva';

export type MaintenanceServiceType =
  'troca_oleo' | 'filtros' | 'correia_dentada' | 'velas' | 'pneus' | 'freios' | 'outros';

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
  mechanic?: string | null;
  executionTimeMin?: number | null;
  totalValue: number;
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
  mechanic?: string | null;
  executionTimeMin?: number | null;
  totalValue: number;
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
  mechanic?: string | null;
  executionTimeMin?: number | null;
  totalValue?: number;
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
