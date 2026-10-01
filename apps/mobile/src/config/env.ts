import AsyncStorage from '@react-native-async-storage/async-storage';

const MOCK_OVERRIDE_KEY = '@autogest:override_vite_use_mock';

// Lê a variável de ambiente VITE_USE_MOCK (padrão true se não configurado como 'false')
const rawEnvMock =
  typeof process !== 'undefined' && process.env
    ? (process.env.VITE_USE_MOCK ?? process.env.USE_MOCKS)
    : undefined;

const defaultUseMock = rawEnvMock !== 'false';

const defaultApiUrl =
  typeof process !== 'undefined' && process.env && process.env.API_URL
    ? process.env.API_URL
    : 'http://10.0.2.2:3000/api/v1';

let currentMockMode: boolean = defaultUseMock;
const currentApiUrl: string = defaultApiUrl;

export const EnvConfig = {
  /**
   * Retorna se o aplicativo está operando em modo de dados mockados (VITE_USE_MOCK=true)
   */
  isMockMode(): boolean {
    return currentMockMode;
  },

  /**
   * Retorna a URL base da API REST
   */
  getApiUrl(): string {
    return currentApiUrl;
  },

  /**
   * Inicializa e carrega preferências de mock salvas localmente
   */
  async init(): Promise<void> {
    try {
      const override = await AsyncStorage.getItem(MOCK_OVERRIDE_KEY);
      if (override !== null) {
        currentMockMode = override === 'true';
      } else {
        currentMockMode = defaultUseMock;
      }
    } catch {
      currentMockMode = defaultUseMock;
    }
  },

  /**
   * Permite alternar dinamicamente o modo mock em tempo de execução
   */
  async setMockMode(enabled: boolean): Promise<void> {
    currentMockMode = enabled;
    try {
      await AsyncStorage.setItem(MOCK_OVERRIDE_KEY, enabled ? 'true' : 'false');
    } catch {
      //
    }
  },

  /**
   * Restaura para o valor original da variável de ambiente VITE_USE_MOCK
   */
  async resetToEnvDefault(): Promise<void> {
    currentMockMode = defaultUseMock;
    try {
      await AsyncStorage.removeItem(MOCK_OVERRIDE_KEY);
    } catch {
      //
    }
  },
};
