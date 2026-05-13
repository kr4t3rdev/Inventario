/**
 * @description Pruebas para la página de reportes y analytics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { ReportesAnalyticsPage } from './reportes-analytics-page'

const mockFetch = vi.fn()

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

const mockResumenResponse = {
  resumenPorMoneda: [
    {
      moneda: 'CUP',
      saldoActual: 150000,
      totalIngresos: 75000,
      totalEgresos: 45000,
      flujoNeto: 30000,
      desglose: {
        ingresos: { ventas: 50000, servicios: 20000, ajustes: 5000, inyecciones: [] },
        egresos: { gastos: 30000, ajustes: 5000, pagosDeuda: 5000, prestamosCash: 5000 },
      },
    },
    {
      moneda: 'USD',
      saldoActual: 12000,
      totalIngresos: 5000,
      totalEgresos: 2000,
      flujoNeto: 3000,
      desglose: {
        ingresos: { ventas: 3000, servicios: 1500, ajustes: 500, inyecciones: [] },
        egresos: { gastos: 1500, ajustes: 500, pagosDeuda: 0, prestamosCash: 0 },
      },
    },
  ],
  cuentasBancarias: [
    { cuentaId: 'c1', nombreBanco: 'Banco Nacional', numeroCuenta: '001', saldo: 100000, moneda: 'CUP', tipoCuenta: 'Ahorro' },
  ],
  estadisticas: {
    totalCuentas: 5,
    totalReconciliaciones: 120,
    totalTransferencias: 45,
    totalAjustes: 8,
    totalInyecciones: 3,
    periodo: { fechaInicio: '2025-01-01', fechaFin: '2025-12-31' },
  },
}

describe('ReportesAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe mostrar los indicadores principales', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResumenResponse,
    })

    render(<ReportesAnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Cuentas')).toBeInTheDocument()
      expect(screen.getByText('Reconciliaciones')).toBeInTheDocument()
      expect(screen.getByText('Transferencias')).toBeInTheDocument()
      expect(screen.getByText('Ajustes')).toBeInTheDocument()
    })

    expect(screen.getByText('5')).toBeInTheDocument() // totalCuentas
  })

  it('debe mostrar el resumen por moneda', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResumenResponse,
    })

    render(<ReportesAnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Resumen Financiero por Moneda')).toBeInTheDocument()
    })

    expect(screen.getByText('CUP')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
  })

  it('debe mostrar loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    render(<ReportesAnalyticsPage />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('debe mostrar error state cuando falla la API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Error interno' }),
    })

    render(<ReportesAnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Error al cargar reportes')).toBeInTheDocument()
    })
  })
})
