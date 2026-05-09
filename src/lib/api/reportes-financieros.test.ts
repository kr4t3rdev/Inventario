import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRF, createRF } from './reportes-financieros'
import { ServerActionError } from './errors'

vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    venta: { findMany: vi.fn() },
    gastoCompra: { findMany: vi.fn() },
    empleado: { findMany: vi.fn() },
    gastosDE: { findMany: vi.fn() },
    merma: { findMany: vi.fn() },
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'

describe('reportes-financieros fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'user-1' })
  })

  describe('getRF', () => {
    it('should return financial report for current period', async () => {
      const now = new Date()
      const mockVentas = [
        { cantidad: 2, producto: { id: 'p1', nombre: 'Prod1', precioVenta: 100, precioCosto: 50 } },
        { cantidad: 1, producto: { id: 'p2', nombre: 'Prod2', precioVenta: 200, precioCosto: 120 } },
      ]
      const mockGastosCompra = [{ total: 500 }, { total: 300 }]
      const mockEmpleados = [{ empleadoId: 'e1', nombre: 'A', apellido: 'B', salarioBases: 1000 }]
      const mockGastosDE = [{ monto: 200 }, { monto: 150 }]
      const mockMermas = [{ cantidad: 3, costoTotal: 50 }]

      vi.mocked(prisma.venta.findMany).mockResolvedValue(mockVentas as any)
      vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue(mockGastosCompra as any)
      vi.mocked(prisma.empleado.findMany).mockResolvedValue(mockEmpleados as any)
      vi.mocked(prisma.gastosDE.findMany).mockResolvedValue(mockGastosDE as any)
      vi.mocked(prisma.merma.findMany).mockResolvedValue(mockMermas as any)

      const result = await getRF()

      // ingresos: 2*100 + 1*200 = 400
      // gastosCompra: 500 + 300 = 800
      // gastosSalarios: 1000
      // gastosServicios: 200 + 150 = 350
      // gastosMermas: 3 * 50 = 150
      // totalIngresos: 400
      // totalGastos: 800 + 1000 + 350 + 150 = 2300
      expect(result.totalIngresos).toBe(400)
      expect(result.totalGastos).toBe(2300)
      expect(result.cantidadVentas).toBe(2)
      expect(result.periodo).toBe(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    })

    it('should return zeroes when no data exists', async () => {
      vi.mocked(prisma.venta.findMany).mockResolvedValue([])
      vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])
      vi.mocked(prisma.empleado.findMany).mockResolvedValue([])
      vi.mocked(prisma.gastosDE.findMany).mockResolvedValue([])
      vi.mocked(prisma.merma.findMany).mockResolvedValue([])

      const result = await getRF()
      expect(result.totalIngresos).toBe(0)
      expect(result.totalGastos).toBe(0)
      expect(result.cantidadVentas).toBe(0)
    })

    it('should throw ServerActionError on prisma failure', async () => {
      vi.mocked(prisma.venta.findMany).mockRejectedValue(new Error('DB down'))
      vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([])
      vi.mocked(prisma.empleado.findMany).mockResolvedValue([])
      vi.mocked(prisma.gastosDE.findMany).mockResolvedValue([])
      vi.mocked(prisma.merma.findMany).mockResolvedValue([])

      try {
        await getRF()
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ServerActionError)
        expect((error as ServerActionError).status).toBe(500)
      }
    })
  })
})
