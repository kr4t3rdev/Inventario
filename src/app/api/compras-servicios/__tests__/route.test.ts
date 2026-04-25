import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  compraServicio: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  servicios: {
    findUnique: vi.fn(),
  },
  vendor: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/services/anticipos-workflow', () => ({
  applyAnticipoAllocations: vi.fn(async () => []),
  isAnticipoWorkflowError: vi.fn(() => false),
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('API /compras-servicios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock))
  })

  it('crea un servicio recibido con total calculado', async () => {
    const { POST } = await import('../route')

    prismaMock.servicios.findUnique.mockResolvedValueOnce({
      servicioId: 'serv-1',
      nombre: 'Servicio 1',
    })
    prismaMock.vendor.findUnique.mockResolvedValueOnce({
      vendorId: 'prov-1',
      nombre: 'Proveedor 1',
    })
    prismaMock.compraServicio.create.mockResolvedValueOnce({
      compraServicioId: 'cs-1',
      servicioId: 'serv-1',
      proveedorId: 'prov-1',
      numeroFactura: 'F-001',
      costoUnitario: 100,
      cantidad: 2,
      total: 200,
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      descripcion: 'Prueba',
      fechaServicio: new Date('2026-04-20T00:00:00.000Z'),
      fechaVencimiento: null,
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      updatedAt: new Date('2026-04-20T00:00:00.000Z'),
    })

    const request = new NextRequest('http://localhost/api/compras-servicios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        servicioId: 'serv-1',
        proveedorId: 'prov-1',
        numeroFactura: 'F-001',
        costoUnitario: 100,
        cantidad: 2,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
        descripcion: 'Prueba',
      }),
    })

    const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.compraServicio.compraServicioId).toBe('cs-1')
    expect(data.compraServicio.total).toBe(200)
    expect(data.allocationsResult).toEqual([])
    expect(prismaMock.compraServicio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          servicioId: 'serv-1',
          proveedorId: 'prov-1',
          total: 200,
        }),
      })
    )
  })

  it('acepta costo unitario decimal', async () => {
    const { POST } = await import('../route')

    prismaMock.servicios.findUnique.mockResolvedValueOnce({
      servicioId: 'serv-1',
      nombre: 'Servicio 1',
    })
    prismaMock.compraServicio.create.mockResolvedValueOnce({
      compraServicioId: 'cs-2',
      servicioId: 'serv-1',
      proveedorId: null,
      numeroFactura: null,
      costoUnitario: 100.5,
      cantidad: 2,
      total: 201,
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      descripcion: null,
      fechaServicio: new Date('2026-04-20T00:00:00.000Z'),
      fechaVencimiento: null,
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      updatedAt: new Date('2026-04-20T00:00:00.000Z'),
    })

    const request = new NextRequest('http://localhost/api/compras-servicios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        servicioId: 'serv-1',
        costoUnitario: 100.5,
        cantidad: 2,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
      }),
    })

    const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.compraServicio.total).toBe(201)
    expect(prismaMock.compraServicio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          costoUnitario: 100.5,
          total: 201,
        }),
      })
    )
  })

  it('lista los servicios recibidos', async () => {
    const { GET } = await import('../route')

    prismaMock.compraServicio.findMany.mockResolvedValueOnce([
      {
        compraServicioId: 'cs-1',
        servicioId: 'serv-1',
        proveedorId: 'prov-1',
        numeroFactura: 'F-001',
        costoUnitario: 100,
        cantidad: 2,
        total: 200,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
        descripcion: 'Prueba',
        fechaServicio: new Date('2026-04-20T00:00:00.000Z'),
        fechaVencimiento: null,
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
      },
    ])

    const request = new NextRequest('http://localhost/api/compras-servicios')
    const response = await GET(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
  })
})
