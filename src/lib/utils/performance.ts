/**
 * @description Utilidades de performance para el dashboard de inteligencia cambiaria
 * @module utils/performance
 */

/**
 * @description Tiempo de cache para cada tipo de dato (en milisegundos)
 */
export const CACHE_DURATIONS = {
  /** Tasas de cambio: 1 hora */
  EXCHANGE_RATES: 60 * 60 * 1000,
  /** KPIs: 5 minutos */
  KPIs: 5 * 60 * 1000,
  /** Tendencias históricas: 24 horas */
  HISTORICAL_TRENDS: 24 * 60 * 60 * 1000,
  /** Cost impact: 10 minutos */
  COST_IMPACT: 10 * 60 * 1000,
  /** Debt exposure: 10 minutos */
  DEBT_EXPOSURE: 10 * 60 * 1000,
  /** Payment efficiency: 10 minutos */
  PAYMENT_EFFICIENCY: 10 * 60 * 1000,
};

/**
 * @description Configuración de debounce para diferentes operaciones
 */
export const DEBOUNCE_DELAYS = {
  /** sliders del simulador */
  SIMULATOR_SLIDER: 300,
  /** Filtros de búsqueda */
  SEARCH_FILTER: 500,
  /** Cambios de tabs */
  TAB_SWITCH: 100,
};

/**
 * @description Thresholds de performance para alertas
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Tiempo máximo para renderizado de componente (ms) */
  COMPONENT_RENDER_MAX: 100,
  /** Tiempo máximo para cálculo de KPIs (ms) */
  KPI_CALCULATION_MAX: 500,
  /** Tiempo máximo para carga inicial (ms) */
  INITIAL_LOAD_MAX: 2000,
  /** Número máximo de items antes de virtualización */
  VIRTUALIZATION_THRESHOLD: 100,
};

/**
 * @description Calcula el tiempo transcurrido desde un punto de inicio
 * @param startTime - Tiempo de inicio del benchmark
 * @returns Objeto con tiempo transcurrido y si está dentro del threshold
 */
export function measure_performance(
  startTime: number,
  threshold: number
): { elapsed: number; isWithinThreshold: boolean } {
  const elapsed = performance.now() - startTime;
  return {
    elapsed,
    isWithinThreshold: elapsed <= threshold,
  };
}

/**
 * @description Crea un benchmarkmed function wrapper
 * @param fn - Función a benchmark
 * @param threshold - Threshold de performance
 * @returns Función con logging de performance
 */
export function with_performance_logging<T extends (...args: unknown[]) => unknown>(
  fn: T,
  operationName: string,
  threshold: number
): T {
  return ((...args: Parameters<T>) => {
    const startTime = performance.now();
    const result = fn(...args);
    const { elapsed, isWithinThreshold } = measure_performance(startTime, threshold);

    console.log(`[Performance] ${operationName}: ${elapsed.toFixed(2)}ms (threshold: ${threshold}ms)`);

    if (!isWithinThreshold) {
      console.warn(`[Performance Warning] ${operationName} exceeded threshold: ${elapsed.toFixed(2)}ms`);
    }

    return result;
  }) as T;
}

/**
 * @description Utilidad para deep freeze de objetos inmutables
 * @param obj - Objeto a congelar
 * @returns Objeto congelado
 */
export function deep_freeze<T extends object>(obj: T): T {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key as keyof T] === 'object' && obj[key as keyof T] !== null) {
      deep_freeze(obj[key as keyof T] as object);
    }
  });
  return Object.freeze(obj);
}

/**
 * @description Utilidad para crear objetos shallowly frozen para React.memo
 * @param obj - Objeto a congelar
 * @returns Objeto congelado superficialmente
 */
export function shallow_freeze<T extends object>(obj: T): T {
  return Object.freeze(obj);
}

/**
 * @description Cache simple en memoria para datos estáticos
 */
export class MemoryCache<T> {
  private cache: Map<string, { data: T; expiresAt: number }> = new Map();

  /**
   * @description Obtiene un valor del cache
   * @param key - Clave del cache
   * @returns Valor cacheado o undefined si no existe o expiró
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /**
   * @description Guarda un valor en el cache
   * @param key - Clave del cache
   * @param data - Datos a guardar
   * @param ttlMs - Tiempo de vida en milisegundos
   */
  set(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * @description Invalida una entrada del cache
   * @param key - Clave del cache
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * @description Invalida todas las entradas del cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * @description Obtiene estadísticas del cache
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/** Cache global para tasas de cambio */
export const exchangeRatesCache = new MemoryCache<Record<string, number>>();

/** Cache global para KPIs */
export const kpisCache = new MemoryCache<unknown>();

/** Cache global para tendencias históricas */
export const historicalTrendsCache = new MemoryCache<unknown>();

/**
 * @description Utilidad para crear selectors memoizados con timeout de re-cálculo
 * @param selector - Selector original
 * @param timeoutMs - Timeout antes de permitir re-cálculo
 * @returns Selector con throttle
 */
export function create_throttled_selector<T>(
  selector: (state: unknown) => T,
  timeoutMs: number
): (state: unknown) => T {
  let lastResult!: T;
  let lastCalculated = 0;
  let has_result = false;

  return (state: unknown) => {
    const now = Date.now();
    if (!has_result || now - lastCalculated >= timeoutMs) {
      lastResult = selector(state);
      lastCalculated = now;
      has_result = true;
    }
    return lastResult;
  };
}

/**
 * @description Configuración de lazy loading para componentes pesados
 */
export const LAZY_COMPONENTS = {
  /** Gráficos complejos - prioridad baja */
  CHARTS: {
    chunkName: 'exchange-charts',
    import: () => import('@/components/contabilidad/exchange-intelligence/exchange-charts'),
  },
  /** Simulador de escenarios - prioridad media */
  SIMULATOR: {
    chunkName: 'scenario-simulator',
    import: () => import('@/components/contabilidad/exchange-intelligence/scenario-simulator'),
  },
};

const performanceUtils = {
  CACHE_DURATIONS,
  DEBOUNCE_DELAYS,
  PERFORMANCE_THRESHOLDS,
  measure_performance,
  with_performance_logging,
  deep_freeze,
  shallow_freeze,
  exchangeRatesCache,
  kpisCache,
  historicalTrendsCache,
  LAZY_COMPONENTS,
};

export default performanceUtils;
