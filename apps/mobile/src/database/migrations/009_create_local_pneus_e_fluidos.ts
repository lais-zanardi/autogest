import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 9,
  name: '009_create_local_pneus_e_fluidos',
  up: async () => {
    // US11.1: Inicializa tabelas locais de pneus e fluidos e índices compostos (veiculo_id + data)
    const pneuData = await db.getTableData('registros_pneu');
    if (!pneuData) {
      await db.saveTableData('registros_pneu', []);
    }

    const fluidoData = await db.getTableData('registros_fluido');
    if (!fluidoData) {
      await db.saveTableData('registros_fluido', []);
    }

    await db.createIndex('idx_registros_pneu_veiculo_data', 'registros_pneu', [
      'vehicleId',
      'date',
    ]);
    await db.createIndex('idx_registros_fluido_veiculo_data', 'registros_fluido', [
      'vehicleId',
      'date',
    ]);
  },
});
