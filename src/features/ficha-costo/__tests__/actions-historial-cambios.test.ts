import { describe, it, expect, vi, beforeEach } from 'vitest'
import { expectActionSuccess } from '@/test/action-response'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { getHistorialCambiosPrecioAction } from '../actions-historial-cambios'

// La sesion se resuelve dentro del withAction real; solo se fija el usuario.
vi.mock('@/lib/server-actions/get-current-user')

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
    productoCostHistory: { findMany: vi.fn(), count: vi.fn() },
  },
}))
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireFeature: vi.fn(),
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'

const mockUser: AuthenticatedUser = {
  userId: 'u1',
  name: 'Usuario Historial',
  email: 'historial@test.com',
  isActive: true,
  tenantId: 'tenant-1',
  planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
  role: 'admin',
}

describe('getHistorialCambiosPrecioAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
  })

  it('retorna historial paginado de cambios de precio', async () => {
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValue([
      {
        id: 'h1', productoId: 'p1', oldPrecioVenta: 100, newPrecioVenta: 120,
        oldPrecioCosto: 50, newPrecioCosto: 50, reason: 'MANUAL_EDIT',
        changedBy: 'user-1', changedAt: new Date('2026-01-01'), notes: 'Ajuste',
      },
    ] as any)
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValue(15)

    const data = expectActionSuccess(await getHistorialCambiosPrecioAction(
      { page: 1, limit: 10 },
    )).data

    expect(data.items).toHaveLength(1)
    expect(data.items[0].precioVenta).toEqual({ old: 100, new: 120 })
    expect(data.pagination.total).toBe(15)
    expect(data.pagination.totalPages).toBe(2)

    const tenantHistoryWhere = { producto: { is: { tenantId: 'tenant-1' } } }
    expect(prisma.productoCostHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: tenantHistoryWhere }),
    )
    expect(prisma.productoCostHistory.count).toHaveBeenCalledWith({ where: tenantHistoryWhere })
  })

  it('filtra por productoId', async () => {
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValue([])
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValue(0)

    await getHistorialCambiosPrecioAction(
      { productoId: 'p1', page: 1, limit: 10 },
    )

    const tenantProductWhere = {
      producto: { is: { tenantId: 'tenant-1' } },
      productoId: 'p1',
    }
    expect(prisma.producto.findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', tenantId: 'tenant-1' },
      select: { id: true },
    })
    expect(prisma.productoCostHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: tenantProductWhere }),
    )
    expect(prisma.productoCostHistory.count).toHaveBeenCalledWith({ where: tenantProductWhere })
  })

  it('fails closed for a foreign product without querying its history', async () => {
    vi.mocked(prisma.producto.findFirst).mockResolvedValueOnce(null)

    const data = expectActionSuccess(await getHistorialCambiosPrecioAction(
      { productoId: 'foreign-product', page: 1, limit: 10 },
    )).data

    expect(data).toEqual({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })
    expect(prisma.producto.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-product', tenantId: 'tenant-1' },
      select: { id: true },
    })
    expect(prisma.productoCostHistory.findMany).not.toHaveBeenCalled()
    expect(prisma.productoCostHistory.count).not.toHaveBeenCalled()
  })
})
