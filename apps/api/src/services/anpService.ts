import { FuelType } from '@autogest/shared-types';

export class ANPService {
  /**
   * Retorna o preço médio praticado segundo levantamento da ANP por Estado/Combustível
   */
  static async getAveragePrice(state: string, fuelType: FuelType): Promise<number> {
    const referenceTable: Record<FuelType, number> = {
      Gasolina: 5.79,
      Etanol: 3.89,
      Diesel: 5.95,
      GNV: 4.69,
      Flex: 4.84,
    };
    return referenceTable[fuelType] || 5.5;
  }
}
