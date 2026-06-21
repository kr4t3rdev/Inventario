import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDashboardRentabilidadAction } from '../actions-alertas'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server-actions', () => ({
  withAction: (fn: any) => fn,
}))

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
}))

import { prisma } from '@/lib/prisma'

const mockUser = { userId: 'user-1', tenantId: 'tenant-1' } as any

const makeProd = (overrides: any = {}) => ({
  id: overrides.id ?? 'p1',
  nombre: overrides.nombre ?? 'Producto',
  precioCosto: overrides.precioCosto ?? 50,
  precioVenta: overrides.precioVenta ?? 100,
  tipo: overrides.tipo ?? 'SIMPLE',
  categorias: overrides.categorias ?? [{ id: 'cat-1', nombre: 'Categoría A' }],
})

describe('getDashboardRentabilidadAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna margen promedio por categoría', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      makeProd({ id: 'A', precioVenta: 100, precioCosto: 60, categorias: [{ id: 'c1', nombre: 'Cat A' }] }),
      makeProd({ id: 'B', precioVenta: 100, precioCosto: 80, categorias: [{ id: 'c1', nombre: 'Cat A' }] }),
      makeProd({ id: 'C', precioVenta: 100, precioCosto: 50, categorias: [{ id: 'c2', nombre: 'Cat B' }] }),
    ] as any)

    const data = await getDashboardRentabilidadAction({}, mockUser)

    expect(data.porCategoria).toHaveLength(2)
    const catA = data.porCategoria.find(c => c.nombre === 'Cat A')!
    expect(catA.margenPromedio).toBeCloseTo(30, 0) // (40+20)/2
    expect(catA.cantidadProductos).toBe(2)
  })

  it('retorna top 5 productos por margen', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) =>
        makeProd({ id: `p${i}`, precioVenta: 100, precioCosto: 50 + i * 5 }),
      ) as any,
    )

    const data = await getDashboardRentabilidadAction({}, mockUser)

    expect(data.topProductos).toHaveLength(5)
    expect(data.topProductos[0].margenPorcentaje).toBeGreaterThan(data.topProductos[4].margenPorcentaje)
  })

  it('retorna bottom 5 productos por margen', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) =>
        makeProd({ id: `p${i}`, precioVenta: 100, precioCosto: 50 + i * 5 }),
      ) as any,
    )

    const data = await getDashboardRentabilidadAction({}, mockUser)

    expect(data.bottomProductos).toHaveLength(5)
    expect(data.bottomProductos[0].margenPorcentaje).toBeLessThan(data.bottomProductos[4].margenPorcentaje)
  })

  it('filtra por tenantId', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await getDashboardRentabilidadAction({}, mockUser)

    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', precioVenta: { gt: 0 }, precioCosto: { gt: 0 } },
      select: {
        id: true, nombre: true, precioCosto: true, precioVenta: true, tipo: true,
        categorias: { select: { id: true, nombre: true } },
      },
    })
  })

  it('filtra por tipo de producto', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await getDashboardRentabilidadAction({ tipo: 'COMPUESTO' }, mockUser)

    expect(prisma.producto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tipo: 'COMPUESTO' } as any),
    }))
  })

  it('retorna array vacío si no hay productos', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    const data = await getDashboardRentabilidadAction({}, mockUser)

    expect(data.porCategoria).toHaveLength(0)
    expect(data.topProductos).toHaveLength(0)
    expect(data.bottomProductos).toHaveLength(0)
  })
})
