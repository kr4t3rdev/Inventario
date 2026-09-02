import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getAccountingHealthAction } = vi.hoisted(() => ({ getAccountingHealthAction: vi.fn() }))
vi.mock('../actions-health', () => ({ getAccountingHealthAction }))

import { AccountingHealthCard, deriveHealthStatus } from './accounting-health-card'

describe('AccountingHealthCard', () => {
  beforeEach(() => {
    getAccountingHealthAction.mockReset()
  })

  it('no renderiza para roles no admin', () => {
    expect(render(<AccountingHealthCard userRole="regularUser" />).container).toBeEmptyDOMElement()
  })

  it('muestra bloqueado sin periodo activo', async () => {
    getAccountingHealthAction.mockResolvedValue({ success: true, data: { metrics: { hasActivePeriod: false, currentPeriodStatus: null, lastClosedPeriod: null, totalPeriods: 0 } } })
    render(<AccountingHealthCard userRole="admin" />)
    expect(await screen.findByText('Bloqueado')).toBeInTheDocument()
  })

  it('muestra skeleton accesible mientras carga (sin spinner infinito)', () => {
    getAccountingHealthAction.mockReturnValue(new Promise(() => {}))
    const { container } = render(<AccountingHealthCard userRole="admin" />)

    expect(screen.getByLabelText('Cargando')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.animate-spin')).toBeNull()
  })

  it('muestra estado de error con reintento cuando la consulta falla', async () => {
    getAccountingHealthAction.mockResolvedValue({ success: false, error: { message: 'fallo' } })
    render(<AccountingHealthCard userRole="admin" />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /intentar nuevamente/i })).toBeInTheDocument()
  })

  it('el reintento vuelve a consultar y muestra los datos al recuperarse', async () => {
    getAccountingHealthAction
      .mockResolvedValueOnce({ success: false, error: { message: 'fallo' } })
      .mockResolvedValueOnce({
        success: true,
        data: { metrics: { hasActivePeriod: true, currentPeriodStatus: 'ABIERTO', lastClosedPeriod: 'M-2026-07', totalPeriods: 5 } },
      })
    render(<AccountingHealthCard userRole="admin" />)

    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: /intentar nuevamente/i }))

    expect(await screen.findByText('Operativo')).toBeInTheDocument()
    expect(getAccountingHealthAction).toHaveBeenCalledTimes(2)
  })
})

describe('deriveHealthStatus', () => {
  it('devuelve Bloqueado sin período activo', () => {
    expect(deriveHealthStatus({ hasActivePeriod: false, currentPeriodStatus: null, lastClosedPeriod: null, totalPeriods: 3 }).label).toBe('Bloqueado')
  })

  it('devuelve Iniciando con menos de dos períodos', () => {
    expect(deriveHealthStatus({ hasActivePeriod: true, currentPeriodStatus: 'ABIERTO', lastClosedPeriod: null, totalPeriods: 1 }).label).toBe('Iniciando')
  })

  it('devuelve Operativo con período activo y al menos dos períodos', () => {
    expect(deriveHealthStatus({ hasActivePeriod: true, currentPeriodStatus: 'ABIERTO', lastClosedPeriod: 'M-2026-07', totalPeriods: 2 }).label).toBe('Operativo')
  })
})