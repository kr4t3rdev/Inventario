import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { getExpenseHealthAction } = vi.hoisted(() => ({ getExpenseHealthAction: vi.fn() }))
vi.mock('../actions-health', () => ({ getExpenseHealthAction }))

import { ExpenseHealthCard } from './expense-health-card'

describe('ExpenseHealthCard', () => {
  it('no renderiza para roles no admin', () => {
    expect(render(<ExpenseHealthCard userRole="regularUser" />).container).toBeEmptyDOMElement()
  })

  it('muestra sin actividad cuando no hay gastos', async () => {
    getExpenseHealthAction.mockResolvedValue({ success: true, data: { metrics: { gastosCount: 0, gastosTotal: 0 } } })
    render(<ExpenseHealthCard userRole="admin" />)
    expect(await screen.findByText('Sin actividad')).toBeInTheDocument()
  })
})