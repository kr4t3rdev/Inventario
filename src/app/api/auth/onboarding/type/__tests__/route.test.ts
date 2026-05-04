import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { POST } from '../route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/onboarding', () => ({
  validateCSRF: vi.fn(() => ({ valid: true })),
  verifyOnboardingToken: vi.fn(),
  signOnboardingToken: vi.fn(),
}))

describe('/api/auth/onboarding/type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guarda el tipo worker y avanza a selecting_tenant', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-1',
      email: 'worker@test.com',
      purpose: 'onboarding',
    } as never)

    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'worker' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.onboardingStatus).toBe('selecting_tenant')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        onboardingType: 'worker',
        onboardingStatus: 'selecting_tenant',
      },
    })
  })

  it('guarda el tipo company y avanza a awaiting_global_approval', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-2',
      email: 'company@test.com',
      purpose: 'onboarding',
    } as never)

    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'company' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.onboardingStatus).toBe('awaiting_global_approval')
  })
})
