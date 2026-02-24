/**
 * @description Hook para persistencia de cache en localStorage
 * @module hooks/use-cache-persistence
 */

import { useEffect, useRef, useState } from 'react';
import {
  save_to_local_storage,
  get_from_local_storage,
  LOCAL_STORAGE_CACHE,
} from '@/lib/utils/cache-strategy';

/**
 * @description Hook para guardar y recuperar datos del localStorage
 * @param key - Clave del localStorage
 * @param initialValue - Valor inicial si no existe en cache
 * @param expirationMs - Tiempo de expiración en milisegundos (opcional)
 * @returns Tupla con [valor, setter]
 */
export function useLocalStorageCache<T>(
  key: string,
  initialValue: T,
  expirationMs?: number
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const cached = get_from_local_storage<T>(key);
    return cached !== null ? cached : initialValue;
  });

  const set_value = (newValue: T) => {
    setValue(newValue);
    save_to_local_storage(key, newValue, expirationMs);
  };

  return [value, set_value];
}

/**
 * @description Hook para guardar el rango de fechas seleccionado
 * @param initialDateRange - Rango de fechas inicial
 * @returns Tupla con [dateRange, setDateRange]
 */
export function useDateRangeCache(initialDateRange: { from: Date; to: Date }) {
  return useLocalStorageCache(
    LOCAL_STORAGE_CACHE.LAST_DATE_RANGE,
    initialDateRange,
    24 * 60 * 60 * 1000 // 24 horas
  );
}

/**
 * @description Hook para guardar la sección activa del dashboard
 * @param initialSection - Sección inicial
 * @returns Tupla con [section, setSection]
 */
export function useActiveSectionCache(initialSection: string) {
  return useLocalStorageCache(
    LOCAL_STORAGE_CACHE.LAST_ACTIVE_SECTION,
    initialSection,
    7 * 24 * 60 * 60 * 1000 // 7 días
  );
}

/**
 * @description Hook para guardar preferencias de usuario
 * @param initialPreferences - Preferencias iniciales
 * @returns Tupla con [preferences, setPreferences]
 */
export function useUserPreferencesCache(initialPreferences: Record<string, unknown>) {
  return useLocalStorageCache(
    LOCAL_STORAGE_CACHE.USER_PREFERENCES,
    initialPreferences,
    30 * 24 * 60 * 60 * 1000 // 30 días
  );
}

/**
 * @description Hook para guardar configuración de umbrales
 * @param initialThresholds - Umbrales iniciales
 * @returns Tupla con [thresholds, setThresholds]
 */
export function useThresholdsCache(initialThresholds: Record<string, number>) {
  return useLocalStorageCache(
    LOCAL_STORAGE_CACHE.THRESHOLDS_CONFIG,
    initialThresholds,
    30 * 24 * 60 * 60 * 1000 // 30 días
  );
}

/**
 * @description Hook para guardar escenarios guardados
 * @param initialScenarios - Escenarios iniciales
 * @returns Tupla con [scenarios, setScenarios]
 */
export function useSavedScenariosCache(initialScenarios: unknown[]) {
  return useLocalStorageCache(
    LOCAL_STORAGE_CACHE.SAVED_SCENARIOS,
    initialScenarios,
    90 * 24 * 60 * 60 * 1000 // 90 días
  );
}

/**
 * @description Hook para sincronizar estado con localStorage
 * @param key - Clave del localStorage
 * @param value - Valor a sincronizar
 * @param expirationMs - Tiempo de expiración en milisegundos (opcional)
 */
export function useSyncToLocalStorage<T>(
  key: string,
  value: T,
  expirationMs?: number
): void {
  const prevValueRef = useRef<T | undefined>(undefined);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      save_to_local_storage(key, value, expirationMs);
      prevValueRef.current = value;
    }
  }, [key, value, expirationMs]);
}

/**
 * @description Hook para limpiar cache cuando el componente se desmonta
 * @param keys - Claves a limpiar
 */
export function useCleanupCache(keys: string[]): void {
  useEffect(() => {
    return () => {
      keys.forEach(key => {
        localStorage.removeItem(key);
      });
    };
  }, [keys]);
}

const cachePersistence = {
  useLocalStorageCache,
  useDateRangeCache,
  useActiveSectionCache,
  useUserPreferencesCache,
  useThresholdsCache,
  useSavedScenariosCache,
  useSyncToLocalStorage,
  useCleanupCache,
};

export default cachePersistence;
