import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { POST } from '../route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/onboarding', () => ({
  validateCSRF: vi.fn(() => ({ valid: true })),
  verifyOnboardingToken: vi.fn(),
  signOnboardingToken: vi.fn().mockReturnValue('onboarding-token'),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 })),
}))

describe('/api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifica el correo y devuelve onboarding token', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-1',
      email: 'test@test.com',
      purpose: 'email-verification',
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      email: 'test@test.com',
      isActive: false,
      onboardingStatus: 'pending_email_verification',
    } as never)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never)

    const request = new NextRequest('http://localhost/api/auth/verify-email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({ token: 'email-token' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.onboardingToken).toBe('onboarding-token')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: expect.objectContaining({
        emailVerifiedAt: expect.any(Date),
        onboardingStatus: 'selecting_user_type',
      }),
    })
  })

  it('devuelve 400 cuando el token es inválido', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockImplementation(() => {
      throw new Error('jwt malformed')
    })

    const request = new NextRequest('http://localhost/api/auth/verify-email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({ token: 'bad-token' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token inválido o expirado')
  })

  it('devuelve 500 cuando falla la base y no acusa token inválido', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-1',
      email: 'test@test.com',
      purpose: 'email-verification',
    } as never)

    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error('db timeout'))

    const request = new NextRequest('http://localhost/api/auth/verify-email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({ token: 'email-token' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('No se pudo verificar el correo por un problema temporal')
  })
})
