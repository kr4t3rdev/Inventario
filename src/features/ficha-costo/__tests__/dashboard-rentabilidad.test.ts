import { describe, it, expect, vi, beforeEach } from 'vitest'
import { expectActionFailure, expectActionSuccess } from '@/test/action-response'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { getDashboardRentabilidadAction } from '../actions-alertas'

// La sesion se resuelve dentro del withAction real; solo se fija el usuario.
vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: {
      findMany: vi.fn(),
    },
  },
}))


vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireFeature: vi.fn(),
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'

const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Usuario Ficha',
  email: 'ficha@test.com',
  isActive: true,
  tenantId: 'tenant-1',
  planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
  role: 'admin',
}

const makeProd = (overrides: any = {}) => ({
  id: overrides.id ?? 'p1',
  nombre: overrides.nombre ?? 'Producto',
  precioCosto: overrides.precioCosto ?? 50,
  precioVenta: overrides.precioVenta ?? 100,
  esCompuesto: overrides.esCompuesto ?? false,
  categoria: overrides.categoria ?? { id: 'cat-1', nombre: 'Categoría A' },
})

describe('getDashboardRentabilidadAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
  })

  it('retorna margen promedio por categoría', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      makeProd({ id: 'A', precioVenta: 100, precioCosto: 60, categoria: { id: 'c1', nombre: 'Cat A' } }),
      makeProd({ id: 'B', precioVenta: 100, precioCosto: 80, categoria: { id: 'c1', nombre: 'Cat A' } }),
      makeProd({ id: 'C', precioVenta: 100, precioCosto: 50, categoria: { id: 'c2', nombre: 'Cat B' } }),
    ] as any)

    const data = expectActionSuccess(await getDashboardRentabilidadAction({})).data

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

    const data = expectActionSuccess(await getDashboardRentabilidadAction({})).data

    expect(data.topProductos).toHaveLength(5)
    expect(data.topProductos[0].margenPorcentaje).toBeGreaterThan(data.topProductos[4].margenPorcentaje)
  })

  it('retorna bottom 5 productos por margen', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) =>
        makeProd({ id: `p${i}`, precioVenta: 100, precioCosto: 50 + i * 5 }),
      ) as any,
    )

    const data = expectActionSuccess(await getDashboardRentabilidadAction({})).data

    expect(data.bottomProductos).toHaveLength(5)
    expect(data.bottomProductos[0].margenPorcentaje).toBeLessThan(data.bottomProductos[4].margenPorcentaje)
  })

  it('filtra por tenantId', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await getDashboardRentabilidadAction({})

    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', precioVenta: { gt: 0 }, precioCosto: { gt: 0 } },
      select: {
        id: true, nombre: true, precioCosto: true, precioVenta: true, esCompuesto: true,
        categoria: { select: { catId: true, nombre: true } },
      },
    })
  })

  it('filtra por tipo de producto', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await getDashboardRentabilidadAction(
      { tipo: 'COMPUESTO' },
    )

    expect(prisma.producto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ esCompuesto: true } as any),
    }))
  })

  it('retorna array vacío si no hay productos', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    const data = expectActionSuccess(await getDashboardRentabilidadAction({})).data

    expect(data.porCategoria).toHaveLength(0)
    expect(data.topProductos).toHaveLength(0)
    expect(data.bottomProductos).toHaveLength(0)
  })
})
