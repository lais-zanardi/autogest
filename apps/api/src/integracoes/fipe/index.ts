import {
  ParallelumFipeProvider,
  ProvedorFipe,
  FipeItem,
  FipeCotacaoNormalizada,
  normalizarMesReferenciaFipe,
  parseValorFipeCentavos,
} from '../../services/fipeService';

export {
  ProvedorFipe,
  ParallelumFipeProvider,
  FipeItem,
  FipeCotacaoNormalizada,
  normalizarMesReferenciaFipe,
  parseValorFipeCentavos,
};

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * US18.2: Cache em memória com TTL (padrão 24h = 86.400.000 ms) e chave por consulta
 */
export class FipeMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTtlMs: number;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) {
    this.defaultTtlMs = ttlMs;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { data, expiresAt });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export class FipeIntegrationService {
  private static provider: ProvedorFipe = new ParallelumFipeProvider();
  private static cache = new FipeMemoryCache();

  static setProvider(customProvider: ProvedorFipe): void {
    this.provider = customProvider;
  }

  static getCache(): FipeMemoryCache {
    return this.cache;
  }

  static async listarMarcas(): Promise<FipeItem[]> {
    const cacheKey = 'fipe:marcas';
    const cached = this.cache.get<FipeItem[]>(cacheKey);
    if (cached) return cached;

    const data = await this.provider.listarMarcas();
    this.cache.set(cacheKey, data);
    return data;
  }

  static async listarModelos(marcaCodigo: string): Promise<FipeItem[]> {
    const cacheKey = `fipe:modelos:${marcaCodigo}`;
    const cached = this.cache.get<FipeItem[]>(cacheKey);
    if (cached) return cached;

    const data = await this.provider.listarModelos(marcaCodigo);
    this.cache.set(cacheKey, data);
    return data;
  }

  static async listarAnos(marcaCodigo: string, modeloCodigo: string): Promise<FipeItem[]> {
    const cacheKey = `fipe:anos:${marcaCodigo}:${modeloCodigo}`;
    const cached = this.cache.get<FipeItem[]>(cacheKey);
    if (cached) return cached;

    const data = await this.provider.listarAnos(marcaCodigo, modeloCodigo);
    this.cache.set(cacheKey, data);
    return data;
  }

  static async consultarValor(
    marcaCodigo: string,
    modeloCodigo: string,
    anoCodigo: string
  ): Promise<FipeCotacaoNormalizada> {
    const cacheKey = `fipe:valor:${marcaCodigo}:${modeloCodigo}:${anoCodigo}`;
    const cached = this.cache.get<FipeCotacaoNormalizada>(cacheKey);
    if (cached) return cached;

    const data = await this.provider.consultarValor(marcaCodigo, modeloCodigo, anoCodigo);
    this.cache.set(cacheKey, data);
    return data;
  }
}
