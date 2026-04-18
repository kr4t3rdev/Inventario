import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  miEmpresa: {
    findFirst: vi.fn(),
  },
  vendor: {
    findUnique: vi.fn(),
  },
  categoria: {
    findUnique: vi.fn(),
  },
  producto: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  productoCostHistory: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuth: (handler: unknown) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
}))

const { PATCH } = await import('../route')

describe('PATCH /api/productos/[id] - EAN-13', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.miEmpresa.findFirst.mockResolvedValue({ usaCodigoEan13: true })
    prismaMock.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      precioCosto: 100,
      precioVenta: 150,
      categoriaId: 'cat-1',
      subcategoriaId: 'sub-1',
      vendorId: 'vendor-1',
      proveedorCodigo: '01',
    })
    prismaMock.vendor.findUnique.mockResolvedValue({ vendorId: 'vendor-1' })
    prismaMock.categoria.findUnique.mockResolvedValue({ parentId: 'cat-1' })
  })

  it('rechaza segmentos manuales enviados por el cliente', async () => {
    const request = new Request('http://localhost/api/productos/prod-1', {
      method: 'PATCH',
      body: JSON.stringify({
        nombre: 'Producto demo',
        idSeccionCodigo: '14',
      }),
    }) as NextRequest

    const response = await PATCH(request, { params: Promise.resolve({ id: 'prod-1' }) } as never, {} as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/generan automáticamente/i)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rechaza edición EAN-13 sin subcategoría efectiva', async () => {
    prismaMock.producto.findUnique.mockResolvedValueOnce({
      id: 'prod-1',
      precioCosto: 100,
      precioVenta: 150,
      categoriaId: 'cat-1',
      subcategoriaId: null,
      vendorId: 'vendor-1',
      proveedorCodigo: '01',
    })

    const request = new Request('http://localhost/api/productos/prod-1', {
      method: 'PATCH',
      body: JSON.stringify({
        nombre: 'Producto demo',
      }),
    }) as NextRequest

    const response = await PATCH(request, { params: Promise.resolve({ id: 'prod-1' }) } as never, {} as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/subcategoría/i)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rechaza cambios de categoría o subcategoría en productos con EAN-13 ya generado', async () => {
    const request = new Request('http://localhost/api/productos/prod-1', {
      method: 'PATCH',
      body: JSON.stringify({
        nombre: 'Producto demo',
        categoriaId: 'cat-2',
      }),
    }) as NextRequest

    const response = await PATCH(request, { params: Promise.resolve({ id: 'prod-1' }) } as never, {} as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/no se pueden cambiar/i)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('normaliza y persiste el proveedor sin recalcular el código EAN-13', async () => {
    const tx = {
      producto: {
        update: vi.fn().mockResolvedValue({ id: 'prod-1', proveedorCodigo: '01' }),
      },
      productoCostHistory: {
        create: vi.fn(),
      },
    }

    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
      return callback(tx)
    })

    const request = new Request('http://localhost/api/productos/prod-1', {
      method: 'PATCH',
      body: JSON.stringify({
        nombre: 'Producto demo',
        descripcion: 'Actualizado',
        proveedorCodigo: '1',
        vendorId: 'vendor-1',
        categoriaId: 'cat-1',
        subcategoriaId: 'sub-1',
        precioCosto: 100,
        precioVenta: 150,
        stock: 10,
        stockMinimo: 0,
        fotos: [],
        unidadId: 'u1',
        almacenId: 'a1',
      }),
    }) as NextRequest

    const response = await PATCH(request, { params: Promise.resolve({ id: 'prod-1' }) } as never, { id: 'user-1' } as never)

    expect(response.status).toBe(200)

    const updateArgs = tx.producto.update.mock.calls[0]?.[0]
    expect(updateArgs.data.proveedorCodigo).toBe('01')
    expect(updateArgs.data.codigoNegocio).toBeUndefined()
    expect(updateArgs.data.idSeccionCodigo).toBeUndefined()
    expect(updateArgs.data.especificoCodigo).toBeUndefined()
    expect(updateArgs.data.surtidoCodigo).toBeUndefined()
  })
})