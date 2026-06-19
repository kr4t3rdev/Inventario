import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findFirst: vi.fn() },
    compraDocumentoItem: { findMany: vi.fn(), count: vi.fn() },
    merma: { aggregate: vi.fn().mockResolvedValue({ _sum: { cantidad: 0 } }) },
    tasaCambio: { findMany: vi.fn().mockResolvedValue([]) },
    precioProducto: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getHistorialCostosAction } from '../actions'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'u-1',
  name: 'Tester',
  email: 't@test.com',
  role: 'admin' as AuthenticatedUser['role'],
  isActive: true,
  tenantId: 'tenant-A',
  tenantRole: 'manager',
}

describe('getHistorialCostosAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 404 si el producto no pertenece al tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)

    const result = await getHistorialCostosAction({ productoId: 'prod-1' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('pagina 20 items por defecto y devuelve total', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      {
        compraDocumentoItemId: 'i1',
        cantidad: 100,
        precioUnitario: 500,
        totalLinea: 50000,
        compraDocumento: {
          fechaCompra: new Date('2026-01-15'),
          numeroFactura: 'F-001',
          proveedor: { nombre: 'Proveedor A' },
        },
      },
    ] as any)
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(45)

    const result = await getHistorialCostosAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toHaveLength(1)
      expect(result.data.pagination.page).toBe(1)
      expect(result.data.pagination.limit).toBe(20)
      expect(result.data.pagination.total).toBe(45)
      expect(result.data.pagination.totalPages).toBe(3)
    }
    expect(prisma.compraDocumentoItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { compraDocumento: { fechaCompra: 'desc' } },
      }),
    )
  })

  it('respeta los filtros de fecha y proveedor', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(0)

    const result = await getHistorialCostosAction({
      productoId: 'prod-1',
      page: 2,
      limit: 10,
      fechaDesde: '2026-03-01',
      fechaHasta: '2026-03-31',
      proveedorId: 'prov-1',
    })
    expect(result.success).toBe(true)
    expect(prisma.compraDocumentoItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productoId: 'prod-1',
          tenantId: 'tenant-A',
          compraDocumento: expect.objectContaining({
            fechaCompra: expect.objectContaining({
              gte: new Date('2026-03-01'),
              lte: new Date('2026-03-31'),
            }),
            proveedorId: 'prov-1',
          }),
        }),
        skip: 10,
        take: 10,
      }),
    )
  })

  it('devuelve lista vacía sin error cuando no hay compras', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(0)

    const result = await getHistorialCostosAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toEqual([])
      expect(result.data.pagination.total).toBe(0)
    }
  })
})
