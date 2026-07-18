import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findFirst: vi.fn() },
    precioProducto: { findMany: vi.fn() },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getListasPreciosProductoAction } from '../actions'
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

describe('getListasPreciosProductoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 404 si el producto no existe', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)
    const result = await getListasPreciosProductoAction({ productoId: 'prod-1' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('devuelve la lista de precios del producto', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([
      {
        precio: 850,
        listaPrecio: { id: 'lista-1', nombre: 'Minorista' },
      },
      {
        precio: 750,
        listaPrecio: { id: 'lista-2', nombre: 'Mayorista' },
      },
    ] as any)

    const result = await getListasPreciosProductoAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].lista.nombre).toBe('Minorista')
      expect(result.data[0].precio).toBe(850)
    }
  })

  it('devuelve array vacío si el producto no está en ninguna lista', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([])
    const result = await getListasPreciosProductoAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })
})
