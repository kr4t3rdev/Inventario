import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({
  prisma: {
    venta: { count: vi.fn(), aggregate: vi.fn() },
    factura: { count: vi.fn() },
    oferta: { count: vi.fn() },
    servicio: { count: vi.fn() },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getSalesHealthAction } from './actions-health'

const adminUser = {
  userId: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin' as const,
  isActive: true, tenantId: 'tenant-1', tenantRole: 'manager' as const,
}

/** @description Verifica los indicadores de ventas del tenant activo. @returns {void} */
describe('getSalesHealthAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna counts y total limitados al tenant del admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
    vi.mocked(prisma.venta.count).mockResolvedValue(50)
    vi.mocked(prisma.venta.aggregate).mockResolvedValue({ _sum: { total: 1250 } } as never)
    vi.mocked(prisma.factura.count).mockResolvedValue(20)
    vi.mocked(prisma.oferta.count).mockResolvedValue(4)
    vi.mocked(prisma.servicio.count).mockResolvedValue(3)

    await expect(getSalesHealthAction()).resolves.toEqual({
      success: true,
      data: { metrics: { ventasCount: 50, ventasTotal: 1250, facturasCount: 20, ofertasCount: 4, serviciosCount: 3 } },
    })
    expect(prisma.venta.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', deletedAt: null } })
    expect(prisma.venta.aggregate).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', deletedAt: null }, _sum: { total: true } })
    expect(prisma.factura.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', estado: { not: 'ANULADA' } } })
  })

  it('rechaza roles no admin sin consultar ventas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, role: 'regularUser' })
    const result = await getSalesHealthAction()
    expect(result.error?.code).toBe('FORBIDDEN')
    expect(prisma.venta.count).not.toHaveBeenCalled()
  })

  it('normaliza una suma nula a cero', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
    vi.mocked(prisma.venta.count).mockResolvedValue(0)
    vi.mocked(prisma.venta.aggregate).mockResolvedValue({ _sum: { total: null } } as never)
    vi.mocked(prisma.factura.count).mockResolvedValue(0)
    vi.mocked(prisma.oferta.count).mockResolvedValue(0)
    vi.mocked(prisma.servicio.count).mockResolvedValue(0)

    const result = await getSalesHealthAction()
    expect(result.success && result.data?.metrics.ventasTotal).toBe(0)
  })
})
