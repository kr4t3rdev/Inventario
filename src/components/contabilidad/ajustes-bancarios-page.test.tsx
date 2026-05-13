/**
 * @description Pruebas para la página de ajustes bancarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AjustesBancariosPage } from './ajustes-bancarios-page'

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
]

const mockFetch = vi.fn()

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

const mockAjustesResponse = {
  ajustes: [
    {
      ajusteId: 'aj-1',
      tipo: 'ingreso',
      monto: 5000,
      moneda: 'CUP',
      descripcion: 'Corrección de saldo inicial',
      motivo: 'Ajuste contable',
      realizadoPor: 'user-abc',
      createdAt: '2025-06-15T10:30:00.000Z',
      cuentaBancaria: {
        nombreBanco: 'Banco Nacional',
        numeroCuenta: '001-123456',
        moneda: 'CUP',
      },
    },
    {
      ajusteId: 'aj-2',
      tipo: 'egreso',
      monto: 2000,
      moneda: 'CUP',
      descripcion: 'Comisión bancaria',
      motivo: 'Gasto operativo',
      realizadoPor: 'user-def',
      createdAt: '2025-06-14T08:00:00.000Z',
      cuentaBancaria: {
        nombreBanco: 'Banco Nacional',
        numeroCuenta: '001-123456',
        moneda: 'CUP',
      },
    },
  ],
}

describe('AjustesBancariosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCuentasBancariasAction.mockResolvedValue({
      success: true,
      data: { cuentas: mockCuentas },
    })
  })

  it('debe mostrar los tabs y el formulario de creación', async () => {
    render(<AjustesBancariosPage />)

    await waitFor(() => {
      expect(screen.getByText('Nuevo Ajuste')).toBeInTheDocument()
      expect(screen.getByText('Historial')).toBeInTheDocument()
      expect(screen.getByText('Crear Ajuste Bancario')).toBeInTheDocument()
    })

    expect(screen.getByText('Cuenta Bancaria')).toBeInTheDocument()
    expect(screen.getByText('Tipo de Ajuste')).toBeInTheDocument()
    expect(screen.getByText('Motivo')).toBeInTheDocument()
    expect(screen.getByText('Descripción')).toBeInTheDocument()
  })

  it('debe mostrar loading mientras carga cuentas', () => {
    mockGetCuentasBancariasAction.mockImplementation(() => new Promise(() => {}))
    render(<AjustesBancariosPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('debe mostrar el botón de crear ajuste', async () => {
    render(<AjustesBancariosPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /crear ajuste/i })).toBeInTheDocument()
    })
  })

  it('debe cambiar al tab de historial', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAjustesResponse,
    })

    const user = userEvent.setup()
    render(<AjustesBancariosPage />)

    await waitFor(() => {
      expect(screen.getByText('Nuevo Ajuste')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Historial'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/contabilidad/ajustes/all')
    })

    expect(screen.getByText('5,000.00 CUP')).toBeInTheDocument()
    expect(screen.getByText('2,000.00 CUP')).toBeInTheDocument()
  })

  it('debe mostrar loading en historial mientras carga', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<AjustesBancariosPage />)

    await waitFor(() => {
      expect(screen.getByText('Nuevo Ajuste')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Historial'))

    await waitFor(() => {
      const statuses = screen.getAllByRole('status')
      expect(statuses.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('debe mostrar vacío en historial cuando no hay ajustes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ajustes: [] }),
    })

    const user = userEvent.setup()
    render(<AjustesBancariosPage />)

    await waitFor(() => {
      expect(screen.getByText('Nuevo Ajuste')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Historial'))

    await waitFor(() => {
      expect(screen.getByText('Sin ajustes registrados')).toBeInTheDocument()
    })
  })
})
