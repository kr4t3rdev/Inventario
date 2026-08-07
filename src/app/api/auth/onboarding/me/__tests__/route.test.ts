import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { GET } from '../route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    tenant: {
      findMany: vi.fn(),
    },
    tenantMembership: {
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/onboarding', () => ({
  validateCSRF: vi.fn(() => ({ valid: true })),
  verifyOnboardingToken: vi.fn(),
  signOnboardingToken: vi.fn(),
}))

describe('/api/auth/onboarding/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve el contexto de onboarding y lista de tenants', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-1',
      email: 'new@test.com',
      purpose: 'onboarding',
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      name: 'New User',
      email: 'new@test.com',
      role: 'regularUser',
      isActive: false,
      onboardingType: null,
      onboardingStatus: 'selecting_user_type',
      emailVerifiedAt: new Date(),
    } as never)
    vi.mocked(prisma.tenant.findMany).mockResolvedValueOnce([
      { tenantId: 'tenant-1', nombre: 'Empresa 1', slug: 'empresa-1' },
    ] as never)
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0)

    const request = new NextRequest('http://localhost/api/auth/onboarding/me', {
      method: 'GET',
      headers: {
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user.onboardingStatus).toBe('selecting_user_type')
    expect(data.tenants).toHaveLength(1)
    expect(data.hasActiveMembership).toBe(false)
  })

  it('reporta hasActiveMembership=true cuando el worker ya fue aprobado', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-1',
      email: 'new@test.com',
      purpose: 'onboarding',
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      name: 'New User',
      email: 'new@test.com',
      role: 'regularUser',
      isActive: true,
      onboardingType: 'worker',
      onboardingStatus: 'awaiting_manager_approval',
      emailVerifiedAt: new Date(),
    } as never)
    vi.mocked(prisma.tenant.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(1)

    const request = new NextRequest('http://localhost/api/auth/onboarding/me', {
      method: 'GET',
      headers: {
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.hasActiveMembership).toBe(true)
  })
})
