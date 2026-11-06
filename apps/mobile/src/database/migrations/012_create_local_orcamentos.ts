import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 12,
  name: '012_create_local_orcamentos',
  up: async () => {
    // US15.1: Tabela local `orcamentos` sincronizável
    const rows = await db.getTableData('orcamentos');
    if (!rows || rows.length === 0) {
      await db.saveTableData('orcamentos', []);
    }
    await db.createIndex('idx_orcamentos_veiculo_id', 'orcamentos', ['veiculo_id']);
  },
});
