/**
 * @description Estrategia de caching para el dashboard de inteligencia cambiaria
 * @module utils/cache-strategy
 */

import { CACHE_DURATIONS } from './performance';

/**
 * @description Configuración de cache para RTK Query
 * Implementa diferentes estrategias de cache según el tipo de dato
 */
export const CACHE_STRATEGY = {
  /**
   * @description Cache para tasas de cambio - 1 hora
   * Las tasas de cambio son relativamente estables y no cambian constantemente
   * Se cachean por 1 hora para reducir llamadas a API
   */
  EXCHANGE_RATES: {
    keepUnusedDataFor: CACHE_DURATIONS.EXCHANGE_RATES / 1000, // 3600 segundos
    refetchOnMountOrArgChange: false,
    refetchOnFocus: false,
    refetchOnReconnect: true,
  },

  /**
   * @description Cache para KPIs - 5 minutos
   * Los KPIs son cálculos que pueden cambiar frecuentemente
   * Se cachean por 5 minutos para balance entre actualización y performance
   */
  KPIs: {
    keepUnusedDataFor: CACHE_DURATIONS.KPIs / 1000, // 300 segundos
    refetchOnMountOrArgChange: false,
    refetchOnFocus: true, // Refetch cuando el usuario vuelve a la ventana
    refetchOnReconnect: true,
  },

  /**
   * @description Cache para tendencias históricas - 24 horas
   * Los datos históricos no cambian frecuentemente
   * Se cachean por 24 horas para máxima performance
   */
  HISTORICAL_TRENDS: {
    keepUnusedDataFor: CACHE_DURATIONS.HISTORICAL_TRENDS / 1000, // 86400 segundos
    refetchOnMountOrArgChange: false,
    refetchOnFocus: false,
    refetchOnReconnect: false,
  },

  /**
   * @description Cache para impacto en costos - 10 minutos
   * Datos que pueden cambiar con nuevas compras o cambios de tasas
   */
  COST_IMPACT: {
    keepUnusedDataFor: CACHE_DURATIONS.COST_IMPACT / 1000, // 600 segundos
    refetchOnMountOrArgChange: false,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  },

  /**
   * @description Cache para exposición de deuda - 10 minutos
   * Datos que pueden cambiar con nuevos pagos o cambios de tasas
   */
  DEBT_EXPOSURE: {
    keepUnusedDataFor: CACHE_DURATIONS.DEBT_EXPOSURE / 1000, // 600 segundos
    refetchOnMountOrArgChange: false,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  },

  /**
   * @description Cache para eficiencia de pagos - 10 minutos
   * Datos que pueden cambiar con nuevas transacciones
   */
  PAYMENT_EFFICIENCY: {
    keepUnusedDataFor: CACHE_DURATIONS.PAYMENT_EFFICIENCY / 1000, // 600 segundos
    refetchOnMountOrArgChange: false,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  },
};

/**
 * @description Configuración de invalidación de cache
 * Define qué datos deben ser invalidados cuando ocurren ciertos eventos
 */
export const CACHE_INVALIDATION_RULES = {
  /**
   * @description Cuando se registra una nueva compra, invalidar:
   * - Impacto en costos
   * - KPIs (porque afecta márgenes)
   * - Tendencias históricas
   */
  ON_NEW_PURCHASE: ['COST_IMPACT', 'KPIs', 'HISTORICAL_TRENDS'],

  /**
   * @description Cuando se registra un nuevo pago, invalidar:
   * - Exposición de deuda
   * - KPIs (porque afecta deuda)
   * - Eficiencia de pagos
   */
  ON_NEW_PAYMENT: ['DEBT_EXPOSURE', 'KPIs', 'PAYMENT_EFFICIENCY'],

  /**
   * @description Cuando cambia la tasa de cambio, invalidar:
   * - Tasas de cambio
   * - Impacto en costos
   * - Exposición de deuda
   * - KPIs
   * - Eficiencia de pagos
   */
  ON_EXCHANGE_RATE_CHANGE: [
    'EXCHANGE_RATES',
    'COST_IMPACT',
    'DEBT_EXPOSURE',
    'KPIs',
    'PAYMENT_EFFICIENCY',
  ],

  /**
   * @description Cuando se registra una nueva transacción de cambio, invalidar:
   * - Eficiencia de pagos
   * - KPIs
   */
  ON_NEW_EXCHANGE_TRANSACTION: ['PAYMENT_EFFICIENCY', 'KPIs'],

  /**
   * @description Cuando el usuario cambia filtros, invalidar:
   * - Datos filtrados (se manejan automáticamente por RTK Query)
   */
  ON_FILTER_CHANGE: [],
};

/**
 * @description Utilidad para crear claves de cache consistentes
 * @param prefix - Prefijo de la clave (ej: 'cost-impact')
 * @param params - Parámetros que afectan el cache
 * @returns Clave de cache única
 */
export function create_cache_key(
  prefix: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  return `${prefix}:${sortedParams}`;
}

/**
 * @description Utilidad para determinar si un cache está expirado
 * @param lastFetchTime - Timestamp del último fetch
 * @param cacheDuration - Duración del cache en milisegundos
 * @returns Booleano indicando si el cache está expirado
 */
export function is_cache_expired(
  lastFetchTime: number,
  cacheDuration: number
): boolean {
  return Date.now() - lastFetchTime > cacheDuration;
}

/**
 * @description Utilidad para calcular tiempo restante de cache
 * @param lastFetchTime - Timestamp del último fetch
 * @param cacheDuration - Duración del cache en milisegundos
 * @returns Tiempo restante en milisegundos
 */
export function get_cache_remaining_time(
  lastFetchTime: number,
  cacheDuration: number
): number {
  const remaining = cacheDuration - (Date.now() - lastFetchTime);
  return Math.max(0, remaining);
}

/**
 * @description Configuración de cache para localStorage
 * Permite persistencia de datos entre sesiones
 */
export const LOCAL_STORAGE_CACHE = {
  /**
   * @description Clave para almacenar configuración de umbrales
   */
  THRESHOLDS_CONFIG: 'exchange-intelligence:thresholds-config',

  /**
   * @description Clave para almacenar escenarios guardados
   */
  SAVED_SCENARIOS: 'exchange-intelligence:saved-scenarios',

  /**
   * @description Clave para almacenar preferencias de usuario
   */
  USER_PREFERENCES: 'exchange-intelligence:user-preferences',

  /**
   * @description Clave para almacenar último período seleccionado
   */
  LAST_DATE_RANGE: 'exchange-intelligence:last-date-range',

  /**
   * @description Clave para almacenar última sección activa
   */
  LAST_ACTIVE_SECTION: 'exchange-intelligence:last-active-section',
};

/**
 * @description Utilidad para guardar datos en localStorage con expiración
 * @param key - Clave del localStorage
 * @param data - Datos a guardar
 * @param expirationMs - Tiempo de expiración en milisegundos (opcional)
 */
export function save_to_local_storage<T>(
  key: string,
  data: T,
  expirationMs?: number
): void {
  const item = {
    data,
    timestamp: Date.now(),
    expiresAt: expirationMs ? Date.now() + expirationMs : null,
  };
  localStorage.setItem(key, JSON.stringify(item));
}

/**
 * @description Utilidad para obtener datos de localStorage con validación de expiración
 * @param key - Clave del localStorage
 * @returns Datos o null si no existen o están expirados
 */
export function get_from_local_storage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsed = JSON.parse(item);
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data as T;
  } catch {
    return null;
  }
}

/**
 * @description Utilidad para limpiar localStorage
 * @param pattern - Patrón de claves a limpiar (ej: 'exchange-intelligence:')
 */
export function clear_local_storage(pattern?: string): void {
  if (!pattern) {
    localStorage.clear();
    return;
  }

  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(pattern)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * @description Estrategia de cache en cascada
 * Intenta obtener datos de: Memory Cache → LocalStorage → API
 */
export class CascadeCacheStrategy<T> {
  private memory_cache: Map<string, { data: T; expiresAt: number }> = new Map();
  private cache_duration: number;

  constructor(cacheDurationMs: number) {
    this.cache_duration = cacheDurationMs;
  }

  /**
   * @description Obtiene datos usando estrategia en cascada
   * @param key - Clave del cache
   * @param fetchFn - Función para obtener datos de API
   * @returns Datos obtenidos
   */
  async get(key: string, fetchFn: () => Promise<T>): Promise<T> {
    // 1. Intentar obtener de memory cache
    const memoryData = this.get_from_memory(key);
    if (memoryData) return memoryData;

    // 2. Intentar obtener de localStorage
    const localData = get_from_local_storage<T>(key);
    if (localData) {
      this.set_in_memory(key, localData);
      return localData;
    }

    // 3. Obtener de API
    const apiData = await fetchFn();
    this.set_in_memory(key, apiData);
    save_to_local_storage(key, apiData, this.cache_duration);
    return apiData;
  }

  /**
   * @description Obtiene datos de memory cache
   */
  private get_from_memory(key: string): T | null {
    const entry = this.memory_cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memory_cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * @description Guarda datos en memory cache
   */
  private set_in_memory(key: string, data: T): void {
    this.memory_cache.set(key, {
      data,
      expiresAt: Date.now() + this.cache_duration,
    });
  }

  /**
   * @description Invalida una entrada del cache
   */
  invalidate(key: string): void {
    this.memory_cache.delete(key);
    localStorage.removeItem(key);
  }

  /**
   * @description Limpia todo el cache
   */
  clear(): void {
    this.memory_cache.clear();
    clear_local_storage('exchange-intelligence:');
  }
}

const cacheStrategy = {
  CACHE_STRATEGY,
  CACHE_INVALIDATION_RULES,
  create_cache_key,
  is_cache_expired,
  get_cache_remaining_time,
  LOCAL_STORAGE_CACHE,
  save_to_local_storage,
  get_from_local_storage,
  clear_local_storage,
  CascadeCacheStrategy,
};

export default cacheStrategy;
