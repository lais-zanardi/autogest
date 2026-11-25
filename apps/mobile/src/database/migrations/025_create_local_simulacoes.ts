import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 025: Tabela local simulacoes (US16.6)
 */
localMigrator.registerMigration({
  version: 25,
  name: '025_create_local_simulacoes',
  up: async () => {
    const simulacoes = await db.getTableData('simulacoes');
    if (!simulacoes || simulacoes.length === 0) {
      await db.saveTableData('simulacoes', []);
    }
    await db.createIndex('idx_simulacoes_criado', 'simulacoes', ['tipo', 'criado_em']);
  },
});
