import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

let storageClient: Storage | null = null;
if (env.gcs.isConfigured) {
  try {
    storageClient = new Storage({
      projectId: env.gcs.projectId,
      keyFilename: env.gcs.keyFile,
    });
    console.log('☁️ Google Cloud Storage configurado com sucesso.');
  } catch (err) {
    console.error('⚠️ Falha ao inicializar Google Cloud Storage:', err);
  }
} else {
  console.log('ℹ️ Google Cloud Storage não configurado. Uploads locais em disco ativos.');
}

export class StorageService {
  private static localUploadsDir = path.resolve(process.cwd(), 'uploads');

  private static ensureLocalDir() {
    if (!fs.existsSync(this.localUploadsDir)) {
      fs.mkdirSync(this.localUploadsDir, { recursive: true });
    }
  }

  /**
   * Realiza upload de comprovante/anexo para o Google Cloud Storage ou diretório local em dev
   */
  static async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType = 'image/jpeg',
  ): Promise<string> {
    const uniqueFilename = `${Date.now()}_${filename.replace(/\s+/g, '_')}`;

    // 1. Upload via GCS real se configurado
    if (storageClient && env.gcs.bucketName) {
      try {
        const bucket = storageClient.bucket(env.gcs.bucketName);
        const file = bucket.file(`receipts/${uniqueFilename}`);

        await file.save(buffer, {
          metadata: { contentType: mimeType },
          resumable: false,
        });

        return `https://storage.googleapis.com/${env.gcs.bucketName}/receipts/${uniqueFilename}`;
      } catch (err) {
        console.error('⚠️ Falha no upload para o GCS. Fazendo fallback local:', err);
      }
    }

    // 2. Fallback de desenvolvimento: salvar localmente no servidor
    this.ensureLocalDir();
    const destinationPath = path.join(this.localUploadsDir, uniqueFilename);
    fs.writeFileSync(destinationPath, buffer);

    return `/uploads/${uniqueFilename}`;
  }

  /**
   * Upload de imagem de recibo/nota fiscal (OCR)
   */
  static async uploadReceipt(
    base64OrBuffer: string | Buffer,
    filename = 'receipt.jpg',
  ): Promise<string> {
    const buffer = Buffer.isBuffer(base64OrBuffer)
      ? base64OrBuffer
      : Buffer.from(base64OrBuffer.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    return this.uploadFile(buffer, filename, 'image/jpeg');
  }
}
