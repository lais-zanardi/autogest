import { MaintenanceAttachment } from '@autogest/shared-types';
import { AttachmentRepository } from '../repositories/AttachmentRepository';
import { api } from './api';

export type AttachmentUploadFn = (attachment: MaintenanceAttachment) => Promise<{ gcsUrl: string }>;

/**
 * US09.6: Fila de Upload de Imagens e Comprovantes.
 * Mantém anexos em status pendente quando offline e processa o envio quando houver conexão.
 */
export class AttachmentUploadQueue {
  private static isProcessing = false;

  /**
   * Processa todos os anexos com status 'pendente' ou 'erro'
   */
  static async processPending(
    customUploader?: AttachmentUploadFn,
  ): Promise<{ successCount: number; failCount: number }> {
    if (this.isProcessing) {
      return { successCount: 0, failCount: 0 };
    }

    this.isProcessing = true;
    let successCount = 0;
    let failCount = 0;

    try {
      const pendingItems = await AttachmentRepository.listPendingUpload();

      for (const item of pendingItems) {
        try {
          let gcsUrl = item.gcsUrl;

          if (customUploader) {
            const res = await customUploader(item);
            gcsUrl = res.gcsUrl;
          } else {
            // 1. Solicita URL assinada do GCS à API backend (US09.5)
            const fileName = item.localPath.split('/').pop() || 'comprovante.jpg';
            const uploadRes = await api.post('/api/v1/anexos/upload-url', {
              nomeArquivo: fileName,
              tipoMime: item.mimeType || 'image/jpeg',
              tamanhoBytes: item.fileSize,
              manutencaoId: item.maintenanceId,
            });

            const { uploadUrl, publicUrl } = uploadRes.data;

            // 2. Realiza o PUT binário direto no bucket (ou endpoint de upload direto)
            await api.put(uploadUrl, {
              headers: { 'Content-Type': item.mimeType || 'image/jpeg' },
            });

            gcsUrl = publicUrl;
          }

          // 3. Atualiza anexo com status 'enviado' e a URL final do GCS
          await AttachmentRepository.update(item.id, {
            uploadStatus: 'enviado',
            gcsUrl,
          });

          successCount++;
        } catch (err) {
          console.warn(`[AttachmentUploadQueue] Erro ao enviar anexo ${item.id}:`, err);
          await AttachmentRepository.update(item.id, {
            uploadStatus: 'erro',
          });
          failCount++;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { successCount, failCount };
  }
}
