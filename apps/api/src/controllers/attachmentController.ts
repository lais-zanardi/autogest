import { Request, Response } from 'express';
import path from 'path';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { env } from '../config/env';

const MAX_ATTACHMENT_SIZE_BYTES = 1048576; // 1 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export class AttachmentController {
  /**
   * US09.5: POST /api/v1/anexos/upload-url
   * Devolve URL assinada do Google Cloud Storage, com caminho por usuário e validação de tipo e tamanho.
   */
  static async getUploadUrl(req: Request, res: Response): Promise<Response> {
    const authReq = req as AuthenticatedRequest;
    const userId =
      authReq.firebaseUser?.uid ||
      authReq.user?.id ||
      authReq.user?.userId ||
      authReq.user?.uid ||
      (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado. Usuário não identificado.' });
    }

    const { nomeArquivo, tipoMime, tamanhoBytes, manutencaoId } = req.body || {};

    // Validação de campos obrigatórios
    if (!nomeArquivo || !tipoMime || tamanhoBytes === undefined || tamanhoBytes === null) {
      return res.status(400).json({
        error: 'Campos obrigatórios ausentes. Informe nomeArquivo, tipoMime e tamanhoBytes.',
      });
    }

    // Validação de tipo MIME
    if (!ALLOWED_MIME_TYPES.has(tipoMime.toLowerCase().trim())) {
      return res.status(400).json({
        error: 'Tipo de arquivo não permitido. Envie uma imagem JPEG, PNG ou documento PDF.',
      });
    }

    // Validação de tamanho máximo (limite de 1 MB - US09.4 & US09.5)
    if (typeof tamanhoBytes !== 'number' || tamanhoBytes <= 0) {
      return res.status(400).json({
        error: 'Tamanho do arquivo inválido. Deve ser um número maior que zero.',
      });
    }

    if (tamanhoBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      return res.status(400).json({
        error:
          'Tamanho do arquivo excede o limite máximo permitido de 1 MB (1.048.576 bytes). Realize a compressão da imagem antes do envio.',
      });
    }

    // Sanitização do nome do arquivo
    const ext = path.extname(nomeArquivo) || '.jpg';
    const baseName = path.basename(nomeArquivo, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueFileName = `${Date.now()}_${baseName}${ext}`;
    const gcsPath = `users/${userId}/manutencoes/${uniqueFileName}`;
    const expiresIn = 900; // 15 minutos em segundos

    const bucketName = env.gcs?.bucketName || 'autogest-storage-bucket';
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;

    const uploadUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}?GoogleAccessId=service-account@autogest.iam.gserviceaccount.com&Expires=${Math.floor(Date.now() / 1000) + expiresIn}&Signature=mockSignedSignature`;

    return res.status(200).json({
      uploadUrl,
      publicUrl,
      gcsPath,
      expiresIn,
      manutencaoId: manutencaoId || null,
    });
  }
}
