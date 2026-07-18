import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    producto: { findFirst: vi.fn() },
    ventaItem: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    purchaseAllocation: { findMany: vi.fn() },
    compraDocumentoItem: { findMany: vi.fn() },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getVentasProductoAction } from '../actions-ventas'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'u-1',
  name: 'Tester',
  email: 't@test.com',
  role: 'admin' as AuthenticatedUser['role'],
  isActive: true,
  tenantId: 'tenant-A',
  planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
  tenantRole: 'manager',
}

const VENTA_ITEM_BASE = {
  id: 'vi-1',
  ventaId: 'v-1',
  productoId: 'prod-1',
  cantidad: 10,
  precioUnitario: 100,
  total: 1000,
  venta: {
    ventaId: 'v-1',
    createdAt: new Date('2026-05-01'),
    cliente: { nombre: 'Cliente A' },
  },
}

describe('getVentasProductoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ costoTotal: 0 }] as any)
  })

  it('happy path: 3 ventas con allocations FIFO → costoReal calculado', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockResolvedValue([
      { ...VENTA_ITEM_BASE, id: 'vi-1', ventaId: 'v-1' },
      { ...VENTA_ITEM_BASE, id: 'vi-2', ventaId: 'v-2' },
      { ...VENTA_ITEM_BASE, id: 'vi-3', ventaId: 'v-3' },
    ] as any)
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(3)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 30, total: 3000 },
    } as any)
    // Allocations: cada venta tiene 1 allocation de 10 unidades a precio 60
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([
      { ventaItemId: 'vi-1', compraDocumentoItemId: 'cdi-1', cantidad: 10 },
      { ventaItemId: 'vi-2', compraDocumentoItemId: 'cdi-2', cantidad: 10 },
      { ventaItemId: 'vi-3', compraDocumentoItemId: 'cdi-3', cantidad: 10 },
    ] as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      { compraDocumentoItemId: 'cdi-1', precioUnitario: 60 },
      { compraDocumentoItemId: 'cdi-2', precioUnitario: 60 },
      { compraDocumentoItemId: 'cdi-3', precioUnitario: 60 },
    ] as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ costoTotal: 1800 }] as any)

    // Act
    const result = await getVentasProductoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toHaveLength(3)
      expect(result.data.items[0].ventaItemId).toBe('vi-1')
      expect(result.data.items[0].fecha).toBe('2026-05-01T00:00:00.000Z')
      // Cada venta: ingreso 1000, costo 600 (10 * 60), margen 40%
      expect(result.data.items[0].costoReal).toBe(600)
      expect(result.data.items[0].margenReal).toBeCloseTo(40, 1)
      expect(result.data.items[0].esLegacy).toBe(false)
      expect(result.data.resumen.totalVendido).toBe(3000)
      expect(result.data.resumen.costoTotal).toBe(1800)
    }
  })

  it('venta legacy sin allocations → costoReal = precioCosto * cantidad, esLegacy = true', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockResolvedValue([
      { ...VENTA_ITEM_BASE, id: 'vi-1' },
    ] as any)
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(1)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 10, total: 1000 },
    } as any)
    // Sin allocations
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])

    // Act
    const result = await getVentasProductoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].costoReal).toBe(500) // 10 * 50 (precioCosto)
      expect(result.data.items[0].esLegacy).toBe(true)
    }
  })

  it('ventas con cliente → clienteNombre correcto', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockResolvedValue([
      {
        ...VENTA_ITEM_BASE,
        venta: { ...VENTA_ITEM_BASE.venta, cliente: { nombre: 'Juan Pérez' } },
      },
    ] as any)
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(1)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 10, total: 1000 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])

    // Act
    const result = await getVentasProductoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].clienteNombre).toBe('Juan Pérez')
    }
  })

  it('ventas sin cliente → clienteNombre = "Cliente genérico"', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockResolvedValue([
      { ...VENTA_ITEM_BASE, venta: { ...VENTA_ITEM_BASE.venta, cliente: null } },
    ] as any)
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(1)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 10, total: 1000 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])

    // Act
    const result = await getVentasProductoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].clienteNombre).toBe('Cliente genérico')
    }
  })

  it('filtro por fechaDesde → solo ventas >= fechaDesde', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(0)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 0, total: 0 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])

    // Act
    await getVentasProductoAction({
      productoId: 'prod-1',
      fechaDesde: '2026-03-01',
    })

    // Assert: la query debe incluir el filtro
    expect(prisma.ventaItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venta: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date('2026-03-01'),
            }),
          }),
        }),
      }),
    )
    const costoQuery = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as {
      sql: string
      values: unknown[]
    }
    expect(costoQuery.sql).toContain('v."createdAt" >=')
    expect(costoQuery.values).toEqual(
      expect.arrayContaining([
        'tenant-A',
        'prod-1',
        new Date('2026-03-01'),
      ]),
    )
  })

  it('filtro por fechaHasta → solo ventas <= fechaHasta', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(0)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 0, total: 0 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])

    // Act
    await getVentasProductoAction({
      productoId: 'prod-1',
      fechaHasta: '2026-03-31',
    })

    // Assert
    expect(prisma.ventaItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venta: expect.objectContaining({
            createdAt: expect.objectContaining({
              lte: new Date('2026-03-31'),
            }),
          }),
        }),
      }),
    )
    const costoQuery = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as {
      sql: string
      values: unknown[]
    }
    expect(costoQuery.sql).toContain('v."createdAt" <=')
    expect(costoQuery.values).toEqual(
      expect.arrayContaining([
        'tenant-A',
        'prod-1',
        new Date('2026-03-31'),
      ]),
    )
  })

  it('paginación: 25 ventas, page 2 limit 10 → 10 items, pagination correcta', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    const itemsPagina2 = Array.from({ length: 10 }, (_, i) => ({
      ...VENTA_ITEM_BASE,
      id: `vi-${i + 11}`,
    }))
    vi.mocked(prisma.ventaItem.findMany).mockImplementation((args: any) => {
      if (args?.skip === 10 && args?.take === 10) {
        return Promise.resolve(itemsPagina2) as any
      }
      return Promise.resolve([]) as any
    })
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(25)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 250, total: 25000 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])

    // Act
    const result = await getVentasProductoAction({
      productoId: 'prod-1',
      page: 2,
      limit: 10,
    })

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toHaveLength(10)
      expect(result.data.pagination.page).toBe(2)
      expect(result.data.pagination.total).toBe(25)
      expect(result.data.pagination.totalPages).toBe(3)
    }
  })

  it('multi-tenant: producto de otro tenant → NOT_FOUND', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)

    // Act
    const result = await getVentasProductoAction({ productoId: 'prod-otro-tenant' })

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('sin ventas → items: [], resumen con todo en 0', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(0)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 0, total: 0 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])

    // Act
    const result = await getVentasProductoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toEqual([])
      expect(result.data.resumen.totalVendido).toBe(0)
      expect(result.data.resumen.costoTotal).toBe(0)
      expect(result.data.resumen.margenPromedio).toBe(0)
      expect(result.data.resumen.cantidadVentas).toBe(0)
    }
  })

  it('resumen calculado sobre dataset completo (no solo página)', async () => {
    // Arrange: 25 ventas totales, página 1 con 10 items
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    const itemsPagina1 = Array.from({ length: 10 }, (_, i) => ({
      ...VENTA_ITEM_BASE,
      id: `vi-${i + 1}`,
    }))
    vi.mocked(prisma.ventaItem.findMany).mockImplementation((args: any) => {
      if (args?.skip === 0 && args?.take === 10) {
        return Promise.resolve(itemsPagina1) as any
      }
      return Promise.resolve([]) as any
    })
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(25)
    // Aggregate sobre TODO el dataset (25 ventas)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 250, total: 25000 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])

    // Act
    const result = await getVentasProductoAction({
      productoId: 'prod-1',
      page: 1,
      limit: 10,
    })

    // Assert: resumen refleja las 25 ventas, no solo las 10 de la página
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.resumen.totalVendido).toBe(25000)
      expect(result.data.resumen.cantidadVentas).toBe(25)
    }
  })

  it('mantiene el resumen global al paginar entre mezclas de costo diferentes', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockImplementation((args: any) => {
      return Promise.resolve([
        {
          ...VENTA_ITEM_BASE,
          id: args?.skip === 0 ? 'vi-low' : 'vi-high',
        },
      ]) as any
    })
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(2)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 20, total: 2000 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockImplementation((args: any) => {
      const ventaItemId = args.where.ventaItemId.in[0]
      return Promise.resolve([
        {
          ventaItemId,
          compraDocumentoItemId: ventaItemId === 'vi-low' ? 'cdi-low' : 'cdi-high',
          cantidad: 10,
        },
      ]) as any
    })
    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      const compraId = args.where.compraDocumentoItemId.in[0]
      return Promise.resolve([
        {
          compraDocumentoItemId: compraId,
          precioUnitario: compraId === 'cdi-low' ? 10 : 90,
        },
      ]) as any
    })
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ costoTotal: 1000 }] as any)

    const paginaUno = await getVentasProductoAction({ productoId: 'prod-1', page: 1, limit: 1 })
    const paginaDos = await getVentasProductoAction({ productoId: 'prod-1', page: 2, limit: 1 })

    expect(paginaUno.success).toBe(true)
    expect(paginaDos.success).toBe(true)
    if (paginaUno.success && paginaDos.success) {
      expect(paginaUno.data.items[0].costoReal).toBe(100)
      expect(paginaDos.data.items[0].costoReal).toBe(900)
      expect(paginaUno.data.resumen.costoTotal).toBe(1000)
      expect(paginaDos.data.resumen).toEqual(paginaUno.data.resumen)
      expect(paginaUno.data.resumen.margenPromedio).toBe(50)
    }
  })

  it('conserva el costo global cuando la página solicitada está vacía', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 50,
    } as any)
    vi.mocked(prisma.ventaItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.ventaItem.count).mockResolvedValue(2)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({
      _sum: { cantidad: 20, total: 2000 },
    } as any)
    vi.mocked(prisma.purchaseAllocation.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ costoTotal: 1000 }] as any)

    const result = await getVentasProductoAction({ productoId: 'prod-1', page: 3, limit: 1 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toEqual([])
      expect(result.data.resumen.costoTotal).toBe(1000)
      expect(result.data.resumen.margenPromedio).toBe(50)
    }
  })
})
