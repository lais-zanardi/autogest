import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';

export class CameraService {
  /**
   * Captura imagem do comprovante através da Câmera nativa
   */
  static async captureReceiptFromCamera(): Promise<string | null> {
    const result: ImagePickerResponse = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: true,
    });
    return result.assets && result.assets[0]?.base64 ? result.assets[0].base64 : null;
  }

  /**
   * Seleciona imagem do comprovante existente na Galeria
   */
  static async selectReceiptFromGallery(): Promise<string | null> {
    const result: ImagePickerResponse = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: true,
    });
    return result.assets && result.assets[0]?.base64 ? result.assets[0].base64 : null;
  }
}
