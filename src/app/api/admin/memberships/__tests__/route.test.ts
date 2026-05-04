import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantMembership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: Function) => handler,
  withAuth: (handler: Function) => handler,
}))

import { GET as getPending } from '../pending/route'

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-admin-1',
    name: 'Admin',
    email: 'admin@test.com',
    role: 'admin',
    isActive: true,
    tenantId: 'tenant-1',
    tenantRole: 'manager',
    ...overrides,
  }
}

describe('admin memberships endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/memberships/pending', () => {
    it('devuelve membresías pendientes del tenant', async () => {
      const mockMemberships = [
        {
          membershipId: 'mem-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          isActive: false,
          user: { userId: 'user-1', name: 'John', email: 'john@test.com', onboardingType: 'worker', onboardingStatus: 'awaiting_manager_approval', createdAt: new Date() },
        },
      ]

      vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce(mockMemberships as any)

      const request = new NextRequest('http://localhost/api/admin/memberships/pending')
      const response = await getPending(request, {}, mockUser())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].membershipId).toBe('mem-1')
      expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', isActive: false },
        include: {
          user: {
            select: {
              userId: true,
              name: true,
              email: true,
              onboardingType: true,
              onboardingStatus: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('rechaza si no es admin del tenant', async () => {
      const request = new NextRequest('http://localhost/api/admin/memberships/pending')
      const response = await getPending(request, {}, mockUser({ tenantRole: 'dependiente' }))
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('No autorizado')
    })
  })
})
