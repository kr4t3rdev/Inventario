import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: async () => ({ success: true, data: [] }),
  getTasasActualesAction: async () => ({ success: true, data: { tasas: [] } }),
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>Barra lateral</button>
  ),
}))

vi.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }))
vi.mock('./theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/features/notificaciones/components/panel-notificaciones', () => ({
  PanelNotificaciones: () => null,
}))
vi.mock('@/features/contabilidad/components/currency-indicator', () => ({
  CurrencyIndicator: () => null,
}))
vi.mock('@/features/contabilidad/components/periodo-activo-indicator', () => ({
  PeriodoActivoIndicator: () => null,
}))
vi.mock('@/features/contabilidad/components/contabilidad-breadcrumb', () => ({
  ContabilidadBreadcrumb: () => null,
}))

import { SiteHeader } from './site-header'

describe('SiteHeader', () => {
  it('ofrece un control accesible de 44 px para la barra lateral', async () => {
    render(await SiteHeader())

    expect(screen.getByRole('button', { name: 'Alternar barra lateral' })).toHaveClass('size-11')
  })
})
