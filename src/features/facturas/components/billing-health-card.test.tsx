import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { getBillingHealthAction } = vi.hoisted(() => ({ getBillingHealthAction: vi.fn() }))
vi.mock('../actions-health', () => ({ getBillingHealthAction }))

import { BillingHealthCard } from './billing-health-card'

describe('BillingHealthCard', () => {
  it('no renderiza para roles no admin', () => {
    expect(render(<BillingHealthCard userRole="regularUser" />).container).toBeEmptyDOMElement()
  })

  it('muestra estado alto con tasa al menos 70', async () => {
    getBillingHealthAction.mockResolvedValue({ success: true, data: { metrics: { facturasCount: 7, ventasCount: 10, formalizationRate: 70 } } })
    render(<BillingHealthCard userRole="admin" />)
    expect(await screen.findByText('Alto')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })
})
