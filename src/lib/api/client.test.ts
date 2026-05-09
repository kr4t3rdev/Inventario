import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ServerActionError } from './errors'
import { getAuthenticatedContext } from './client'

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

// Mock jsonwebtoken (CommonJS module)
vi.mock('jsonwebtoken', () => {
  const verify = vi.fn()
  return {
    default: { verify },
    verify,
  }
})

import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

describe('getAuthenticatedContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw ServerActionError 401 when no refreshToken cookie', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as any)

    try {
      await getAuthenticatedContext()
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).status).toBe(401)
    }
  })

  it('should throw ServerActionError when refreshToken JWT is invalid', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ name: 'refreshToken', value: 'invalid-token' }),
    } as any)
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('jwt malformed')
    })

    try {
      await getAuthenticatedContext()
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).status).toBe(401)
    }
  })

  it('should return userId from valid refreshToken', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ name: 'refreshToken', value: 'valid-jwt' }),
    } as any)
    vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-123', email: 'test@example.com' } as any)

    const ctx = await getAuthenticatedContext()

    expect(ctx.userId).toBe('user-123')
    expect(ctx.tenantId).toBeUndefined()
  })

  it('should return tenantId when present in token', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ name: 'refreshToken', value: 'valid-jwt' }),
    } as any)
    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
      tenantId: 'tenant-1',
      tenantRole: 'admin',
      iat: 123456,
    } as any)

    const ctx = await getAuthenticatedContext()

    expect(ctx.userId).toBe('user-123')
    expect(ctx.tenantId).toBe('tenant-1')
    expect(ctx.tenantRole).toBe('admin')
  })

  it('should omit tenantId when not in token', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ name: 'refreshToken', value: 'valid-jwt' }),
    } as any)
    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-123',
    } as any)

    const ctx = await getAuthenticatedContext()

    expect(ctx.userId).toBe('user-123')
    expect(ctx.tenantId).toBeUndefined()
  })
})
