import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getConceptos, getValesSalida, getValeSalida, createValeSalida, updateValeSalida, anularValeSalida } from './vales'
import { ServerActionError } from '../errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    gastosDE: { findMany: vi.fn() },
    valeSalida: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('produccion/vales fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'u1', tenantId: 't1' })
  })

  it('getConceptos should return distinct concept list', async () => {
    vi.mocked(prisma.gastosDE.findMany).mockResolvedValue([{ concepto: 'Merma' }, { concepto: 'Consumo' }] as any)
    const result = await getConceptos()
    expect(result).toEqual(['Merma', 'Consumo'])
    expect(prisma.gastosDE.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1' },
      }),
    )
  })

  it('getValesSalida should return list with items', async () => {
    vi.mocked(prisma.valeSalida.findMany).mockResolvedValue([{ valeSalidaId: 'v1', concepto: 'Test' }] as any)
    const result = await getValesSalida()
    expect(result).toHaveLength(1)
  })

  it('getValeSalida should return single vale', async () => {
    vi.mocked(prisma.valeSalida.findUnique).mockResolvedValue({ valeSalidaId: 'v1' } as any)
    const result = await getValeSalida('v1')
    expect(result.valeSalidaId).toBe('v1')
  })

  it('getValeSalida should throw 404 when not found', async () => {
    vi.mocked(prisma.valeSalida.findUnique).mockResolvedValue(null)
    try {
      await getValeSalida('invalid')
      expect.unreachable()
    } catch (e) {
      expect((e as ServerActionError).status).toBe(404)
    }
  })

  it('createValeSalida should create vale with items', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        valeSalida: {
          create: vi.fn().mockReturnValue({ valeSalidaId: 'new' }),
          findUnique: vi.fn().mockResolvedValue({ valeSalidaId: 'new', items: [] }),
        },
        valeSalidaItem: { createMany: vi.fn() },
      }
      return cb(tx)
    })

    const result = await createValeSalida({ concepto: 'Test', items: [{ productoId: 'p1', cantidad: 5 }] })
    expect(result).toBeDefined()
  })

  it('updateValeSalida should patch vale', async () => {
    vi.mocked(prisma.valeSalida.update).mockResolvedValue({ valeSalidaId: 'v1', concepto: 'Updated' } as any)
    const result = await updateValeSalida('v1', { concepto: 'Updated' })
    expect(result.valeSalidaId).toBe('v1')
  })

  it('anularValeSalida should delete vale', async () => {
    vi.mocked(prisma.valeSalida.delete).mockResolvedValue({} as any)
    const result = await anularValeSalida('v1')
    expect(result.success).toBe(true)
  })
})
