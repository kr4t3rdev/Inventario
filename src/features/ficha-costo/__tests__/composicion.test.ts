import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findFirst: vi.fn() },
    receta: { findFirst: vi.fn() },
    compraDocumentoItem: { findMany: vi.fn() },
    compraDocumento: { findMany: vi.fn() },
    gastoCompra: { findMany: vi.fn() },
    tasaCambio: { findMany: vi.fn().mockResolvedValue([]) },
    merma: { aggregate: vi.fn().mockResolvedValue({ _sum: { cantidad: 0 } }) },
    precioProducto: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getComposicionCostoAction } from '../actions'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'u-1',
  name: 'Tester',
  email: 't@test.com',
  role: 'admin' as AuthenticatedUser['role'],
  isActive: true,
  tenantId: 'tenant-A',
  planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
  tenantRole: 'manager',
}

describe('getComposicionCostoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 404 si el producto no pertenece al tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)

    const result = await getComposicionCostoAction({
      productoId: 'prod-1',
      manoObra: 100,
      indirectos: 50,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('suma materiales + mano de obra + indirectos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.receta.findFirst).mockResolvedValue({
      RecetaIngrediente: [
        {
          id: 'ing-1',
          cantidad: 2,
          desperdicio: 0,
          productoId: 'sub-1',
          Producto: { id: 'sub-1', nombre: 'Tabaco' },
        },
        {
          id: 'ing-2',
          cantidad: 1,
          desperdicio: 0,
          productoId: 'sub-2',
          Producto: { id: 'sub-2', nombre: 'Papel' },
        },
      ],
    } as any)
    // CPP de los ingredientes: sub-1=100, sub-2=50
    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      if (args.where.productoId === 'sub-1') {
        return Promise.resolve([
          { cantidad: 10, precioUnitario: 100, compraDocumentoId: 'd-1' },
        ]) as any
      }
      if (args.where.productoId === 'sub-2') {
        return Promise.resolve([
          { cantidad: 5, precioUnitario: 50, compraDocumentoId: 'd-2' },
        ]) as any
      }
      return Promise.resolve([]) as any
    })
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    const result = await getComposicionCostoAction({
      productoId: 'prod-1',
      manoObra: 300,
      indirectos: 150,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // sub-1: 2*100 = 200, sub-2: 1*50 = 50 → materiales 250
      // total = 250 + 300 + 150 = 700
      expect(result.data.materiales).toBe(250)
      expect(result.data.manoObra).toBe(300)
      expect(result.data.indirectos).toBe(150)
      expect(result.data.total).toBe(700)
    }
  })

  it('rechaza mano de obra o indirectos negativos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)

    const result = await getComposicionCostoAction({
      productoId: 'prod-1',
      manoObra: -1,
      indirectos: 0,
    })
    expect(result.success).toBe(false)
  })

  it('ignora ingredientes sin CPP y los reporta', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.receta.findFirst).mockResolvedValue({
      RecetaIngrediente: [
        { id: 'ing-1', cantidad: 2, desperdicio: 0, productoId: 'sub-1', Producto: { id: 'sub-1', nombre: 'A' } },
        { id: 'ing-2', cantidad: 1, desperdicio: 0, productoId: 'sub-2', Producto: { id: 'sub-2', nombre: 'B' } },
      ],
    } as any)
    // sub-1 tiene CPP 100, sub-2 sin compras → []
    vi.mocked(prisma.compraDocumentoItem.findMany).mockImplementation((args: any) => {
      if (args.where.productoId === 'sub-1') {
        return Promise.resolve([{ cantidad: 10, precioUnitario: 100, compraDocumentoId: 'd-1' }]) as any
      }
      return Promise.resolve([]) as any
    })
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])

    const result = await getComposicionCostoAction({
      productoId: 'prod-1',
      manoObra: 0,
      indirectos: 0,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.materiales).toBe(200) // solo sub-1
      expect(result.data.ingredientesSinCosto).toBe(1)
    }
  })
})
