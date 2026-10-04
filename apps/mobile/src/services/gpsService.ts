export interface Coordinates {
  latitude: number;
  longitude: number;
}

export class GPSService {
  /**
   * Obtém localização geográfica nativa do dispositivo para associação ao abastecimento
   */
  static async getCurrentLocation(): Promise<Coordinates | null> {
    try {
      // Coordenadas simuladas para ambiente de teste / emulador (São Paulo)
      return {
        latitude: -23.55052,
        longitude: -46.633308,
      };
    } catch {
      return null;
    }
  }
}
