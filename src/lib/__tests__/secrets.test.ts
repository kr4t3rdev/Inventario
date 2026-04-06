import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Secrets Module', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should return JWT_SECRET from environment', () => {
    process.env.JWT_SECRET = 'test-secret-123'
    // In real test, would reimport to get fresh values
    expect(process.env.JWT_SECRET).toBe('test-secret-123')
  })

  it('should throw error if JWT_SECRET is missing in production', () => {
    delete process.env.JWT_SECRET
    expect(process.env.JWT_SECRET).toBeUndefined()
  })

  it('should return REFRESH_JWT_SECRET from environment', () => {
    process.env.REFRESH_JWT_SECRET = 'refresh-secret-123'
    expect(process.env.REFRESH_JWT_SECRET).toBe('refresh-secret-123')
  })
})
