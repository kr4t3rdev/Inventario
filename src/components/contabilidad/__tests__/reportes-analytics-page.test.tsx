import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ReportesAnalyticsPage } from '../reportes-analytics-page'

const mockUseGetCuentasBancariasQuery = vi.fn()
const mockUseGetPrestamosCashStatsQuery = vi.fn()
const mockUseGetMovimientosQuery = vi.fn()
const mockUseGetCuentaTransactionHistoryQuery = vi.fn()

vi.mock('@/features/contabilidad/api/contabilidadApi', () => ({
  useGetCuentasBancariasQuery: (...args: unknown[]) => mockUseGetCuentasBancariasQuery(...args),
  useGetMovimientosQuery: (...args: unknown[]) => mockUseGetMovimientosQuery(...args),
  useGetCuentaTransactionHistoryQuery: (...args: unknown[]) => mockUseGetCuentaTransactionHistoryQuery(...args),
}))

vi.mock('@/lib/redux/services/prestamosCashApi', () => ({
  useGetPrestamosCashStatsQuery: (...args: unknown[]) => mockUseGetPrestamosCashStatsQuery(...args),
}))

vi.mock('@/components/contabilidad/resumen-financiero', () => ({
  ResumenFinanciero: () => <div>Resumen mock</div>,
}))

vi.mock('@/components/contabilidad/movimientos-table', () => ({
  MovimientosTable: () => <div>Tabla de movimientos</div>,
}))

vi.mock('@/components/contabilidad/account-transaction-history', () => ({
  AccountTransactionHistory: () => <div>Historial por cuenta</div>,
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  },
  useReducedMotion: () => true,
}))

describe('ReportesAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseGetCuentasBancariasQuery.mockReturnValue({
      data: {
        cuentas: [
          {
            cuentaId: 'cuenta-1',
            nombreBanco: 'Banco A',
            numeroCuenta: '123',
            moneda: 'CUP',
          },
        ],
      },
    })

    mockUseGetPrestamosCashStatsQuery.mockReturnValue({
      data: {
        montoPendienteCobro: { CUP: 100 },
      },
    })

    mockUseGetMovimientosQuery.mockReturnValue({})
    mockUseGetCuentaTransactionHistoryQuery.mockReturnValue({})
  })

  it('muestra las pestañas de movimientos y cuenta', () => {
    render(<ReportesAnalyticsPage />)

    expect(screen.getByRole('tab', { name: /resumen/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /movimientos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /por cuenta/i })).toBeInTheDocument()
  })
})
