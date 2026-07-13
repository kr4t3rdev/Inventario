import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { getSalesHealthAction } = vi.hoisted(() => ({ getSalesHealthAction: vi.fn() }))
vi.mock('../actions-health', () => ({ getSalesHealthAction }))

import { SalesHealthCard } from './sales-health-card'

/** @description Verifica estados visibles de salud de ventas. @returns {void} */
describe('SalesHealthCard', () => {
  it('no renderiza para roles no admin', () => {
    const { container } = render(<SalesHealthCard userRole="regularUser" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra inactivo sin ventas', async () => {
    getSalesHealthAction.mockResolvedValue({ success: true, data: { metrics: { ventasCount: 0, ventasTotal: 0, facturasCount: 0, ofertasCount: 0, serviciosCount: 0 } } })
    render(<SalesHealthCard userRole="admin" />)
    expect(await screen.findByText('Inactivo')).toBeInTheDocument()
  })

  it('muestra activo con 50 ventas', async () => {
    getSalesHealthAction.mockResolvedValue({ success: true, data: { metrics: { ventasCount: 50, ventasTotal: 1250, facturasCount: 10, ofertasCount: 2, serviciosCount: 3 } } })
    render(<SalesHealthCard userRole="admin" />)
    expect(await screen.findByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('$1,250')).toBeInTheDocument()
  })
})
