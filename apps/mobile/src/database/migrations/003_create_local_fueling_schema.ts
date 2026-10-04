import { localMigrator } from './localMigrator';
import { db } from '../DatabaseConnection';

localMigrator.registerMigration({
  version: 3,
  name: '003_create_local_fueling_schema',
  up: async () => {
    // Inicializa tabela local de leituras de hodômetro
    const readings = await db.getTableData('local_leituras_hodometro');
    if (!readings) {
      await db.saveTableData('local_leituras_hodometro', []);
    }

    // Garante que a tabela local_refuels suporte novos campos (latitude, longitude, excluido_em)
    const refuels = await db.getTableData('local_refuels');
    if (!refuels) {
      await db.saveTableData('local_refuels', []);
    } else {
      const updated = refuels.map((r: any) => ({
        ...r,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        deletedAt: r.deletedAt ?? null,
      }));
      await db.saveTableData('local_refuels', updated);
    }
  },
});
