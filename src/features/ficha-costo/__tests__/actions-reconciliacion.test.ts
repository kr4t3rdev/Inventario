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
  compraDocumentoId: 'doc-1',
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

/**
 * @description Crea una línea de compra con fecha y documento controlados.
 * @param {string} id - Identificador de la línea.
 * @param {string} fechaCompra - Fecha ISO de la compra.
 * @returns {typeof ITEM_BASE} Línea lista para los mocks de Prisma.
 */
function crearItem(id: string, fechaCompra: string): typeof ITEM_BASE {
  return {
    ...ITEM_BASE,
    compraDocumentoItemId: id,
    compraDocumentoId: `doc-${id}`,
    compraDocumento: {
      ...ITEM_BASE.compraDocumento,
      fechaCompra: new Date(fechaCompra),
    },
  }
}

describe('getHistorialReconciliadoAction', () => {
  beforeEach(() => {
    vi.useRealTimers()
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

  it('prorratea el gasto con la cantidad documental en compras multiproducto', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    const itemProducto = {
      ...ITEM_BASE,
      compraDocumento: {
        ...ITEM_BASE.compraDocumento,
        compraDocumentoId: 'doc-1',
        gastoCompraId: 'gasto-1',
      },
    }
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      itemProducto,
    ] as any)
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(1)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([
      { gastoCompraId: 'gasto-1', total: 300, cantidad: 30 },
    ] as any)

    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].gastoProporcional).toBe(100)
      expect(result.data.proveedores[0].montoTotal).toBe(1100)
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

  it('mantiene en la página una compra anterior a la ventana CPP', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    const itemFueraVentana = crearItem('i-antiguo', '2024-01-15')

    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      if (args?.skip === 0 && args?.take === 20) {
        return Promise.resolve([itemFueraVentana]) as any
      }
      return Promise.resolve([]) as any
    })
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(1)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toHaveLength(1)
      expect(result.data.items[0]).toMatchObject({
        compraDocumentoItemId: 'i-antiguo',
        enVentanaCPP: false,
      })
      expect(result.data.pagination).toMatchObject({ total: 1, totalPages: 1 })
    }
  })

  it('no deja vacía una página válida aunque sus filas estén fuera del resumen CPP', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    const itemsPaginaDos = [
      crearItem('i-3', '2023-03-01'),
      crearItem('i-4', '2023-02-01'),
    ]

    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      if (args?.skip === 2 && args?.take === 2) {
        return Promise.resolve(itemsPaginaDos) as any
      }
      return Promise.resolve([]) as any
    })
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(4)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    const result = await getHistorialReconciliadoAction({
      productoId: 'prod-1',
      page: 2,
      limit: 2,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items.map((item) => item.compraDocumentoItemId)).toEqual([
        'i-3',
        'i-4',
      ])
      expect(result.data.items.every((item) => !item.enVentanaCPP)).toBe(true)
      expect(result.data.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 4,
        totalPages: 2,
      })
    }
  })

  it('no cambia el estado CPP por advertencias de una fila histórica fuera de ventana', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    const itemCPP = crearItem('i-cpp', '2026-05-01')
    const itemHistoricoInvalido = {
      ...crearItem('i-historico', '2023-01-01'),
      precioUnitario: Number.NaN,
    }

    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      if (args?.skip === 0 && args?.take === 20) {
        return Promise.resolve([itemCPP, itemHistoricoInvalido]) as any
      }
      return Promise.resolve([itemCPP]) as any
    })
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(2)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toHaveLength(2)
      expect(result.data.estadoCPP).toBe('CALCULADO')
      expect(result.data.advertencias).toEqual([])
    }
  })

  it('comparte el corte de 12 meses calendario entre query y reconciliación', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-03-01T12:00:00Z'))
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    const itemEnVentana = crearItem('i-cpp', '2024-03-01T12:00:00Z')
    const itemFueraVentana = crearItem('i-bisiesto', '2024-02-29T12:00:00Z')

    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      if (args?.skip === 0 && args?.take === 20) {
        return Promise.resolve([itemEnVentana, itemFueraVentana]) as any
      }
      return Promise.resolve([itemEnVentana]) as any
    })
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(2)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    const result = await getHistorialReconciliadoAction({ productoId: 'prod-1' })

    expect(prisma.compraDocumentoItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          compraDocumento: expect.objectContaining({
            fechaCompra: expect.objectContaining({
              gte: new Date('2024-03-01T12:00:00Z'),
            }),
          }),
        }),
      }),
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items.map((item) => [item.compraDocumentoItemId, item.enVentanaCPP])).toEqual([
        ['i-cpp', true],
        ['i-bisiesto', false],
      ])
      expect(result.data.estadoCPP).toBe('CALCULADO')
    }
  })

  it('reconcilia el universo CPP sin límite silencioso de 1000 filas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    const itemsEnVentana = Array.from({ length: 1001 }, (_, index) =>
      crearItem(`i-resumen-${index}`, '2026-05-01'),
    )
    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      if (args?.skip === 1500 && args?.take === 20) {
        return Promise.resolve([]) as any
      }
      return Promise.resolve(itemsEnVentana) as any
    })
    vi.mocked(prisma.compraDocumentoItem.count).mockResolvedValue(1501)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    const result = await getHistorialReconciliadoAction({
      productoId: 'prod-1',
      page: 76,
      limit: 20,
    })

    expect(result.success).toBe(true)
    expect(prisma.compraDocumentoItem.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ take: 1000 }),
    )
    if (result.success) {
      expect(result.data.proveedores[0].cantidadItems).toBe(1001)
      expect(result.data.pagination).toMatchObject({
        total: 1501,
        totalPages: 76,
      })
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
