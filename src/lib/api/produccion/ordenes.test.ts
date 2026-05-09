import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOrdenesProduccion, getOrdenProduccion, createOrdenProduccion, aprobarOrdenProduccion, completarOrdenProduccion, cancelarOrdenProduccion } from './ordenes'
import { ServerActionError } from '../errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    ordenProduccion: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('produccion/ordenes fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u1', tenantId: 't1' })
  })

  it('getOrdenesProduccion should return paginated list with stats', async () => {
    vi.mocked(prisma.ordenProduccion.findMany).mockResolvedValue([{ ordenProduccionId: 'o1' }] as any)
    vi.mocked(prisma.ordenProduccion.count)
      .mockResolvedValueOnce(10)  // total
      .mockResolvedValueOnce(5)   // pendientes
      .mockResolvedValueOnce(3)   // enProceso
      .mockResolvedValueOnce(2)   // completadas

    const result = await getOrdenesProduccion({ page: 1 })
    expect(result.data).toHaveLength(1)
    expect(result.meta.stats.pendientes).toBe(5)
    expect(result.meta.stats.enProceso).toBe(3)
  })

  it('getOrdenProduccion should return single order', async () => {
    vi.mocked(prisma.ordenProduccion.findUnique).mockResolvedValue({ ordenProduccionId: 'o1', estado: 'PENDIENTE' } as any)
    const result = await getOrdenProduccion('o1')
    expect(result.ordenProduccionId).toBe('o1')
  })

  it('createOrdenProduccion should create order', async () => {
    vi.mocked(prisma.ordenProduccion.create).mockResolvedValue({ ordenProduccionId: 'new', estado: 'PENDIENTE' } as any)
    const result = await createOrdenProduccion({ recetaId: 'r1', cantidad: 10 })
    expect(result.ordenProduccionId).toBe('new')
  })

  it('aprobarOrdenProduccion should transition to EN_PROCESO', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        ordenProduccion: { findUnique: vi.fn().mockResolvedValue({ estado: 'PENDIENTE' }), update: vi.fn().mockResolvedValue({ estado: 'EN_PROCESO' }) },
        ordenProduccionHistorial: { create: vi.fn() },
      }
      return cb(tx)
    })

    const result = await aprobarOrdenProduccion({ ordenProduccionId: 'o1' })
    expect(result).toBeDefined()
  })

  it('cancelarOrdenProduccion should transition to CANCELADA', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        ordenProduccion: { findUnique: vi.fn().mockResolvedValue({ estado: 'PENDIENTE' }), update: vi.fn().mockResolvedValue({ estado: 'CANCELADA' }) },
        ordenProduccionHistorial: { create: vi.fn() },
      }
      return cb(tx)
    })

    const result = await cancelarOrdenProduccion({ ordenProduccionId: 'o1', observaciones: 'Test' })
    expect(result).toBeDefined()
  })
})
