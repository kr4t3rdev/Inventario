import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PagoPrestamoModal } from '../pago-prestamo-modal'

const mockUseRegistrarPagoPrestamoMutation = vi.fn()

vi.mock('@/lib/redux/services/prestamosCashApi', () => ({
  useRegistrarPagoPrestamoMutation: () => mockUseRegistrarPagoPrestamoMutation(),
}))

vi.mock('@/lib/sileo-shim', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('PagoPrestamoModal', () => {
  beforeEach(() => {
    mockUseRegistrarPagoPrestamoMutation.mockReturnValue([vi.fn(), { isLoading: false }])
  })

  it('muestra el saldo pendiente y el saldo restante tras el pago', async () => {
    const user = userEvent.setup()

    render(
      <PagoPrestamoModal
        prestamo={{
          id: 'p-1',
          idNumerico: 1,
          clienteId: 'c-1',
          cuentaPorCobrarId: 'cxc-1',
          montoCapital: 1000,
          moneda: 'CUP',
          fechaOtorgamiento: '2024-01-01',
          estado: 'ACTIVO',
          createdById: 'user-1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          cuentaPorCobrar: {
            id: 'cxc-1',
            montoDeuda: 1100,
            montoPagado: 250,
            estado: 'PARCIAL',
            clienteId: 'c-1',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            fechaVencimiento: null,
            tipoCuenta: 'PRESTAMO_CASH',
            idCC: 1,
            facturaId: null,
            numeroFactura: null,
            idTransferencia: null,
          },
        }}
        open
        onOpenChange={vi.fn()}
        cuentasBancarias={[]}
        tiposPago={[]}
      />
    )

    expect(screen.getByText(/Saldo pendiente actual/i)).toHaveTextContent('850.00')

    const input = screen.getByLabelText(/Monto a pagar/i)
    await user.clear(input)
    await user.type(input, '100')

    expect(screen.getByText(/Saldo restante tras este pago/i)).toHaveTextContent('750.00')
  })
})
