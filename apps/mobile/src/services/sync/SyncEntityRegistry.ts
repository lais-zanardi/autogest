import { VehicleRepository } from '../../repositories/VehicleRepository';
import { RefuelRepository } from '../../repositories/RefuelRepository';
import { ExpenseRepository } from '../../repositories/ExpenseRepository';
import { db } from '../../database/DatabaseConnection';

export interface SyncEntityDefinition {
  name: string;
  endpoint: string;
  localTable: string;
  applyRemote: (remoteItem: any) => Promise<void>;
}

/**
 * US02.7: Lista central de entidades sincronizáveis.
 * Cada nova entidade desenvolvida (ex: manutenções na US09) precisa apenas ser registrada aqui.
 */
export class SyncEntityRegistry {
  private static registry: Map<string, SyncEntityDefinition> = new Map();

  static register(definition: SyncEntityDefinition): void {
    this.registry.set(definition.name, definition);
  }

  static get(name: string): SyncEntityDefinition | undefined {
    return this.registry.get(name);
  }

  static getAll(): SyncEntityDefinition[] {
    return Array.from(this.registry.values());
  }
}

// 1. Entidade Veículos (US04 / US02.7)
SyncEntityRegistry.register({
  name: 'veiculos',
  endpoint: '/api/v1/sync/veiculos',
  localTable: 'local_vehicles',
  applyRemote: async (remote: any) => {
    const existing = await VehicleRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await VehicleRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || 0).getTime();
      // Regra Last-Write-Wins (US02.3)
      if (remoteUpdatedAt >= localUpdatedAt) {
        await VehicleRepository.update(remote.id, {
          model: remote.modelo || remote.model,
          brand: remote.marca || remote.brand,
          name: remote.nome || remote.name,
          plate: remote.placa || remote.plate,
          year: remote.ano || remote.year,
          tankCapacityL: remote.capacidade_tanque_l || remote.tankCapacityL,
          preferredFuel: remote.combustivel_preferencial || remote.preferredFuel,
          initialOdometer: remote.odometro_inicial || remote.initialOdometer,
          currentOdometer: remote.odometro_atual || remote.currentOdometer,
        });
      }
    } else {
      // Inserção com o ID do servidor
      await db.insert('local_vehicles', {
        id: remote.id,
        userId: remote.usuario_id || remote.userId || 'local_user',
        name: remote.nome || remote.name || remote.modelo || remote.model,
        brand: remote.marca || remote.brand || '',
        model: remote.modelo || remote.model,
        year: remote.ano || remote.year,
        plate: remote.placa || remote.plate,
        fuelType: remote.combustivel_preferencial || remote.preferredFuel || 'Gasolina',
        tankCapacityL: remote.capacidade_tanque_l || remote.tankCapacityL,
        preferredFuel: remote.combustivel_preferencial || remote.preferredFuel || 'Gasolina',
        initialOdometer: remote.odometro_inicial || remote.initialOdometer || 0,
        currentOdometer: remote.odometro_atual || remote.currentOdometer || 0,
        fipeValue: remote.valor_fipe || remote.fipeValue || null,
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});

// 2. Entidade Abastecimentos (US05 / US02.7)
SyncEntityRegistry.register({
  name: 'abastecimentos',
  endpoint: '/api/v1/sync/abastecimentos',
  localTable: 'local_refuels',
  applyRemote: async (remote: any) => {
    const existing = await RefuelRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await RefuelRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (remoteUpdatedAt >= localUpdatedAt) {
        await RefuelRepository.update(remote.id, {
          odometer: remote.km || remote.odometer,
          liters: remote.litros || remote.liters,
          totalValue: remote.valor_total || remote.totalValue,
          pricePerLiter: remote.valor_litro || remote.pricePerLiter,
          fuelType: remote.tipo_combustivel || remote.fuelType,
          isFullTank: remote.tanque_cheio ?? remote.isFullTank ?? true,
          stationName: remote.posto || remote.stationName || null,
          date: remote.data_hora || remote.date,
        });
      }
    } else {
      await db.insert('local_refuels', {
        id: remote.id,
        vehicleId: remote.veiculo_id || remote.vehicleId,
        date: remote.data_hora || remote.date,
        odometer: remote.km || remote.odometer,
        fuelType: remote.tipo_combustivel || remote.fuelType,
        pricePerLiter: remote.valor_litro || remote.pricePerLiter,
        totalValue: remote.valor_total || remote.totalValue,
        liters: remote.litros || remote.liters,
        isFullTank: remote.tanque_cheio ?? remote.isFullTank ?? true,
        calculatedKml: remote.consumo_kml || remote.calculatedKml || null,
        receiptImageUrl: remote.imagem_comprovante_url || remote.receiptImageUrl || null,
        stationName: remote.posto || remote.stationName || null,
        latitude: remote.latitude || null,
        longitude: remote.longitude || null,
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});

// 3. Entidade Leituras de Hodômetro (US06 / US02.7)
SyncEntityRegistry.register({
  name: 'leituras_hodometro',
  endpoint: '/api/v1/sync/leituras_hodometro',
  localTable: 'local_leituras_hodometro',
  applyRemote: async (remote: any) => {
    const existing = await db.findById<any>('local_leituras_hodometro', remote.id);
    if (!existing) {
      await db.insert('local_leituras_hodometro', {
        id: remote.id,
        vehicleId: remote.veiculo_id || remote.vehicleId,
        km: remote.km,
        date: remote.data_hora || remote.date,
        origin: remote.origem || remote.origin,
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: remote.excluido_em || remote.deletedAt || null,
      });
    }
  },
});

// 4. Entidade Despesas (US22 / US02.7)
SyncEntityRegistry.register({
  name: 'despesas',
  endpoint: '/api/v1/sync/despesas',
  localTable: 'local_despesas',
  applyRemote: async (remote: any) => {
    const existing = await ExpenseRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await ExpenseRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (remoteUpdatedAt >= localUpdatedAt) {
        await ExpenseRepository.update(remote.id, {
          category: remote.categoria || remote.category,
          amount: remote.valor !== undefined ? remote.valor : remote.amount,
          date: remote.data_hora || remote.date,
          description: remote.descricao || remote.description,
        });
      }
    } else {
      await db.insert('local_despesas', {
        id: remote.id,
        vehicleId: remote.veiculo_id || remote.vehicleId,
        category: remote.categoria || remote.category,
        amount: remote.valor !== undefined ? Number(remote.valor) : Number(remote.amount),
        date: remote.data_hora || remote.date,
        description: remote.descricao || remote.description || null,
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});
