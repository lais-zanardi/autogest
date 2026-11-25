import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 029: Tabela local preferencias_resumo (US37.1)
 */
localMigrator.registerMigration({
  version: 29,
  name: '029_create_local_preferencias_resumo',
  up: async () => {
    const prefs = await db.getTableData('preferencias_resumo');
    if (!prefs || prefs.length === 0) {
      await db.saveTableData('preferencias_resumo', []);
    }
  },
});
