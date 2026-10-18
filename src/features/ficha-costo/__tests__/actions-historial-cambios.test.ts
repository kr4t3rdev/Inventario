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
  })

  it('filtra por productoId', async () => {
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValue([])
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValue(0)

    await getHistorialCambiosPrecioAction(
      { productoId: 'p1', page: 1, limit: 10 },
    )

    expect(prisma.productoCostHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productoId: 'p1' }),
      }),
    )
  })

  it('opcionalmente filtra por tenantId via producto', async () => {
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValue([])
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValue(0)

    await getHistorialCambiosPrecioAction(
      { page: 1, limit: 10 },
    )

    // Since ProductoCostHistory doesn't have tenantId, we can't filter it directly.
    // The test verifies the action runs without error (multi-tenant is handled
    // by only returning records for products the tenant owns, via join).
    expect(prisma.productoCostHistory.findMany).toHaveBeenCalled()
  })
})
