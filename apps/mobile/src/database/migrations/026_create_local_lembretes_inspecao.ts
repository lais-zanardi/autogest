import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 026: Tabelas locais lembretes_inspecao e ciclos_inspecao (US31.1)
 */
localMigrator.registerMigration({
  version: 26,
  name: '026_create_local_lembretes_inspecao',
  up: async () => {
    const lembretes = await db.getTableData('lembretes_inspecao');
    if (!lembretes || lembretes.length === 0) {
      await db.saveTableData('lembretes_inspecao', []);
    }
    await db.createIndex('idx_lembretes_inspecao', 'lembretes_inspecao', ['veiculo_id', 'ativo']);

    const ciclos = await db.getTableData('ciclos_inspecao');
    if (!ciclos || ciclos.length === 0) {
      await db.saveTableData('ciclos_inspecao', []);
    }
    await db.createIndex('idx_ciclos_inspecao', 'ciclos_inspecao', ['lembrete_id', 'concluido_em']);
  },
});
