import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (vi.hoisted se ejecuta antes que vi.mock) ─────────────────────────

const prismaMock = vi.hoisted(() => ({
  compraDocumento: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  compraDocumentoItem: {
    create: vi.fn(),
  },
  producto: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  gastoCompra: {
    create: vi.fn(),
    update: vi.fn(),
  },
  cuentaPorPagar: {
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  compraProducto: {
    findFirst: vi.fn(),
  },
  productoCostHistory: {
    create: vi.fn(),
  },
  ventaItem: {
    count: vi.fn(),
  },
  pagoCuentaPorPagar: {
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}))

const upsertStockUbicacionMock = vi.hoisted(() => vi.fn())
const calcularPrecioCostoCompraMock = vi.hoisted(() => vi.fn())
const applyPagoGastoWorkflowMock = vi.hoisted(() => vi.fn())
const applyAnticipoAllocationsMock = vi.hoisted(() => vi.fn())
const isAnticipoWorkflowErrorMock = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
  withAuth: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: upsertStockUbicacionMock,
}))

vi.mock('@/lib/inventory-cost-utils', () => ({
  calcularPrecioCostoCompra: calcularPrecioCostoCompraMock,
}))

vi.mock('@/lib/services/pago-gastos-workflow', () => ({
  applyPagoGastoWorkflow: applyPagoGastoWorkflowMock,
}))

vi.mock('@/lib/services/anticipos-workflow', () => ({
  applyAnticipoAllocations: applyAnticipoAllocationsMock,
  isAnticipoWorkflowError: isAnticipoWorkflowErrorMock,
}))

vi.mock('@/lib/constants/anticipos', () => ({
  FORMA_PAGO_ANTICIPO_PAGO: 'ANTICIPO_PAGO',
}))

vi.mock('@/lib/services/anticipos-guards', () => ({
  hasUnrevertedAnticipoExecution: vi.fn().mockResolvedValue(false),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/compras-productos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockTransaction() {
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    const tx = {
      producto: {
        findUnique: prismaMock.producto.findUnique,
        update: prismaMock.producto.update,
      },
      compraDocumento: {
        create: prismaMock.compraDocumento.create,
        findFirst: prismaMock.compraDocumento.findFirst,
        update: prismaMock.compraDocumento.update,
      },
      compraDocumentoItem: {
        create: prismaMock.compraDocumentoItem.create,
      },
      gastoCompra: {
        create: prismaMock.gastoCompra.create,
        update: prismaMock.gastoCompra.update,
      },
      cuentaPorPagar: {
        create: prismaMock.cuentaPorPagar.create,
        update: prismaMock.cuentaPorPagar.update,
      },
      productoCostHistory: {
        create: prismaMock.productoCostHistory.create,
      },
    }
    return callback(tx)
  })
}

const productoA = {
  id: 'prod-a',
  nombre: 'Producto A',
  stock: 10,
  precioCosto: 100,
  precioVenta: 200,
  vendorId: 'vendor-1',
  almacenId: 'alm-1',
  vendor: { vendorId: 'vendor-1', nombre: 'Proveedor 1' },
}

const productoB = {
  id: 'prod-b',
  nombre: 'Producto B',
  stock: 5,
  precioCosto: 50,
  precioVenta: 100,
  vendorId: 'vendor-1',
  almacenId: 'alm-1',
  vendor: { vendorId: 'vendor-1', nombre: 'Proveedor 1' },
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('API /compras-productos POST', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockTransaction()
    isAnticipoWorkflowErrorMock.mockReturnValue(false)
    calcularPrecioCostoCompraMock.mockImplementation(({ stockAntes, precioCostoActual, cantidadCompra, costoUnitario }: any) => {
      if (stockAntes <= 0) return { precioCostoNuevo: costoUnitario, metodoCosto: 'PRIMERA_COMPRA' }
      const valorAnterior = stockAntes * precioCostoActual
      const valorNuevo = cantidadCompra * costoUnitario
      const stockTotal = stockAntes + cantidadCompra
      return { precioCostoNuevo: (valorAnterior + valorNuevo) / stockTotal, metodoCosto: 'PONDERADO' }
    })
  })

  it('crea compra múltiple con 2 productos — una cabecera, 2 items, 1 gasto', async () => {
    const { POST } = await import('../route')

    prismaMock.compraDocumento.findFirst.mockResolvedValueOnce(null)
    prismaMock.producto.findUnique
      .mockResolvedValueOnce(productoA)
      .mockResolvedValueOnce(productoB)
    prismaMock.producto.update.mockResolvedValue({})
    upsertStockUbicacionMock.mockResolvedValue(undefined)
    prismaMock.gastoCompra.create.mockResolvedValueOnce({
      gastoCompraId: 'gc-1',
      productoId: 'prod-a',
      vendorId: 'vendor-1',
      cantidad: 7,
      precioUnitario: 86,
      total: 600,
      vendor: { nombre: 'Proveedor 1' },
    })
    prismaMock.compraDocumento.create.mockResolvedValueOnce({
      compraDocumentoId: 'cd-1',
      proveedorId: 'vendor-1',
      total: 600,
      estado: 'PAGADA',
    })
    prismaMock.compraDocumentoItem.create
      .mockResolvedValueOnce({ compraDocumentoItemId: 'ci-1', compraDocumentoId: 'cd-1', productoId: 'prod-a', cantidad: 4, precioUnitario: 100, totalLinea: 400 })
      .mockResolvedValueOnce({ compraDocumentoItemId: 'ci-2', compraDocumentoId: 'cd-1', productoId: 'prod-b', cantidad: 3, precioUnitario: 50, totalLinea: 150 })
    prismaMock.productoCostHistory.create.mockResolvedValue({})

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      numeroFactura: 'F-001',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      items: [
        { productoId: 'prod-a', precioCosto: 100, cantidad: 4 },
        { productoId: 'prod-b', precioCosto: 50, cantidad: 3 },
      ],
    })

    const response = await POST(request, {}, { userId: 'user-1', id: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.compraDocumento.compraDocumentoId).toBe('cd-1')
    expect(data.items).toHaveLength(2)

    // Verifica que se creó UN solo gasto con el total correcto
    expect(prismaMock.gastoCompra.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.gastoCompra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 550, // 4*100 + 3*50
          vendorId: 'vendor-1',
        }),
      })
    )

    // Verifica que se crearon 2 items
    expect(prismaMock.compraDocumentoItem.create).toHaveBeenCalledTimes(2)

    // Verifica que se actualizó stock 2 veces
    expect(prismaMock.producto.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-a' },
        data: expect.objectContaining({
          stock: { increment: 4 },
        }),
      })
    )

    // Verifica que se actualizó StockUbicacion 2 veces
    expect(upsertStockUbicacionMock).toHaveBeenCalledTimes(2)
  })

  it('acepta precioCosto con coma decimal', async () => {
    const { POST } = await import('../route')

    prismaMock.compraDocumento.findFirst.mockResolvedValueOnce(null)
    prismaMock.producto.findUnique.mockResolvedValueOnce(productoA)
    prismaMock.producto.update.mockResolvedValue({})
    prismaMock.compraDocumento.create.mockResolvedValueOnce({
      compraDocumentoId: 'cd-coma',
      proveedorId: 'vendor-1',
      total: 25,
      estado: 'PAGADA',
    })
    prismaMock.compraDocumentoItem.create.mockResolvedValueOnce({
      compraDocumentoItemId: 'ci-coma',
      compraDocumentoId: 'cd-coma',
      productoId: 'prod-a',
      cantidad: 2,
      precioUnitario: 12.5,
      totalLinea: 25,
    })
    prismaMock.productoCostHistory.create.mockResolvedValue({})
    prismaMock.gastoCompra.create.mockResolvedValueOnce({
      gastoCompraId: 'gc-coma',
      productoId: 'prod-a',
      vendorId: 'vendor-1',
      cantidad: 2,
      precioUnitario: 12.5,
      total: 25,
      vendor: { nombre: 'Proveedor 1' },
    })
    upsertStockUbicacionMock.mockResolvedValue(undefined)

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      numeroFactura: 'F-COMA',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      items: [
        { productoId: 'prod-a', precioCosto: '12,5', cantidad: 2 },
      ],
    })

    const response = await POST(request, {}, { userId: 'user-1', id: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(prismaMock.gastoCompra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 25,
        }),
      })
    )
    expect(prismaMock.compraDocumentoItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          precioUnitario: 12.5,
          totalLinea: 25,
        }),
      })
    )
  })

  it('rechaza si items está vacío', async () => {
    const { POST } = await import('../route')

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      items: [],
    })

    const response = await POST(request, {}, { userId: 'user-1', id: 'user-1' })

    expect(response.status).toBe(400)
  })

  it('rechaza si un producto no existe', async () => {
    const { POST } = await import('../route')

    prismaMock.compraDocumento.findFirst.mockResolvedValueOnce(null)
    prismaMock.producto.findUnique.mockResolvedValueOnce(null)

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      items: [
        { productoId: 'prod-inexistente', precioCosto: 100, cantidad: 1 },
      ],
    })

    const response = await POST(request, {}, { userId: 'user-1', id: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('PRODUCT_NOT_FOUND')
  })

  it('rechaza si el producto no pertenece al proveedor', async () => {
    const { POST } = await import('../route')

    prismaMock.compraDocumento.findFirst.mockResolvedValueOnce(null)
    prismaMock.producto.findUnique.mockResolvedValueOnce({
      ...productoA,
      vendorId: 'otro-vendor',
    })

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      items: [
        { productoId: 'prod-a', precioCosto: 100, cantidad: 1 },
      ],
    })

    const response = await POST(request, {}, { userId: 'user-1', id: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(422)
    expect(data.code).toBe('PRODUCT_VENDOR_MISMATCH')
  })

  it('rechaza factura duplicada para mismo proveedor', async () => {
    const { POST } = await import('../route')

    // El findFirst de duplicados retorna una compra existente
    prismaMock.compraDocumento.findFirst.mockResolvedValueOnce({
      compraDocumentoId: 'cd-existente',
    })

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      numeroFactura: 'F-001',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      items: [
        { productoId: 'prod-a', precioCosto: 100, cantidad: 1 },
      ],
    })

    const response = await POST(request, {}, { userId: 'user-1', id: 'user-1' })

    expect(response.status).toBe(409)
  })

  it('crea cuenta por pagar para PAGO_PARCIAL', async () => {
    const { POST } = await import('../route')

    prismaMock.compraDocumento.findFirst.mockResolvedValueOnce(null)
    prismaMock.producto.findUnique.mockResolvedValueOnce(productoA)
    prismaMock.producto.update.mockResolvedValue({})
    upsertStockUbicacionMock.mockResolvedValue(undefined)
    prismaMock.gastoCompra.create.mockResolvedValueOnce({
      gastoCompraId: 'gc-1',
      vendor: { nombre: 'Proveedor 1' },
    })
    prismaMock.cuentaPorPagar.create.mockResolvedValueOnce({
      cuentaPorPagarId: 'cxp-1',
      montoDeuda: 400,
      saldoPendiente: 400,
    })
    prismaMock.compraDocumento.create.mockResolvedValueOnce({
      compraDocumentoId: 'cd-1',
    })
    prismaMock.compraDocumentoItem.create.mockResolvedValueOnce({
      compraDocumentoItemId: 'ci-1',
    })
    prismaMock.productoCostHistory.create.mockResolvedValue({})

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      numeroFactura: 'F-002',
      formaPago: 'PAGO_PARCIAL',
      estado: 'PENDIENTE',
      items: [
        { productoId: 'prod-a', precioCosto: 100, cantidad: 4 },
      ],
    })

    const response = await POST(request, {}, { userId: 'user-1', id: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.cuentaPorPagar).toBeTruthy()
    expect(prismaMock.cuentaPorPagar.create).toHaveBeenCalledTimes(1)
  })

  it('calcula costo ponderado por cada item independientemente', async () => {
    const { POST } = await import('../route')

    prismaMock.compraDocumento.findFirst.mockResolvedValueOnce(null)
    prismaMock.producto.findUnique
      .mockResolvedValueOnce(productoA)
      .mockResolvedValueOnce(productoB)
    prismaMock.producto.update.mockResolvedValue({})
    upsertStockUbicacionMock.mockResolvedValue(undefined)
    prismaMock.gastoCompra.create.mockResolvedValueOnce({
      gastoCompraId: 'gc-1',
      vendor: { nombre: 'Proveedor 1' },
    })
    prismaMock.compraDocumento.create.mockResolvedValueOnce({
      compraDocumentoId: 'cd-1',
    })
    prismaMock.compraDocumentoItem.create
      .mockResolvedValueOnce({ compraDocumentoItemId: 'ci-1' })
      .mockResolvedValueOnce({ compraDocumentoItemId: 'ci-2' })
    prismaMock.productoCostHistory.create.mockResolvedValue({})

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      items: [
        { productoId: 'prod-a', precioCosto: 200, cantidad: 10 },
        { productoId: 'prod-b', precioCosto: 80, cantidad: 5 },
      ],
    })

    const response = await POST(request, {}, { userId: 'user-1', id: 'user-1' })

    expect(response.status).toBe(201)

    // Producto A: (10*100 + 10*200) / 20 = 150
    expect(calcularPrecioCostoCompraMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stockAntes: 10,
        precioCostoActual: 100,
        cantidadCompra: 10,
        costoUnitario: 200,
      })
    )

    // Producto B: (5*50 + 5*80) / 10 = 65
    expect(calcularPrecioCostoCompraMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stockAntes: 5,
        precioCostoActual: 50,
        cantidadCompra: 5,
        costoUnitario: 80,
      })
    )
  })

  it('el total del gasto coincide con la suma de los subtotales de items', async () => {
    const { POST } = await import('../route')

    prismaMock.compraDocumento.findFirst.mockResolvedValueOnce(null)
    prismaMock.producto.findUnique
      .mockResolvedValueOnce(productoA)
      .mockResolvedValueOnce(productoB)
    prismaMock.producto.update.mockResolvedValue({})
    upsertStockUbicacionMock.mockResolvedValue(undefined)
    prismaMock.gastoCompra.create.mockResolvedValueOnce({
      gastoCompraId: 'gc-1',
      vendor: { nombre: 'Proveedor 1' },
    })
    prismaMock.compraDocumento.create.mockResolvedValueOnce({
      compraDocumentoId: 'cd-1',
    })
    prismaMock.compraDocumentoItem.create
      .mockResolvedValueOnce({ compraDocumentoItemId: 'ci-1' })
      .mockResolvedValueOnce({ compraDocumentoItemId: 'ci-2' })
    prismaMock.productoCostHistory.create.mockResolvedValue({})

    const request = makePostRequest({
      proveedorId: 'vendor-1',
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      items: [
        { productoId: 'prod-a', precioCosto: 100, cantidad: 4 }, // 400
        { productoId: 'prod-b', precioCosto: 50, cantidad: 3 },  // 150
      ],
    })

    await POST(request, {}, { userId: 'user-1', id: 'user-1' })

    // Total = 4*100 + 3*50 = 550
    expect(prismaMock.gastoCompra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ total: 550 }),
      })
    )

    // Total en cabecera = 550
    expect(prismaMock.compraDocumento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ total: 550 }),
      })
    )
  })
})

describe('API /compras-productos GET', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('retorna cabeceras con items incluidos', async () => {
    const { GET } = await import('../route')

    prismaMock.compraDocumento.findMany.mockResolvedValueOnce([
      {
        compraDocumentoId: 'cd-1',
        proveedorId: 'vendor-1',
        numeroFactura: 'F-001',
        total: 550,
        estado: 'PAGADA',
        fechaCompra: new Date(),
        proveedor: { vendorId: 'vendor-1', nombre: 'Proveedor 1' },
        items: [
          { compraDocumentoItemId: 'ci-1', productoId: 'prod-a', cantidad: 4, precioUnitario: 100, totalLinea: 400, producto: { id: 'prod-a', nombre: 'Producto A' } },
          { compraDocumentoItemId: 'ci-2', productoId: 'prod-b', cantidad: 3, precioUnitario: 50, totalLinea: 150, producto: { id: 'prod-b', nombre: 'Producto B' } },
        ],
      },
    ])
    prismaMock.compraDocumento.count.mockResolvedValueOnce(1)

    const request = new NextRequest('http://localhost/api/compras-productos')
    const response = await GET(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.compras).toHaveLength(1)
    expect(data.compras[0].items).toHaveLength(2)
    expect(data.pagination.total).toBe(1)
  })

  it('filtra por deletedAt null (no muestra eliminadas)', async () => {
    const { GET } = await import('../route')

    prismaMock.compraDocumento.findMany.mockResolvedValueOnce([])
    prismaMock.compraDocumento.count.mockResolvedValueOnce(0)

    const request = new NextRequest('http://localhost/api/compras-productos')
    await GET(request, {}, { userId: 'user-1' })

    expect(prismaMock.compraDocumento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    )
  })
})

describe('API /compras-productos/[id] DELETE', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockTransaction()
  })

  it('revierte stock por cada item al eliminar', async () => {
    const { DELETE } = await import('../[id]/route')

    prismaMock.compraDocumento.findUnique.mockResolvedValueOnce({
      compraDocumentoId: 'cd-1',
      tipoOperacion: 'RESTOCK',
      items: [
        { productoId: 'prod-a', cantidad: 4, producto: { nombre: 'Producto A' } },
        { productoId: 'prod-b', cantidad: 3, producto: { nombre: 'Producto B' } },
      ],
      gastoCompra: { gastoCompraId: 'gc-1' },
      cuentaPorPagar: null,
    })
    prismaMock.ventaItem.count.mockResolvedValue(0)
    prismaMock.compraDocumento.update.mockResolvedValue({})
    prismaMock.producto.update.mockResolvedValue({})
    prismaMock.gastoCompra.update.mockResolvedValue({})

    const request = new NextRequest('http://localhost/api/compras-productos/cd-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: 'cd-1' }) }, { userId: 'user-1', id: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // Verifica que se decrementó stock 2 veces (una por item)
    expect(prismaMock.producto.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-a' },
        data: { stock: { decrement: 4 } },
      })
    )
    expect(prismaMock.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-b' },
        data: { stock: { decrement: 3 } },
      })
    )
  })

  it('bloquea eliminación si algún producto ya fue vendido', async () => {
    const { DELETE } = await import('../[id]/route')

    prismaMock.compraDocumento.findUnique.mockResolvedValueOnce({
      compraDocumentoId: 'cd-1',
      tipoOperacion: 'RESTOCK',
      items: [
        { productoId: 'prod-a', cantidad: 4, producto: { nombre: 'Producto A' } },
      ],
      gastoCompra: null,
      cuentaPorPagar: null,
    })
    prismaMock.ventaItem.count.mockResolvedValueOnce(3) // producto A fue vendido

    const request = new NextRequest('http://localhost/api/compras-productos/cd-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: 'cd-1' }) }, { userId: 'user-1', id: 'user-1' })

    expect(response.status).toBe(400)
    expect(prismaMock.producto.update).not.toHaveBeenCalled()
  })

  it('soft delete de gasto y cxp si existen', async () => {
    const { DELETE } = await import('../[id]/route')

    prismaMock.compraDocumento.findUnique.mockResolvedValueOnce({
      compraDocumentoId: 'cd-1',
      tipoOperacion: 'RESTOCK',
      items: [
        { productoId: 'prod-a', cantidad: 4, producto: { nombre: 'Producto A' } },
      ],
      gastoCompra: { gastoCompraId: 'gc-1' },
      cuentaPorPagar: { cuentaPorPagarId: 'cxp-1' },
    })
    prismaMock.ventaItem.count.mockResolvedValue(0)
    prismaMock.pagoCuentaPorPagar.count.mockResolvedValueOnce(0)
    prismaMock.compraDocumento.update.mockResolvedValue({})
    prismaMock.producto.update.mockResolvedValue({})
    prismaMock.gastoCompra.update.mockResolvedValue({})
    prismaMock.cuentaPorPagar.update.mockResolvedValue({})

    const request = new NextRequest('http://localhost/api/compras-productos/cd-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: 'cd-1' }) }, { userId: 'user-1', id: 'user-1' })

    expect(response.status).toBe(200)
    expect(prismaMock.gastoCompra.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gastoCompraId: 'gc-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )
    expect(prismaMock.cuentaPorPagar.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cuentaPorPagarId: 'cxp-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )
  })
})
