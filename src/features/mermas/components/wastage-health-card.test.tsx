import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { getWastageHealthAction } = vi.hoisted(() => ({ getWastageHealthAction: vi.fn() }))
vi.mock('../actions-health', () => ({ getWastageHealthAction }))

import { WastageHealthCard } from './wastage-health-card'

describe('WastageHealthCard', () => {
  it('no renderiza para roles no admin', () => {
    expect(render(<WastageHealthCard userRole="regularUser" />).container).toBeEmptyDOMElement()
  })

  it('muestra saludable sin mermas', async () => {
    getWastageHealthAction.mockResolvedValue({ success: true, data: { metrics: { mermasCount: 0, mermasTotalValue: 0 } } })
    render(<WastageHealthCard userRole="admin" />)
    expect(await screen.findByText('Saludable')).toBeInTheDocument()
    expect(screen.getByText('$0')).toBeInTheDocument()
  })

  it('muestra atención con hasta diez mermas', async () => {
    getWastageHealthAction.mockResolvedValue({ success: true, data: { metrics: { mermasCount: 10, mermasTotalValue: 50 } } })
    render(<WastageHealthCard userRole="admin" />)
    expect(await screen.findByText('Atención')).toBeInTheDocument()
  })

  it('muestra crítico con más de 50 mermas', async () => {
    getWastageHealthAction.mockResolvedValue({ success: true, data: { metrics: { mermasCount: 51, mermasTotalValue: 200 } } })
    render(<WastageHealthCard userRole="admin" />)
    expect(await screen.findByText('Crítico')).toBeInTheDocument()
  })
})