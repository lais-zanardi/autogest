import AsyncStorage from '@react-native-async-storage/async-storage';

const MOCK_OVERRIDE_KEY = '@autogest:override_vite_use_mock';
const CUSTOM_API_URL_KEY = '@autogest:custom_api_url';

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

// Flag de build de demonstração: ligada em desenvolvimento (__DEV__), em env DEMO_BUILD=true ou VITE_DEMO_BUILD=true
const rawEnvDemo =
  typeof process !== 'undefined' && process.env
    ? (process.env.DEMO_BUILD ?? process.env.VITE_DEMO_BUILD ?? process.env.APP_ENV)
    : undefined;

const isDevMode = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
const defaultDemoBuild = isDevMode || rawEnvDemo === 'true' || rawEnvDemo === 'demo';

let currentMockMode: boolean = defaultUseMock;
let currentApiUrl: string = defaultApiUrl;
let currentDemoBuild: boolean = defaultDemoBuild;

export const EnvConfig = {
  /**
   * Retorna se a build atual permite recursos de demonstração (seed, roteiro ao vivo).
   * Habilitado em desenvolvimento ou builds com flag DEMO_BUILD=true.
   * Estritamente desabilitado em release/produção.
   */
  isDemoBuild(): boolean {
    return currentDemoBuild;
  },

  /**
   * Permite alternar a flag de build de demonstração para testes
   */
  setDemoBuild(enabled: boolean): void {
    currentDemoBuild = enabled;
  },
  /**
   * Retorna se o aplicativo está operando em modo de dados mockados (VITE_USE_MOCK=true)
   */
  isMockMode(): boolean {
    return currentMockMode;
  },

  /**
   * Retorna a URL base padrão configurada para a API
   */
  getDefaultApiUrl(): string {
    return defaultApiUrl;
  },

  /**
   * Retorna a URL base ativa da API REST
   */
  getApiUrl(): string {
    return currentApiUrl;
  },

  /**
   * Permite configurar uma URL personalizada da API (ex: IP local da máquina em dispositivo físico)
   */
  async setApiUrl(url: string): Promise<void> {
    const trimmed = url.trim();
    currentApiUrl = trimmed || defaultApiUrl;
    try {
      if (trimmed) {
        await AsyncStorage.setItem(CUSTOM_API_URL_KEY, trimmed);
      } else {
        await AsyncStorage.removeItem(CUSTOM_API_URL_KEY);
      }
    } catch {
      // Fallback
    }
  },

  /**
   * Restaura a URL base da API para o valor padrão
   */
  async resetApiUrl(): Promise<void> {
    currentApiUrl = defaultApiUrl;
    try {
      await AsyncStorage.removeItem(CUSTOM_API_URL_KEY);
    } catch {
      // Fallback
    }
  },

  /**
   * Inicializa e carrega preferências de mock e endpoint salvas localmente
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

    try {
      const savedApiUrl = await AsyncStorage.getItem(CUSTOM_API_URL_KEY);
      if (savedApiUrl && savedApiUrl.trim()) {
        currentApiUrl = savedApiUrl.trim();
      } else {
        currentApiUrl = defaultApiUrl;
      }
    } catch {
      currentApiUrl = defaultApiUrl;
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
   * Restaura para os valores originais de mock e endpoint
   */
  async resetToEnvDefault(): Promise<void> {
    currentMockMode = defaultUseMock;
    currentApiUrl = defaultApiUrl;
    try {
      await AsyncStorage.removeItem(MOCK_OVERRIDE_KEY);
      await AsyncStorage.removeItem(CUSTOM_API_URL_KEY);
    } catch {
      //
    }
  },
};
