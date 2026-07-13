import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({ prisma: { oferta: { count: vi.fn() }, servicio: { count: vi.fn() } } }))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getOffersServicesHealthAction } from './actions-health'

const admin = { userId: 'a', name: 'a', email: 'a@a.com', role: 'admin' as const, isActive: true, tenantId: 't', tenantRole: 'manager' as const }

describe('getOffersServicesHealthAction', () => {
  it('retorna counts de ofertas y servicios del tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin)
    vi.mocked(prisma.oferta.count).mockResolvedValue(4)
    vi.mocked(prisma.servicio.count).mockResolvedValue(3)
    await expect(getOffersServicesHealthAction()).resolves.toEqual({ success: true, data: { metrics: { ofertasCount: 4, serviciosCount: 3 } } })
  })
})