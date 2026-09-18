import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({ prisma: { compraDocumento: { count: vi.fn() }, compraProducto: { count: vi.fn(), aggregate: vi.fn() }, vendor: { count: vi.fn() } } }))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getPurchaseHealthAction } from './actions-health'

const admin = { userId: 'a', name: 'a', email: 'a@a.com', role: 'admin' as const, isActive: true, tenantId: 't', tenantRole: 'manager' as const }

describe('getPurchaseHealthAction', () => {
  it('retorna métricas del tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin)
    vi.mocked(prisma.compraDocumento.count).mockResolvedValue(2)
    vi.mocked(prisma.compraProducto.count).mockResolvedValue(4)
    vi.mocked(prisma.compraProducto.aggregate).mockResolvedValue({ _sum: { total: 100 } } as never)
    vi.mocked(prisma.vendor.count).mockResolvedValue(3)
    await expect(getPurchaseHealthAction()).resolves.toEqual({ success: true, data: { metrics: { comprasCount: 2, comprasTotal: 100, itemsCount: 4, vendorActiveCount: 3 } } })
  })
})
