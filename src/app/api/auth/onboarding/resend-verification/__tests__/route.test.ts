import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { POST } from '../route'
import { sendEmailVerificationLink } from '@/lib/email'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/onboarding', () => ({
  validateCSRF: vi.fn(() => ({ valid: true })),
  verifyOnboardingToken: vi.fn(),
  signOnboardingToken: vi.fn().mockReturnValue('verification-token'),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 2, resetAt: Date.now() + 1000 })),
}))

vi.mock('@/lib/email', () => ({
  sendEmailVerificationLink: vi.fn(),
}))

describe('/api/auth/onboarding/resend-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reenvía el link de verificación para usuarios pendientes', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      name: 'New User',
      email: 'new@test.com',
      onboardingStatus: 'pending_email_verification',
    } as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/resend-verification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({ email: 'new@test.com' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Email de verificación reenviado.')
    expect(sendEmailVerificationLink).toHaveBeenCalledWith(
      'new@test.com',
      expect.stringContaining('/verify-email?token='),
      'New User',
    )
  })
})
