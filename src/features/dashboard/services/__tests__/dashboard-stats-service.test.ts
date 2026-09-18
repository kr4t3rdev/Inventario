import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/dashboard/queries', () => ({
  getDashboardStatsQuery: vi.fn(),
}))

import type { DashboardStats } from '@/features/dashboard/queries'
import { getDashboardStatsQuery } from '@/features/dashboard/queries'
import { getDashboardStatsData, invalidateDashboardStatsCache } from '../dashboard-stats-service'

const dashboardStatsFixture = {
  totalProductos: 3,
  totalAlmacenes: 1,
  totalPuntosVenta: 1,
  totalVentas: 2,
  totalMermas: 0,
  totalTransferencias: 0,
  totalIngresos: 100,
  totalGastosMermas: 0,
  totalBeneficio: 100,
  valorTotalInventario: 42,
  datosPorMes: [{ mes: 'Junio', ventas: 2 }],
  datosPorSemana: [{ semana: 'Semana 1', ventas: 2 }],
  ventasDiarias: {
    ventasHoy: 0,
    ingresosHoy: 0,
    ventasAyer: 0,
    ingresosAyer: 0,
    promedioVentasDiarias: 0,
    promedioIngresosDiarios: 0,
    diasConVentas: 0,
    totalDias: 0,
    totalIngresosPeriodo: 0,
    totalCantidadPeriodo: 0,
  },
  productosMasVendidos: [{ productoId: 'prod-1', cantidad: 2 }],
  productosStockBajo: [{ productoId: 'prod-2', stock: 4 }],
  distribucionStock: [{ categoria: 'Básicos', productos: 2, stockTotal: 4, valorTotal: 42 }],
  transferenciasStats: {
    almacenAAlmacen: 0,
    almacenAPuntoVenta: 0,
    puntoVentaAAlmacen: 0,
    puntoVentaAPuntoVenta: 0,
  },
} satisfies DashboardStats

describe('dashboard-stats-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateDashboardStatsCache()
  })

  it('delegates dashboard calculations to the shared query and caches the result', async () => {
    vi.mocked(getDashboardStatsQuery).mockResolvedValue(dashboardStatsFixture)

    const first = await getDashboardStatsData({
      tenantId: 'tenant-1',
      ubicacionId: 'alm-1',
      tipoUbicacion: 'almacen',
    })
    const second = await getDashboardStatsData({
      tenantId: 'tenant-1',
      ubicacionId: 'alm-1',
      tipoUbicacion: 'almacen',
    })

    expect(first).toStrictEqual(dashboardStatsFixture)
    expect(second).toStrictEqual(dashboardStatsFixture)
    expect(vi.mocked(getDashboardStatsQuery)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(getDashboardStatsQuery)).toHaveBeenCalledWith('tenant-1', {
      ubicacionId: 'alm-1',
      tipoUbicacion: 'almacen',
    })
  })
})
