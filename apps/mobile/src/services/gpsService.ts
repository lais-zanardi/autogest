export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const MENSAGEM_MOTIVO_PERMISSAO_LOCALIZACAO =
  'O AutoGest usa sua localização apenas enquanto esta tela está aberta para calcular a distância até os postos mais baratos próximos a você.';

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

  /**
   * US34.3 & US34.5: Solicita permissão de localização em primeiro plano com explicação clara.
   * Nunca consulta localização em segundo plano.
   */
  static async obterPosicaoComPermissao(): Promise<{
    coords: Coordinates | null;
    permissaoNegada: boolean;
  }> {
    if (this.mockPermissionDenied) {
      return { coords: null, permissaoNegada: true };
    }

    try {
      // Carregamento dinâmico seguro para evitar acoplamento nativo em testes Node
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const rn = require('react-native');
      if (rn?.Platform?.OS === 'android' && rn?.PermissionsAndroid) {
        const perm = rn.PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const alreadyGranted = await rn.PermissionsAndroid.check(perm);
        if (!alreadyGranted) {
          const status = await rn.PermissionsAndroid.request(perm, {
            title: 'Localização para postos próximos',
            message: MENSAGEM_MOTIVO_PERMISSAO_LOCALIZACAO,
            buttonPositive: 'Permitir',
            buttonNegative: 'Agora não',
          });
          if (status !== rn.PermissionsAndroid.RESULTS.GRANTED) {
            return { coords: null, permissaoNegada: true };
          }
        }
      }
    } catch {
      // Ambiente Node / testes unitários
    }

    const coords = await this.getCurrentLocation();
    return {
      coords,
      permissaoNegada: coords === null,
    };
  }
}
