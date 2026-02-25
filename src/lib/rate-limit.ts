import { getRedis } from "./redis"

type CheckResult = { allowed: boolean; remaining: number; resetMs: number; backend: "redis" | "memory" }

const memoryStore = new Map<string, { count: number; resetAt: number }>()

export async function checkRateLimit(key: string, windowMs: number, max: number, prefix = "ratelimit"): Promise<CheckResult> {
  const redis = getRedis()
  const namespaced = `${prefix}:${key}`
  const now = Date.now()

  if (redis) {
    const expireSeconds = Math.ceil(windowMs / 1000)
    const pipe = redis.pipeline()
    pipe.incr(namespaced)
    pipe.expire(namespaced, expireSeconds)
    pipe.pttl(namespaced)
    const [[, count], [,], [, pttl]] = (await pipe.exec()) as [unknown, number][][]
    const remaining = Math.max(0, max - Number(count ?? 0))
    return {
      allowed: Number(count ?? 0) <= max,
      remaining,
      resetMs: typeof pttl === "number" && pttl > 0 ? pttl : windowMs,
      backend: "redis",
    }
  }

  const bucket = memoryStore.get(namespaced)
  if (!bucket || now > bucket.resetAt) {
    memoryStore.set(namespaced, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetMs: windowMs, backend: "memory" }
  }
  bucket.count += 1
  const remaining = Math.max(0, max - bucket.count)
  return { allowed: bucket.count <= max, remaining, resetMs: bucket.resetAt - now, backend: "memory" }
}

