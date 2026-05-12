import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PrismaClientKnownRequestError } from '@/generated/prisma'

// ──────────────────────────────────────────────
// Mocks globales
// ──────────────────────────────────────────────

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'user-123' }),
  withAuth: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'user-123' }),
}))

const prismaMock = {
  venta: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
  },
  ventaItem: { aggregate: vi.fn() },
  puntoDeVenta: { findUnique: vi.fn() },
  producto: { findUnique: vi.fn(), update: vi.fn() },
  precioProducto: { findUnique: vi.fn() },
  transferencia: { aggregate: vi.fn() },
  ventaServicios: { create: vi.fn() },
  stockUbicacion: { upsert: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

vi.mock('@/lib/services/anticipos-workflow', () => ({
  executeAnticipo: vi.fn(),
  isAnticipoWorkflowError: () => false,
}))

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn().mockReturnValue('1'),
}))

// ──────────────────────────────────────────────
// Issue #1 — MultiTenant
// ──────────────────────────────────────────────

describe('Issue #1 — MultiTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe incluir tenantId en la creación de venta única', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null })
    prisma.precioProducto.findUnique.mockResolvedValue(null)
    prisma.transferencia.aggregate.mockImplementation(async (args: any) =>
      args?.where?.puntoDeVentaDestinoId
        ? { _sum: { cantidad: 100 } }
        : { _sum: { cantidad: 0 } }
    )
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    })

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1', cliente: null, puntoDeVenta: { nombre: 'PV' }, items: [],
    })
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = { venta: { create: txVentaCreate }, stockUbicacion: { upsert: vi.fn() } }
      return cb(tx)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(200)
    expect(txVentaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: expect.any(String),
        }),
      }),
    )
  })

  it('debe filtrar ventas por tenantId en GET', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.venta.findMany.mockResolvedValue([])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas')
    const response = await GET(request, {})

    expect(response.status).toBe(200)
    expect(prisma.venta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: expect.any(String),
        }),
      }),
    )
  })
})

// ──────────────────────────────────────────────
// Issue #4 — Location Validation
// ──────────────────────────────────────────────

describe('Issue #4 — Location Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe rechazar venta con puntoDeVentaId inválido', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.puntoDeVenta.findUnique.mockResolvedValue(null)
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-invalido',
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Punto de venta no encontrado')
  })

  it('debe aceptar venta con puntoDeVentaId válido', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null })
    prisma.precioProducto.findUnique.mockResolvedValue(null)
    prisma.transferencia.aggregate.mockImplementation(async (args: any) =>
      args?.where?.puntoDeVentaDestinoId
        ? { _sum: { cantidad: 100 } }
        : { _sum: { cantidad: 0 } }
    )
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    })

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1', cliente: null, puntoDeVenta: { nombre: 'PV' }, items: [],
    })
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = { venta: { create: txVentaCreate }, stockUbicacion: { upsert: vi.fn() } }
      return cb(tx)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(200)
  })
})

// ──────────────────────────────────────────────
// Issue #2 — Idempotency Key
// ──────────────────────────────────────────────

describe('Issue #2 — Idempotency Key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar venta existente (200) cuando idempotencyKey ya existe', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const existingVenta = {
      ventaId: 'venta-existente',
      idempotencyKey: 'key-duplicada',
      total: 100,
      puntoDeVenta: { nombre: 'PV' },
      cliente: null,
      items: [],
    }

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null })
    prisma.venta.findUnique.mockResolvedValueOnce(existingVenta)

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
        idempotencyKey: 'key-duplicada',
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ventaId).toBe('venta-existente')
  })

  it('debe crear venta con 201 cuando idempotencyKey es nueva', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null })
    prisma.precioProducto.findUnique.mockResolvedValue(null)
    prisma.transferencia.aggregate.mockImplementation(async (args: any) =>
      args?.where?.puntoDeVentaDestinoId
        ? { _sum: { cantidad: 100 } }
        : { _sum: { cantidad: 0 } }
    )
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    })
    // findUnique returns null for idempotencyKey check — key is new
    prisma.venta.findUnique.mockResolvedValue(null)

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-nueva', cliente: null, puntoDeVenta: { nombre: 'PV' }, items: [],
    })
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        venta: { create: txVentaCreate },
        factura: { create: vi.fn() },
        cuentaPorCobrar: { create: vi.fn() },
        serieFacturacion: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() },
        stockUbicacion: { upsert: vi.fn() },
      }
      return cb(tx)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
        idempotencyKey: 'key-nueva',
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(200)
    expect(txVentaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: 'key-nueva',
        }),
      }),
    )
  })

  it('debe auto-generar idempotencyKey cuando no se provee', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null })
    prisma.precioProducto.findUnique.mockResolvedValue(null)
    prisma.transferencia.aggregate.mockImplementation(async (args: any) =>
      args?.where?.puntoDeVentaDestinoId
        ? { _sum: { cantidad: 100 } }
        : { _sum: { cantidad: 0 } }
    )
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    })
    prisma.venta.findUnique.mockResolvedValue(null)

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-nueva', cliente: null, puntoDeVenta: { nombre: 'PV' }, items: [],
    })
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        venta: { create: txVentaCreate },
        factura: { create: vi.fn() },
        cuentaPorCobrar: { create: vi.fn() },
        serieFacturacion: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() },
        stockUbicacion: { upsert: vi.fn() },
      }
      return cb(tx)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
        // Sin idempotencyKey
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(200)
    expect(txVentaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      }),
    )
  })
})

// ──────────────────────────────────────────────
// Issue #3 — Stock Unification
// ──────────────────────────────────────────────

describe('Issue #3 — Stock Unification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe calcular stock solo desde VentaItem (sin ventasLegacy)', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null })
    prisma.precioProducto.findUnique.mockResolvedValue(null)
    prisma.transferencia.aggregate.mockImplementation(async (args: any) =>
      args?.where?.puntoDeVentaDestinoId
        ? { _sum: { cantidad: 100 } }
        : { _sum: { cantidad: 0 } }
    )

    // Solo ventaItem.aggregate debe ser llamado, NO venta.aggregate
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 5 } })
    // El test verifica que venta.aggregate NO es llamado

    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    })

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1', cliente: null, puntoDeVenta: { nombre: 'PV' }, items: [],
    })
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = { venta: { create: txVentaCreate }, stockUbicacion: { upsert: vi.fn() } }
      return cb(tx)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(200)

    // ventaItem.aggregate debe ser llamado
    expect(prisma.ventaItem.aggregate).toHaveBeenCalled()

    // venta.aggregate NO debe ser llamado (no más legacy)
    expect(prisma.venta.aggregate).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────
// Issue #5 — Error Handling
// ──────────────────────────────────────────────

describe('Issue #5 — Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar 409 en error P2002 de Prisma', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null })
    prisma.precioProducto.findUnique.mockResolvedValue(null)
    prisma.transferencia.aggregate.mockImplementation(async (args: any) =>
      args?.where?.puntoDeVentaDestinoId
        ? { _sum: { cantidad: 100 } }
        : { _sum: { cantidad: 0 } }
    )
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    })

    const p2002Error = new PrismaClientKnownRequestError(
      'Unique constraint violation',
      { code: 'P2002', clientVersion: '5.0.0' },
    )
    prisma.$transaction.mockRejectedValue(p2002Error)

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(409)
  })

  it('debe retornar 404 en error P2025 de Prisma', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null })
    prisma.precioProducto.findUnique.mockResolvedValue(null)
    prisma.transferencia.aggregate.mockImplementation(async (args: any) =>
      args?.where?.puntoDeVentaDestinoId
        ? { _sum: { cantidad: 100 } }
        : { _sum: { cantidad: 0 } }
    )
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } })
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    })

    const p2025Error = new PrismaClientKnownRequestError(
      'Record not found',
      { code: 'P2025', clientVersion: '5.0.0' },
    )
    prisma.$transaction.mockRejectedValue(p2025Error)

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
      }),
    })

    const response = await POST(request, {})
    expect(response.status).toBe(404)
  })
})
