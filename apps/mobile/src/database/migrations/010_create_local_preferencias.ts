import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 10,
  name: '010_create_local_preferencias',
  up: async () => {
    // US03.3: Inicializa tabela local de preferências do dispositivo (ex.: tutorial_concluido)
    const prefs = await db.getTableData('preferencias');
    if (!prefs) {
      await db.saveTableData('preferencias', []);
    }
  },
});
