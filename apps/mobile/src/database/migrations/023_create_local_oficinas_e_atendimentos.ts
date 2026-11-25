import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 023: Tabelas locais oficinas e atendimentos_oficina (US12.1)
 */
localMigrator.registerMigration({
  version: 23,
  name: '023_create_local_oficinas_e_atendimentos',
  up: async () => {
    const oficinas = await db.getTableData('oficinas');
    if (!oficinas || oficinas.length === 0) {
      await db.saveTableData('oficinas', []);
    }
    await db.createIndex('idx_oficinas_favorita', 'oficinas', ['favorita', 'nome']);

    const atendimentos = await db.getTableData('atendimentos_oficina');
    if (!atendimentos || atendimentos.length === 0) {
      await db.saveTableData('atendimentos_oficina', []);
    }
    await db.createIndex('idx_atendimentos_oficina', 'atendimentos_oficina', [
      'oficina_id',
      'data',
    ]);
  },
});
