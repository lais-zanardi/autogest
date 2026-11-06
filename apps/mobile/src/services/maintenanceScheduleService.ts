import { MaintenanceScheduleRepository } from '../repositories/MaintenanceScheduleRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { NotificacaoService } from './notificationService';
import {
  MaintenanceSchedule,
  CreateMaintenanceScheduleDTO,
  UpdateMaintenanceScheduleDTO,
} from '@autogest/shared-types';

export class MaintenanceScheduleService {
  /**
   * Converte data ('AAAA-MM-DD') e hora ('HH:mm') em ISO timestamp
   */
  static calcularTimestampDisparo(data: string, hora: string = '09:00'): string {
    const [hStr, mStr] = hora.split(':');
    const h = parseInt(hStr || '9', 10);
    const m = parseInt(mStr || '0', 10);

    const [yearStr, monthStr, dayStr] = data.split('-');
    const dt = new Date(
      parseInt(yearStr, 10),
      parseInt(monthStr, 10) - 1,
      parseInt(dayStr, 10),
      h,
      m,
      0,
      0
    );
    return dt.toISOString();
  }

  /**
   * US30.2 & US30.4: Cria agendamento e agenda lembrete local pelo NotificacaoService
   */
  static async criarAgendamento(
    dto: CreateMaintenanceScheduleDTO
  ): Promise<MaintenanceSchedule> {
    const hora = dto.reminderTime || '09:00';
    const schedule = await MaintenanceScheduleRepository.create({
      ...dto,
      reminderTime: hora,
    });

    // Enfileira outbox para sincronização
    await SyncQueueRepository.enqueue('CREATE_FIXED_COST' as any, '/sync/agendamentos_manutencao', {
      id: schedule.id,
      veiculo_id: schedule.vehicleId,
      data: schedule.date,
      hora_lembrete: schedule.reminderTime,
      tipo_servico: schedule.serviceType,
      descricao: schedule.description,
      status: schedule.status,
      manutencao_id: schedule.maintenanceId,
      criado_em: schedule.createdAt,
      atualizado_em: schedule.updatedAt,
    }).catch(() => {});

    // Agenda o lembrete local com alarmes inexatos (US30.4)
    const timestampDisparo = this.calcularTimestampDisparo(schedule.date, hora);
    await NotificacaoService.agendar({
      title: '🔔 Lembrete de Manutenção Agendada',
      body: `${schedule.description} programada para hoje (${schedule.date}).`,
      triggerAt: timestampDisparo,
      channelId: 'manutencoes_preventivas',
      sourceType: 'agendamento',
      sourceId: schedule.id,
      vehicleId: schedule.vehicleId,
    });

    return schedule;
  }

  /**
   * US30.2 & US30.4: Edita agendamento e reagenda o lembrete local
   */
  static async editarAgendamento(
    id: string,
    updates: UpdateMaintenanceScheduleDTO
  ): Promise<MaintenanceSchedule | null> {
    const updated = await MaintenanceScheduleRepository.update(id, updates);
    if (!updated) return null;

    // Cancela agendamento anterior no NotificacaoService
    await NotificacaoService.cancelarPorReferencia(id);

    // Se continuar agendado, reagenda com nova data/hora
    if (updated.status === 'agendado') {
      const timestampDisparo = this.calcularTimestampDisparo(
        updated.date,
        updated.reminderTime
      );
      await NotificacaoService.agendar({
        title: '🔔 Lembrete de Manutenção Agendada',
        body: `${updated.description} programada para hoje (${updated.date}).`,
        triggerAt: timestampDisparo,
        channelId: 'manutencoes_preventivas',
        sourceType: 'agendamento',
        sourceId: updated.id,
        vehicleId: updated.vehicleId,
      });
    }

    // Sincroniza atualização
    await SyncQueueRepository.enqueue('UPDATE_FIXED_COST' as any, `/sync/agendamentos_manutencao/${id}`, {
      id: updated.id,
      veiculo_id: updated.vehicleId,
      data: updated.date,
      hora_lembrete: updated.reminderTime,
      tipo_servico: updated.serviceType,
      descricao: updated.description,
      status: updated.status,
      manutencao_id: updated.maintenanceId,
      atualizado_em: updated.updatedAt,
    }).catch(() => {});

    return updated;
  }

  /**
   * Cancela agendamento e remove o lembrete local
   */
  static async cancelarAgendamento(id: string): Promise<MaintenanceSchedule | null> {
    const updated = await MaintenanceScheduleRepository.update(id, {
      status: 'cancelado',
    });
    if (updated) {
      await NotificacaoService.cancelarPorReferencia(id);
    }
    return updated;
  }

  /**
   * Exclui agendamento
   */
  static async excluirAgendamento(id: string): Promise<boolean> {
    await NotificacaoService.cancelarPorReferencia(id);
    const deleted = await MaintenanceScheduleRepository.delete(id);
    if (deleted) {
      await SyncQueueRepository.enqueue('DELETE_FIXED_COST' as any, `/sync/agendamentos_manutencao/${id}`, {
        id,
      }).catch(() => {});
    }
    return deleted;
  }

  /**
   * US30.5: Conclui agendamento vinculando à manutenção realizada
   */
  static async concluirAgendamento(
    agendamentoId: string,
    manutencaoId: string
  ): Promise<MaintenanceSchedule | null> {
    await NotificacaoService.cancelarPorReferencia(agendamentoId);
    return this.editarAgendamento(agendamentoId, {
      status: 'concluido',
      maintenanceId: manutencaoId,
    });
  }

  /**
   * Lista agendamentos por veículo
   */
  static async listarPorVeiculo(vehicleId: string): Promise<MaintenanceSchedule[]> {
    return MaintenanceScheduleRepository.listByVehicle(vehicleId);
  }
}
