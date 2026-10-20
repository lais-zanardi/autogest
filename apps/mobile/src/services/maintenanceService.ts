import {
  Maintenance,
  CreateMaintenanceDTO,
  UpdateMaintenanceDTO,
  MaintenanceType,
  MaintenanceAttachment,
} from '@autogest/shared-types';
import { MaintenanceRepository } from '../repositories/MaintenanceRepository';
import { AttachmentRepository } from '../repositories/AttachmentRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { OdometerRepository } from '../repositories/OdometerRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { useAppStore } from '../store/useAppStore';

const MAX_ATTACHMENT_SIZE_BYTES = 1048576; // 1 MB (US09.4 & Decisão 8)

export class MaintenanceService {
  /**
   * US09.4 & US09.8: Validação e preparação de anexo com limite de 1 MB
   */
  static async validateAndPrepareAttachment(data: {
    localPath: string;
    fileSize: number;
    mimeType?: string;
  }): Promise<{ localPath: string; fileSize: number; mimeType: string }> {
    if (!data.localPath) {
      throw new Error('Caminho do arquivo local é obrigatório.');
    }

    if (typeof data.fileSize !== 'number' || data.fileSize <= 0) {
      throw new Error('Tamanho do arquivo inválido. Deve ser maior que zero.');
    }

    if (data.fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(
        'O tamanho do anexo excede o limite máximo permitido de 1 MB (1.048.576 bytes). Realize a compressão da imagem antes do envio.',
      );
    }

    return {
      localPath: data.localPath,
      fileSize: data.fileSize,
      mimeType: data.mimeType || 'image/jpeg',
    };
  }

  /**
   * US09.2 & US09.3: Registro de Manutenção com regras de hodômetro e vínculo de anexos
   */
  static async createMaintenance(dto: CreateMaintenanceDTO): Promise<Maintenance> {
    // 1. Validações de campos obrigatórios
    if (!dto.vehicleId) {
      throw new Error('Veículo é obrigatório.');
    }
    if (!dto.date) {
      throw new Error('Data da manutenção é obrigatória.');
    }
    if (dto.odometer === undefined || dto.odometer === null || Number(dto.odometer) < 0) {
      throw new Error('Quilometragem inválida. Deve ser maior ou igual a zero.');
    }
    if (!dto.type || (dto.type !== 'preventiva' && dto.type !== 'corretiva')) {
      throw new Error('Tipo de manutenção é obrigatório (preventiva ou corretiva).');
    }
    if (!dto.serviceType) {
      throw new Error('Tipo de serviço é obrigatório.');
    }
    if (!dto.description || !dto.description.trim()) {
      throw new Error('Descrição da manutenção é obrigatória.');
    }
    if (dto.totalValue === undefined || dto.totalValue === null || Number(dto.totalValue) < 0) {
      throw new Error('Valor da manutenção deve ser maior ou igual a zero.');
    }

    const vehicle = await VehicleRepository.findById(dto.vehicleId);
    if (!vehicle) {
      throw new Error('Veículo informado não foi encontrado.');
    }

    // 2. Grava registro de manutenção
    const maintenance = await MaintenanceRepository.create(dto);

    // 3. Regra de Hodômetro (US09.3):
    // "grava leitura de hodômetro apenas se o km for maior que o último, o que permite lançar manutenções antigas"
    const currentVehicleKm = vehicle.currentOdometer || 0;
    const isNewerKm = Number(dto.odometer) > currentVehicleKm;

    if (isNewerKm) {
      await OdometerRepository.create({
        vehicleId: dto.vehicleId,
        km: Number(dto.odometer),
        date: dto.date,
        origin: 'manutencao',
      });

      const updatedVehicle = await VehicleRepository.update(dto.vehicleId, {
        currentOdometer: Number(dto.odometer),
      });

      // Atualiza estado global se for o veículo ativo
      const store = useAppStore.getState();
      if (store.selectedVehicle?.id === dto.vehicleId && updatedVehicle) {
        store.setSelectedVehicle(updatedVehicle);
      }
    }

    // 4. Associa anexos vinculados a esta manutenção
    let attachments: MaintenanceAttachment[] = [];
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      for (const attId of dto.attachmentIds) {
        await AttachmentRepository.update(attId, {
          maintenanceId: maintenance.id,
        });
      }
      attachments = await AttachmentRepository.listByMaintenance(maintenance.id);
    }

    // 5. Enfileira na outbox de sincronização offline (US02.4)
    await SyncQueueRepository.enqueue('CREATE_MAINTENANCE', '/sync/manutencoes', maintenance).catch(
      () => {},
    );

    // US10.5 & US10.7: Reavalia regras preventivas e reinicia o ciclo de notificação para este tipo de serviço
    const { MaintenanceAlertService } = await import('./maintenanceAlertService');
    const { NotificationService } = await import('./notificationService');
    const { MaintenanceRuleRepository } = await import('../repositories/MaintenanceRuleRepository');
    const matchingRule = await MaintenanceRuleRepository.findByVehicleAndServiceType(
      dto.vehicleId,
      dto.serviceType,
    );
    if (matchingRule) {
      await NotificationService.clearNotificationCycleForRule(matchingRule.id);
    }
    MaintenanceAlertService.evaluateVehicleAlerts(dto.vehicleId).catch(() => {});

    // US13.3: Recalcula indicadores globais do dashboard ao salvar manutenção
    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(dto.vehicleId).catch(() => {});

    return {
      ...maintenance,
      attachments,
    };
  }

  /**
   * Atualiza dados de uma manutenção existente
   */
  static async updateMaintenance(
    id: string,
    updates: UpdateMaintenanceDTO,
  ): Promise<Maintenance | null> {
    const updated = await MaintenanceRepository.update(id, updates);
    if (!updated) return null;

    if (updates.attachmentIds && updates.attachmentIds.length > 0) {
      for (const attId of updates.attachmentIds) {
        await AttachmentRepository.update(attId, {
          maintenanceId: id,
        });
      }
    }

    await SyncQueueRepository.enqueue(
      'UPDATE_MAINTENANCE',
      `/sync/manutencoes/${id}`,
      updated,
    ).catch(() => {});

    // US13.3: Recalcula indicadores globais do dashboard ao editar manutenção
    const { DashboardIndicatorsService } = await import('./dashboardIndicators');
    await DashboardIndicatorsService.refreshForVehicle(updated.vehicleId).catch(() => {});

    const attachments = await AttachmentRepository.listByMaintenance(id);
    return {
      ...updated,
      attachments,
    };
  }

  /**
   * Exclusão lógica de manutenção e seus anexos
   */
  static async deleteMaintenance(id: string): Promise<boolean> {
    const existing = await MaintenanceRepository.findById(id);
    const success = await MaintenanceRepository.delete(id);
    if (success) {
      // Exclusão lógica em cascata para os anexos
      const attachments = await AttachmentRepository.listByMaintenance(id);
      for (const att of attachments) {
        await AttachmentRepository.delete(att.id);
      }

      await SyncQueueRepository.enqueue('DELETE_MAINTENANCE', `/sync/manutencoes/${id}`, {
        id,
      }).catch(() => {});

      // US13.3: Recalcula indicadores globais do dashboard ao excluir manutenção
      if (existing?.vehicleId) {
        const { DashboardIndicatorsService } = await import('./dashboardIndicators');
        await DashboardIndicatorsService.refreshForVehicle(existing.vehicleId).catch(() => {});
      }
    }
    return success;
  }

  /**
   * US09.7: Histórico por veículo com filtro por tipo
   */
  static async listByVehicle(
    vehicleId: string,
    filterType?: MaintenanceType,
  ): Promise<Maintenance[]> {
    const records = await MaintenanceRepository.listByVehicle(vehicleId, filterType);
    const results: Maintenance[] = [];

    for (const item of records) {
      const attachments = await AttachmentRepository.listByMaintenance(item.id);
      results.push({
        ...item,
        attachments,
      });
    }

    return results;
  }
}
