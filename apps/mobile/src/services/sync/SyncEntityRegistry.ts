import { VehicleRepository } from '../../repositories/VehicleRepository';
import { RefuelRepository } from '../../repositories/RefuelRepository';
import { ExpenseRepository } from '../../repositories/ExpenseRepository';
import { MaintenanceRepository } from '../../repositories/MaintenanceRepository';
import { AttachmentRepository } from '../../repositories/AttachmentRepository';
import { MaintenanceRuleRepository } from '../../repositories/MaintenanceRuleRepository';
import { db } from '../../database/DatabaseConnection';

export interface SyncEntityDefinition {
  name: string;
  endpoint: string;
  localTable: string;
  applyRemote: (remoteItem: any) => Promise<void>;
  applyServerChange?: (remoteItem: any) => Promise<void>;
}

/**
 * US02.7: Lista central de entidades sincronizáveis.
 * Cada nova entidade desenvolvida (ex: manutenções na US09) precisa apenas ser registrada aqui.
 */
export class SyncEntityRegistry {
  private static registry: Map<string, SyncEntityDefinition> = new Map();

  static register(definition: SyncEntityDefinition): void {
    this.registry.set(definition.name, {
      ...definition,
      applyServerChange: definition.applyServerChange || definition.applyRemote,
    });
  }

  static get(name: string): SyncEntityDefinition | undefined {
    return this.registry.get(name);
  }

  static getAll(): SyncEntityDefinition[] {
    return Array.from(this.registry.values());
  }

  static listRegisteredEntities(): string[] {
    return Array.from(this.registry.keys());
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

// 5. Entidade Manutenções (US09.1 / US02.7)
SyncEntityRegistry.register({
  name: 'manutencoes',
  endpoint: '/api/v1/sync/manutencoes',
  localTable: 'manutencoes',
  applyRemote: async (remote: any) => {
    const existing = await MaintenanceRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await MaintenanceRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (remoteUpdatedAt >= localUpdatedAt) {
        await MaintenanceRepository.update(remote.id, {
          date: remote.data || remote.date,
          odometer: remote.km !== undefined ? Number(remote.km) : Number(remote.odometer),
          type: remote.tipo || remote.type,
          serviceType: remote.tipo_servico || remote.serviceType,
          description: remote.descricao || remote.description,
          replacedParts: remote.pecas !== undefined ? remote.pecas : remote.replacedParts,
          workshop: remote.oficina !== undefined ? remote.oficina : remote.workshop,
          mechanic: remote.profissional !== undefined ? remote.profissional : remote.mechanic,
          executionTimeMin:
            remote.tempo_execucao_min !== undefined
              ? remote.tempo_execucao_min
              : remote.executionTimeMin,
          totalValue: remote.valor !== undefined ? Number(remote.valor) : Number(remote.totalValue),
        });
      }
    } else {
      await db.insert('manutencoes', {
        id: remote.id,
        vehicleId: remote.veiculo_id || remote.vehicleId,
        date: remote.data || remote.date,
        odometer: remote.km !== undefined ? Number(remote.km) : Number(remote.odometer),
        type: remote.tipo || remote.type,
        serviceType: remote.tipo_servico || remote.serviceType,
        description: remote.descricao || remote.description || '',
        replacedParts: remote.pecas !== undefined ? remote.pecas : remote.replacedParts || null,
        workshop: remote.oficina !== undefined ? remote.oficina : remote.workshop || null,
        mechanic: remote.profissional !== undefined ? remote.profissional : remote.mechanic || null,
        executionTimeMin:
          remote.tempo_execucao_min !== undefined
            ? Number(remote.tempo_execucao_min)
            : remote.executionTimeMin || null,
        totalValue:
          remote.valor !== undefined ? Number(remote.valor) : Number(remote.totalValue || 0),
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});

// 6. Entidade Anexos de Manutenção (US09.1 / US02.7)
SyncEntityRegistry.register({
  name: 'anexos',
  endpoint: '/api/v1/sync/anexos',
  localTable: 'anexos',
  applyRemote: async (remote: any) => {
    const existing = await AttachmentRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await AttachmentRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (remoteUpdatedAt >= localUpdatedAt) {
        await AttachmentRepository.update(remote.id, {
          maintenanceId: remote.manutencao_id || remote.maintenanceId,
          localPath: remote.arquivo_local || remote.localPath || existing.localPath,
          gcsUrl: remote.url_gcs || remote.gcsUrl,
          fileSize: remote.tamanho !== undefined ? Number(remote.tamanho) : Number(remote.fileSize),
          uploadStatus: remote.status_upload || remote.uploadStatus,
          mimeType: remote.tipo_mime || remote.mimeType,
        });
      }
    } else {
      await db.insert('anexos', {
        id: remote.id,
        maintenanceId: remote.manutencao_id || remote.maintenanceId || null,
        localPath: remote.arquivo_local || remote.localPath || '',
        gcsUrl: remote.url_gcs || remote.gcsUrl || null,
        fileSize:
          remote.tamanho !== undefined ? Number(remote.tamanho) : Number(remote.fileSize || 0),
        uploadStatus: remote.status_upload || remote.uploadStatus || 'pendente',
        mimeType: remote.tipo_mime || remote.mimeType || 'image/jpeg',
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});

// 7. Entidade Regras de Manutenção (US10.1 / US02.7)
SyncEntityRegistry.register({
  name: 'regras_manutencao',
  endpoint: '/api/v1/sync/regras_manutencao',
  localTable: 'regras_manutencao',
  applyRemote: async (remote: any) => {
    const existing = await MaintenanceRuleRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await MaintenanceRuleRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (remoteUpdatedAt >= localUpdatedAt) {
        await MaintenanceRuleRepository.update(remote.id, {
          serviceType: remote.tipo_servico || remote.serviceType,
          name: remote.nome || remote.name,
          intervalKm: remote.intervalo_km !== undefined ? remote.intervalo_km : remote.intervalKm,
          intervalDays:
            remote.intervalo_dias !== undefined ? remote.intervalo_dias : remote.intervalDays,
          advanceKm:
            remote.antecedencia_km !== undefined ? remote.antecedencia_km : remote.advanceKm,
          advanceDays:
            remote.antecedencia_dias !== undefined ? remote.antecedencia_dias : remote.advanceDays,
          lastServiceDate: remote.ultima_troca_data || remote.lastServiceDate,
          lastServiceKm:
            remote.ultima_troca_km !== undefined ? remote.ultima_troca_km : remote.lastServiceKm,
          active: remote.ativo !== undefined ? remote.ativo : remote.active,
        });
      }
    } else {
      await db.insert('regras_manutencao', {
        id: remote.id,
        vehicleId: remote.veiculo_id || remote.vehicleId,
        userId: remote.usuario_id || remote.userId || 'local_user',
        serviceType: remote.tipo_servico || remote.serviceType,
        name: remote.nome || remote.name || remote.tipo_servico,
        intervalKm:
          remote.intervalo_km !== undefined ? remote.intervalo_km : remote.intervalKm || null,
        intervalDays:
          remote.intervalo_dias !== undefined ? remote.intervalo_dias : remote.intervalDays || null,
        advanceKm:
          remote.antecedencia_km !== undefined ? remote.antecedencia_km : remote.advanceKm || 500,
        advanceDays:
          remote.antecedencia_dias !== undefined
            ? remote.antecedencia_dias
            : remote.advanceDays || 15,
        lastServiceDate: remote.ultima_troca_data || remote.lastServiceDate || null,
        lastServiceKm:
          remote.ultima_troca_km !== undefined
            ? remote.ultima_troca_km
            : remote.lastServiceKm || null,
        active: remote.ativo !== undefined ? remote.ativo : remote.active !== false,
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});

// 8. Entidade Custos Fixos Mensais (US23.1 / US02.7)
SyncEntityRegistry.register({
  name: 'custos_fixos',
  endpoint: '/api/v1/sync/custos_fixos',
  localTable: 'custos_fixos',
  applyRemote: async (remote: any) => {
    const { FixedCostRepository } = await import('../../repositories/FixedCostRepository');
    const existing = await FixedCostRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await FixedCostRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (remoteUpdatedAt >= localUpdatedAt) {
        await FixedCostRepository.update(remote.id, {
          description: remote.descricao || remote.description,
          monthlyAmount:
            remote.valor_mensal !== undefined
              ? Number(remote.valor_mensal)
              : Number(remote.monthlyAmount),
        });
      }
    } else {
      await db.insert('custos_fixos', {
        id: remote.id,
        vehicleId: remote.veiculo_id || remote.vehicleId,
        description: remote.descricao || remote.description || '',
        monthlyAmount:
          remote.valor_mensal !== undefined
            ? Number(remote.valor_mensal)
            : Number(remote.monthlyAmount || 0),
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});

// 9. Entidade Registros de Pneu (US11.1 / US02.7)
SyncEntityRegistry.register({
  name: 'registros_pneu',
  endpoint: '/api/v1/sync/registros_pneu',
  localTable: 'registros_pneu',
  applyRemote: async (remote: any) => {
    const { TireRecordRepository } = await import('../../repositories/TireRecordRepository');
    const existing = await TireRecordRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await TireRecordRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (remoteUpdatedAt >= localUpdatedAt) {
        await TireRecordRepository.update(remote.id, {
          date: remote.data || remote.date,
          km: remote.km !== undefined ? Number(remote.km) : existing.km,
          type: remote.tipo || remote.type,
          pressurePsi:
            remote.pressao_psi !== undefined
              ? Number(remote.pressao_psi)
              : Number(remote.pressurePsi),
          treadDepthMm:
            remote.sulco_mm !== undefined
              ? remote.sulco_mm !== null
                ? Number(remote.sulco_mm)
                : null
              : remote.treadDepthMm !== undefined
                ? remote.treadDepthMm !== null
                  ? Number(remote.treadDepthMm)
                  : null
                : existing.treadDepthMm,
        });
      }
    } else {
      await db.insert('registros_pneu', {
        id: remote.id,
        vehicleId: remote.veiculo_id || remote.vehicleId,
        date: remote.data || remote.date,
        km: Number(remote.km || 0),
        type: remote.tipo || remote.type || 'calibragem',
        pressurePsi:
          remote.pressao_psi !== undefined
            ? Number(remote.pressao_psi)
            : Number(remote.pressurePsi || 0),
        treadDepthMm:
          remote.sulco_mm !== undefined && remote.sulco_mm !== null
            ? Number(remote.sulco_mm)
            : remote.treadDepthMm !== undefined && remote.treadDepthMm !== null
              ? Number(remote.treadDepthMm)
              : null,
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});

// 10. Entidade Registros de Fluido (US11.1 / US02.7)
SyncEntityRegistry.register({
  name: 'registros_fluido',
  endpoint: '/api/v1/sync/registros_fluido',
  localTable: 'registros_fluido',
  applyRemote: async (remote: any) => {
    const { FluidRecordRepository } = await import('../../repositories/FluidRecordRepository');
    const existing = await FluidRecordRepository.findById(remote.id);
    const remoteUpdatedAt = new Date(remote.atualizado_em || remote.updatedAt || 0).getTime();

    if (remote.excluido_em || remote.deletedAt) {
      if (existing) {
        await FluidRecordRepository.delete(remote.id);
      }
      return;
    }

    if (existing) {
      const localUpdatedAt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (remoteUpdatedAt >= localUpdatedAt) {
        await FluidRecordRepository.update(remote.id, {
          fluidType: remote.tipo_fluido || remote.fluidType,
          date: remote.data || remote.date,
          km: remote.km !== undefined ? Number(remote.km) : existing.km,
          level: remote.nivel || remote.level || 'normal',
        });
      }
    } else {
      await db.insert('registros_fluido', {
        id: remote.id,
        vehicleId: remote.veiculo_id || remote.vehicleId,
        fluidType: remote.tipo_fluido || remote.fluidType || 'oleo_motor',
        date: remote.data || remote.date,
        km: Number(remote.km || 0),
        level: remote.nivel || remote.level || 'normal',
        createdAt: remote.criado_em || remote.createdAt || new Date().toISOString(),
        updatedAt: remote.atualizado_em || remote.updatedAt || new Date().toISOString(),
        deletedAt: null,
      });
    }
  },
});
