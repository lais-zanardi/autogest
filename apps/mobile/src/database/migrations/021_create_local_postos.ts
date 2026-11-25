import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 021: Tabela local postos somente leitura (US34.1)
 */
localMigrator.registerMigration({
  version: 21,
  name: '021_create_local_postos',
  up: async () => {
    const postos = await db.getTableData('postos');
    if (!postos || postos.length === 0) {
      await db.saveTableData('postos', []);
    }
    await db.createIndex('idx_postos_municipio', 'postos', ['municipio', 'uf']);
  },
});
