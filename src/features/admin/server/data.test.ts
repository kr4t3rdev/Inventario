import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    plan: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('@/lib/prisma')
  return { prismaPlatform: prisma, default: prisma }
})

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getAdminUsersPageData } from './data'

describe('getAdminUsersPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga memberships de tenant en vez de tenants', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ role: 'admin' } as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        userId: 'user-1',
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'admin',
        onboardingStatus: 'completado',
        onboardingType: null,
        isActive: true,
        lockedUntil: null,
        expiresAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        loginAttempts: 0,
        salesAgentProfile: null,
        salesAgentBalance: null,
        salesAgentReferrals: [],
        tenantMemberships: [
          {
            tenantId: 'tenant-1',
            tenantRole: 'owner',
            isActive: true,
            tenant: { nombre: 'Tenant Uno' },
          },
        ],
        _count: { tenantMemberships: 1 },
      },
    ] as any)
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    vi.mocked(prisma.plan.findMany).mockResolvedValue([])

    const result = await getAdminUsersPageData()

    expect(result?.users[0].tenants).toEqual([
      {
        tenantId: 'tenant-1',
        tenantRole: 'owner',
        isActive: true,
        tenant: { nombre: 'Tenant Uno' },
      },
    ])
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          tenantMemberships: expect.objectContaining({
            select: expect.objectContaining({
              tenant: { select: { nombre: true } },
            }),
          }),
        }),
      }),
    )
  })
})
