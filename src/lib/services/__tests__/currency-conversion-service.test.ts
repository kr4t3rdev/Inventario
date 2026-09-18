import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CurrencyConversionService } from '@/lib/services/currency-conversion-service'
import { ExchangeServiceError } from '@/features/contabilidad/services/exchange-types'

const provider = vi.hoisted(() => ({
  getCurrency: vi.fn(),
  getPrincipalCurrency: vi.fn(),
  getLatestRate: vi.fn(),
}))

describe('CurrencyConversionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the same amount with a 1 rate for same-currency conversions', async () => {
    provider.getCurrency.mockResolvedValue({ codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true })

    const quote = await CurrencyConversionService.quoteConversion(
      { monto: 125, monedaOrigen: 'CUP', monedaDestino: 'CUP' },
      provider,
    )

    expect(quote).toMatchObject({
      montoOriginal: 125,
      montoConvertido: 125,
      tasaAplicada: 1,
      ruta: 'same_currency',
      monedaOrigen: 'CUP',
      monedaDestino: 'CUP',
    })
  })

  it('uses the latest direct rate for a pair', async () => {
    provider.getCurrency.mockImplementation(async (codigo: string) => ({ codigo, nombre: codigo, simbolo: codigo, esPrincipal: codigo === 'CUP', isActive: true }))
    provider.getLatestRate.mockResolvedValue({ tasaId: 'rate-2', tasa: 24.75, fechaVigencia: new Date('2026-06-15T10:00:00.000Z') })

    const quote = await CurrencyConversionService.quoteConversion(
      { monto: 100, monedaOrigen: 'USD', monedaDestino: 'CUP' },
      provider,
    )

    expect(provider.getLatestRate).toHaveBeenCalledWith('USD', 'CUP')
    expect(quote).toMatchObject({
      montoConvertido: 2475,
      tasaAplicada: 24.75,
      ruta: 'direct',
      tasaId: 'rate-2',
      effectiveAt: '2026-06-15T10:00:00.000Z',
    })
  })

  it('uses the principal path when no direct rate exists', async () => {
    provider.getCurrency.mockImplementation(async (codigo: string) => ({ codigo, nombre: codigo, simbolo: codigo, esPrincipal: codigo === 'CUP', isActive: true }))
    provider.getPrincipalCurrency.mockResolvedValue({ codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true })
    provider.getLatestRate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tasaId: 'usd-cup', tasa: 120, fechaVigencia: new Date('2026-06-10T10:00:00.000Z') })
      .mockResolvedValueOnce({ tasaId: 'eur-cup', tasa: 150, fechaVigencia: new Date('2026-06-12T10:00:00.000Z') })

    const quote = await CurrencyConversionService.quoteConversion(
      { monto: 10, monedaOrigen: 'USD', monedaDestino: 'EUR' },
      provider,
    )

    expect(provider.getLatestRate).toHaveBeenNthCalledWith(1, 'USD', 'EUR')
    expect(provider.getLatestRate).toHaveBeenNthCalledWith(2, 'USD', 'CUP')
    expect(provider.getLatestRate).toHaveBeenNthCalledWith(3, 'EUR', 'CUP')
    expect(quote).toMatchObject({
      tasaAplicada: 0.8,
      montoConvertido: 8,
      ruta: 'via_principal',
    })
  })

  it('rejects inactive currencies before rate lookup', async () => {
    provider.getCurrency.mockResolvedValueOnce({ codigo: 'USD', nombre: 'USD', simbolo: '$', esPrincipal: false, isActive: false })

    await expect(
      CurrencyConversionService.quoteConversion(
        { monto: 10, monedaOrigen: 'USD', monedaDestino: 'CUP' },
        provider,
      ),
    ).rejects.toBeInstanceOf(ExchangeServiceError)
  })
})
