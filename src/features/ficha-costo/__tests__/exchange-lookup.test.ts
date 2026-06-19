import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tasaCambio: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { precargarTasas, lookupFromCache } from '../lib/exchange-lookup'

describe('exchange-lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('precarga la tasa más reciente por moneda y la sirve en el lookup', async () => {
    vi.mocked(prisma.tasaCambio.findMany).mockResolvedValue([
      {
        tasaId: 't-1',
        monedaOrigenId: 'USD',
        monedaDestino: 'CUP',
        tasa: '120' as any,
        fechaVigencia: new Date('2026-06-15'),
        createdAt: new Date('2026-06-15'),
        updatedAt: new Date('2026-06-15'),
      },
      {
        tasaId: 't-2',
        monedaOrigenId: 'USD',
        monedaDestino: 'CUP',
        tasa: '110' as any,
        fechaVigencia: new Date('2026-05-01'),
        createdAt: new Date('2026-05-01'),
        updatedAt: new Date('2026-05-01'),
      },
    ] as any)

    const cache = await precargarTasas(['USD'], 'CUP')
    const lookup = lookupFromCache(cache)
    const r = lookup(new Date('2026-06-20'), 'USD', 'CUP')
    expect(r).not.toBeNull()
    expect(r?.tasa).toBe(120)
  })

  it('retorna null cuando no hay tasa para la moneda origen', async () => {
    vi.mocked(prisma.tasaCambio.findMany).mockResolvedValue([])
    const cache = await precargarTasas(['EUR'], 'CUP')
    const lookup = lookupFromCache(cache)
    expect(lookup(new Date(), 'EUR', 'CUP')).toBeNull()
  })

  it('short-circuit cuando origen === destino', async () => {
    const cache = await precargarTasas([], 'CUP')
    const lookup = lookupFromCache(cache)
    const r = lookup(new Date('2026-06-15'), 'CUP', 'CUP')
    expect(r?.tasa).toBe(1)
  })
})
