import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { getAccountingHealthAction } = vi.hoisted(() => ({ getAccountingHealthAction: vi.fn() }))
vi.mock('../actions-health', () => ({ getAccountingHealthAction }))

import { AccountingHealthCard } from './accounting-health-card'

describe('AccountingHealthCard', () => {
  it('no renderiza para roles no admin', () => {
    expect(render(<AccountingHealthCard userRole="regularUser" />).container).toBeEmptyDOMElement()
  })

  it('muestra bloqueado sin periodo activo', async () => {
    getAccountingHealthAction.mockResolvedValue({ success: true, data: { metrics: { hasActivePeriod: false, currentPeriodStatus: null, lastClosedPeriod: null, totalPeriods: 0 } } })
    render(<AccountingHealthCard userRole="admin" />)
    expect(await screen.findByText('Bloqueado')).toBeInTheDocument()
  })
})