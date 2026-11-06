import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

/**
 * Migration 018: Tabela local consultas_fipe e índice por veículo e mês (US18.4)
 */
localMigrator.registerMigration({
  version: 18,
  name: '018_create_local_consultas_fipe',
  up: async () => {
    // US18.4: Tabela local consultas_fipe
    const consultas = await db.getTableData('consultas_fipe');
    if (!consultas || consultas.length === 0) {
      await db.saveTableData('consultas_fipe', []);
    }
    await db.createIndex('idx_consultas_fipe_veiculo_mes', 'consultas_fipe', [
      'vehicleId',
      'referenceMonth',
    ]);
  },
});
