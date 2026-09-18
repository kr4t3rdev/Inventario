import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({ prisma: { factura: { count: vi.fn() }, venta: { count: vi.fn() } } }))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getBillingHealthAction } from './actions-health'

const adminUser = {
  userId: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin' as const,
  isActive: true, tenantId: 'tenant-1', tenantRole: 'manager' as const,
}

/** @description Verifica los indicadores de facturación del tenant activo. @returns {void} */
describe('getBillingHealthAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calcula la tasa de formalización redondeada', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
    vi.mocked(prisma.factura.count).mockResolvedValue(4)
    vi.mocked(prisma.venta.count).mockResolvedValue(10)

    await expect(getBillingHealthAction()).resolves.toEqual({
      success: true,
      data: { metrics: { facturasCount: 4, ventasCount: 10, formalizationRate: 40 } },
    })
  })

  it('retorna tasa cero sin ventas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
    vi.mocked(prisma.factura.count).mockResolvedValue(3)
    vi.mocked(prisma.venta.count).mockResolvedValue(0)

    const result = await getBillingHealthAction()
    expect(result.success && result.data?.metrics.formalizationRate).toBe(0)
  })

  it('rechaza roles no admin sin consultar facturas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, role: 'regularUser' })
    const result = await getBillingHealthAction()
    expect(result.error?.code).toBe('FORBIDDEN')
    expect(prisma.factura.count).not.toHaveBeenCalled()
  })
})
