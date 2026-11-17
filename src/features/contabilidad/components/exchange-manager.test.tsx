import React from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actionMocks = vi.hoisted(() => ({
  getMonedasAction: vi.fn(),
  getTasasActualesAction: vi.fn(),
  cambiarMonedaPrincipalAction: vi.fn(),
  getAccountingPolicyStateAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: actionMocks.getMonedasAction,
  getTasasActualesAction: actionMocks.getTasasActualesAction,
  cambiarMonedaPrincipalAction: actionMocks.cambiarMonedaPrincipalAction,
}))

vi.mock('@/features/contabilidad/actions-accounting-policy', () => ({
  getAccountingPolicyStateAction: actionMocks.getAccountingPolicyStateAction,
}))

vi.mock('sonner', () => ({
  toast: { success: actionMocks.toastSuccess, error: actionMocks.toastError },
}))

vi.mock('framer-motion', () => {
  const proxy = new Proxy({}, {
    get: (_, tag: string) => {
      const Component = ({
        children,
        ...props
      }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { initial, animate, exit, variants, transition, whileHover, whileTap, layout, ...rest } = props
        return React.createElement(tag, rest, children)
      }
      Component.displayName = `motion.${tag}`
      return Component
    },
  })
  return {
    motion: proxy,
    m: proxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  }
})

vi.mock('./conversion-dialog', () => ({ ConversionDialog: () => null }))
vi.mock('./historial-tasas-table', () => ({ HistorialTasasTable: () => null }))
vi.mock('./moneda-form', () => ({ MonedaForm: () => null }))
vi.mock('./tasa-cambio-form', () => ({ TasaCambioForm: () => null }))

import { ExchangeManager } from './exchange-manager'

const monedas = [
  { codigo: 'CUP', nombre: 'Peso cubano', simbolo: '$', esPrincipal: true, isActive: true },
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'US$', esPrincipal: false, isActive: true },
]

describe('ExchangeManager — moneda principal desde la política contable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionMocks.getMonedasAction.mockResolvedValue({ success: true, data: monedas })
    actionMocks.getTasasActualesAction.mockResolvedValue({
      success: true,
      data: { monedaPrincipal: monedas[0], tasas: [] },
    })
    actionMocks.getAccountingPolicyStateAction.mockResolvedValue({
      success: true,
      data: {
        policy: { functionalCurrencyCode: 'USD' },
        evidence: 'NONE',
        canManage: true,
      },
    })
    actionMocks.cambiarMonedaPrincipalAction.mockResolvedValue({
      success: true,
      data: { result: 'UPDATED', functionalCurrencyCode: 'CUP' },
    })
  })

  it('muestra la moneda de la política contable como principal, no la del catálogo', async () => {
    render(<ExchangeManager />)

    await screen.findByText('Moneda principal activa')

    expect(screen.getByText('Código: USD')).toBeInTheDocument()
    expect(screen.queryByText('Código: CUP')).not.toBeInTheDocument()
  })

  it('muestra sin moneda configurada cuando la política no existe', async () => {
    actionMocks.getAccountingPolicyStateAction.mockResolvedValue({
      success: true,
      data: { policy: null, evidence: null, canManage: true },
    })

    render(<ExchangeManager />)

    await screen.findByText('Sin moneda configurada')
    expect(screen.queryByText(/Código:/)).not.toBeInTheDocument()
  })

  it('oculta el control de cambio sin el feature del plan', async () => {
    render(<ExchangeManager />)

    await screen.findByText('Moneda principal activa')

    expect(
      screen.queryByRole('button', { name: 'Cambiar moneda principal' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva moneda principal')).not.toBeInTheDocument()
  })

  it('permite cambiar la moneda principal cuando el plan tiene el feature', async () => {
    render(<ExchangeManager puedeCambiarMonedaPrincipal />)

    const select = await screen.findByLabelText('Nueva moneda principal')
    expect(screen.queryByLabelText('Nueva moneda principal')).toBeInTheDocument()
    // La moneda actual (USD) no se ofrece como destino.
    expect(screen.getByRole('option', { name: /CUP/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /USD/ })).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'CUP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar moneda principal' }))

    await waitFor(() => {
      expect(actionMocks.cambiarMonedaPrincipalAction).toHaveBeenCalledWith({
        codigo: 'CUP',
      })
    })
    await waitFor(() => {
      expect(actionMocks.toastSuccess).toHaveBeenCalledWith(
        'Moneda principal actualizada correctamente',
      )
    })
  })

  it('anuncia el error del servidor cuando el cambio queda bloqueado', async () => {
    actionMocks.cambiarMonedaPrincipalAction.mockResolvedValue({
      success: false,
      error: {
        message: 'La moneda funcional no puede cambiar después de registrar evidencia contable',
        code: 'FUNCTIONAL_CURRENCY_IMMUTABLE',
      },
    })

    render(<ExchangeManager puedeCambiarMonedaPrincipal />)

    const select = await screen.findByLabelText('Nueva moneda principal')
    fireEvent.change(select, { target: { value: 'CUP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar moneda principal' }))

    await waitFor(() => {
      expect(actionMocks.toastError).toHaveBeenCalledWith(
        'La moneda funcional no puede cambiar después de registrar evidencia contable',
      )
    })
    expect(actionMocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('marca como principal la moneda de la política y como base de tasas a la del catálogo', async () => {
    render(<ExchangeManager />)

    await screen.findByText('Moneda principal activa')

    // La fila USD corresponde a la política contable de la empresa.
    expect(screen.getAllByText('Principal')).toHaveLength(1)
    // La marca global del catálogo (CUP) es la base de formación de tasas.
    expect(screen.getByText('Base de tasas')).toBeInTheDocument()
  })
})
