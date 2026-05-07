/**
 * @fileoverview Integration tests para el endpoint GET /api/contabilidad/exchange/payment-efficiency
 * Valida la API de eficiencia de pagos con mocks del servicio
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { exchange_intelligence_service } from '@/lib/services/exchange_intelligence_service'

vi.mock('@/lib/services/exchange_intelligence_service', () => ({
  exchange_intelligence_service: {
    calculate_payment_efficiency: vi.fn(),
  },
}))

describe('Payment Efficiency API - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock response
    vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue({
      transacciones: [],
      spread_promedio: 0,
      mejor_tasa: 0,
      peor_tasa: 0,
      transacciones_superiores_promedio: [],
      recomendacion_renegociacion: false,
    })
  })

  describe('Parameter Validation', () => {
    it('should return 400 when fecha_inicio is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Parámetros requeridos faltantes')
      expect(data.message).toBe('fecha_inicio y fecha_fin son obligatorios')
    })

    it('should return 400 when fecha_fin is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Parámetros requeridos faltantes')
      expect(data.message).toBe('fecha_inicio y fecha_fin son obligatorios')
    })

    it('should return 400 when both dates are missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Parámetros requeridos faltantes')
      expect(data.message).toBe('fecha_inicio y fecha_fin son obligatorios')
    })

    it('should return 400 for invalid fecha_inicio format', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=invalid&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Formato de fecha inválido')
      expect(data.message).toBe('Las fechas deben estar en formato ISO válido')
    })

    it('should return 400 for invalid fecha_fin format', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=invalid')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Formato de fecha inválido')
      expect(data.message).toBe('Las fechas deben estar en formato ISO válido')
    })

    it('should return 400 for completely invalid date string', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=not-a-date&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Formato de fecha inválido')
    })

    it('should return 400 when fecha_inicio is after fecha_fin', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-31&fecha_fin=2024-01-01')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Rango de fechas inválido')
      expect(data.message).toBe('La fecha de inicio debe ser anterior a la fecha de fin')
    })

    it('should return 400 when period exceeds maximum (365 days)', async () => {
      // 366 days period (exceeds 365 limit)
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2023-01-01&fecha_fin=2024-01-02')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Período demasiado extenso')
      expect(data.message).toBe('El período máximo permitido es de 365 días')
    })

    it('should accept exactly 365 days period', async () => {
      const mockResponse = {
        transacciones: [],
        spread_promedio: 0,
        mejor_tasa: 0,
        peor_tasa: 0,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      // Exactly 365 days
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-12-31')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Currency Filter Testing', () => {
    it('should filter transactions by USD currency', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-15',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 165,
            spread_bancario: 3.125,
          },
        ],
        spread_promedio: 3.125,
        mejor_tasa: 165,
        peor_tasa: 165,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: true,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&moneda=USD')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transacciones[0].moneda).toBe('USD')
      expect(vi.mocked(exchange_intelligence_service).calculate_payment_efficiency).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        'USD'
      )
    })

    it('should filter transactions by EUR currency', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-15',
            moneda: 'EUR',
            monto: 5000,
            tasa_oficial: 175,
            tasa_real: 180,
            spread_bancario: 2.857,
          },
        ],
        spread_promedio: 2.857,
        mejor_tasa: 180,
        peor_tasa: 180,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&moneda=EUR')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transacciones[0].moneda).toBe('EUR')
      expect(vi.mocked(exchange_intelligence_service).calculate_payment_efficiency).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        'EUR'
      )
    })

    it('should return 400 for invalid currency code', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&moneda=ABC')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Moneda no válida')
      expect(data.message).toContain('USD')
      expect(data.message).toContain('EUR')
    })

    it('should handle currency in lowercase', async () => {
      const mockResponse = {
        transacciones: [],
        spread_promedio: 0,
        mejor_tasa: 0,
        peor_tasa: 0,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&moneda=usd')

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(exchange_intelligence_service).calculate_payment_efficiency).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31',
        'usd'
      )
    })
  })

  describe('Recommendation Generation (Spread > 3%)', () => {
    it('should generate renegotiation recommendation when spread > 3%', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-15',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 168,
            spread_bancario: 5.0,
          },
          {
            fecha: '2024-01-20',
            moneda: 'USD',
            monto: 15000,
            tasa_oficial: 162,
            tasa_real: 170,
            spread_bancario: 4.938,
          },
        ],
        spread_promedio: 4.96,
        mejor_tasa: 168,
        peor_tasa: 170,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: true,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.recomendacion_renegociacion).toBe(true)
      expect(data.spread_promedio).toBeGreaterThan(3)
    })

    it('should NOT generate recommendation when spread is exactly 3%', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-15',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 164.8,
            spread_bancario: 3.0,
          },
        ],
        spread_promedio: 3.0,
        mejor_tasa: 164.8,
        peor_tasa: 164.8,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.recomendacion_renegociacion).toBe(false)
      expect(data.spread_promedio).toBe(3)
    })

    it('should NOT generate recommendation when spread < 3%', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-15',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 164,
            spread_bancario: 2.5,
          },
        ],
        spread_promedio: 2.5,
        mejor_tasa: 164,
        peor_tasa: 164,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.recomendacion_renegociacion).toBe(false)
      expect(data.spread_promedio).toBeLessThan(3)
    })

    it('should identify transactions with spread above average', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-15',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 164,
            spread_bancario: 2.5,
          },
          {
            fecha: '2024-01-20',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 172,
            spread_bancario: 7.5,
          },
        ],
        spread_promedio: 5.0,
        mejor_tasa: 164,
        peor_tasa: 172,
        transacciones_superiores_promedio: [
          {
            fecha: '2024-01-20',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 172,
            spread_bancario: 7.5,
          },
        ],
        recomendacion_renegociacion: true,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transacciones_superiores_promedio.length).toBe(1)
      expect(data.transacciones_superiores_promedio[0].spread_bancario).toBeGreaterThan(data.spread_promedio)
    })
  })

  describe('Period Testing', () => {
    it('should handle short period (30 days)', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-15',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 165,
            spread_bancario: 3.125,
          },
        ],
        spread_promedio: 3.125,
        mejor_tasa: 165,
        peor_tasa: 165,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: true,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transacciones.length).toBe(1)
    })

    it('should handle medium period (90 days)', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-15',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 160,
            tasa_real: 165,
            spread_bancario: 3.125,
          },
          {
            fecha: '2024-02-15',
            moneda: 'USD',
            monto: 15000,
            tasa_oficial: 162,
            tasa_real: 168,
            spread_bancario: 3.704,
          },
          {
            fecha: '2024-03-15',
            moneda: 'USD',
            monto: 20000,
            tasa_oficial: 165,
            tasa_real: 170,
            spread_bancario: 3.03,
          },
        ],
        spread_promedio: 3.26,
        mejor_tasa: 165,
        peor_tasa: 170,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: true,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-03-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transacciones.length).toBe(3)
    })

    it('should handle long period (1 year, exactly 365 days)', async () => {
      const mockResponse = {
        transacciones: [
          {
            fecha: '2024-01-01',
            moneda: 'USD',
            monto: 10000,
            tasa_oficial: 155,
            tasa_real: 160,
            spread_bancario: 3.226,
          },
        ],
        spread_promedio: 3.226,
        mejor_tasa: 160,
        peor_tasa: 160,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: true,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-12-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockResponse)
    })

    it('should reject period exceeding 365 days', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2023-01-01&fecha_fin=2024-01-02')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Período demasiado extenso')
    })
  })

  describe('No Transactions Response', () => {
    it('should return empty array when no transactions exist', async () => {
      const mockResponse = {
        transacciones: [],
        spread_promedio: 0,
        mejor_tasa: 0,
        peor_tasa: 0,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transacciones).toEqual([])
      expect(data.spread_promedio).toBe(0)
      expect(data.recomendacion_renegociacion).toBe(false)
    })

    it('should return empty array when no transactions for specific currency', async () => {
      const mockResponse = {
        transacciones: [],
        spread_promedio: 0,
        mejor_tasa: 0,
        peor_tasa: 0,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&moneda=GBP')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.transacciones).toEqual([])
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Error interno del servidor')
    })

    it('should handle validation errors from service', async () => {
      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockRejectedValue(new Error('La fecha de inicio debe ser anterior a la fecha de fin'))

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Error de validación')
    })
  })

  describe('Date Format Handling', () => {
    it('should handle ISO date format with time', async () => {
      const mockResponse = {
        transacciones: [],
        spread_promedio: 0,
        mejor_tasa: 0,
        peor_tasa: 0,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01T00:00:00Z&fecha_fin=2024-01-31T23:59:59Z')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should handle date-only format', async () => {
      const mockResponse = {
        transacciones: [],
        spread_promedio: 0,
        mejor_tasa: 0,
        peor_tasa: 0,
        transacciones_superiores_promedio: [],
        recomendacion_renegociacion: false,
      }

      vi.mocked(exchange_intelligence_service).calculate_payment_efficiency.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/payment-efficiency?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })
})
