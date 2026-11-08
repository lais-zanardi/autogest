import { PermissionsAndroid, Platform } from 'react-native';
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
   * Solicita e verifica permissão de acesso à câmera no Android nativo
   */
  static async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (hasPermission) {
        return true;
      }

      const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Permissão de Câmera',
        message: 'O AutoGest precisa de acesso à câmera para fotografar notas fiscais e comprovantes.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Cancelar',
      });

      return status === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  /**
   * Captura imagem do comprovante através da Câmera nativa
   */
  static async captureReceiptFromCamera(): Promise<string | null> {
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      throw new Error('Permissão da câmera negada. Conceda acesso à câmera nas configurações do celular.');
    }

    try {
      const result: ImagePickerResponse = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
      });

      if (result.didCancel) {
        return null;
      }

      if (result.errorCode) {
        if (result.errorCode === 'permission') {
          throw new Error('Permissão da câmera não concedida.');
        }
        if (result.errorCode === 'camera_unavailable') {
          throw new Error('Câmera indisponível neste dispositivo.');
        }
        throw new Error(result.errorMessage || 'Falha ao acessar a câmera.');
      }

      return result.assets && result.assets[0]?.base64 ? result.assets[0].base64 : null;
    } catch (error: any) {
      if (error?.message) {
        throw error;
      }
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

      if (result.didCancel) {
        return null;
      }

      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Falha ao acessar a galeria de imagens.');
      }

      return result.assets && result.assets[0]?.base64 ? result.assets[0].base64 : null;
    } catch (error: any) {
      if (error?.message) {
        throw error;
      }
      return null;
    }
  }

  /**
   * US09.4: Captura ou seleção de anexos com compressão nativa configurada (<= 1 MB)
   */
  static async pickMaintenanceImage(
    source: 'camera' | 'gallery' = 'gallery',
  ): Promise<PickedImageResult | null> {
    if (source === 'camera') {
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        throw new Error('Permissão da câmera negada. Conceda acesso à câmera nas configurações do celular.');
      }
    }

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

      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Falha ao obter imagem.');
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
    } catch (error: any) {
      if (error?.message) {
        throw error;
      }
      return null;
    }
  }
}
