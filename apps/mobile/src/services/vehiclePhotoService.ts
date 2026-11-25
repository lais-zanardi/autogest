import {
  CreateVehiclePhotoDTO,
  Vehicle,
  VehiclePhotoRecord,
} from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { MaintenanceService } from './maintenanceService';
import { api } from './api';
import { useAppStore } from '../store/useAppStore';

export const FOTOS_VEICULO_TABLE = 'fotos_veiculo';

function generateId(): string {
  return `foto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface SignedUploadHttpClient {
  post: (url: string, body: any) => Promise<{ data: any }>;
  put: (url: string, body?: any) => Promise<{ data: any }>;
}

/**
 * US32.4: Ordena fotos em ordem cronológica (data crescente, desempate por criado_em).
 */
export function ordenarFotosCronologicamente(
  fotos: VehiclePhotoRecord[],
): VehiclePhotoRecord[] {
  return [...fotos].sort(
    (a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em),
  );
}

/**
 * US32.2, US32.3 & US32.4 — Serviço de Galeria de Fotos do Veículo.
 * Reutiliza integralmente a validação/compressão (<= 1 MB) e a rota de URL assinada
 * `POST /api/v1/anexos/upload-url` da US09, sem duplicar lógica de upload.
 */
export class VehiclePhotoService {
  static async adicionarFoto(dto: CreateVehiclePhotoDTO): Promise<VehiclePhotoRecord> {
    if (!dto.veiculoId) {
      throw new Error('Veículo é obrigatório.');
    }
    if (!dto.data) {
      throw new Error('Data da foto é obrigatória.');
    }

    // Reusa validação de compressão e tamanho <= 1 MB da US09.4
    const validated = await MaintenanceService.validateAndPrepareAttachment({
      localPath: dto.localPath,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType || 'image/jpeg',
    });

    const db = DatabaseConnection.getInstance();
    const now = new Date().toISOString();
    const record: VehiclePhotoRecord = {
      id: generateId(),
      veiculo_id: dto.veiculoId,
      vehicleId: dto.veiculoId,
      data: dto.data.slice(0, 10),
      legenda: dto.legenda ? dto.legenda.trim() : null,
      arquivo_local: validated.localPath,
      url_gcs: null,
      tamanho_bytes: validated.fileSize,
      mime_type: validated.mimeType,
      status_upload: 'pendente',
      criado_em: now,
      atualizado_em: now,
      excluido_em: null,
    };

    await db.insert(FOTOS_VEICULO_TABLE, record);
    await SyncQueueRepository.enqueue(
      'CREATE_VEHICLE_PHOTO',
      '/api/v1/sync/fotos_veiculo',
      record,
    ).catch(() => {});

    return record;
  }

  static async listarGaleriaCronologica(veiculoId: string): Promise<VehiclePhotoRecord[]> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<VehiclePhotoRecord>(FOTOS_VEICULO_TABLE)) || [];
    const ativas = rows.filter(r => !r.excluido_em && r.veiculo_id === veiculoId);
    return ordenarFotosCronologicamente(ativas);
  }

  /**
   * US32.3: Reusa o endpoint `POST /api/v1/anexos/upload-url` da US09.5
   * (caminho por usuário, expiração 15 min, validação de tipo e tamanho <= 1 MB).
   */
  static async enviarFotoParaNuvem(
    fotoId: string,
    httpClient: SignedUploadHttpClient = api,
  ): Promise<VehiclePhotoRecord | null> {
    const db = DatabaseConnection.getInstance();
    const rows = [...((await db.getTableData<VehiclePhotoRecord>(FOTOS_VEICULO_TABLE)) || [])];
    const idx = rows.findIndex(r => r.id === fotoId && !r.excluido_em);
    if (idx < 0) return null;

    const foto = rows[idx];
    const nomeArquivo = foto.arquivo_local.split('/').pop() || 'foto_veiculo.jpg';

    try {
      const uploadRes = await httpClient.post('/api/v1/anexos/upload-url', {
        nomeArquivo,
        tipoMime: foto.mime_type || 'image/jpeg',
        tamanhoBytes: foto.tamanho_bytes,
      });

      const { uploadUrl, publicUrl } = uploadRes.data;
      await httpClient.put(uploadUrl, {
        headers: { 'Content-Type': foto.mime_type || 'image/jpeg' },
      });

      const updated: VehiclePhotoRecord = {
        ...foto,
        url_gcs: publicUrl,
        status_upload: 'enviado',
        atualizado_em: new Date().toISOString(),
      };
      rows[idx] = updated;
      await db.saveTableData(FOTOS_VEICULO_TABLE, rows);
      await SyncQueueRepository.enqueue(
        'UPDATE_VEHICLE_PHOTO',
        '/api/v1/sync/fotos_veiculo',
        updated,
      ).catch(() => {});
      return updated;
    } catch {
      const failed: VehiclePhotoRecord = {
        ...foto,
        status_upload: 'erro',
        atualizado_em: new Date().toISOString(),
      };
      rows[idx] = failed;
      await db.saveTableData(FOTOS_VEICULO_TABLE, rows);
      return failed;
    }
  }

  /**
   * US32.4: Escolhe foto de capa do veículo (`foto_capa_id` / `coverPhotoId`).
   */
  static async definirFotoCapa(veiculoId: string, fotoId: string): Promise<Vehicle | null> {
    const galeria = await this.listarGaleriaCronologica(veiculoId);
    const existe = galeria.some(f => f.id === fotoId);
    if (!existe) {
      throw new Error('Foto não encontrada na galeria deste veículo.');
    }

    const updated = await VehicleRepository.update(veiculoId, {
      coverPhotoId: fotoId,
      foto_capa_id: fotoId,
    });

    if (updated) {
      await SyncQueueRepository.enqueue('UPDATE_VEHICLE', '/api/v1/sync/veiculos', updated).catch(
        () => {},
      );
      const store = useAppStore.getState();
      if (store.selectedVehicle?.id === veiculoId) {
        store.setSelectedVehicle(updated);
      }
    }

    return updated;
  }

  static async excluirFoto(fotoId: string): Promise<boolean> {
    const db = DatabaseConnection.getInstance();
    const rows = [...((await db.getTableData<VehiclePhotoRecord>(FOTOS_VEICULO_TABLE)) || [])];
    const idx = rows.findIndex(r => r.id === fotoId && !r.excluido_em);
    if (idx < 0) return false;

    const foto = rows[idx];
    const now = new Date().toISOString();
    rows[idx] = {
      ...foto,
      excluido_em: now,
      atualizado_em: now,
    };
    await db.saveTableData(FOTOS_VEICULO_TABLE, rows);
    await SyncQueueRepository.enqueue('DELETE_VEHICLE_PHOTO', '/api/v1/sync/fotos_veiculo', {
      id: fotoId,
    }).catch(() => {});

    const veiculo = await VehicleRepository.findById(foto.veiculo_id);
    if (veiculo && (veiculo.foto_capa_id === fotoId || veiculo.coverPhotoId === fotoId)) {
      await VehicleRepository.update(foto.veiculo_id, {
        coverPhotoId: null,
        foto_capa_id: null,
      });
    }

    return true;
  }
}
