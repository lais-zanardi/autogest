import {
  CreateInspectionReminderDTO,
  InspectionCycleRecord,
  InspectionReminderRecord,
} from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { NotificacaoService } from './notificationService';
import {
  deveRepetirNotificacaoCiclo,
  LIMITE_TENTATIVAS_REPETICAO_INSPECAO,
  proximoCicloInspecao,
} from './visualInspectionDomain';

export const LEMBRETES_INSPECAO_TABLE = 'lembretes_inspecao';
export const CICLOS_INSPECAO_TABLE = 'ciclos_inspecao';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * US31.2 & US31.4 — Serviço de Lembretes de Inspeção Visual integrado ao NotificacaoService
 * e respeitando a pausa global de notificações (US39).
 */
export class VisualInspectionService {
  static async criarLembrete(dto: CreateInspectionReminderDTO): Promise<InspectionReminderRecord> {
    const item = (dto.item || '').trim();
    if (!item) {
      throw new Error('O item de inspeção é obrigatório.');
    }
    const dias = Math.round(Number(dto.periodicidadeDias));
    if (!Number.isFinite(dias) || dias <= 0) {
      throw new Error('A periodicidade em dias deve ser maior que zero.');
    }

    const db = DatabaseConnection.getInstance();
    const now = new Date().toISOString();
    const record: InspectionReminderRecord = {
      id: generateId('insp'),
      veiculo_id: dto.veiculoId,
      vehicleId: dto.veiculoId,
      item,
      periodicidade_dias: dias,
      ultima_inspecao_em: dto.ultimaInspecaoEm ?? now,
      ativo: dto.ativo !== undefined ? Boolean(dto.ativo) : true,
      criado_em: now,
      atualizado_em: now,
      excluido_em: null,
    };

    await db.insert(LEMBRETES_INSPECAO_TABLE, record);
    await SyncQueueRepository.enqueue(
      'CREATE_INSPECTION_REMINDER',
      '/api/v1/sync/lembretes_inspecao',
      record,
    ).catch(() => {});

    if (record.ativo) {
      await this.agendarProximoCiclo(record);
    }

    return record;
  }

  static async listarLembretes(veiculoId?: string): Promise<InspectionReminderRecord[]> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<InspectionReminderRecord>(LEMBRETES_INSPECAO_TABLE)) || [];
    return rows
      .filter(r => !r.excluido_em && (!veiculoId || r.veiculo_id === veiculoId))
      .sort((a, b) => a.item.localeCompare(b.item));
  }

  static async listarCiclosAbertos(): Promise<InspectionCycleRecord[]> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<InspectionCycleRecord>(CICLOS_INSPECAO_TABLE)) || [];
    return rows.filter(r => !r.excluido_em && !r.concluido_em);
  }

  static async alternarAtivo(
    lembreteId: string,
    ativo: boolean,
  ): Promise<InspectionReminderRecord | null> {
    const db = DatabaseConnection.getInstance();
    const rows = [
      ...((await db.getTableData<InspectionReminderRecord>(LEMBRETES_INSPECAO_TABLE)) || []),
    ];
    const idx = rows.findIndex(r => r.id === lembreteId && !r.excluido_em);
    if (idx < 0) return null;

    rows[idx] = {
      ...rows[idx],
      ativo,
      atualizado_em: new Date().toISOString(),
    };
    await db.saveTableData(LEMBRETES_INSPECAO_TABLE, rows);
    await SyncQueueRepository.enqueue(
      'UPDATE_INSPECTION_REMINDER',
      '/api/v1/sync/lembretes_inspecao',
      rows[idx],
    ).catch(() => {});

    if (ativo) {
      await this.agendarProximoCiclo(rows[idx]);
    }
    return rows[idx];
  }

  static async excluirLembrete(lembreteId: string): Promise<boolean> {
    const db = DatabaseConnection.getInstance();
    const rows = [
      ...((await db.getTableData<InspectionReminderRecord>(LEMBRETES_INSPECAO_TABLE)) || []),
    ];
    const idx = rows.findIndex(r => r.id === lembreteId && !r.excluido_em);
    if (idx < 0) return false;

    const now = new Date().toISOString();
    rows[idx] = {
      ...rows[idx],
      ativo: false,
      excluido_em: now,
      atualizado_em: now,
    };
    await db.saveTableData(LEMBRETES_INSPECAO_TABLE, rows);
    await SyncQueueRepository.enqueue(
      'DELETE_INSPECTION_REMINDER',
      '/api/v1/sync/lembretes_inspecao',
      { id: lembreteId },
    ).catch(() => {});
    return true;
  }

  private static async agendarProximoCiclo(
    lembrete: InspectionReminderRecord,
    dataReferencia: Date = new Date(),
  ): Promise<string> {
    const prox = proximoCicloInspecao(lembrete, dataReferencia);
    await NotificacaoService.agendar({
      title: `Inspeção visual: ${lembrete.item}`,
      body: `Hora de verificar ${lembrete.item.toLowerCase()} do seu veículo.`,
      triggerAt: prox.proximaDataIso,
      channelId: 'inspecao_visual',
      importance: 'default',
      sourceType: 'outro',
      sourceId: lembrete.id,
      vehicleId: lembrete.veiculo_id,
    }).catch(() => {});
    return prox.proximaDataIso;
  }

  /**
   * US31.4: Verifica lembretes vencidos e ciclos abertos:
   * - Se vencido e sem ciclo aberto: abre ciclo e dispara notificação pelo NotificacaoService.
   * - Se ciclo aberto: repete diariamente até marcar como feito ou atingir limite de tentativas.
   * - Respeita pausa global (US39) automaticamente via NotificacaoService.disparar.
   */
  static async verificarEDispararCiclos(
    dataReferencia: Date = new Date(),
  ): Promise<{ disparados: number }> {
    const db = DatabaseConnection.getInstance();
    const lembretes = await this.listarLembretes();
    const ciclos = [
      ...((await db.getTableData<InspectionCycleRecord>(CICLOS_INSPECAO_TABLE)) || []),
    ];

    let disparados = 0;
    let ciclosAlterados = false;
    const nowIso = dataReferencia.toISOString();

    for (const lembrete of lembretes) {
      if (!lembrete.ativo) continue;

      const cicloAbertoIdx = ciclos.findIndex(
        c => !c.excluido_em && !c.concluido_em && c.lembrete_id === lembrete.id,
      );

      if (cicloAbertoIdx >= 0) {
        const ciclo = ciclos[cicloAbertoIdx];
        if (
          deveRepetirNotificacaoCiclo(ciclo, dataReferencia, LIMITE_TENTATIVAS_REPETICAO_INSPECAO)
        ) {
          const res = await NotificacaoService.disparar(
            {
              title: `Inspeção pendente: ${lembrete.item}`,
              body: `Lembrete diário: verifique ${lembrete.item.toLowerCase()} e marque como feito.`,
              channelId: 'inspecao_visual',
              importance: 'default',
            },
            dataReferencia,
          );

          if (res.sent) {
            ciclos[cicloAbertoIdx] = {
              ...ciclo,
              ultimo_disparo_em: nowIso,
              tentativas: ciclo.tentativas + 1,
              atualizado_em: nowIso,
            };
            ciclosAlterados = true;
            disparados += 1;
          }
        }
      } else {
        const prox = proximoCicloInspecao(lembrete, dataReferencia);
        if (prox.vencido) {
          const res = await NotificacaoService.disparar(
            {
              title: `Inspeção visual: ${lembrete.item}`,
              body: `Chegou o dia de inspecionar ${lembrete.item.toLowerCase()}.`,
              channelId: 'inspecao_visual',
              importance: 'default',
            },
            dataReferencia,
          );

          if (res.sent) {
            const novoCiclo: InspectionCycleRecord = {
              id: generateId('ciclo'),
              lembrete_id: lembrete.id,
              disparado_em: nowIso,
              ultimo_disparo_em: nowIso,
              tentativas: 1,
              concluido_em: null,
              criado_em: nowIso,
              atualizado_em: nowIso,
              excluido_em: null,
            };
            ciclos.push(novoCiclo);
            ciclosAlterados = true;
            disparados += 1;
            await SyncQueueRepository.enqueue(
              'CREATE_INSPECTION_CYCLE',
              '/api/v1/sync/ciclos_inspecao',
              novoCiclo,
            ).catch(() => {});
          }
        }
      }
    }

    if (ciclosAlterados) {
      await db.saveTableData(CICLOS_INSPECAO_TABLE, ciclos);
    }

    return { disparados };
  }

  /**
   * US31.4 & US31.5: Marca "inspeção feita", fecha o ciclo aberto, atualiza `ultima_inspecao_em`
   * e agenda o próximo ciclo no NotificacaoService.
   */
  static async marcarInspecaoFeita(
    lembreteId: string,
    dataConclusao: Date = new Date(),
  ): Promise<{
    lembrete: InspectionReminderRecord;
    cicloFechado: InspectionCycleRecord | null;
    proximoAgendamentoIso: string;
  } | null> {
    const db = DatabaseConnection.getInstance();
    const lembretes = [
      ...((await db.getTableData<InspectionReminderRecord>(LEMBRETES_INSPECAO_TABLE)) || []),
    ];
    const lIdx = lembretes.findIndex(l => l.id === lembreteId && !l.excluido_em);
    if (lIdx < 0) return null;

    const nowIso = dataConclusao.toISOString();
    const atualizado: InspectionReminderRecord = {
      ...lembretes[lIdx],
      ultima_inspecao_em: nowIso,
      atualizado_em: nowIso,
    };
    lembretes[lIdx] = atualizado;
    await db.saveTableData(LEMBRETES_INSPECAO_TABLE, lembretes);

    const ciclos = [
      ...((await db.getTableData<InspectionCycleRecord>(CICLOS_INSPECAO_TABLE)) || []),
    ];
    const cIdx = ciclos.findIndex(
      c => !c.excluido_em && !c.concluido_em && c.lembrete_id === lembreteId,
    );
    let cicloFechado: InspectionCycleRecord | null = null;
    if (cIdx >= 0) {
      cicloFechado = {
        ...ciclos[cIdx],
        concluido_em: nowIso,
        atualizado_em: nowIso,
      };
      ciclos[cIdx] = cicloFechado;
      await db.saveTableData(CICLOS_INSPECAO_TABLE, ciclos);
      await SyncQueueRepository.enqueue(
        'UPDATE_INSPECTION_CYCLE',
        '/api/v1/sync/ciclos_inspecao',
        cicloFechado,
      ).catch(() => {});
    }

    await SyncQueueRepository.enqueue(
      'UPDATE_INSPECTION_REMINDER',
      '/api/v1/sync/lembretes_inspecao',
      atualizado,
    ).catch(() => {});

    const proximoAgendamentoIso = await this.agendarProximoCiclo(atualizado, dataConclusao);
    return {
      lembrete: atualizado,
      cicloFechado,
      proximoAgendamentoIso,
    };
  }
}
