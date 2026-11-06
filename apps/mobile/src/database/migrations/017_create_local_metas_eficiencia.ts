import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 17,
  name: '017_create_local_metas_eficiencia',
  up: async () => {
    // US08.1: Tabela local metas_eficiencia
    const goals = await db.getTableData('metas_eficiencia');
    if (!goals || goals.length === 0) {
      await db.saveTableData('metas_eficiencia', []);
    }
    await db.createIndex('idx_metas_eficiencia_veiculo_ativa', 'metas_eficiencia', [
      'vehicleId',
      'active',
    ]);
  },
});
