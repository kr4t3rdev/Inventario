import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOrdenesReparacion, getOrdenReparacion, addOrdenReparacion, updateOrdenReparacion, deleteOrdenReparacion } from './ordenes'
import { ServerActionError } from '../errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    ordenReparacion: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    cloudinaryAsset: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('reparaciones/ordenes fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u1', tenantId: 't1', tenantRole: 'admin' })
  })

  it('getOrdenesReparacion should return list', async () => {
    vi.mocked(prisma.ordenReparacion.findMany).mockResolvedValue([{ id: 'o1', numeroOrden: 1 }] as any)
    const result = await getOrdenesReparacion()
    expect(result).toHaveLength(1)
    expect(prisma.ordenReparacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } })
    )
  })

  it('getOrdenReparacion should return single order', async () => {
    vi.mocked(prisma.ordenReparacion.findUnique).mockResolvedValue({ id: 'o1', cliente: {} } as any)
    vi.mocked(prisma.cloudinaryAsset.findMany).mockResolvedValue([] as any)
    const result = await getOrdenReparacion('o1')
    expect(result.id).toBe('o1')
  })

  it('getOrdenReparacion should throw 404 when not found', async () => {
    vi.mocked(prisma.ordenReparacion.findUnique).mockResolvedValue(null)
    try {
      await getOrdenReparacion('invalid')
      expect.unreachable()
    } catch (e) {
      expect((e as ServerActionError).status).toBe(404)
    }
  })

  it('deleteOrdenReparacion should reject non-admin', async () => {
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u2', tenantId: 't1', tenantRole: 'dependiente' })
    try {
      await deleteOrdenReparacion('o1')
      expect.unreachable()
    } catch (e) {
      expect((e as ServerActionError).status).toBe(403)
    }
  })
})
