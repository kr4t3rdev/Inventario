import { register, Counter, collectDefaultMetrics, Registry } from 'prom-client'

// Singleton para el registro de métricas para evitar errores de recarga en desarrollo
// "Metric with name ... has already been registered"
let metricsRegistry: Registry

declare global {
  var _metricsRegistry: Registry | undefined
}

if (process.env.NODE_ENV === 'production') {
  metricsRegistry = register
} else {
  if (!global._metricsRegistry) {
    global._metricsRegistry = register
  }
  metricsRegistry = global._metricsRegistry
}

// Inicializar métricas por defecto (CPU, memoria, etc.)
// Solo si no se han inicializado ya
try {
  collectDefaultMetrics({ register: metricsRegistry })
} catch (e) {
  // Ignorar error si ya se están recolectando
}

// Definición de contadores personalizados
// Usamos un patrón para obtener o crear la métrica para soportar Hot Reloading

const getOrCreateCounter = (name: string, help: string, labelNames: string[]) => {
  const existing = metricsRegistry.getSingleMetric(name)
  if (existing) {
    return existing as Counter
  }
  return new Counter({
    name,
    help,
    labelNames,
    registers: [metricsRegistry],
  })
}

export const licenseValidationCounter = getOrCreateCounter(
  'licencias_validaciones_total',
  'Total de validaciones de licencias',
  ['status', 'reason'] // status: 'valid', 'invalid', 'error'. reason: 'active', 'expired', 'revoked', 'not_found', etc.
)

export const rateLimitCounter = getOrCreateCounter(
  'rate_limit_hits_total',
  'Total de peticiones rechazadas por rate limit',
  ['endpoint', 'ip']
)

export const idempotencyCounter = getOrCreateCounter(
  'idempotency_hits_total',
  'Total de peticiones manejadas por idempotencia',
  ['endpoint', 'action'] // action: 'cache_hit', 'conflict'
)

export const licenseCreationCounter = getOrCreateCounter(
  'licencias_creadas_total',
  'Total de licencias creadas',
  ['plan', 'origen'] // origen: 'manual', 'api'
)

export { metricsRegistry }
