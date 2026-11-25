import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 020: Tabelas locais precos_combustivel e cache_clima (US17.1 & US17.7)
 */
localMigrator.registerMigration({
  version: 20,
  name: '020_create_local_precos_e_clima',
  up: async () => {
    const precos = await db.getTableData('precos_combustivel');
    if (!precos || precos.length === 0) {
      await db.saveTableData('precos_combustivel', []);
    }
    await db.createIndex('idx_precos_combustivel_consulta', 'precos_combustivel', [
      'municipio',
      'combustivel',
      'data_coleta',
    ]);

    const clima = await db.getTableData('cache_clima');
    if (!clima || clima.length === 0) {
      await db.saveTableData('cache_clima', []);
    }
    await db.createIndex('idx_cache_clima_municipio', 'cache_clima', ['municipio', 'data']);
  },
});
