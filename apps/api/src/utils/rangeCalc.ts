/**
 * Utilitário de cálculo de autonomia estimada do veículo
 */

export function calculateEstimatedRange(
  tankCapacityLiters: number,
  fuelLevelPercentage: number,
  averageKml: number,
): number {
  if (averageKml <= 0 || tankCapacityLiters <= 0 || fuelLevelPercentage <= 0) {
    return 0;
  }
  const currentLiters = (tankCapacityLiters * fuelLevelPercentage) / 100;
  const estimatedKm = currentLiters * averageKml;
  return Math.round(estimatedKm);
}
