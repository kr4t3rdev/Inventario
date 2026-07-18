import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getProductosMargenBajoAction,
  verificarMargenBajoAction,
  getDashboardRentabilidadAction,
} from '../actions-alertas'

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

const { mockRequireFeature } = vi.hoisted(() => ({ mockRequireFeature: vi.fn() }))

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireFeature: mockRequireFeature,
}))

import { prisma } from '@/lib/prisma'

const makeProducto = (overrides: any = {}) => ({
  id: overrides.id ?? 'prod-1',
  nombre: overrides.nombre ?? 'Producto Test',
  codigoInterno: overrides.codigoInterno ?? 'CODE-001',
  precioCosto: overrides.precioCosto ?? 50,
  precioVenta: overrides.precioVenta ?? 100,
  tenantId: overrides.tenantId ?? 'tenant-1',
})

const mockUser = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
} as any

describe('getProductosMargenBajoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })


  it.each([
    ['productos con margen bajo', () => getProductosMargenBajoAction({}, mockUser)],
    ['verificación de margen', () => verificarMargenBajoAction({}, mockUser)],
    ['dashboard de rentabilidad', () => getDashboardRentabilidadAction({}, mockUser)],
  ])('deniega %s antes de consultar Prisma', async (_name, invoke) => {
    mockUser.planFeatures['ficha-costo'] = false

    await expect(invoke()).rejects.toThrow('plan actual no incluye')

    expect(prisma.producto.findMany).not.toHaveBeenCalled()
    mockUser.planFeatures['ficha-costo'] = true
  })

  it('retorna productos con margen < 10% ordenados ascendentemente', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      makeProducto({ id: 'A', precioVenta: 100, precioCosto: 60 }), // margen=40%
      makeProducto({ id: 'B', precioVenta: 100, precioCosto: 95 }), // margen=5%
      makeProducto({ id: 'C', precioVenta: 100, precioCosto: 110 }), // margen=-10%
    ] as any)

    const data = await getProductosMargenBajoAction({}, mockUser)

    expect(data).toHaveLength(2) // solo B y C
    expect(data[0].id).toBe('C') // margen=-10% primero
    expect(data[0].margenPorcentaje).toBeCloseTo(-10, 0)
    expect(data[1].id).toBe('B') // margen=5% segundo
    expect(data[1].margenPorcentaje).toBeCloseTo(5, 0)
  })

  it('retorna array vacío si todos tienen margen ≥ 10%', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      makeProducto({ id: 'A', precioVenta: 100, precioCosto: 50 }),
    ] as any)

    const data = await getProductosMargenBajoAction({}, mockUser)

    expect(data).toHaveLength(0)
  })

  it('excluye productos con precioVenta = 0', async () => {
    // Prisma filtra por precioVenta > 0, así que solo retorna el válido
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      makeProducto({ id: 'B', precioVenta: 100, precioCosto: 95 }),
    ] as any)

    const data = await getProductosMargenBajoAction({}, mockUser)

    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('B')
  })

  it('filtra por tenantId', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await getProductosMargenBajoAction({}, mockUser)

    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        precioVenta: { gt: 0 },
        precioCosto: { gt: 0 },
      },
      select: {
        id: true,
        nombre: true,
        codigoInterno: true,
        precioCosto: true,
        precioVenta: true,
      },
      orderBy: { nombre: 'asc' },
    })
  })

  it('respeta el límite configurable', async () => {
    const productos = Array.from({ length: 15 }, (_, i) =>
      makeProducto({ id: `prod-${i}`, precioVenta: 100, precioCosto: 95 }),
    )
    vi.mocked(prisma.producto.findMany).mockResolvedValue(productos as any)

    const data = await getProductosMargenBajoAction({ limit: 5 }, mockUser)

    expect(data).toHaveLength(5)
  })

  it('excluye productos con precioCosto = 0', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      makeProducto({ id: 'A', precioVenta: 100, precioCosto: 0 }),
      makeProducto({ id: 'B', precioVenta: 100, precioCosto: 95 }),
    ] as any)

    const data = await getProductosMargenBajoAction({}, mockUser)

    expect(data).toHaveLength(1)
  })
})
