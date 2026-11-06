import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 16,
  name: '016_create_local_viagens',
  up: async () => {
    // 1. Tabela local viagens (US07.1)
    const trips = await db.getTableData('viagens');
    if (!trips || trips.length === 0) {
      await db.saveTableData('viagens', []);
    }
    await db.createIndex('idx_viagens_veiculo_status', 'viagens', ['vehicleId', 'status']);
    await db.createIndex('idx_viagens_data_inicio', 'viagens', ['startDate']);

    // 2. Índices de viagem_id em abastecimentos e despesas
    await db.createIndex('idx_local_refuels_viagem_id', 'local_refuels', ['tripId']);
    await db.createIndex('idx_local_despesas_viagem_id', 'local_despesas', ['tripId']);
  },
});
