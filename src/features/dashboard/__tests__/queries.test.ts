import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  producto: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  almacen: {
    count: vi.fn(),
  },
  puntoDeVenta: {
    count: vi.fn(),
  },
  venta: {
    findMany: vi.fn(),
  },
  ventaItem: {
    findMany: vi.fn(),
  },
  ventaServicios: {
    findMany: vi.fn(),
  },
  merma: {
    findMany: vi.fn(),
  },
  gastosDE: {
    findMany: vi.fn(),
  },
  pagosalario: {
    findMany: vi.fn(),
  },
  transferencia: {
    findMany: vi.fn(),
  },
  gastoCompra: {
    findMany: vi.fn(),
  },
  stockUbicacion: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

import { getDashboardStatsQuery } from '../queries'

describe('getDashboardStatsQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T12:00:00.000Z'))
    vi.clearAllMocks()

    vi.mocked(mockPrisma.producto.count).mockResolvedValue(2)
    vi.mocked(mockPrisma.almacen.count).mockResolvedValue(1)
    vi.mocked(mockPrisma.puntoDeVenta.count).mockResolvedValue(1)
    vi.mocked(mockPrisma.venta.findMany).mockResolvedValue([
      { productoId: 'prod-1', cantidad: 1, descuento: null, total: 100, createdAt: new Date('2026-06-22T09:00:00.000Z') },
      { productoId: 'prod-1', cantidad: 1, descuento: null, total: 50, createdAt: new Date('2026-06-21T09:00:00.000Z') },
    ] as never)
    vi.mocked(mockPrisma.ventaItem.findMany).mockResolvedValue([])
    vi.mocked(mockPrisma.ventaServicios.findMany).mockResolvedValue([
      { total: 40, cantidad: 2, createdAt: new Date('2026-06-22T10:00:00.000Z') },
      { total: 20, cantidad: 1, createdAt: new Date('2026-06-21T10:00:00.000Z') },
    ] as never)
    vi.mocked(mockPrisma.merma.findMany).mockResolvedValue([])
    vi.mocked(mockPrisma.gastosDE.findMany).mockResolvedValue([])
    vi.mocked(mockPrisma.pagosalario.findMany).mockResolvedValue([])
    vi.mocked(mockPrisma.transferencia.findMany).mockResolvedValue([])
    vi.mocked(mockPrisma.gastoCompra.findMany).mockResolvedValue([
      { total: 75, createdAt: new Date('2026-06-05T12:00:00.000Z') },
    ] as never)
    vi.mocked(mockPrisma.producto.findMany)
      .mockResolvedValueOnce([
        {
          id: 'prod-1',
          nombre: 'Harina',
          stock: 0,
          stockMinimo: 10,
          precioCosto: 5,
          precioVenta: 10,
          almacenId: null,
          categoria: { nombre: 'Básicos' },
          unidad: { simbolo: 'kg' },
        },
        {
          id: 'prod-2',
          nombre: 'Azúcar',
          stock: 0,
          stockMinimo: 5,
          precioCosto: 2,
          precioVenta: 4,
          almacenId: null,
          categoria: { nombre: 'Básicos' },
          unidad: { simbolo: 'kg' },
        },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          id: 'prod-1',
          nombre: 'Harina',
          stock: 0,
          stockMinimo: 10,
          precioCosto: 5,
          precioVenta: 10,
          almacenId: null,
          puntoDeVentaId: null,
          categoria: { nombre: 'Básicos' },
          unidad: { simbolo: 'kg' },
        },
        {
          id: 'prod-2',
          nombre: 'Azúcar',
          stock: 0,
          stockMinimo: 5,
          precioCosto: 2,
          precioVenta: 4,
          almacenId: null,
          puntoDeVentaId: null,
          categoria: { nombre: 'Básicos' },
          unidad: { simbolo: 'kg' },
        },
      ] as never)
    vi.mocked(mockPrisma.stockUbicacion.findMany).mockResolvedValue([
      {
        productoId: 'prod-1',
        cantidad: 12,
        cantidadReservada: 0,
        cantidadDisponible: 12,
        producto: {
          id: 'prod-1',
          nombre: 'Harina',
          precioCosto: 5,
          categoria: { nombre: 'Básicos' },
        },
      },
      {
        productoId: 'prod-2',
        cantidad: 3,
        cantidadReservada: 0,
        cantidadDisponible: 3,
        producto: {
          id: 'prod-2',
          nombre: 'Azúcar',
          precioCosto: 2,
          categoria: { nombre: 'Básicos' },
        },
      },
    ] as never)
  })

  it('incluye ventas de servicios en las métricas diarias y calcula compras mensuales reales', async () => {
    const stats = await getDashboardStatsQuery('tenant-1')

    expect(stats.ventasDiarias.ingresosHoy).toBe(140)
    expect(stats.ventasDiarias.ventasHoy).toBe(3)
    expect(stats.ventasDiarias.ingresosAyer).toBe(70)
    expect(stats.ventasDiarias.ventasAyer).toBe(2)

    const mes = stats.datosPorMes.find((item) => item.gastosCompras === 75)
    expect(mes).toBeDefined()
    expect(mes?.gastosComprasCantidad).toBe(1)

    expect(stats.datosPorSemana.length).toBeGreaterThan(0)
    expect(stats.datosPorSemana[0]).toHaveProperty('semana')
    expect(stats.datosPorSemana.some((item) => 'ventasCantidad' in item)).toBe(true)
  })

  it('calcula inventario y distribución desde StockUbicacion', async () => {
    const stats = await getDashboardStatsQuery('tenant-1')

    expect(mockPrisma.stockUbicacion.findMany).toHaveBeenCalled()
    expect(stats.valorTotalInventario).toBe(66)
    expect(stats.distribucionStock).toEqual([
      {
        categoria: 'Básicos',
        productos: 2,
        stockTotal: 15,
        valorTotal: 66,
      },
    ])
  })

  it('respeta el filtro de ubicación para el stock bajo', async () => {
    vi.mocked(mockPrisma.producto.findMany).mockReset()
    vi.mocked(mockPrisma.producto.findMany)
      .mockResolvedValueOnce([
        {
          id: 'prod-1',
          nombre: 'Harina',
          stock: 4,
          stockMinimo: 10,
          precioCosto: 5,
          precioVenta: 10,
          almacenId: 'alm-1',
          puntoDeVentaId: null,
          categoria: { nombre: 'Básicos' },
          unidad: { simbolo: 'kg' },
        },
        {
          id: 'prod-2',
          nombre: 'Harina',
          stock: 8,
          stockMinimo: 10,
          precioCosto: 5,
          precioVenta: 10,
          almacenId: 'alm-2',
          puntoDeVentaId: null,
          categoria: { nombre: 'Básicos' },
          unidad: { simbolo: 'kg' },
        },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          id: 'prod-1',
          nombre: 'Harina',
          stock: 4,
          stockMinimo: 10,
          precioCosto: 5,
          precioVenta: 10,
          almacenId: 'alm-1',
          puntoDeVentaId: null,
          categoria: { nombre: 'Básicos' },
          unidad: { simbolo: 'kg' },
        },
      ] as never)

    const stats = await getDashboardStatsQuery('tenant-1', {
      ubicacionId: 'alm-1',
      tipoUbicacion: 'almacen',
    })

    expect(stats.productosStockBajo).toHaveLength(1)
    expect(stats.productosStockBajo[0].stockTotal).toBe(4)
    expect(stats.productosStockBajo[0].almacenId).toBe('alm-1')
  })
})
