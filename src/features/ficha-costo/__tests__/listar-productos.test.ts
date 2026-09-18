import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findMany: vi.fn() },
    servicios: { findMany: vi.fn() },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { listarProductosParaFichaAction } from '../actions'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'u-1',
  name: 'Tester',
  email: 't@test.com',
  role: 'admin' as AuthenticatedUser['role'],
  isActive: true,
  tenantId: 'tenant-A',
  tenantRole: 'manager',
  planFeatures: {
    'ficha-costo': true,
    productos: true,
    servicios: true,
  },
}

describe('listarProductosParaFichaAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna lista de productos con datos básicos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Harina 50kg',
        codigoInterno: 'HAR-50',
        precioCosto: 500,
        precioVenta: 800,
        esCompuesto: false,
      },
      {
        id: 'prod-2',
        nombre: 'Cigarrillos',
        codigoInterno: 'CIG-01',
        precioCosto: 200,
        precioVenta: 400,
        esCompuesto: true,
      },
    ] as any)
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      {
        servicioId: 'svc-1',
        nombre: 'Instalación',
        precio: 350,
      },
    ] as any)

    const result = await listarProductosParaFichaAction({ search: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(3)
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nombre: 'Harina 50kg',
            entityType: 'PRODUCTO',
            tipo: 'SIMPLE',
          }),
          expect.objectContaining({
            nombre: 'Cigarrillos',
            entityType: 'PRODUCTO',
            tipo: 'COMPUESTO',
          }),
          expect.objectContaining({
            nombre: 'Instalación',
            entityType: 'SERVICIO',
            tipo: 'SERVICIO',
          }),
        ]),
      )
    }
  })

  it('filtra por search en nombre o codigoInterno', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([])
    const result = await listarProductosParaFichaAction({ search: 'har' })
    expect(result.success).toBe(true)
    expect(prisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-A',
          OR: expect.any(Array),
        }),
      }),
    )
    expect(prisma.servicios.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-A',
          nombre: expect.objectContaining({ contains: 'har' }),
        }),
      }),
    )
  })

  it('retorna array vacío si no hay productos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([])
    const result = await listarProductosParaFichaAction({ search: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })
})
