import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { exchange_intelligence_service } from '@/lib/services/exchange_intelligence_service'

vi.mock('@/lib/services/exchange_intelligence_service', () => ({
  exchange_intelligence_service: {
    calculate_cost_impact: vi.fn(),
  },
}))

describe('Cost Impact API - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock response
    vi.mocked(exchange_intelligence_service).calculate_cost_impact.mockResolvedValue({
      timeline: [],
      resumen: {
        incremento_promedio: 0,
        productos_afectados: 0,
        alerta_ajuste_precios: false,
      },
    })
  })

  describe('Parameter Validation', () => {
    it('should return 400 when fecha_inicio is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Parámetros requeridos faltantes')
      expect(data.message).toBe('fecha_inicio y fecha_fin son obligatorios')
    })

    it('should return 400 when fecha_fin is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Parámetros requeridos faltantes')
      expect(data.message).toBe('fecha_inicio y fecha_fin son obligatorios')
    })

    it('should return 400 when both dates are missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Parámetros requeridos faltantes')
      expect(data.message).toBe('fecha_inicio y fecha_fin son obligatorios')
    })

    it('should return 400 for invalid fecha_inicio format', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=invalid&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Formato de fecha inválido')
      expect(data.message).toBe('Las fechas deben estar en formato ISO válido')
    })

    it('should return 400 for invalid fecha_fin format', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=invalid')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Formato de fecha inválido')
      expect(data.message).toBe('Las fechas deben estar en formato ISO válido')
    })

    it('should return 400 when fecha_inicio is after fecha_fin', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-31&fecha_fin=2024-01-01')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Rango de fechas inválido')
      expect(data.message).toBe('La fecha de inicio debe ser anterior a la fecha de fin')
    })
  })

  describe('Date Range Testing', () => {
    it('should handle short date range (1 day)', async () => {
      const mockResponse = {
        timeline: [
          {
            fecha: '2024-01-01',
            costo_historico: 1000,
            costo_reposicion: 1250,
            diferencia_porcentual: 25,
          }
        ],
        resumen: {
          incremento_promedio: 25,
          productos_afectados: 1,
          alerta_ajuste_precios: true,
        },
      }

      vi.mocked(exchange_intelligence_service).calculate_cost_impact.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-01')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockResponse)
      expect(vi.mocked(exchange_intelligence_service).calculate_cost_impact).toHaveBeenCalledWith('2024-01-01', '2024-01-01', {
        categoria_id: undefined,
        almacen_id: undefined,
        vendor_id: undefined,
      })
    })

    it('should handle long date range (1 year)', async () => {
      const mockResponse = {
        timeline: [
          {
            fecha: '2023-01-01',
            costo_historico: 1000,
            costo_reposicion: 1250,
            diferencia_porcentual: 25,
          },
          {
            fecha: '2023-06-01',
            costo_historico: 1200,
            costo_reposicion: 1500,
            diferencia_porcentual: 25,
          }
        ],
        resumen: {
          incremento_promedio: 25,
          productos_afectados: 1,
          alerta_ajuste_precios: true,
        },
      }

      vi.mocked(exchange_intelligence_service).calculate_cost_impact.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2023-01-01&fecha_fin=2023-12-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.timeline.length).toBeGreaterThan(0)
    })

    it('should handle date range with no purchases', async () => {
      const mockResponse = {
        timeline: [],
        resumen: {
          incremento_promedio: 0,
          productos_afectados: 0,
          alerta_ajuste_precios: false,
        },
      }

      vi.mocked(exchange_intelligence_service).calculate_cost_impact.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.timeline).toEqual([])
      expect(data.resumen.incremento_promedio).toBe(0)
      expect(data.resumen.productos_afectados).toBe(0)
      expect(data.resumen.alerta_ajuste_precios).toBe(false)
    })
  })

  describe('Filter Application', () => {
    it('should apply categoria_id filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&categoria_id=cat1')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(vi.mocked(exchange_intelligence_service).calculate_cost_impact).toHaveBeenCalledWith('2024-01-01', '2024-01-31', {
        categoria_id: 'cat1',
        almacen_id: undefined,
        vendor_id: undefined,
      })
    })

    it('should apply almacen_id filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&almacen_id=alm1')

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(exchange_intelligence_service).calculate_cost_impact).toHaveBeenCalledWith('2024-01-01', '2024-01-31', {
        categoria_id: undefined,
        almacen_id: 'alm1',
        vendor_id: undefined,
      })
    })

    it('should apply vendor_id filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&vendor_id=ven1')

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(exchange_intelligence_service).calculate_cost_impact).toHaveBeenCalledWith('2024-01-01', '2024-01-31', {
        categoria_id: undefined,
        almacen_id: undefined,
        vendor_id: 'ven1',
      })
    })

    it('should apply multiple filters simultaneously', async () => {
      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31&categoria_id=cat1&almacen_id=alm1&vendor_id=ven1')

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(exchange_intelligence_service).calculate_cost_impact).toHaveBeenCalledWith('2024-01-01', '2024-01-31', {
        categoria_id: 'cat1',
        almacen_id: 'alm1',
        vendor_id: 'ven1',
      })
    })
  })

  describe('Alert Generation', () => {
    it('should generate alert when average increase exceeds 10%', async () => {
      const mockResponse = {
        timeline: [
          {
            fecha: '2024-01-01',
            costo_historico: 1000,
            costo_reposicion: 1250,
            diferencia_porcentual: 25,
          }
        ],
        resumen: {
          incremento_promedio: 25,
          productos_afectados: 1,
          alerta_ajuste_precios: true,
        },
      }

      vi.mocked(exchange_intelligence_service).calculate_cost_impact.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.resumen.alerta_ajuste_precios).toBe(true)
      expect(data.resumen.incremento_promedio).toBeGreaterThan(10)
    })

    it('should not generate alert when average increase is below 10%', async () => {
      const mockResponse = {
        timeline: [
          {
            fecha: '2024-01-01',
            costo_historico: 1000,
            costo_reposicion: 1050,
            diferencia_porcentual: 5,
          }
        ],
        resumen: {
          incremento_promedio: 5,
          productos_afectados: 1,
          alerta_ajuste_precios: false,
        },
      }

      vi.mocked(exchange_intelligence_service).calculate_cost_impact.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.resumen.alerta_ajuste_precios).toBe(false)
      expect(data.resumen.incremento_promedio).toBeLessThanOrEqual(10)
    })

    it('should not generate alert when there are no products', async () => {
      const mockResponse = {
        timeline: [],
        resumen: {
          incremento_promedio: 0,
          productos_afectados: 0,
          alerta_ajuste_precios: false,
        },
      }

      vi.mocked(exchange_intelligence_service).calculate_cost_impact.mockResolvedValue(mockResponse)

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.resumen.alerta_ajuste_precios).toBe(false)
      expect(data.resumen.incremento_promedio).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(exchange_intelligence_service).calculate_cost_impact.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/contabilidad/exchange/cost-impact?fecha_inicio=2024-01-01&fecha_fin=2024-01-31')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Error interno del servidor')
      expect(data.message).toBe('Ocurrió un error al procesar la solicitud')
    })
  })
})