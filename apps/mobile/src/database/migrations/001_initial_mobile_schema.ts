import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 1,
  name: '001_initial_mobile_schema',
  up: async () => {
    // Inicializa estruturas de tabelas caso não existam
    const vehicles = await db.getTableData('local_vehicles');
    if (!vehicles) await db.saveTableData('local_vehicles', []);

    const refuels = await db.getTableData('local_refuels');
    if (!refuels) await db.saveTableData('local_refuels', []);

    const expenses = await db.getTableData('local_expenses');
    if (!expenses) await db.saveTableData('local_expenses', []);

    const syncQueue = await db.getTableData('sync_queue');
    if (!syncQueue) await db.saveTableData('sync_queue', []);
  },
});
