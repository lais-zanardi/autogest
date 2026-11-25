import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 027: Tabela local fotos_veiculo (US32.1)
 */
localMigrator.registerMigration({
  version: 27,
  name: '027_create_local_fotos_veiculo',
  up: async () => {
    const fotos = await db.getTableData('fotos_veiculo');
    if (!fotos || fotos.length === 0) {
      await db.saveTableData('fotos_veiculo', []);
    }
    await db.createIndex('idx_fotos_veiculo', 'fotos_veiculo', ['veiculo_id', 'data']);
  },
});
