import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { getPurchaseHealthAction } = vi.hoisted(() => ({ getPurchaseHealthAction: vi.fn() }))
vi.mock('../actions-health', () => ({ getPurchaseHealthAction }))

import { PurchaseHealthCard } from './purchase-health-card'

describe('PurchaseHealthCard', () => {
  it('no renderiza para roles no admin', () => {
    expect(render(<PurchaseHealthCard userRole="regularUser" />).container).toBeEmptyDOMElement()
  })

  it('muestra crítico sin compras', async () => {
    getPurchaseHealthAction.mockResolvedValue({ success: true, data: { metrics: { comprasCount: 0, comprasTotal: 0, itemsCount: 0, vendorActiveCount: 0 } } })
    render(<PurchaseHealthCard userRole="admin" />)
    expect(await screen.findByText('Crítico')).toBeInTheDocument()
  })
})