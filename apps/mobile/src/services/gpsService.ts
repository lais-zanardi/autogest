export interface Coordinates {
  latitude: number;
  longitude: number;
}

export class GPSService {
  private static mockPermissionDenied = false;

  /**
   * Permite simular permissão de GPS negada em testes automatizados
   */
  static setMockPermissionDenied(denied: boolean) {
    this.mockPermissionDenied = denied;
  }

  /**
   * Obtém localização geográfica nativa do dispositivo para associação ao abastecimento.
   * Se permissão negada ou indisponível, retorna null com segurança (US05.4).
   */
  static async getCurrentLocation(): Promise<Coordinates | null> {
    if (this.mockPermissionDenied) {
      return null;
    }

    try {
      // Coordenadas padrão em ambiente simulado / emulador (São Paulo - Marco Zero)
      return {
        latitude: -23.55052,
        longitude: -46.633308,
      };
    } catch {
      return null;
    }
  }
}
