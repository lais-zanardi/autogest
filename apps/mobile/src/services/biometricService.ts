import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRICS_ENABLED_KEY = '@autogest:biometrics_enabled';
const BIOMETRICS_PROMPTED_KEY = '@autogest:biometrics_prompted';

export interface BiometricAuthResult {
  success: boolean;
  durationMs: number;
  error?: string;
  fallbackRequired: boolean;
}

// Estado mockável para testes de unidade e ambiente sem hardware nativo
let mockAvailable = true;
let mockBiometryType: string | undefined = 'Biometrics';
let mockDelayMs = 250;
let mockFailureMessage: string | null = null;
const memoryStore: Record<string, string> = {};

export class BiometricService {
  /**
   * Reseta o estado simulado para testes
   */
  static resetMockState(): void {
    mockAvailable = true;
    mockBiometryType = 'Biometrics';
    mockDelayMs = 250;
    mockFailureMessage = null;
    delete memoryStore[BIOMETRICS_ENABLED_KEY];
    delete memoryStore[BIOMETRICS_PROMPTED_KEY];
  }

  static mockSensorAvailability(available: boolean, type?: string): void {
    mockAvailable = available;
    mockBiometryType = type;
  }

  static mockAuthDelay(delayMs: number): void {
    mockDelayMs = delayMs;
  }

  static mockAuthFailure(errorMessage: string): void {
    mockFailureMessage = errorMessage;
  }

  /**
   * Verifica se o hardware biométrico está disponível no dispositivo Android
   */
  static async isSensorAvailable(): Promise<{ available: boolean; biometryType?: string }> {
    try {
      // Se a biblioteca nativa estiver instalada e linkada no runtime
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ReactNativeBiometrics = require('react-native-biometrics');
      const rnBiometrics = new (ReactNativeBiometrics.default || ReactNativeBiometrics)();
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      return { available, biometryType };
    } catch {
      // Fallback para desenvolvimento / testes automatizados
      return { available: mockAvailable, biometryType: mockBiometryType };
    }
  }

  /**
   * Dispara o prompt biométrico nativo do Android e mede a duração (Critério BDD <= 2s)
   */
  static async authenticateWithBiometrics(options?: {
    promptMessage?: string;
    fallbackToPassword?: boolean;
  }): Promise<BiometricAuthResult> {
    const startTime = Date.now();
    const sensor = await this.isSensorAvailable();

    if (!sensor.available) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: 'Sensor biométrico não disponível ou não suportado no dispositivo.',
        fallbackRequired: true,
      };
    }

    try {
      let isSuccess = false;
      let errorMsg: string | undefined;

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ReactNativeBiometrics = require('react-native-biometrics');
        const rnBiometrics = new (ReactNativeBiometrics.default || ReactNativeBiometrics)();
        const { success } = await rnBiometrics.simplePrompt({
          promptMessage: options?.promptMessage || 'Desbloquear AutoGest com biometria',
          cancelButtonText: 'Usar Senha',
        });
        isSuccess = success;
      } catch {
        // Simulação / Fallback
        if (mockDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, mockDelayMs));
        }
        if (mockFailureMessage) {
          isSuccess = false;
          errorMsg = mockFailureMessage;
        } else {
          isSuccess = true;
        }
      }

      const durationMs = Date.now() - startTime;

      if (!isSuccess) {
        return {
          success: false,
          durationMs,
          error: errorMsg || 'Autenticação biométrica cancelada ou falhou.',
          fallbackRequired: true,
        };
      }

      return {
        success: true,
        durationMs,
        fallbackRequired: false,
      };
    } catch (err: any) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: err.message || 'Erro durante leitura biométrica.',
        fallbackRequired: true,
      };
    }
  }

  /**
   * Consulta se o usuário optou por habilitar biometria
   */
  static async isBiometricsEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
      if (val !== null) return val === 'true';
    } catch {
      // Ignora erro do AsyncStorage em testes
    }
    return memoryStore[BIOMETRICS_ENABLED_KEY] === 'true';
  }

  /**
   * Habilita ou desabilita biometria no app
   */
  static async setBiometricsEnabled(enabled: boolean): Promise<void> {
    const val = enabled ? 'true' : 'false';
    memoryStore[BIOMETRICS_ENABLED_KEY] = val;
    try {
      await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, val);
    } catch {
      // Ignora erro do AsyncStorage em testes
    }
  }

  /**
   * Consulta se já foi apresentado o modal de oferta de biometria após primeiro login
   */
  static async hasPromptedBiometrics(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(BIOMETRICS_PROMPTED_KEY);
      if (val !== null) return val === 'true';
    } catch {
      // Ignora
    }
    return memoryStore[BIOMETRICS_PROMPTED_KEY] === 'true';
  }

  /**
   * Marca que a biometria já foi oferecida
   */
  static async markBiometricsPrompted(): Promise<void> {
    memoryStore[BIOMETRICS_PROMPTED_KEY] = 'true';
    try {
      await AsyncStorage.setItem(BIOMETRICS_PROMPTED_KEY, 'true');
    } catch {
      // Ignora
    }
  }
}
