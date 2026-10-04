import { MaintenanceAttachment, AttachmentUploadStatus } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';

/**
 * US09.1 & US09.6: Repositório de Anexos (anexos).
 * Gerencia fotos e comprovantes locais, status de upload e vínculo com manutenções.
 */
export class AttachmentRepository {
  private static TABLE = 'anexos';
  private static LEGACY_TABLE = 'local_anexos';

  static async create(data: {
    maintenanceId?: string | null;
    localPath: string;
    fileSize: number;
    mimeType?: string | null;
    gcsUrl?: string | null;
    uploadStatus?: AttachmentUploadStatus;
  }): Promise<MaintenanceAttachment> {
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: MaintenanceAttachment = {
      id,
      maintenanceId: data.maintenanceId || null,
      localPath: data.localPath,
      fileSize: data.fileSize,
      mimeType: data.mimeType || 'image/jpeg',
      gcsUrl: data.gcsUrl || null,
      uploadStatus: data.uploadStatus || 'pendente',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.insert(this.TABLE, record);
    try {
      await db.insert(this.LEGACY_TABLE, record);
    } catch {
      // Ignore
    }

    return record;
  }

  static async findById(id: string): Promise<MaintenanceAttachment | null> {
    const records = await db.find<MaintenanceAttachment>(
      this.TABLE,
      item => item.id === id && !item.deletedAt,
    );
    if (records.length > 0) return records[0];

    const fallback = await db.find<MaintenanceAttachment>(
      this.LEGACY_TABLE,
      item => item.id === id && !item.deletedAt,
    );
    return fallback[0] || null;
  }

  static async listByMaintenance(maintenanceId: string): Promise<MaintenanceAttachment[]> {
    const records = await db.find<MaintenanceAttachment>(
      this.TABLE,
      item => item.maintenanceId === maintenanceId && !item.deletedAt,
    );
    return records;
  }

  static async listPendingUpload(): Promise<MaintenanceAttachment[]> {
    const records = await db.find<MaintenanceAttachment>(
      this.TABLE,
      item => (item.uploadStatus === 'pendente' || item.uploadStatus === 'erro') && !item.deletedAt,
    );
    return records;
  }

  static async update(
    id: string,
    updates: Partial<MaintenanceAttachment>,
  ): Promise<MaintenanceAttachment | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: MaintenanceAttachment = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await db.update<MaintenanceAttachment>(this.TABLE, id, updated);
    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const deleted: MaintenanceAttachment = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    };

    await db.update<MaintenanceAttachment>(this.TABLE, id, deleted);
    return true;
  }

  static async saveAll(items: MaintenanceAttachment[]): Promise<void> {
    await db.saveTableData(this.TABLE, items);
  }

  static async clear(): Promise<void> {
    await db.saveTableData(this.TABLE, []);
    await db.saveTableData(this.LEGACY_TABLE, []);
  }
}
