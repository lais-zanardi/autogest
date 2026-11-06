import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 13,
  name: '013_create_local_preferencias_e_notificacoes_agendadas',
  up: async () => {
    // US39.1: Tabela local `preferencias` (não sincronizável — Decisão #9 / US39)
    const prefs = await db.getTableData('preferencias');
    if (!prefs || prefs.length === 0) {
      await db.saveTableData('preferencias', [
        {
          id: 'preferencias_locais',
          chave: 'unidade_consumo_principal',
          valor: 'km/l',
          atualizado_em: new Date().toISOString(),
        },
        {
          id: 'preferencias_pausa_notificacoes',
          chave: 'notificacoes_pausadas_ate',
          valor: null,
          atualizado_em: new Date().toISOString(),
        },
      ]);
    }

    // US39.6: Tabela local `notificacoes_agendadas`
    const scheduled = await db.getTableData('notificacoes_agendadas');
    if (!scheduled || scheduled.length === 0) {
      await db.saveTableData('notificacoes_agendadas', []);
    }
    await db.createIndex('idx_notificacoes_agendadas_status_trigger', 'notificacoes_agendadas', [
      'status',
      'triggerAt',
    ]);
  },
});
