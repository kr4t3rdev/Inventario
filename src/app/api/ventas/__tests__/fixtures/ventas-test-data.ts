import { vi } from 'vitest'
import { NextRequest } from 'next/server'

// ──────────────────────────────────────────────
// Constantes compartidas
// ──────────────────────────────────────────────

export const MOCK_USER = {
  userId: 'user-123',
  email: 'test@example.com',
  empresaId: 'emp-001',
  rol: 'admin',
}

export const MOCK_TENANT_ID = 'emp-001'

export const MOCK_VENTA_ID = 'venta-001'
export const MOCK_PRODUCTO_ID = 'prod-001'
export const MOCK_PUNTO_VENTA_ID = 'pv-001'
export const MOCK_ALMACEN_ID = 'alm-001'
export const MOCK_CLIENTE_ID = 'cli-001'
export const MOCK_IDEMPOTENCY_KEY = '550e8400-e29b-41d4-a716-446655440000'

// ──────────────────────────────────────────────
// Mock data builders
// ──────────────────────────────────────────────

export function buildMockVenta(overrides: Record<string, any> = {}) {
  return {
    ventaId: MOCK_VENTA_ID,
    productoId: null,
    cantidad: 0,
    puntoDeVentaId: MOCK_PUNTO_VENTA_ID,
    tenantId: MOCK_TENANT_ID,
    idempotencyKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    total: 100,
    clienteId: null,
    descuento: 0,
    observaciones: null,
    esVentaUnica: true,
    ofertaId: null,
    ventaPadreId: null,
    empleadoId: null,
    ordenId: null,
    items: [],
    factura: null,
    ...overrides,
  }
}

export function buildMockVentaItem(overrides: Record<string, any> = {}) {
  return {
    id: 'vitem-001',
    ventaId: MOCK_VENTA_ID,
    productoId: MOCK_PRODUCTO_ID,
    cantidad: 2,
    precioUnitario: 50,
    total: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function buildMockPuntoDeVenta(overrides: Record<string, any> = {}) {
  return {
    pvId: MOCK_PUNTO_VENTA_ID,
    nombre: 'Punto de Venta Test',
    listaPrecioId: null,
    ...overrides,
  }
}

export function buildMockUser(overrides: Record<string, any> = {}) {
  return {
    ...MOCK_USER,
    ...overrides,
  }
}

export function buildMockAlmacen(overrides: Record<string, any> = {}) {
  return {
    almacenId: MOCK_ALMACEN_ID,
    nombre: 'Almacén Test',
    ...overrides,
  }
}

export function buildMockRequest(
  body: Record<string, any>,
  overrides: Partial<{ method: string; url: string }> = {}
): NextRequest {
  return new NextRequest(overrides.url || 'http://localhost/api/ventas', {
    method: overrides.method || 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ──────────────────────────────────────────────
// Mock Prisma client factory
// ──────────────────────────────────────────────

type MockFn = ReturnType<typeof vi.fn>

interface MockPrismaClient {
  venta: {
    findUnique: MockFn
    findMany: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
    aggregate: MockFn
    count: MockFn
  }
  ventaItem: {
    aggregate: MockFn
  }
  puntoDeVenta: {
    findUnique: MockFn
  }
  producto: {
    findUnique: MockFn
    update: MockFn
  }
  precioProducto: {
    findUnique: MockFn
  }
  transferencia: {
    aggregate: MockFn
  }
  ventaServicios: {
    create: MockFn
  }
  $transaction: MockFn
  $queryRaw: MockFn
}

export function createMockPrisma(): MockPrismaClient {
  return {
    venta: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    ventaItem: {
      aggregate: vi.fn(),
    },
    puntoDeVenta: {
      findUnique: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    precioProducto: {
      findUnique: vi.fn(),
    },
    transferencia: {
      aggregate: vi.fn(),
    },
    ventaServicios: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  }
}

// ──────────────────────────────────────────────
// Common mock setups
// ──────────────────────────────────────────────

/**
 * Configura mocks para un escenario de stock suficiente (sin legacy)
 * donde puntoDeVenta existe y no hay ventas previas que afecten stock.
 */
export function mockStockScenario(prisma: any, overrides: Record<string, any> = {}) {
  prisma.puntoDeVenta.findUnique.mockResolvedValue(buildMockPuntoDeVenta(overrides.puntoDeVenta))
  prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
    if (args?.where?.puntoDeVentaDestinoId) {
      return { _sum: { cantidad: 100 } }
    }
    return { _sum: { cantidad: 0 } }
  })
  prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })
  // Legacy aggregate — will be removed in Issue #3
  prisma.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })
  prisma.precioProducto.findUnique.mockResolvedValue(null)
  prisma.producto.findUnique.mockResolvedValue({
    id: MOCK_PRODUCTO_ID,
    precioVenta: 100,
    nombre: 'Producto Test',
    productoPadreId: null,
    cantidadEnPack: null,
    ...overrides.producto,
  })
}

/**
 * Configura el mock $transaction para escenarios de POST.
 * Retorna las funciones tx para assertions posteriores.
 */
export function mockTransaction(prisma: any, txOverrides: Record<string, any> = {}) {
  const txVentaCreate = vi.fn().mockResolvedValue({
    ventaId: MOCK_VENTA_ID,
    cliente: null,
    puntoDeVenta: { nombre: 'PV Test' },
    items: [],
    ...txOverrides.ventaCreada,
  })

  const txSerieFindFirst = vi.fn().mockResolvedValue({
    serieId: 'serie-1',
    prefijo: 'SD',
    consecutivo: 1,
    activa: true,
  })

  const txSerieUpdate = vi.fn().mockResolvedValue({
    serieId: 'serie-1',
    consecutivo: 2,
  })

  const txFacturaCreate = vi.fn(txOverrides.facturaCreate || (() => ({
    idFactura: 'fac-001',
    estado: 'PENDIENTE',
  })))

  const txCuentaPorCobrarCreate = vi.fn()

  prisma.$transaction.mockImplementation(async (callback: any) => {
    const tx = {
      venta: { create: txVentaCreate },
      serieFacturacion: {
        findFirst: txSerieFindFirst,
        create: vi.fn(),
        update: txSerieUpdate,
      },
      factura: { create: txFacturaCreate },
      cuentaPorCobrar: { create: txCuentaPorCobrarCreate },
      producto: { update: vi.fn() },
      ...txOverrides.extraTx,
    }
    return callback(tx)
  })

  return { txVentaCreate, txSerieFindFirst, txFacturaCreate, txCuentaPorCobrarCreate }
}
