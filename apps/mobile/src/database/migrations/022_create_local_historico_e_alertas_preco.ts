import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 022: Tabelas locais historico_precos_locais e alertas_preco (US35.1)
 */
localMigrator.registerMigration({
  version: 22,
  name: '022_create_local_historico_e_alertas_preco',
  up: async () => {
    const historico = await db.getTableData('historico_precos_locais');
    if (!historico || historico.length === 0) {
      await db.saveTableData('historico_precos_locais', []);
    }
    await db.createIndex('idx_historico_precos_locais', 'historico_precos_locais', [
      'municipio',
      'combustivel',
      'data_coleta',
    ]);

    const alertas = await db.getTableData('alertas_preco');
    if (!alertas || alertas.length === 0) {
      await db.saveTableData('alertas_preco', []);
    }
    await db.createIndex('idx_alertas_preco_veiculo', 'alertas_preco', [
      'veiculo_id',
      'combustivel',
    ]);
  },
});
