import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 5,
  name: '005_create_local_manutencoes',
  up: async () => {
    // Inicializa tabelas locais de manutenções e anexos (US09.1)
    const manutencoes = await db.getTableData('manutencoes');
    if (!manutencoes) {
      await db.saveTableData('manutencoes', []);
    }

    const anexos = await db.getTableData('anexos');
    if (!anexos) {
      await db.saveTableData('anexos', []);
    }
  },
});
