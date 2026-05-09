import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRF } from './reportes-financieros'
import { ServerActionError } from '@/lib/api/errors'

vi.mock('@/lib/api/reportes-financieros', () => ({
  getRF: vi.fn(),
}))

import * as fetcher from '@/lib/api/reportes-financieros'

describe('reportes-financieros Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return report from fetcher', async () => {
    const mockReport = { totalIngresos: 1000, totalGastos: 500, cantidadVentas: 5 }
    vi.mocked(fetcher.getRF).mockResolvedValue(mockReport as any)

    const result = await getRF()

    expect(result).toEqual(mockReport)
    expect(fetcher.getRF).toHaveBeenCalledOnce()
  })

  it('should propagate ServerActionError', async () => {
    vi.mocked(fetcher.getRF).mockRejectedValue(
      new ServerActionError('getRF', 'GET', 500, 'DB error')
    )

    try {
      await getRF()
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).status).toBe(500)
    }
  })
})
