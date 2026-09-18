import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { getOffersServicesHealthAction } = vi.hoisted(() => ({ getOffersServicesHealthAction: vi.fn() }))
vi.mock('../actions-health', () => ({ getOffersServicesHealthAction }))

import { OffersServicesHealthCard } from './offers-services-health-card'

describe('OffersServicesHealthCard', () => {
  it('no renderiza para roles no admin', () => {
    expect(render(<OffersServicesHealthCard userRole="regularUser" />).container).toBeEmptyDOMElement()
  })

  it('muestra sin actividad cuando ambos son cero', async () => {
    getOffersServicesHealthAction.mockResolvedValue({ success: true, data: { metrics: { ofertasCount: 0, serviciosCount: 0 } } })
    render(<OffersServicesHealthCard userRole="admin" />)
    expect(await screen.findByText('Sin actividad')).toBeInTheDocument()
  })

  it('muestra activo cuando ambos tienen datos', async () => {
    getOffersServicesHealthAction.mockResolvedValue({ success: true, data: { metrics: { ofertasCount: 4, serviciosCount: 3 } } })
    render(<OffersServicesHealthCard userRole="admin" />)
    expect(await screen.findByText('Activo')).toBeInTheDocument()
  })
})