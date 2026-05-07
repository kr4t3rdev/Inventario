import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { MovimientosTable } from '../movimientos-table'

const mockUseGetMovimientosQuery = vi.fn()
const mockUseGetCuentasBancariasQuery = vi.fn()
const mockUseGetPrestamoCashHistorialQuery = vi.fn()
const mockUseGetDeudaCashQuery = vi.fn()

vi.mock('@/features/contabilidad/api/contabilidadApi', () => ({
  useGetMovimientosQuery: (...args: unknown[]) => mockUseGetMovimientosQuery(...args),
  useGetCuentasBancariasQuery: (...args: unknown[]) => mockUseGetCuentasBancariasQuery(...args),
}))

vi.mock('@/lib/redux/services/prestamosCashApi', () => ({
  useGetPrestamoCashHistorialQuery: (...args: unknown[]) => mockUseGetPrestamoCashHistorialQuery(...args),
}))

vi.mock('@/lib/redux/services/deudasCashApi', () => ({
  useGetDeudaCashQuery: (...args: unknown[]) => mockUseGetDeudaCashQuery(...args),
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_, element: string) => {
        return ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
          React.createElement(element, props, children)
      },
    },
  ),
  useReducedMotion: () => true,
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
}))

describe('MovimientosTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseGetCuentasBancariasQuery.mockReturnValue({
      data: { cuentas: [] },
    })

    mockUseGetMovimientosQuery.mockReturnValue({
      data: {
        data: [
          {
            id: 'mov-1',
            tipo: 'prestamo_cash_desembolso',
            fecha: '2024-02-01T00:00:00.000Z',
            cuenta: 'Banco A - 123',
            descripcion: 'Desembolso Préstamo Cash - Cliente Test',
            referencia: 'prestamo-1',
            moneda: 'CUP',
            monto: 500,
            montoConvertido: 500,
            tasaCambio: null,
            detalles: {
              prestamoCashId: 'prestamo-1',
              clientePrestamo: 'Cliente Test',
              esPrestamoCash: true,
            },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    })

    mockUseGetPrestamoCashHistorialQuery.mockReturnValue({
      data: {
        prestamo: {
          id: 'prestamo-1',
          moneda: 'CUP',
        },
        resumen: {
          montoCapital: 500,
          totalDeuda: 500,
          montoPagado: 0,
          saldoPendiente: 500,
          cantidadPagos: 0,
        },
        historial: [],
      },
    })

    mockUseGetDeudaCashQuery.mockReturnValue({
      data: {
        id: 'deuda-1',
        moneda: 'CUP',
        montoCapital: 500,
      },
    })
  })

  it('muestra el detalle solo en el desembolso del préstamo cash', () => {
    render(<MovimientosTable />)

    fireEvent.click(screen.getByRole('button', { name: /ver préstamo/i }))

    expect(screen.getByText('Detalle de préstamo cash')).toBeInTheDocument()
    expect(screen.getByText(/Historial completo de Cliente Test/i)).toBeInTheDocument()
  })

  it('no muestra botón en cobros de préstamo cash', () => {
    mockUseGetMovimientosQuery.mockReturnValueOnce({
      data: {
        data: [
          {
            id: 'mov-2',
            tipo: 'prestamo_cash_pago',
            fecha: '2024-02-01T00:00:00.000Z',
            cuenta: 'Banco A - 123',
            descripcion: 'Cobro Préstamo Cash - Cliente Test',
            referencia: 'prestamo-1',
            moneda: 'CUP',
            monto: 200,
            montoConvertido: 200,
            tasaCambio: null,
            detalles: {
              prestamoCashId: 'prestamo-1',
              clientePrestamo: 'Cliente Test',
              esPrestamoCash: false,
            },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    })

    render(<MovimientosTable />)

    expect(screen.queryByRole('button', { name: /ver préstamo/i })).not.toBeInTheDocument()
  })
})
