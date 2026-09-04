import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/features/notificaciones/actions', () => ({
  deleteNotificacionAction: vi.fn(),
  getNotificacionesAction: async () => ({
    success: true,
    data: { notificaciones: [] },
  }),
  marcarNotificacionLeidaAction: vi.fn(),
}))

import { PanelNotificaciones } from './panel-notificaciones'

describe('PanelNotificaciones', () => {
  it('nombra el disparador, ofrece 44 px y evita focos anidados', () => {
    render(<PanelNotificaciones />)

    const trigger = screen.getByRole('button', { name: 'Abrir notificaciones' })
    expect(trigger).toHaveClass('size-11')
    expect(trigger.querySelector('[tabindex="0"]')).toBeNull()
  })
})
