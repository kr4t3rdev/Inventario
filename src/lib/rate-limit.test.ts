import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkRateLimit, resetRateLimit } from './rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimit()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('permite requests dentro del límite', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('1.2.3.4', '/api/auth/register')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4 - i)
    }
  })

  it('bloquea requests que exceden el límite', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('1.2.3.4', '/api/auth/register')
    }
    const result = checkRateLimit('1.2.3.4', '/api/auth/register')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resetea el contador al expirar la ventana', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('1.2.3.4', '/api/auth/register')
    }

    vi.advanceTimersByTime(60_001)

    const result = checkRateLimit('1.2.3.4', '/api/auth/register')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('aísla diferentes IPs', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('1.1.1.1', '/api/auth/register')
    }
    const blocked = checkRateLimit('1.1.1.1', '/api/auth/register')
    expect(blocked.allowed).toBe(false)

    const allowed = checkRateLimit('2.2.2.2', '/api/auth/register')
    expect(allowed.allowed).toBe(true)
    expect(allowed.remaining).toBe(4)
  })

  it('aísla diferentes endpoints', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('1.2.3.4', '/api/auth/register')
    }
    const allowed = checkRateLimit('1.2.3.4', '/api/auth/verify-email')
    expect(allowed.allowed).toBe(true)
  })

  it('usa defaults específicos para verify-email', () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit('1.2.3.4', '/api/auth/verify-email')
      expect(r.allowed).toBe(true)
    }
    const blocked = checkRateLimit('1.2.3.4', '/api/auth/verify-email')
    expect(blocked.allowed).toBe(false)
  })

  it('usa config default para rutas no específicas', () => {
    for (let i = 0; i < 20; i++) {
      const r = checkRateLimit('1.2.3.4', '/api/other')
      expect(r.allowed).toBe(true)
    }
    const blocked = checkRateLimit('1.2.3.4', '/api/other')
    expect(blocked.allowed).toBe(false)
  })

  it('respawn rate limit usa 3 requests por 5 minutos', () => {
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit('1.2.3.4', '/api/auth/onboarding/resend-verification')
      expect(r.allowed).toBe(true)
    }
    const blocked = checkRateLimit('1.2.3.4', '/api/auth/onboarding/resend-verification')
    expect(blocked.allowed).toBe(false)

    vi.advanceTimersByTime(300_001)

    const allowed = checkRateLimit('1.2.3.4', '/api/auth/onboarding/resend-verification')
    expect(allowed.allowed).toBe(true)
  })
})
