import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 15,
  name: '015_create_local_search_indexes',
  up: async () => {
    // US33.5: Índices locais para os filtros mais usados (veiculo_id + data, valor)

    // Abastecimentos: veiculo_id + data, valor_total
    await db.createIndex('idx_local_refuels_vehicle_date', 'local_refuels', [
      'vehicleId',
      'date',
    ]);
    await db.createIndex('idx_local_refuels_amount', 'local_refuels', ['totalValue']);

    // Despesas: veiculo_id + data, amount
    await db.createIndex('idx_local_despesas_vehicle_date', 'local_despesas', [
      'vehicleId',
      'date',
    ]);
    await db.createIndex('idx_local_despesas_amount', 'local_despesas', ['amount']);

    // Manutenções: veiculo_id + data, valor/totalValue
    await db.createIndex('idx_manutencoes_vehicle_date', 'manutencoes', [
      'vehicleId',
      'date',
    ]);
    await db.createIndex('idx_manutencoes_amount', 'manutencoes', ['totalValue']);
  },
});
