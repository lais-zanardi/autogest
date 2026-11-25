import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 024: Tabela local locais_visitados (US36.1)
 */
localMigrator.registerMigration({
  version: 24,
  name: '024_create_local_locais_visitados',
  up: async () => {
    const locais = await db.getTableData('locais_visitados');
    if (!locais || locais.length === 0) {
      await db.saveTableData('locais_visitados', []);
    }
    await db.createIndex('idx_locais_visitados_tipo', 'locais_visitados', ['tipo', 'data']);
  },
});
