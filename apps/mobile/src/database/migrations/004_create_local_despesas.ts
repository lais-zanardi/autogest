import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 4,
  name: '004_create_local_despesas',
  up: async () => {
    // Inicializa tabela local de despesas
    const despesas = await db.getTableData('local_despesas');
    if (!despesas) {
      await db.saveTableData('local_despesas', []);
    }
  },
});
