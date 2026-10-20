import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 7,
  name: '007_create_local_custos_fixos',
  up: async () => {
    // Inicializa tabela local de custos fixos mensais (US23.1)
    const custosFixos = await db.getTableData('custos_fixos');
    if (!custosFixos) {
      await db.saveTableData('custos_fixos', []);
    }
  },
});
