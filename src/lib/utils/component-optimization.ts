/**
 * @description Utilidades para optimización de componentes React
 * @module utils/component-optimization
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * @description Hook para memoizar cálculos costosos con dependencias
 * @param factory - Función que realiza el cálculo
 * @param deps - Array de dependencias
 * @returns Valor memoizado
 */
export function useMemoizedCalculation<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}

/**
 * @description Hook para crear callbacks memoizados
 * @param callback - Función callback
 * @param deps - Array de dependencias
 * @returns Callback memoizado
 */
export function useMemoizedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, deps) as T;
}

/**
 * @description Hook para detectar cambios en props y evitar re-renders innecesarios
 * @param props - Props del componente
 * @returns Booleano indicando si las props cambiaron
 */
export function usePropsChanged<T extends Record<string, unknown>>(props: T): boolean {
  const prevPropsRef = useRef<T>(props);
  const changed = JSON.stringify(prevPropsRef.current) !== JSON.stringify(props);

  useEffect(() => {
    prevPropsRef.current = props;
  });

  return changed;
}

/**
 * @description HOC para memoizar componentes puros
 * @param Component - Componente a memoizar
 * @param propsAreEqual - Función personalizada para comparar props
 * @returns Componente memoizado
 */
export function withMemo<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  return React.memo(Component, propsAreEqual);
}

/**
 * @description Hook para lazy loading de componentes
 * @param importFunc - Función que importa el componente
 * @returns Componente lazy loaded
 */
export function useLazyComponent<P extends object>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>
): React.LazyExoticComponent<React.ComponentType<P>> {
  return React.lazy(importFunc);
}

/**
 * @description Hook para virtualización de listas largas
 * @param items - Array de items
 * @param itemHeight - Altura de cada item en píxeles
 * @param containerHeight - Altura del contenedor en píxeles
 * @returns Items visibles, offset y manejador de scroll
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
): { visibleItems: T[]; startIndex: number; offset: number; onScroll: (e: React.UIEvent<HTMLElement>) => void } {
  const [scrollTop, setScrollTop] = React.useState(0);

  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const visibleItems = items.slice(startIndex, startIndex + visibleCount + 1);

  return {
    visibleItems,
    startIndex,
    offset: startIndex * itemHeight,
    onScroll,
  };
}

/**
 * @description Hook para debounce de valores
 * @param value - Valor a debounce
 * @param delay - Delay en milisegundos
 * @returns Valor debounceado
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * @description Hook para throttle de callbacks
 * @param callback - Callback a throttle
 * @param delay - Delay en milisegundos
 * @returns Callback throttleado
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRunRef.current;

      if (timeSinceLastRun >= delay) {
        callback(...args);
        lastRunRef.current = now;
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRunRef.current = Date.now();
        }, delay - timeSinceLastRun);
      }
    },
    [callback, delay]
  );
}

/**
 * @description Hook para medir performance de componentes
 * @param componentName - Nombre del componente
 * @returns Función para marcar puntos de medición
 */
export function usePerformanceMonitor(componentName: string) {
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTimeRef.current;
      console.log(`[Performance] ${componentName} render time: ${duration.toFixed(2)}ms`);
    };
  }, [componentName]);

  return {
    mark: (label: string) => {
      performance.mark(`${componentName}-${label}`);
    },
    measure: (label: string, startMark: string, endMark: string) => {
      performance.measure(
        `${componentName}-${label}`,
        `${componentName}-${startMark}`,
        `${componentName}-${endMark}`
      );
    },
  };
}

/**
 * @description Utilidad para crear selectores memoizados
 * @param selector - Función selector
 * @returns Selector memoizado
 */
export function createMemoizedSelector<T, R>(
  selector: (state: T) => R
): (state: T) => R {
  let lastState: T | undefined;
  let lastResult: R | undefined;

  return (state: T): R => {
    if (lastState !== state) {
      lastState = state;
      lastResult = selector(state);
    }
    return lastResult as R;
  };
}

/**
 * @description Configuración para code splitting automático
 */
export const CODE_SPLIT_CONFIG = {
  /** Componentes que deben ser lazy loaded */
  LAZY_COMPONENTS: {
    ExchangeCharts: () => import('@/components/contabilidad/exchange-intelligence/exchange-charts'),
    ScenarioSimulator: () => import('@/components/contabilidad/exchange-intelligence/scenario-simulator'),
    KPIDashboard: () => import('@/components/contabilidad/exchange-intelligence/kpi-dashboard'),
  },
  /** Tamaño máximo de chunk antes de split (bytes) */
  MAX_CHUNK_SIZE: 250000,
};

export const componentOptimization = {
  useMemoizedCalculation,
  useMemoizedCallback,
  usePropsChanged,
  withMemo,
  useLazyComponent,
  useVirtualScroll,
  useDebouncedValue,
  useThrottledCallback,
  usePerformanceMonitor,
  createMemoizedSelector,
  CODE_SPLIT_CONFIG,
};

export default componentOptimization;
