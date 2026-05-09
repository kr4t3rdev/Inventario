import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPiezaReparacion, updatePiezaReparacion, deletePiezaReparacion } from './piezas'
import { ServerActionError } from '../errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    piezaReparacion: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('reparaciones/piezas fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u1', tenantId: 't1', tenantRole: 'admin' })
  })

  it('should create pieza', async () => {
    const mockPieza = { id: 'p1', nombre: 'Pieza 1', equipoId: 'e1' }
    vi.mocked(prisma.piezaReparacion.create).mockResolvedValue(mockPieza as any)
    const result = await createPiezaReparacion({ nombre: 'Pieza 1', equipoId: 'e1', costoPequeno: 10, costoMediano: 20, costoGrande: 30 } as any)
    expect(result.id).toBe('p1')
  })

  it('should update pieza', async () => {
    const updated = { id: 'p1', nombre: 'Updated' }
    vi.mocked(prisma.piezaReparacion.update).mockResolvedValue(updated as any)
    const result = await updatePiezaReparacion('p1', { nombre: 'Updated' } as any)
    expect(result.id).toBe('p1')
  })

  it('should delete pieza', async () => {
    vi.mocked(prisma.piezaReparacion.delete).mockResolvedValue({ id: 'p1' } as any)
    const result = await deletePiezaReparacion('p1')
    expect(result.success).toBe(true)
    expect(result.id).toBe('p1')
  })
})
