import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRecetasProduccion, getRecetaProduccion, createRecetaProduccion } from './recetas'
import { ServerActionError } from '../errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    receta: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    producto: { findUnique: vi.fn() },
    recetaIngrediente: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('produccion/recetas fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u1', tenantId: 't1' })
  })

  it('getRecetasProduccion should return paginated list', async () => {
    vi.mocked(prisma.receta.findMany).mockResolvedValue([{ recetaId: 'r1', nombre: 'Receta 1' }] as any)
    vi.mocked(prisma.receta.count).mockResolvedValue(1)

    const result = await getRecetasProduccion({ page: 1, limit: 20 })
    expect(result.data).toHaveLength(1)
    expect(result.meta.total).toBe(1)
    expect(result.meta.totalPages).toBe(1)
  })

  it('getRecetaProduccion should return single receta', async () => {
    vi.mocked(prisma.receta.findUnique).mockResolvedValue({ recetaId: 'r1', nombre: 'Test' } as any)
    const result = await getRecetaProduccion('r1')
    expect(result.recetaId).toBe('r1')
  })

  it('getRecetaProduccion should throw 404 when not found', async () => {
    vi.mocked(prisma.receta.findUnique).mockResolvedValue(null)
    try {
      await getRecetaProduccion('invalid')
      expect.unreachable()
    } catch (e) {
      expect((e as ServerActionError).status).toBe(404)
    }
  })

  it('createRecetaProduccion should create receta', async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValue({ id: 'p1', precioCosto: 100 } as any)
    vi.mocked(prisma.receta.create).mockResolvedValue({ recetaId: 'new', nombre: 'Test' } as any)

    const result = await createRecetaProduccion({ nombre: 'Test', rendimiento: 1, productoId: 'p1' })
    expect(result.recetaId).toBe('new')
  })
})
