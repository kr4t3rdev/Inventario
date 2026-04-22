import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { AccountTransactionHistory } from '../account-transaction-history'

const mockUseGetCuentaTransactionHistoryQuery = vi.fn()
const mockUseGetMonedasQuery = vi.fn()
const mockUseGetPrestamoCashHistorialQuery = vi.fn()

vi.mock('@/lib/redux/services/contabilidadApi', () => ({
  useGetCuentaTransactionHistoryQuery: (...args: unknown[]) => mockUseGetCuentaTransactionHistoryQuery(...args),
  useGetMonedasQuery: (...args: unknown[]) => mockUseGetMonedasQuery(...args),
}))

vi.mock('@/lib/redux/services/prestamosCashApi', () => ({
  useGetPrestamoCashHistorialQuery: (...args: unknown[]) => mockUseGetPrestamoCashHistorialQuery(...args),
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  },
  useReducedMotion: () => true,
}))

vi.spyOn(window, 'fetch').mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, data: { tasas: [] } }),
} as Response)

describe('AccountTransactionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseGetMonedasQuery.mockReturnValue({ data: { data: [] } })
    mockUseGetPrestamoCashHistorialQuery.mockReturnValue({ data: null })
    mockUseGetCuentaTransactionHistoryQuery.mockReturnValue({
      data: {
        transacciones: [
          {
            transaccionId: 'tx-1',
            fecha: '2024-02-01T00:00:00.000Z',
            tipoMovimiento: 'prestamo_cash_desembolso',
            descripcion: 'Desembolso Préstamo Cash',
            monedaOriginal: 'CUP',
            montoOriginal: 500,
            montoConvertido: 500,
            esIngreso: false,
            detalles: { prestamoCashId: 'prestamo-1' },
          },
          {
            transaccionId: 'tx-2',
            fecha: '2024-02-02T00:00:00.000Z',
            tipoMovimiento: 'prestamo_cash_pago',
            descripcion: 'Cobro Préstamo Cash',
            monedaOriginal: 'CUP',
            montoOriginal: 100,
            montoConvertido: 100,
            esIngreso: true,
            detalles: { prestamoCashId: 'prestamo-1' },
          },
        ],
        resumen: { saldoActual: 0, totalIngresos: 0, totalEgresos: 0, totalTransferencias: 0, totalMovimientos: 2 },
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    })
  })

  it('solo abre detalle en desembolso de préstamo', () => {
    render(
      <AccountTransactionHistory
        cuentaId="cuenta-1"
        nombreCuenta="Banco A"
        numeroCuenta="123"
        monedaCuenta="CUP"
      />,
    )

    fireEvent.click(screen.getByRole('row', { name: /Desembolso Préstamo Cash/i }))
    expect(screen.getByText(/Detalle de préstamo cash/i)).toBeInTheDocument()
  })
})
