import { Refuel, DashboardStats, FuelType } from '@autogest/shared-types';

export function generateDashboardStats(refuels: Refuel[]): DashboardStats {
  if (!refuels || refuels.length === 0) {
    return {
      totalSpent: 0,
      totalDistance: 0,
      averageKml: 0,
      totalRefuels: 0,
      costPerKm: 0,
      fuelDistribution: { Gasolina: 0, Etanol: 0, Diesel: 0, GNV: 0, Flex: 0 },
    };
  }

  const totalSpent = refuels.reduce((acc, r) => acc + Number(r.totalValue), 0);
  const validKmlList = refuels
    .map(r => r.calculatedKml)
    .filter((k): k is number => k !== null && k !== undefined && k > 0);
  const averageKml =
    validKmlList.length > 0
      ? Number((validKmlList.reduce((acc, val) => acc + val, 0) / validKmlList.length).toFixed(2))
      : 0;

  const minOdometer = Math.min(...refuels.map(r => Number(r.odometer)));
  const maxOdometer = Math.max(...refuels.map(r => Number(r.odometer)));
  const totalDistance = maxOdometer > minOdometer ? maxOdometer - minOdometer : 0;

  const costPerKm = totalDistance > 0 ? Number((totalSpent / totalDistance).toFixed(2)) : 0;

  const fuelDistribution: Record<FuelType, number> = {
    Gasolina: 0,
    Etanol: 0,
    Diesel: 0,
    GNV: 0,
    Flex: 0,
  };

  refuels.forEach(r => {
    if (fuelDistribution[r.fuelType] !== undefined) {
      fuelDistribution[r.fuelType] += Number(r.totalValue);
    }
  });

  return {
    totalSpent: Number(totalSpent.toFixed(2)),
    totalDistance,
    averageKml,
    totalRefuels: refuels.length,
    costPerKm,
    fuelDistribution,
  };
}
