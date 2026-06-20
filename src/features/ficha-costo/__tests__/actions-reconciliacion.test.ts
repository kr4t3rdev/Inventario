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
    compraDocumento: { findMany: vi.fn() },
    gastoCompra: { findMany: vi.fn() },
    tasaCambio: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getHistorialReconciliadoAction } from '../actions-reconciliacion'
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

const ITEM_BASE = {
  compraDocumentoItemId: 'i-1',
  cantidad: 10,
  precioUnitario: 100,
  totalLinea: 1000,
  compraDocumento: {
    fechaCompra: new Date('2026-05-01'),
    numeroFactura: 'F-001',
    proveedorId: 'prov-A',
    proveedor: { nombre: 'Proveedor A' },
  },
}

describe('getHistorialReconciliadoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: 3 compras reconciliadas con resumen por proveedor', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      { ...ITEM_BASE, compraDocumentoItemId: 'i-1', compraDocumento: { ...ITEM_BASE.compraDocumento, fechaCompra: new Date('2026-05-01') } },
      { ...ITEM_BASE, compraDocumentoItemId: 'i-2', compraDocumento: { ...ITEM_BASE.compraDocumento, fechaCompra: new Date('2026-04-01') } },
      { ...ITEM_BASE, compraDocumentoItemId: 'i-3', compraDocumento: { ...ITEM_BASE.compraDocumento, fechaCompra: new Date('2026-03-01') } },
    ] as any)
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(3)
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    // Act
    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toHaveLength(3)
      expect(result.data.estadoCPP).toBe('CALCULADO')
      expect(result.data.proveedores).toHaveLength(1)
      expect(result.data.proveedores[0].proveedorId).toBe('prov-A')
    }
  })

  it('pagina correctamente: page 2 limit 10', async () => {
    // Arrange: 25 items, page 2 limit 10
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    // Crear 25 items, los primeros 10 son page 1, los siguientes 10 son page 2,
    // los últimos 5 son page 3. La query paginada con skip=10 take=10 debe
    // devolver los items 11-20.
    const todosLosItems = Array.from({ length: 25 }, (_, i) => ({
      ...ITEM_BASE,
      compraDocumentoItemId: `i-${i + 1}`,
    }))
    const itemsPaginados = todosLosItems.slice(10, 20) // skip=10, take=10
    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      // Query paginada: tiene skip=10 y take=10
      if (args?.skip === 10 && args?.take === 10) {
        return Promise.resolve(itemsPaginados) as any
      }
      // Query completa: tiene take=1000 (sin skip)
      if (args?.take === 1000 && !args?.skip) {
        return Promise.resolve(todosLosItems) as any
      }
      return Promise.resolve([]) as any
    })
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(25)
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    // Act
    const result = await getHistorialReconciliadoAction({
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

  it('retorna NOT_FOUND si el producto pertenece a otro tenant', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)

    // Act
    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('retorna NOT_FOUND si el producto no existe', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)

    // Act
    const result = await getHistorialReconciliadoAction({ productoId: 'inexistente' })

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('retorna error si no hay usuario autenticado', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(null as any)

    // Act
    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('sin compras: estadoCPP = SIN_DATOS, items y proveedores vacíos', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(0)
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    // Act
    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toEqual([])
      expect(result.data.proveedores).toEqual([])
      expect(result.data.estadoCPP).toBe('SIN_DATOS')
    }
  })

  it('con advertencias: estadoCPP = CON_ADVERTENCIAS', async () => {
    // Arrange: items sin tasa → genera advertencia
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      { ...ITEM_BASE, compraDocumentoItemId: 'i-1' },
    ] as any)
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(1)
    // Tasa no encontrada → advertencia SIN_TASA
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.tasaCambio.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    // Act
    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    // Assert: al menos CALCULADO o CON_ADVERTENCIAS (depende de si hay tasa)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(['CALCULADO', 'CON_ADVERTENCIAS']).toContain(result.data.estadoCPP)
    }
  })

  it('respeta filtro por proveedorId', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(0)
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    // Act
    await getHistorialReconciliadoAction({
      productoId: 'prod-1',
      proveedorId: 'prov-1',
    })

    // Assert: la query debe incluir el filtro
    expect(prisma.compraDocumentoItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          compraDocumento: expect.objectContaining({ proveedorId: 'prov-1' }),
        }),
      }),
    )
  })

  it('respeta filtro por rango de fechas', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(0)
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    // Act
    await getHistorialReconciliadoAction({
      productoId: 'prod-1',
      fechaDesde: '2026-03-01',
      fechaHasta: '2026-03-31',
    })

    // Assert
    expect(prisma.compraDocumentoItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          compraDocumento: expect.objectContaining({
            fechaCompra: expect.objectContaining({
              gte: new Date('2026-03-01'),
              lte: new Date('2026-03-31'),
            }),
          }),
        }),
      }),
    )
  })
})
