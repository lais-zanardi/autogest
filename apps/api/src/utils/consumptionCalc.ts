/**
 * Utilitário de cálculos de consumo médio e eficiência energética
 */

export function calculateKml(
  currentOdometer: number,
  previousOdometer: number,
  liters: number,
): number | null {
  if (liters <= 0 || currentOdometer <= previousOdometer) {
    return null;
  }
  const distance = currentOdometer - previousOdometer;
  const kml = distance / liters;
  return Number(kml.toFixed(2));
}

export function calculateCostPerKm(totalSpent: number, totalDistance: number): number {
  if (totalDistance <= 0) return 0;
  return Number((totalSpent / totalDistance).toFixed(2));
}
