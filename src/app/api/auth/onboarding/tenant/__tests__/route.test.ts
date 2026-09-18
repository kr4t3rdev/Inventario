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
    tenant: {
      findUnique: vi.fn(),
    },
    tenantMembership: {
      count: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('@/lib/prisma')
  return { prismaPlatform: prisma, default: prisma }
})

vi.mock('@/lib/auth/onboarding', () => ({
  validateCSRF: vi.fn(() => ({ valid: true })),
  verifyOnboardingToken: vi.fn(),
  signOnboardingToken: vi.fn(),
}))

describe('/api/auth/onboarding/tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea una membresía pendiente y notifica a managers', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-1',
      email: 'worker@test.com',
      purpose: 'onboarding',
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      name: 'Worker User',
      onboardingType: 'worker',
      onboardingStatus: 'selecting_tenant',
    } as never)
    vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
      tenantId: 'tenant-1',
    } as never)
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0 as never)
    vi.mocked(prisma.tenantMembership.upsert).mockResolvedValueOnce({
      membershipId: 'membership-1',
    } as never)
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce([
      { userId: 'manager-1' },
      { userId: 'manager-2' },
    ] as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/tenant', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ tenantId: 'tenant-1' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.membershipId).toBe('membership-1')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { onboardingStatus: 'awaiting_manager_approval' },
    })
    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
  })
})
