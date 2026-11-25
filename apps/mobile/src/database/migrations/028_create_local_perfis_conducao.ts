import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 028: Tabela local perfis_conducao (US29.1)
 */
localMigrator.registerMigration({
  version: 28,
  name: '028_create_local_perfis_conducao',
  up: async () => {
    const perfis = await db.getTableData('perfis_conducao');
    if (!perfis || perfis.length === 0) {
      await db.saveTableData('perfis_conducao', []);
    }
    await db.createIndex('idx_perfis_conducao', 'perfis_conducao', ['veiculo_id', 'definido_em']);
  },
});
