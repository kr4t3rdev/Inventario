import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockFetch = vi.fn()

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

import FinanzasPage from './page'

describe('/admin/finanzas page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
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
      }),
    })
  })

  it('fetches the REST finance contract and preserves the current UI shape', async () => {
    render(<FinanzasPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/finance', {
      method: 'GET',
      cache: 'no-store',
    })

    expect(screen.getByText('Finanzas Globales')).toBeInTheDocument()
    expect(screen.getByText('Consolidación financiera de la plataforma')).toBeInTheDocument()
    expect(screen.getByText('Ingresos Totales')).toBeInTheDocument()
    expect(screen.getByText('Gastos Totales')).toBeInTheDocument()
    expect(screen.getByText('Resultado Neto')).toBeInTheDocument()
    expect(screen.getByText('Tenants')).toBeInTheDocument()
    expect(screen.getByText('Desglose de Ingresos')).toBeInTheDocument()
    expect(screen.getByText('Cuentas por Cobrar / Pagar')).toBeInTheDocument()
  })
})
