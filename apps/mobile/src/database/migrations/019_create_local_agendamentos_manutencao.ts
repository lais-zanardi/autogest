import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 019: Tabela local agendamentos_manutencao (US30.1)
 */
localMigrator.registerMigration({
  version: 19,
  name: '019_create_local_agendamentos_manutencao',
  up: async () => {
    const agendamentos = await db.getTableData('agendamentos_manutencao');
    if (!agendamentos || agendamentos.length === 0) {
      await db.saveTableData('agendamentos_manutencao', []);
    }
    await db.createIndex('idx_agendamentos_veiculo_data', 'agendamentos_manutencao', [
      'vehicleId',
      'date',
    ]);
  },
});
