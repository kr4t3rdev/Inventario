import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const txMock = vi.hoisted(() => ({
  producto: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  stockUbicacion: {
    upsert: vi.fn(),
  },
  gastoCompra: {
    create: vi.fn(),
  },
  cuentaPorPagar: {
    create: vi.fn(),
  },
  compraProducto: {
    create: vi.fn(),
  },
}))

const prismaMock = vi.hoisted(() => ({
  configuracionSistema: {
    findFirst: vi.fn(),
  },
  contrato: {
    findFirst: vi.fn(),
  },
  compraProducto: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}))

const executeAnticipoMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

vi.mock('@/lib/services/anticipos-workflow', () => ({
  executeAnticipo: executeAnticipoMock,
  isAnticipoWorkflowError: () => false
}))

vi.mock('@/lib/services/pago-gastos-workflow', () => ({
  applyPagoGastoWorkflow: vi.fn()
}))

function buildPayload(overrides: Record<string, unknown> = {}) {
  return {
    productoId: 'prod-1',
    precioCosto: 120,
    cantidad: 3,
    vendorId: 'vendor-1',
    numeroFactura: 'FAC-100',
    facturaUrl: '',
    formaPago: 'PAGO_COMPLETO',
    estado: 'PAGADA',
    descripcionCompra: 'Compra de prueba',
    ...overrides,
  }
}

describe('API /compras-productos - nuevo contrato con producto existente', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.configuracionSistema.findFirst.mockResolvedValue({ diasAvisoVencimientoContrato: 30 })
    prismaMock.contrato.findFirst.mockResolvedValue({
      contratoId: 'ctr-1',
      vendorId: 'vendor-1',
      estado: 'ACTIVO',
      fechaFin: new Date('2099-12-31'),
    })
    prismaMock.compraProducto.findFirst.mockResolvedValue(null)

    txMock.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      nombre: 'Producto Existente',
      stock: 10,
      precioCosto: 100,
      vendorId: 'vendor-1',
      almacenId: 'alm-1',
      vendor: null,
    })
    txMock.producto.update.mockResolvedValue({
      id: 'prod-1',
      stock: 13,
      precioCosto: 104.61538461538461,
    })
    txMock.stockUbicacion.upsert.mockResolvedValue({
      stockId: 'su-1',
    })

    txMock.gastoCompra.create.mockResolvedValue({
      gastoCompraId: 'gc-1',
      vendor: { nombre: 'Proveedor Test' },
    })

    txMock.cuentaPorPagar.create.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1',
    })

    txMock.compraProducto.create.mockResolvedValue({
      compraProductoId: 'cp-1',
    })

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock))
  })

  it('crea compra con producto existente y NO crea producto nuevo', async () => {
    const { POST } = await import('../route')

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.stockAntes).toBe(10)
    expect(data.stockDespues).toBe(13)
    expect(data.precioCostoAntes).toBe(100)
    expect(data.precioCostoDespues).toBeCloseTo(104.61538461538461)
    expect(data.metodoCosto).toBe('PONDERADO')
    expect(txMock.producto.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1' },
      }),
    )
    expect(txMock.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1' },
        data: expect.objectContaining({
          precioCosto: 104.61538461538461,
        }),
      }),
    )
    expect(txMock.stockUbicacion.upsert).toHaveBeenCalled()
    expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: 'prod-1',
            tipoUbicacion: 'almacen',
            ubicacionId: 'alm-1',
          },
        },
      }),
    )
    expect(txMock.compraProducto.create).toHaveBeenCalled()
    expect(executeAnticipoMock).not.toHaveBeenCalled()
  })

  it('retorna 404 si productoId no existe', async () => {
    const { POST } = await import('../route')
    txMock.producto.findUnique.mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('no existe')
  })

  it('retorna 409 si factura está duplicada para el proveedor', async () => {
    const { POST } = await import('../route')
    prismaMock.compraProducto.findFirst.mockResolvedValueOnce({ compraProductoId: 'cp-existente' })

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload({ numeroFactura: 'FAC-DUP' })),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('Ya existe una compra con este número de factura')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('retorna 422 si vendorId no coincide con el proveedor del producto', async () => {
    const { POST } = await import('../route')
    txMock.producto.findUnique.mockResolvedValueOnce({
      id: 'prod-1',
      nombre: 'Producto Existente',
      stock: 10,
      precioCosto: 100,
      vendorId: 'vendor-catalogo',
      almacenId: 'alm-1',
      vendor: null,
    })

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload({ vendorId: 'vendor-distinto' })),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(422)
    expect(data.code).toBe('PRODUCT_VENDOR_MISMATCH')
    expect(data.error).toContain('no coincide')
  })

  it('retorna 400 con details cuando el payload es inválido', async () => {
    const { POST } = await import('../route')

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload({ cantidad: 0, precioCosto: 0 })),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(data.details).toBeDefined()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('permite compra de producto sin taxonomía/código de negocio', async () => {
    const { POST } = await import('../route')
    txMock.producto.findUnique.mockResolvedValueOnce({
      id: 'prod-2',
      nombre: 'Producto Legacy',
      stock: 0,
      precioCosto: 0,
      almacenId: 'alm-1',
      codigoNegocio: null,
      proveedorCodigo: null,
      idSeccionCodigo: null,
      especificoCodigo: null,
      surtidoCodigo: null,
      dcCodigo: null,
      vendor: null,
    })

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload({ productoId: 'prod-2' })),
    })

    const response = await POST(request, {}, { userId: 'user-1' })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.precioCostoAntes).toBe(0)
    expect(data.precioCostoDespues).toBe(120)
    expect(data.metodoCosto).toBe('PRIMERA_COMPRA')
    expect(txMock.compraProducto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productoId: 'prod-2',
        }),
      }),
    )
  })

  it('hace rollback lógico si falla luego del incremento de stock', async () => {
    const { POST } = await import('../route')
    txMock.gastoCompra.create.mockRejectedValueOnce(new Error('DB_FAIL'))

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('Error al crear compra de producto')
    expect(txMock.producto.update).toHaveBeenCalled()
    expect(txMock.compraProducto.create).not.toHaveBeenCalled()
  })

  it('no sincroniza stock derivado de hijo aunque el payload legacy incluya campos compuestos', async () => {
    const { POST } = await import('../route')

    txMock.producto.findUnique.mockResolvedValueOnce({
      id: 'prod-1',
      nombre: 'Pack x20',
      stock: 10,
      precioCosto: 100,
      almacenId: 'alm-1',
      vendor: null,
      cantidadEnPack: 20,
      productosHijos: [{ id: 'hijo-1' }],
    })

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload({ cantidad: 3 })),
    })

    const response = await POST(request, {}, { userId: 'user-1' })

    expect(response.status).toBe(201)
    // Solo update de stock del producto comprado
    expect(txMock.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prod-1' } }),
    )
    expect(txMock.producto.update).toHaveBeenCalledTimes(1)
  })

  it('mantiene una sola actualización de producto cuando no hay metadatos compuestos', async () => {
    const { POST } = await import('../route')

    txMock.producto.findUnique.mockResolvedValueOnce({
      id: 'prod-1',
      nombre: 'Producto Simple',
      stock: 10,
      precioCosto: 100,
      almacenId: 'alm-1',
      vendor: null,
      cantidadEnPack: null,
      productosHijos: [],
    })

    const request = new NextRequest('http://localhost/api/compras-productos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload({ cantidad: 5 })),
    })

    const response = await POST(request, {}, { userId: 'user-1' })

    expect(response.status).toBe(201)
    // Only 1 update call (parent stock), no child sync
    expect(txMock.producto.update).toHaveBeenCalledTimes(1)
    expect(txMock.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prod-1' } }),
    )
  })
})
