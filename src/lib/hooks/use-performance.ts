/**
 * @description Hooks de performance para el dashboard de inteligencia cambiaria
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PERFORMANCE_THRESHOLDS } from '@/lib/utils/performance';

/**
 * @description Hook para debounce de valores
 * @param value - Valor a debouncear
 * @param delay - Delay en ms
 * @returns Valor debounceado
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * @description Hook para throttlear una función
 * @param callback - Función a throttlear
 * @param delay - Delay en ms
 * @returns Función throttled
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastRan = useRef<number>(0);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRan.current >= delay) {
        callback(...args);
        lastRan.current = now;
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * @description Hook para tracking de performance de render
 * @param componentName - Nombre del componente
 * @returns Objeto con startMeasure y endMeasure
 */
export function useRenderPerformance(componentName: string): {
  start_measure: () => void;
  end_measure: () => void;
} {
  const renderCount = useRef<number>(0);
  const lastRenderTime = useRef<number>(0);

  const start_measure = useCallback(() => {
    renderCount.current += 1;
    lastRenderTime.current = performance.now();
  }, []);

  const end_measure = useCallback(() => {
    const elapsed = performance.now() - lastRenderTime.current;
    const isWithinThreshold = elapsed <= PERFORMANCE_THRESHOLDS.COMPONENT_RENDER_MAX;

    if (!isWithinThreshold) {
      console.warn(
        `[Performance] ${componentName} render took ${elapsed.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.COMPONENT_RENDER_MAX}ms) - render #${renderCount.current}`
      );
    }
  }, [componentName]);

  return { start_measure, end_measure };
}

/**
 * @description Hook para lazy loading de componentes
 * @param importFn - Función de import dinámico
 * @returns Objeto con loaded, error y el componente
 */
export function useLazyComponent<T extends React.ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
): {
  Component: T | null;
  is_loading: boolean;
  error: Error | null;
} {
  const [Component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    setError(null);

    importFn()
      .then((module) => {
        if (mounted) {
          setComponent(() => module.default);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [importFn]);

  return { Component, is_loading: isLoading, error };
}

/**
 * @description Hook para virtual scrolling
 * @param items - Lista de items
 * @param itemHeight - Altura de cada item en px
 * @param containerHeight - Altura del contenedor en px
 * @param overscan - Número de items a renderizar fuera de vista
 * @returns Objeto con visibleItems, totalHeight y scrollTo
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 3
): {
  visible_items: T[];
  total_height: number;
  scroll_to: (index: number) => void;
  start_index: number;
  end_index: number;
} {
  const scrollTop = useRef<number>(0);

  const start_index = useMemo(() => {
    return Math.max(0, Math.floor(scrollTop.current / itemHeight) - overscan);
  }, [itemHeight, overscan]);

  const visible_count = useMemo(() => {
    return Math.ceil(containerHeight / itemHeight) + 2 * overscan;
  }, [containerHeight, itemHeight, overscan]);

  const end_index = useMemo(() => {
    return Math.min(items.length, start_index + visible_count);
  }, [items.length, start_index, visible_count]);

  const visible_items = useMemo(() => {
    return items.slice(start_index, end_index);
  }, [items, start_index, end_index]);

  const total_height = useMemo(() => {
    return items.length * itemHeight;
  }, [items.length, itemHeight]);

  const scroll_to = useCallback((index: number) => {
    scrollTop.current = index * itemHeight;
  }, [itemHeight]);

  return { visible_items, total_height, scroll_to, start_index, end_index };
}

/**
 * @description Hook para tracking de memoria
 * @returns Uso de memoria en MB (si está disponible)
 */
export function useMemoryUsage(): number | null {
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);

  useEffect(() => {
    // Solo funciona en Chrome y navegadores basados en Chromium
    if (typeof window !== 'undefined' && 'performance' in window) {
      const perf = performance as Performance & {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      };

      if (perf.memory) {
        const updateMemory = () => {
          setMemoryUsage(perf.memory!.usedJSHeapSize / (1024 * 1024));
        };

        updateMemory();
        const interval = setInterval(updateMemory, 5000);

        return () => clearInterval(interval);
      }
    }

    return undefined;
  }, []);

  return memoryUsage;
}

/**
 * @description Hook para tracking de memoria
 * @returns Uso de memoria en MB (si está disponible)
 */
const performanceHooks = {
  useDebounce,
  useThrottledCallback,
  useRenderPerformance,
  useLazyComponent,
  useVirtualScroll,
  useMemoryUsage,
};

export default performanceHooks;
