import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 11,
  name: '011_create_local_auditoria',
  up: async () => {
    // US21.5: Tabela local `auditoria` somente inserção (sem atualizado_em nem excluido_em)
    const rows = await db.getTableData('auditoria');
    if (!rows || rows.length === 0) {
      await db.saveTableData('auditoria', []);
    }
    await db.createIndex('idx_auditoria_entidade_data', 'auditoria', ['entidade', 'data_hora']);
  },
});
