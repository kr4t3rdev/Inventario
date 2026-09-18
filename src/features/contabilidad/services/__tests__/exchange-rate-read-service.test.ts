import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExchangeRateReadService } from '@/features/contabilidad/services/exchange-rate-read-service'

const provider = vi.hoisted(() => ({
  listCurrencies: vi.fn(),
  getCurrentRates: vi.fn(),
  getRateHistory: vi.fn(),
}))

describe('ExchangeRateReadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns history rows with provenance and deterministic ordering', async () => {
    provider.getRateHistory.mockResolvedValue({
      tasas: [
        {
          tasaId: 'rate-2',
          monedaOrigenId: 'USD',
          monedaDestino: 'CUP',
          tasa: 24.75,
          fechaVigencia: '2026-06-15T10:00:00.000Z',
          creadoPor: 'Sistema',
          provenance: 'Sistema',
        },
        {
          tasaId: 'rate-1',
          monedaOrigenId: 'USD',
          monedaDestino: 'CUP',
          tasa: 24.5,
          fechaVigencia: '2026-06-14T10:00:00.000Z',
          creadoPor: 'Sistema',
          provenance: 'Sistema',
        },
      ],
      total: 2,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })

    const service = new ExchangeRateReadService(provider)
    const result = await service.getHistorialTasas({ monedaOrigen: 'USD' })

    expect(provider.getRateHistory).toHaveBeenCalledWith({ monedaOrigen: 'USD' })
    expect(result.tasas[0]).toMatchObject({
      tasaId: 'rate-2',
      tasa: 24.75,
      provenance: 'Sistema',
    })
  })
})
