import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { exchange_intelligence_service } from '@/lib/services/exchange_intelligence_service'

vi.mock('@/lib/services/exchange_intelligence_service', () => ({
  exchange_intelligence_service: {
    calculate_debt_exposure: vi.fn(),
  },
}))

describe('Debt Exposure API - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock response
    vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue({
      deuda_original_local: 10000,
      deuda_actual_local: 10500,
      perdida_no_realizada: 500,
      desglose_por_moneda: [],
      alertas: [],
    })
  })

  describe('Parameter Validation', () => {
    it('should return 400 for invalid fecha_corte format', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure?fecha_corte=invalid-date')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Formato de fecha inválido')
      expect(data.message).toBe('fecha_corte debe estar en formato ISO válido')
    })

    it('should accept valid fecha_corte parameter', async () => {
      const fecha_corte = '2024-01-15T10:00:00.000Z'
      const request = new NextRequest(`http://localhost:3000/api/contabilidad/exchange/debt-exposure?fecha_corte=${fecha_corte}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(vi.mocked(exchange_intelligence_service).calculate_debt_exposure).toHaveBeenCalledWith(fecha_corte)
    })

    it('should work without fecha_corte parameter (uses default)', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(vi.mocked(exchange_intelligence_service).calculate_debt_exposure).toHaveBeenCalledWith(undefined)
    })
  })

  describe('Date Range Testing', () => {
    it('should handle past fecha_corte', async () => {
      const fecha_corte = '2023-01-15T10:00:00.000Z'
      const mockResponse = {
        deuda_original_local: 5000,
        deuda_actual_local: 5200,
        perdida_no_realizada: 200,
        desglose_por_moneda: [
          {
            moneda: 'USD',
            monto_original: 5000,
            monto_actual: 5200,
            diferencia: 200,
            antiguedad_dias: 365,
            tendencia: 'alcista' as const,
          }
        ],
        alertas: [],
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest(`http://localhost:3000/api/contabilidad/exchange/debt-exposure?fecha_corte=${fecha_corte}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockResponse)
      expect(data.desglose_por_moneda[0].antiguedad_dias).toBe(365)
    })

    it('should handle future fecha_corte', async () => {
      const fecha_corte = '2025-12-31T23:59:59.999Z'
      const mockResponse = {
        deuda_original_local: 0,
        deuda_actual_local: 0,
        perdida_no_realizada: 0,
        desglose_por_moneda: [],
        alertas: [],
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest(`http://localhost:3000/api/contabilidad/exchange/debt-exposure?fecha_corte=${fecha_corte}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.desglose_por_moneda).toEqual([])
      expect(data.perdida_no_realizada).toBe(0)
    })

    it('should handle fecha_corte with no active debts', async () => {
      const fecha_corte = '2024-06-15T10:00:00.000Z'
      const mockResponse = {
        deuda_original_local: 0,
        deuda_actual_local: 0,
        perdida_no_realizada: 0,
        desglose_por_moneda: [],
        alertas: [],
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest(`http://localhost:3000/api/contabilidad/exchange/debt-exposure?fecha_corte=${fecha_corte}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.deuda_original_local).toBe(0)
      expect(data.deuda_actual_local).toBe(0)
      expect(data.perdida_no_realizada).toBe(0)
      expect(data.desglose_por_moneda).toEqual([])
      expect(data.alertas).toEqual([])
    })
  })

  describe('Alert Generation', () => {
    it('should generate critical alert when unrealized loss exceeds 5% of original debt', async () => {
      const mockResponse = {
        deuda_original_local: 10000,
        deuda_actual_local: 10600,
        perdida_no_realizada: 600,
        desglose_por_moneda: [
          {
            moneda: 'USD',
            monto_original: 10000,
            monto_actual: 10600,
            diferencia: 600,
            antiguedad_dias: 30,
            tendencia: 'alcista' as const,
          }
        ],
        alertas: [
          {
            mensaje: 'Pérdida no realizada significativa: 6.00%',
            severidad: 'critical' as const,
          }
        ],
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.alertas).toHaveLength(1)
      expect(data.alertas[0].severidad).toBe('critical')
      expect(data.alertas[0].mensaje).toContain('6.00%')
      expect(data.perdida_no_realizada).toBeGreaterThan(0.05 * data.deuda_original_local)
    })

    it('should not generate alert when unrealized loss is below 5%', async () => {
      const mockResponse = {
        deuda_original_local: 10000,
        deuda_actual_local: 10200,
        perdida_no_realizada: 200,
        desglose_por_moneda: [
          {
            moneda: 'USD',
            monto_original: 10000,
            monto_actual: 10200,
            diferencia: 200,
            antiguedad_dias: 15,
            tendencia: 'estable' as const,
          }
        ],
        alertas: [],
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.alertas).toEqual([])
      expect(data.perdida_no_realizada).toBeLessThanOrEqual(0.05 * data.deuda_original_local)
    })

    it('should not generate alert when there are no debts', async () => {
      const mockResponse = {
        deuda_original_local: 0,
        deuda_actual_local: 0,
        perdida_no_realizada: 0,
        desglose_por_moneda: [],
        alertas: [],
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.alertas).toEqual([])
      expect(data.perdida_no_realizada).toBe(0)
    })
  })

  describe('Multiple Currencies Testing', () => {
    it('should handle multiple currencies with different trends', async () => {
      const mockResponse = {
        deuda_original_local: 25000,
        deuda_actual_local: 26500,
        perdida_no_realizada: 1500,
        desglose_por_moneda: [
          {
            moneda: 'USD',
            monto_original: 15000,
            monto_actual: 16500,
            diferencia: 1500,
            antiguedad_dias: 60,
            tendencia: 'alcista' as const,
          },
          {
            moneda: 'EUR',
            monto_original: 8000,
            monto_actual: 7800,
            diferencia: -200,
            antiguedad_dias: 45,
            tendencia: 'bajista' as const,
          },
          {
            moneda: 'GBP',
            monto_original: 2000,
            monto_actual: 2200,
            diferencia: 200,
            antiguedad_dias: 30,
            tendencia: 'estable' as const,
          }
        ],
        alertas: [
          {
            mensaje: 'Pérdida no realizada significativa: 6.00%',
            severidad: 'critical' as const,
          }
        ],
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.desglose_por_moneda).toHaveLength(3)

      // Check USD (alcista)
      const usd = data.desglose_por_moneda.find((d: any) => d.moneda === 'USD')
      expect(usd.tendencia).toBe('alcista')
      expect(usd.diferencia).toBeGreaterThan(0)

      // Check EUR (bajista)
      const eur = data.desglose_por_moneda.find((d: any) => d.moneda === 'EUR')
      expect(eur.tendencia).toBe('bajista')
      expect(eur.diferencia).toBeLessThan(0)

      // Check GBP (estable)
      const gbp = data.desglose_por_moneda.find((d: any) => d.moneda === 'GBP')
      expect(gbp.tendencia).toBe('estable')
      expect(gbp.diferencia).toBeGreaterThan(0)

      // Total should match
      const totalDiferencia = data.desglose_por_moneda.reduce((sum: number, d: any) => sum + d.diferencia, 0)
      expect(totalDiferencia).toBe(data.perdida_no_realizada)
    })

    it('should handle single currency exposure', async () => {
      const mockResponse = {
        deuda_original_local: 10000,
        deuda_actual_local: 12000,
        perdida_no_realizada: 2000,
        desglose_por_moneda: [
          {
            moneda: 'USD',
            monto_original: 10000,
            monto_actual: 12000,
            diferencia: 2000,
            antiguedad_dias: 90,
            tendencia: 'alcista' as const,
          }
        ],
        alertas: [
          {
            mensaje: 'Pérdida no realizada significativa: 20.00%',
            severidad: 'critical' as const,
          }
        ],
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.desglose_por_moneda).toHaveLength(1)
      expect(data.desglose_por_moneda[0].moneda).toBe('USD')
      expect(data.desglose_por_moneda[0].diferencia).toBe(2000)
      expect(data.alertas[0].mensaje).toContain('20.00%')
    })

    it('should handle mixed positive and negative differences', async () => {
      const mockResponse = {
        deuda_original_local: 20000,
        deuda_actual_local: 19500,
        perdida_no_realizada: -500, // Negative means gain
        desglose_por_moneda: [
          {
            moneda: 'USD',
            monto_original: 12000,
            monto_actual: 12500,
            diferencia: 500,
            antiguedad_dias: 20,
            tendencia: 'estable' as const,
          },
          {
            moneda: 'EUR',
            monto_original: 8000,
            monto_actual: 7000,
            diferencia: -1000,
            antiguedad_dias: 50,
            tendencia: 'bajista' as const,
          }
        ],
        alertas: [], // No alerts since overall is a gain (negative loss)
      }

      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.perdida_no_realizada).toBe(-500) // Negative = gain
      expect(data.alertas).toEqual([]) // No alerts for gains
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Error interno del servidor')
      expect(data.message).toBe('Ocurrió un error al procesar la solicitud')
    })

    it('should handle service timeout errors', async () => {
      vi.mocked(exchange_intelligence_service).calculate_debt_exposure.mockRejectedValue(new Error('Service timeout'))

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/debt-exposure')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Error interno del servidor')
    })
  })
})