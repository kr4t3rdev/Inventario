/**
 * @description Servicio para gestionar la invalidación de cache
 * @module services/cache-invalidation-service
 */

import { CACHE_INVALIDATION_RULES } from '@/lib/utils/cache-strategy';

/**
 * @description Tipos de eventos que pueden invalidar cache
 */
export type CacheInvalidationEvent =
  | 'ON_NEW_PURCHASE'
  | 'ON_NEW_PAYMENT'
  | 'ON_EXCHANGE_RATE_CHANGE'
  | 'ON_NEW_EXCHANGE_TRANSACTION'
  | 'ON_FILTER_CHANGE';

/**
 * @description Servicio para gestionar invalidación de cache
 */
export class CacheInvalidationService {
  private listeners: Map<CacheInvalidationEvent, Set<() => void>> = new Map();

  /**
   * @description Registra un listener para un evento de invalidación
   * @param event - Tipo de evento
   * @param callback - Función a ejecutar cuando ocurra el evento
   */
  on_invalidation(event: CacheInvalidationEvent, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Retornar función para desuscribirse
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * @description Dispara un evento de invalidación
   * @param event - Tipo de evento
   */
  trigger_invalidation(event: CacheInvalidationEvent): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(`Error in cache invalidation callback for ${event}:`, error);
        }
      });
    }
  }

  /**
   * @description Obtiene las reglas de invalidación para un evento
   * @param event - Tipo de evento
   * @returns Array de tipos de cache a invalidar
   */
  get_invalidation_rules(event: CacheInvalidationEvent): string[] {
    return CACHE_INVALIDATION_RULES[event] || [];
  }

  /**
   * @description Limpia todos los listeners
   */
  clear_all_listeners(): void {
    this.listeners.clear();
  }

  /**
   * @description Limpia listeners para un evento específico
   * @param event - Tipo de evento
   */
  clear_listeners(event: CacheInvalidationEvent): void {
    this.listeners.delete(event);
  }
}

/**
 * @description Instancia global del servicio de invalidación de cache
 */
export const cache_invalidation_service = new CacheInvalidationService();

/**
 * @description Hook para usar el servicio de invalidación de cache
 * @param event - Tipo de evento
 * @param callback - Función a ejecutar cuando ocurra el evento
 */
export function use_cache_invalidation(
  event: CacheInvalidationEvent,
  callback: () => void
): void {
  cache_invalidation_service.on_invalidation(event, callback);
}

/**
 * @description Utilidad para disparar invalidación de cache
 * @param event - Tipo de evento
 */
export function trigger_cache_invalidation(event: CacheInvalidationEvent): void {
  cache_invalidation_service.trigger_invalidation(event);
}

const cacheInvalidation = {
  CacheInvalidationService,
  cache_invalidation_service,
  use_cache_invalidation,
  trigger_cache_invalidation,
};

export default cacheInvalidation;
