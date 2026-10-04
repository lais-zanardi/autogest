import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 2,
  name: '002_create_local_veiculos',
  up: async () => {
    const vehicles = await db.getTableData('local_vehicles');
    if (!vehicles) {
      await db.saveTableData('local_vehicles', []);
    } else {
      const updated = vehicles.map((v: any) => ({
        ...v,
        tankCapacityL: v.tankCapacityL ?? 50,
        preferredFuel: v.preferredFuel ?? v.fuelType ?? 'Gasolina',
        deletedAt: v.deletedAt ?? null,
      }));
      await db.saveTableData('local_vehicles', updated);
    }
  },
});
