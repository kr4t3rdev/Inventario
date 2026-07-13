import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findFirst: vi.fn() },
    servicios: { findFirst: vi.fn() },
    compraDocumento: { findMany: vi.fn() },
    compraDocumentoItem: { findMany: vi.fn() },
    compraServicio: { findMany: vi.fn() },
    gastoCompra: { findMany: vi.fn() },
    receta: { findFirst: vi.fn() },
    ventaServicios: { findMany: vi.fn() },
    merma: { aggregate: vi.fn().mockResolvedValue({ _sum: { cantidad: 0 } }) },
    tasaCambio: { findMany: vi.fn().mockResolvedValue([]) },
    precioProducto: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getFichaCostoAction } from '../actions'
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

describe('getFichaCostoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve 404 si el producto no pertenece al tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)

    const result = await getFichaCostoAction('prod-1')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  it('retorna estado vacío para producto simple sin compras', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      nombre: 'Harina 50kg',
      codigoInterno: 'HAR-50',
      esCompuesto: false,
      precioCosto: 500,
      precioVenta: 800,
      tenantId: 'tenant-A',
    } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    const result = await getFichaCostoAction('prod-1')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.costoCalculado.valor).toBe(0)
      // precioVenta 800 > 0 → margen (800-0)/800 = 100% → SALUDABLE
      expect(result.data.margen.estado).toBe('SALUDABLE')
      expect(result.data.advertencias).toContain(
        'No hay compras registradas en los últimos 12 meses',
      )
    }
  })

  it('calcula CPP y margen para producto simple con compras', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockImplementation(
      () =>
        Promise.resolve({
          id: 'prod-1',
          nombre: 'Harina 50kg',
          codigoInterno: 'HAR-50',
          esCompuesto: false,
          precioCosto: 500,
          precioVenta: 800,
          tenantId: 'tenant-A',
          stock: 100,
        }) as any,
    )
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      {
        compraDocumentoItemId: 'i1',
        cantidad: 100,
        precioUnitario: 500,
        compraDocumento: { fechaCompra: new Date('2026-01-15'), gastoCompraId: null },
      },
      {
        compraDocumentoItemId: 'i2',
        cantidad: 50,
        precioUnitario: 480,
        compraDocumento: { fechaCompra: new Date('2026-02-15'), gastoCompraId: null },
      },
    ] as any)

    const result = await getFichaCostoAction('prod-1')
    expect(result.success).toBe(true)
    if (result.success) {
      // (100*500 + 50*480) / 150 = 74000 / 150 ≈ 493.33
      expect(result.data.costoCalculado.valor).toBeCloseTo(493.33, 2)
      expect(result.data.costoCalculado.metodo).toBe('CPP')
      expect(result.data.margen.estado).toBe('SALUDABLE')
    }
  })

  it('prorratea los gastos por la cantidad de cada documento al calcular el CPP', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      nombre: 'Producto con gastos',
      codigoInterno: 'PG-1',
      esCompuesto: false,
      precioCosto: 100,
      precioVenta: 200,
      tenantId: 'tenant-A',
      stock: 100,
    } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      {
        compraDocumentoId: 'doc-1',
        cantidad: 10,
        precioUnitario: 100,
        compraDocumento: {
          fechaCompra: new Date('2026-01-15'),
          gastoCompraId: 'gasto-1',
        },
      },
      {
        compraDocumentoId: 'doc-2',
        cantidad: 90,
        precioUnitario: 100,
        compraDocumento: {
          fechaCompra: new Date('2026-02-15'),
          gastoCompraId: 'gasto-2',
        },
      },
    ] as any)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([
      { gastoCompraId: 'gasto-1', total: 100, cantidad: 10 },
      { gastoCompraId: 'gasto-2', total: 900, cantidad: 90 },
    ] as any)

    const result = await getFichaCostoAction('prod-1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.costoCalculado.valor).toBe(110)
    }
  })

  it('asigna solo la proporción del gasto correspondiente al producto en un documento multiproducto', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      nombre: 'Producto parcial',
      codigoInterno: 'PP-1',
      esCompuesto: false,
      precioCosto: 100,
      precioVenta: 200,
      tenantId: 'tenant-A',
      stock: 10,
    } as any)
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      {
        compraDocumentoId: 'doc-multiproducto',
        cantidad: 10,
        precioUnitario: 100,
        compraDocumento: {
          fechaCompra: new Date('2026-01-15'),
          gastoCompraId: 'gasto-multiproducto',
        },
      },
    ] as any)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([
      { gastoCompraId: 'gasto-multiproducto', total: 100, cantidad: 100 },
    ] as any)

    const result = await getFichaCostoAction('prod-1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.costoCalculado.valor).toBe(101)
    }

    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([
      { gastoCompraId: 'gasto-multiproducto', total: 100, cantidad: 0 },
    ] as any)

    const resultConCantidadCero = await getFichaCostoAction('prod-1')

    expect(resultConCantidadCero.success).toBe(true)
    if (resultConCantidadCero.success) {
      expect(resultConCantidadCero.data.costoCalculado.valor).toBe(100)
    }
  })

  it('agrega alerta cuando el margen es bajo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockImplementation(
      () =>
        Promise.resolve({
          id: 'prod-1',
          nombre: 'Prod bajo',
          codigoInterno: 'PBAJ-1',
          esCompuesto: false,
          precioCosto: 500,
          precioVenta: 510, // margen ~2%
          tenantId: 'tenant-A',
          stock: 100,
        }) as any,
    )
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      {
        compraDocumentoItemId: 'i1',
        cantidad: 100,
        precioUnitario: 500,
        compraDocumento: { fechaCompra: new Date('2026-01-15'), gastoCompraId: null },
      },
    ] as any)
    const result = await getFichaCostoAction('prod-1')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.margen.estado).toBe('BAJO')
      expect(
        result.data.advertencias.some((a) => a.toLowerCase().includes('margen bajo')),
      ).toBe(true)
    }
  })

  it('agrega alerta crítica cuando hay pérdida', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockImplementation(
      () =>
        Promise.resolve({
          id: 'prod-1',
          nombre: 'Prod pérdida',
          codigoInterno: 'PPER-1',
          esCompuesto: false,
          precioCosto: 500,
          precioVenta: 400, // margen negativo
          tenantId: 'tenant-A',
          stock: 50,
        }) as any,
    )
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([
      {
        compraDocumentoItemId: 'i1',
        cantidad: 100,
        precioUnitario: 500,
        compraDocumento: { fechaCompra: new Date('2026-01-15'), gastoCompraId: null },
      },
    ] as any)
    const result = await getFichaCostoAction('prod-1')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.margen.estado).toBe('PERDIDA')
      expect(
        result.data.advertencias.some((a) => a.toLowerCase().includes('negativo')),
      ).toBe(true)
    }
  })

  it('retorna ficha de costo para servicio con costo promedio de compras', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue({
      servicioId: 'svc-1',
      nombre: 'Instalación técnica',
      precio: 350,
      descripcion: 'Servicio de instalación',
      moneda: 'CUP',
      tenantId: 'tenant-A',
    } as any)
    vi.mocked(prisma.compraServicio.findMany).mockResolvedValue([
      {
        compraServicioId: 'cs-1',
        costoUnitario: 100,
        cantidad: 2,
        total: 200,
        moneda: 'CUP',
      },
      {
        compraServicioId: 'cs-2',
        costoUnitario: 120,
        cantidad: 1,
        total: 120,
        moneda: 'CUP',
      },
    ] as any)

    const result = await getFichaCostoAction({
      entityId: 'svc-1',
      entityType: 'SERVICIO',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.producto.id).toBe('svc-1')
      expect(result.data.producto.entityType).toBe('SERVICIO')
      expect(result.data.producto.tipo).toBe('SERVICIO')
      expect(result.data.costoCalculado.valor).toBeCloseTo(106.67, 2)
      expect(result.data.costoCalculado.metodo).toBe('CPP')
      expect(result.data.producto.precioVenta).toBe(350)
      expect(result.data.merma.cantidad30d).toBe(0)
      expect(result.data.margen.estado).toBe('SALUDABLE')
    }
  })

  it('mantiene SIN_DATOS para servicio si las compras no tienen moneda histórica confiable', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue({
      servicioId: 'svc-1',
      nombre: 'Instalación técnica',
      precio: 350,
      descripcion: 'Servicio de instalación',
      moneda: 'CUP',
      tenantId: 'tenant-A',
    } as any)
    vi.mocked(prisma.compraServicio.findMany).mockResolvedValue([
      {
        compraServicioId: 'cs-1',
        costoUnitario: 100,
        cantidad: 2,
        total: 200,
        moneda: null,
      },
    ] as any)

    const result = await getFichaCostoAction({
      entityId: 'svc-1',
      entityType: 'SERVICIO',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.costoCalculado.valor).toBe(0)
      expect(result.data.costoCalculado.metodo).toBeNull()
      expect(result.data.margen.estado).toBe('SIN_DATOS')
      expect(
        result.data.advertencias.some((item) => item.toLowerCase().includes('moneda')),
      ).toBe(true)
    }
  })

  it('mantiene SIN_DATOS para servicio si las compras mezclan monedas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue({
      servicioId: 'svc-1',
      nombre: 'Instalación técnica',
      precio: 350,
      descripcion: 'Servicio de instalación',
      moneda: 'CUP',
      tenantId: 'tenant-A',
    } as any)
    vi.mocked(prisma.compraServicio.findMany).mockResolvedValue([
      {
        compraServicioId: 'cs-1',
        costoUnitario: 100,
        cantidad: 2,
        total: 200,
        moneda: 'CUP',
      },
      {
        compraServicioId: 'cs-2',
        costoUnitario: 120,
        cantidad: 1,
        total: 120,
        moneda: 'USD',
      },
    ] as any)

    const result = await getFichaCostoAction({
      entityId: 'svc-1',
      entityType: 'SERVICIO',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.costoCalculado.valor).toBe(0)
      expect(result.data.costoCalculado.metodo).toBeNull()
      expect(result.data.margen.estado).toBe('SIN_DATOS')
      expect(
        result.data.advertencias.some(
          (item) =>
            item.toLowerCase().includes('moneda') &&
            item.toLowerCase().includes('consistente'),
        ),
      ).toBe(true)
    }
  })
})
