import { OCRScanResult } from '@autogest/shared-types';

export class OCRService {
  /**
   * Processa a imagem do cupom fiscal e extrai litros, preço por litro e valor total
   */
  static async scanReceipt(_imageBase64OrUrl: string): Promise<OCRScanResult> {
    // Processamento de visão computacional / OCR simulado com score de confiança
    return {
      stationName: 'Posto Shell Select',
      fuelType: 'Gasolina',
      liters: 42.5,
      pricePerLiter: 5.89,
      totalValue: 250.32,
      date: new Date().toISOString(),
      confidenceScore: 0.94,
    };
  }
}
