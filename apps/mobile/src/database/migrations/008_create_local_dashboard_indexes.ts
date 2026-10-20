import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 8,
  name: '008_create_local_dashboard_indexes',
  up: async () => {
    // US13.5: Índices compostos (veiculo_id + data) no banco local para desempenho do Dashboard (RNF01)
    await db.createIndex('idx_local_refuels_veiculo_data', 'local_refuels', ['vehicleId', 'date']);
    await db.createIndex('idx_local_despesas_veiculo_data', 'local_despesas', [
      'vehicleId',
      'date',
    ]);
    await db.createIndex('idx_manutencoes_veiculo_data', 'manutencoes', ['vehicleId', 'date']);
    await db.createIndex('idx_local_leituras_hodometro_veiculo_data', 'local_leituras_hodometro', [
      'vehicleId',
      'date',
    ]);
    await db.createIndex('idx_custos_fixos_veiculo_data', 'custos_fixos', [
      'vehicleId',
      'createdAt',
    ]);
  },
});
