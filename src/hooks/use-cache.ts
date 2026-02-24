import { useState, useEffect, useCallback } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum number of entries
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private config: CacheConfig

  constructor(config: CacheConfig = { ttl: 5 * 60 * 1000, maxSize: 100 }) {
    this.config = config
  }

  set<T>(key: string, data: T, customTtl?: number): void {
    const ttl = customTtl || this.config.ttl
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    }

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(key, entry)
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Global cache instance
const globalCache = new MemoryCache()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  globalCache.cleanup()
}, 5 * 60 * 1000)

export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; enabled?: boolean } = {}
) {
  const { ttl, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedData = globalCache.get<T>(key)
      if (cachedData !== null) {
        setData(cachedData)
        return cachedData
      }
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      globalCache.set(key, result, ttl)
      setData(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, ttl, enabled])

  const invalidate = useCallback(() => {
    globalCache.delete(key)
  }, [key])

  const refresh = useCallback(() => {
    return fetchData(true)
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refresh,
    invalidate,
    refetch: fetchData
  }
}

// Specific cache hooks for contabilidad data
export function useExchangeRatesCache() {
  return useCache(
    'exchange-rates',
    async () => {
      const response = await fetch('/api/contabilidad/exchange/tasas')
      if (!response.ok) throw new Error('Failed to fetch exchange rates')
      return response.json()
    },
    { ttl: 10 * 60 * 1000 } // 10 minutes cache
  )
}

export function useCuentasBancariasCache() {
  return useCache(
    'cuentas-bancarias',
    async () => {
      const response = await fetch('/api/contabilidad/cuentas')
      if (!response.ok) throw new Error('Failed to fetch bank accounts')
      return response.json()
    },
    { ttl: 5 * 60 * 1000 } // 5 minutes cache
  )
}

export function useTiposPagoCache() {
  return useCache(
    'tipos-pago',
    async () => {
      const response = await fetch('/api/contabilidad/tipos-pago')
      if (!response.ok) throw new Error('Failed to fetch payment types')
      return response.json()
    },
    { ttl: 15 * 60 * 1000 } // 15 minutes cache
  )
}

export function useMonedasCache() {
  return useCache(
    'monedas',
    async () => {
      const response = await fetch('/api/contabilidad/exchange/monedas')
      if (!response.ok) throw new Error('Failed to fetch currencies')
      return response.json()
    },
    { ttl: 30 * 60 * 1000 } // 30 minutes cache
  )
}