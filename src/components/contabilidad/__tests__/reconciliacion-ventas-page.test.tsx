import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { ReconciliacionVentasPage } from '@/components/contabilidad/reconciliacion-ventas-page'

const mockUseGetVentasPendientesQuery = vi.fn()
const mockUseGetHistorialReconciliacionVentasQuery = vi.fn()
const mockUseGetCuentasPorCobrarQuery = vi.fn()

vi.mock('@/lib/redux/services/contabilidadApi', () => ({
  useGetVentasPendientesQuery: (...args: unknown[]) => mockUseGetVentasPendientesQuery(...args),
  useGetHistorialReconciliacionVentasQuery: (...args: unknown[]) => mockUseGetHistorialReconciliacionVentasQuery(...args),
}))

vi.mock('@/lib/redux/services/cuentasPorCobrarApi', () => ({
  useGetCuentasPorCobrarQuery: (...args: unknown[]) => mockUseGetCuentasPorCobrarQuery(...args),
}))

vi.mock('@/components/contabilidad/ventas-pendientes-table', () => ({
  VentasPendientesTable: () => <div>Tabla mock</div>,
}))

vi.mock('@/components/contabilidad/reconciliacion-ventas-form', () => ({
  ReconciliacionVentasForm: () => <div>Formulario mock</div>,
}))

vi.mock('@/components/contabilidad/resumen-reconciliacion', () => ({
  ResumenReconciliacion: () => <div>Resumen mock</div>,
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  },
  useReducedMotion: () => true,
}))

describe('ReconciliacionVentasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseGetVentasPendientesQuery.mockReturnValue({
      data: { ventas: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } },
      refetch: vi.fn(),
    })
    mockUseGetHistorialReconciliacionVentasQuery.mockReturnValue({
      data: { reconciliaciones: [], estadisticas: { porMoneda: [], porTipoDePago: [], montoConvertidoTotal: 0, montoTotal: 0 }, pagination: {} },
    })
    mockUseGetCuentasPorCobrarQuery.mockReturnValue({
      data: [],
    })
  })

  it('consulta ventas sin rango de fechas por defecto', () => {
    render(<ReconciliacionVentasPage />)

    expect(mockUseGetVentasPendientesQuery).toHaveBeenCalled()
    expect(
      mockUseGetVentasPendientesQuery.mock.calls.every(([params]) => {
        const queryParams = params as { fechaInicio?: string; fechaFin?: string }
        return queryParams?.fechaInicio === '' && queryParams?.fechaFin === ''
      }),
    ).toBe(true)
  })
})