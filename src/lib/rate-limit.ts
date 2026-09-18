const STORE = new Map<string, { count: number; resetAt: number }>()

const PURGE_INTERVAL_MS = 60_000

let purgeTimer: ReturnType<typeof setInterval> & { unref?: () => void } | null = null

function startPurgeTimer(): void {
  if (purgeTimer) return
  purgeTimer = setInterval(purgeExpired, PURGE_INTERVAL_MS)
  if (purgeTimer.unref) purgeTimer.unref()
}

function purgeExpired(): void {
  const now = Date.now()
  for (const [key, entry] of STORE) {
    if (now >= entry.resetAt) STORE.delete(key)
  }
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

const defaults: Record<string, RateLimitConfig> = {
  '/api/auth/register': { maxRequests: 5, windowMs: 60_000 },
  '/api/auth/verify-email': { maxRequests: 5, windowMs: 60_000 },
  '/api/auth/onboarding/resend-verification': { maxRequests: 3, windowMs: 300_000 },
}

const defaultConfig: RateLimitConfig = { maxRequests: 20, windowMs: 60_000 }

function getConfig(path: string): RateLimitConfig {
  for (const [prefix, config] of Object.entries(defaults)) {
    if (path.startsWith(prefix)) return config
  }
  return defaultConfig
}

function buildKey(ip: string, path: string): string {
  return `${ip}::${path}`
}

/**
 * @description Rate limiter en memoria con sliding window.
 * Lleva conteo de requests por IP y endpoint.
 * @param {string} ip - Dirección IP del cliente.
 * @param {string} path - Path del endpoint.
 * @returns {RateLimitResult}
 */
export function checkRateLimit(ip: string, path: string): RateLimitResult {
  startPurgeTimer()

  const config = getConfig(path)
  const key = buildKey(ip, path)
  const now = Date.now()

  let entry = STORE.get(key)

  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + config.windowMs }
    STORE.set(key, entry)
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: entry.resetAt }
  }

  entry.count++

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

export function resetRateLimit(): void {
  STORE.clear()
}
