import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PrestamoCashForm } from '../prestamo-cash-form'
import { calcularMontoTotalACobrar } from '../prestamo-cash-utils'

const mockUseCreatePrestamoCashMutation = vi.fn()
const mockUseGetTasasActualesQuery = vi.fn()

vi.mock('@/lib/redux/services/prestamosCashApi', () => ({
  useCreatePrestamoCashMutation: () => mockUseCreatePrestamoCashMutation(),
}))

vi.mock('@/features/contabilidad/api/contabilidadApi', () => ({
  useGetTasasActualesQuery: () => mockUseGetTasasActualesQuery(),
}))

vi.mock('@/lib/sileo-shim', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('PrestamoCashForm', () => {
  beforeEach(() => {
    mockUseCreatePrestamoCashMutation.mockReturnValue([vi.fn(), { isLoading: false }])
    mockUseGetTasasActualesQuery.mockReturnValue({
      data: {
        data: {
          monedaPrincipal: { codigo: 'CUP' },
          tasas: [],
        },
      },
    })
  })

  it('expone el cálculo de saldo a pagar usado por el formulario', () => {
    render(
      <PrestamoCashForm
        open
        onOpenChange={vi.fn()}
        clientes={[{ clienteId: 'c-1', nombre: 'Cliente Test' }]}
        cuentasBancarias={[{ cuentaId: 'cuenta-1', nombreBanco: 'Banco A', tipoCuenta: 'Corriente', moneda: 'CUP' }]}
      />
    )

    expect(calcularMontoTotalACobrar(1000, 10)).toBe(1100)
  })
})
