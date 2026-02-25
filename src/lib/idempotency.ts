import { getRedis } from "./redis"

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 1 día

// Almacén en memoria para desarrollo local sin Redis
const memoryStore = new Map<string, { value: string; expiry: number }>()

// Limpieza periódica del almacén en memoria (cada 1 hora)
if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, item] of memoryStore.entries()) {
      if (now > item.expiry) {
        memoryStore.delete(key)
      }
    }
  }, 60 * 60 * 1000)
}

/**
 * Recupera un resultado cacheado para una clave de idempotencia.
 * La idempotencia asegura que múltiples intentos de la misma operación (ej. por reintentos de red)
 * no provoquen efectos secundarios duplicados (ej. crear 2 veces las mismas licencias).
 * 
 * @param key Clave única de la operación (ej. "idem:licencias:generar:UUID")
 * @returns El resultado cacheado o null si no existe o expiró
 */
export async function getIdempotentResult<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  
  // Si hay Redis, usarlo (Producción / Entornos robustos)
  if (redis) {
    const raw = await redis.get<string>(key)
    if (!raw) return null
    try {
      // Upstash Redis a veces devuelve el objeto ya parseado si se usa scan/get, 
      // pero get<string> tipado suele devolver string. 
      // Manejamos ambos casos por seguridad.
      return typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      return null
    }
  }

  // Fallback en memoria (Desarrollo local sin Redis)
  const item = memoryStore.get(key)
  if (!item) return null
  
  if (Date.now() > item.expiry) {
    memoryStore.delete(key)
    return null
  }

  try {
    return JSON.parse(item.value) as T
  } catch {
    return null
  }
}

/**
 * Guarda el resultado de una operación bajo una clave de idempotencia con un tiempo de vida (TTL).
 * 
 * @param key Clave única de la operación
 * @param value Resultado a guardar (se serializará a JSON)
 * @param ttlMs Tiempo de vida en milisegundos (Default: 24 horas). 
 *              Después de este tiempo, la clave expira y un nuevo intento ejecutará la operación nuevamente.
 *              Esto es importante para no llenar la memoria indefinidamente.
 */
export async function setIdempotentResult<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  const redis = getRedis()
  const serialized = JSON.stringify(value)

  if (redis) {
    await redis.set(key, serialized, { px: ttlMs })
    return
  }

  // Fallback en memoria
  memoryStore.set(key, {
    value: serialized,
    expiry: Date.now() + ttlMs
  })
}
