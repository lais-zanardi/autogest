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
  name: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  fuelType: FuelType;
  initialOdometer: number;
  currentOdometer: number;
  fipeValue?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleDTO {
  name: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  fuelType: FuelType;
  initialOdometer: number;
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
  createdAt: string;
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
  receiptImageUrl?: string;
  stationName?: string;
  latitude?: number;
  longitude?: number;
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
