/**
 * @description Pruebas para el formulario de transferencia bancaria
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransferenciaBancariaForm } from './transferencia-bancaria-form'

// Mock server action
const mockGetCuentasBancariasAction = vi.fn()

vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({
  getCuentasBancariasAction: (...args: any[]) => mockGetCuentasBancariasAction(...args),
}))

const mockCuentas = [
  {
    cuentaId: 'c1',
    nombreBanco: 'Banco Nacional',
    numeroCuenta: '001-123456',
    moneda: 'CUP',
    saldo: 100000,
    isActive: true,
    tipoCuenta: 'Ahorro',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    cuentaId: 'c2',
    nombreBanco: 'Banco Metropolitano',
    numeroCuenta: '002-789012',
    moneda: 'USD',
    saldo: 5000,
    isActive: true,
    tipoCuenta: 'Corriente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    cuentaId: 'c3',
    nombreBanco: 'Banco Nacional',
    numeroCuenta: '003-345678',
    moneda: 'CUP',
    saldo: 50000,
    isActive: true,
    tipoCuenta: 'Corriente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const renderForm = (props: Parameters<typeof TransferenciaBancariaForm>[0] = {}) => {
  return render(<TransferenciaBancariaForm {...props} />)
}

describe('TransferenciaBancariaForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCuentasBancariasAction.mockResolvedValue({
      success: true,
      data: { cuentas: mockCuentas },
    })
  })

  it('debe mostrar el título y la descripción', async () => {
    renderForm()

    await waitFor(() => {
      expect(screen.getByText('Nueva Transferencia')).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Complete los datos para realizar una transferencia/)
    ).toBeInTheDocument()
  })

  it('debe mostrar un loader mientras carga las cuentas', () => {
    mockGetCuentasBancariasAction.mockImplementation(
      () => new Promise(() => {}) // never resolves
    )
    renderForm()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('debe mostrar los campos del formulario después de cargar', async () => {
    renderForm()

    await waitFor(() => {
      expect(screen.getByText('Cuenta Origen')).toBeInTheDocument()
    })

    expect(screen.getByText('Cuenta Destino')).toBeInTheDocument()
    expect(screen.getByText('Motivo')).toBeInTheDocument()
    expect(screen.getByText(/descripción/i)).toBeInTheDocument()
  })

  it('debe mostrar el botón de realizar transferencia', async () => {
    renderForm({ onSuccess: vi.fn() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /realizar transferencia/i })).toBeInTheDocument()
    })
  })

  it('debe mostrar el botón de cancelar cuando onCancel está definido', async () => {
    renderForm({ onCancel: vi.fn() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
    })
  })

  it('debe ocultar el botón de cancelar cuando onCancel no está definido', async () => {
    renderForm()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /realizar transferencia/i })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument()
  })

  it('debe mostrar error de validación si se envía vacío', async () => {
    const user = userEvent.setup()
    renderForm()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /realizar transferencia/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /realizar transferencia/i }))

    await waitFor(() => {
      expect(screen.getByText(/seleccione la cuenta origen/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/seleccione la cuenta destino/i)).toBeInTheDocument()
    expect(screen.getByText(/el motivo es requerido/i)).toBeInTheDocument()
  })

  it('debe llamar a onSuccess cuando la transferencia se crea exitosamente', async () => {
    const mockOnSuccess = vi.fn()
    const user = userEvent.setup()

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Transferencia creada' }),
    })

    renderForm({ onSuccess: mockOnSuccess })

    // Esperar a que carguen las cuentas
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /realizar transferencia/i })).toBeInTheDocument()
    })

    // Abrir select cuenta origen y seleccionar
    const origenTrigger = screen.getByRole('combobox', { name: /cuenta origen/i })
    await user.click(origenTrigger)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /001-123456/ })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: /001-123456/ }))
    await user.keyboard('{Escape}')

    // Abrir select cuenta destino y seleccionar
    await waitFor(() => {
      const destinoTrigger = screen.getByRole('combobox', { name: /cuenta destino/i })
      return destinoTrigger
    })

    const destinoTrigger = screen.getByRole('combobox', { name: /cuenta destino/i })
    await user.click(destinoTrigger)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /003-345678/ })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: /003-345678/ }))
    await user.keyboard('{Escape}')

    // Ingresar monto
    const montoInput = screen.getByPlaceholderText('0.00')
    await user.type(montoInput, '1000')

    // Ingresar motivo
    const motivoInput = screen.getByPlaceholderText(/Ej:/)
    await user.type(motivoInput, 'Pago a proveedor')

    // Enviar
    await user.click(screen.getByRole('button', { name: /realizar transferencia/i }))

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('debe mostrar mensaje de error cuando la API falla', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Saldo insuficiente' }),
    })

    renderForm({ onSuccess: vi.fn() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /realizar transferencia/i })).toBeInTheDocument()
    })

    // Seleccionar cuenta origen
    const origenTrigger = screen.getByRole('combobox', { name: /cuenta origen/i })
    await user.click(origenTrigger)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /001-123456/ })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('option', { name: /001-123456/ }))

    // Seleccionar cuenta destino
    await userEvent.click(screen.getByRole('combobox', { name: /cuenta destino/i }))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /003-345678/ })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('option', { name: /003-345678/ }))

    // Completar formulario
    await user.type(screen.getByPlaceholderText('0.00'), '999999')
    await user.type(screen.getByPlaceholderText(/Ej:/), 'Prueba')

    await user.click(screen.getByRole('button', { name: /realizar transferencia/i }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error creating transferencia:',
        'Saldo insuficiente'
      )
    })

    consoleSpy.mockRestore()
  })
})
