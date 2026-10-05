import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 6,
  name: '006_create_local_regras_manutencao',
  up: async () => {
    // Inicializa tabela local de regras de manutenção (US10.1)
    const regras = await db.getTableData('regras_manutencao');
    if (!regras) {
      await db.saveTableData('regras_manutencao', []);
    }
  },
});
