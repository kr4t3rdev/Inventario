import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ServerActionError } from '@/lib/api/errors'
import { checkAuth } from './auth-check'

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { cookies } from 'next/headers'

describe('checkAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw ServerActionError with status 401 when no refreshToken cookie', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as any)

    try {
      await checkAuth()
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).endpoint).toBe('checkAuth')
      expect((error as ServerActionError).method).toBe('UNKNOWN')
      expect((error as ServerActionError).status).toBe(401)
      expect((error as ServerActionError).message).toBe('No autenticado')
    }
  })

  it('should resolve when refreshToken cookie exists', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ name: 'refreshToken', value: 'some-valid-token' }),
    } as any)

    const result = await checkAuth()
    expect(result).toBeUndefined()
  })

  it('should call cookies().get with "refreshToken"', async () => {
    const mockGet = vi.fn().mockReturnValue({ name: 'refreshToken', value: 'token' })
    vi.mocked(cookies).mockResolvedValue({
      get: mockGet,
    } as any)

    await checkAuth()
    expect(mockGet).toHaveBeenCalledWith('refreshToken')
  })
})
