import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@/features/admin', () => ({
  getAdminFinanceAction: vi.fn(),
}))

import { getAdminFinanceAction } from '@/features/admin'
import FinanzasPage from './page'

const mockFinanceData = {
  tenantCount: 7,
  revenue: {
    totalVentas: 2,
    totalVentasMonto: 1500,
    totalVentasServicios: 1,
    totalServiciosMonto: 500,
    totalIngresos: 2000,
  },
  gastos: { totalGastos: 3, totalMonto: 700 },
  cuentasPorCobrar: { total: 4, saldoPendiente: 800 },
  cuentasPorPagar: { total: 5, saldoPendiente: 900 },
  revenueTrend: [],
  revenueComparison: { current7DaysRevenue: 0, previous7DaysRevenue: 0 },
}

describe('/admin/finanzas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminFinanceAction).mockResolvedValue({
      success: true,
      data: mockFinanceData,
    })
  })

  it('consume la Server Action getAdminFinanceAction y preserva el shape actual de la UI', async () => {
    render(<FinanzasPage />)

    await waitFor(() => {
      expect(getAdminFinanceAction).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('Finanzas Globales')).toBeInTheDocument()
    expect(screen.getByText('Consolidación financiera de tenants reales')).toBeInTheDocument()
    expect(screen.getByText('Ingresos Totales')).toBeInTheDocument()
    expect(screen.getByText('Gastos Totales')).toBeInTheDocument()
    expect(screen.getByText('Resultado Neto')).toBeInTheDocument()
    expect(screen.getByText('Tenants')).toBeInTheDocument()
    expect(screen.getByText('Desglose de Ingresos')).toBeInTheDocument()
    expect(screen.getByText('Cuentas por Cobrar / Pagar')).toBeInTheDocument()
  })
})
