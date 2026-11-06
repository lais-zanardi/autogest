import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 14,
  name: '014_create_local_etiquetas_e_contexto',
  up: async () => {
    // 1. Tabela local etiquetas
    const tags = await db.getTableData('etiquetas');
    if (!tags || tags.length === 0) {
      await db.saveTableData('etiquetas', []);
    }
    await db.createIndex('idx_etiquetas_nome', 'etiquetas', ['nome']);

    // 2. Tabela local registros_etiquetas
    const recordTags = await db.getTableData('registros_etiquetas');
    if (!recordTags || recordTags.length === 0) {
      await db.saveTableData('registros_etiquetas', []);
    }
    await db.createIndex('idx_registros_etiquetas_polimorfico', 'registros_etiquetas', [
      'tipo_registro',
      'registro_id',
    ]);
    await db.createIndex('idx_registros_etiquetas_etiqueta_id', 'registros_etiquetas', [
      'etiqueta_id',
    ]);
  },
});
