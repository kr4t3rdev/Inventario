import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDefectaciones, createDefectacion, updateDefectacion, deleteDefectacion } from './defectaciones'
import { ServerActionError } from '../errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    defectacionCatalogo: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('reparaciones/defectaciones fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u1', tenantId: 't1' })
  })

  it('getDefectaciones should return list scoped to tenant', async () => {
    vi.mocked(prisma.defectacionCatalogo.findMany).mockResolvedValue([{ id: 'd1', defecto: 'Roto' }] as any)
    const result = await getDefectaciones()
    expect(result).toHaveLength(1)
    expect(prisma.defectacionCatalogo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } })
    )
  })

  it('createDefectacion should create defecto', async () => {
    vi.mocked(prisma.defectacionCatalogo.create).mockResolvedValue({ id: 'd1', defecto: 'Nuevo', costo: 50 } as any)
    const result = await createDefectacion({ defecto: 'Nuevo', costo: 50 })
    expect(result.id).toBe('d1')
  })

  it('updateDefectacion should update defecto', async () => {
    vi.mocked(prisma.defectacionCatalogo.update).mockResolvedValue({ id: 'd1', defecto: 'Updated', costo: 100 } as any)
    const result = await updateDefectacion('d1', { defecto: 'Updated', costo: 100 })
    expect(result.id).toBe('d1')
  })

  it('deleteDefectacion should delete defecto', async () => {
    vi.mocked(prisma.defectacionCatalogo.delete).mockResolvedValue({ id: 'd1' } as any)
    const result = await deleteDefectacion('d1')
    expect(result.success).toBe(true)
    expect(result.id).toBe('d1')
  })
})
