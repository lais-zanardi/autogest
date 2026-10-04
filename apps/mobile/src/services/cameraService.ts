import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';

export interface PickedImageResult {
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  base64?: string;
}

export class CameraService {
  /**
   * Captura imagem do comprovante através da Câmera nativa
   */
  static async captureReceiptFromCamera(): Promise<string | null> {
    try {
      const result: ImagePickerResponse = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
      });
      return result.assets && result.assets[0]?.base64 ? result.assets[0].base64 : null;
    } catch {
      return null;
    }
  }

  /**
   * Seleciona imagem do comprovante existente na Galeria
   */
  static async selectReceiptFromGallery(): Promise<string | null> {
    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
      });
      return result.assets && result.assets[0]?.base64 ? result.assets[0].base64 : null;
    } catch {
      return null;
    }
  }

  /**
   * US09.4: Captura ou seleção de anexos com compressão nativa configurada (<= 1 MB)
   */
  static async pickMaintenanceImage(
    source: 'camera' | 'gallery' = 'gallery',
  ): Promise<PickedImageResult | null> {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.7 as const, // Compressão de imagem automática para manter < 1 MB
      maxWidth: 1600,
      maxHeight: 1600,
      includeBase64: true,
    };

    try {
      const result: ImagePickerResponse =
        source === 'camera' ? await launchCamera(options) : await launchImageLibrary(options);

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset.uri) return null;

      // Estimativa ou tamanho informado do arquivo
      const fileSize =
        asset.fileSize || (asset.base64 ? Math.round((asset.base64.length * 3) / 4) : 450000);

      return {
        uri: asset.uri,
        fileName: asset.fileName || `anexo_${Date.now()}.jpg`,
        fileSize,
        mimeType: asset.type || 'image/jpeg',
        base64: asset.base64,
      };
    } catch {
      return null;
    }
  }
}
