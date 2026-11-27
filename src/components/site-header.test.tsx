import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const capturedIndicatorProps = vi.hoisted(() => ({ monedas: null as unknown }))

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: async () => ({ success: true, data: [] }),
  getTasasActualesAction: async () => ({ success: true, data: { tasas: [] } }),
}))

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(async () => ({
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'regularUser',
    isActive: true,
  })),
}))

vi.mock('@/lib/services/moneda-principal-service', () => ({
  resolverMonedaPrincipal: vi.fn(async () => ({
    estado: 'CONFIGURADA',
    moneda: 'CUP',
  })),
}))

vi.mock('@/components/nav-user', () => ({ NavUser: () => null }))
vi.mock('@/components/floating-navigation', () => ({
  FloatingNavigationMenu: () => <nav aria-label="Menú principal" />,
}))
vi.mock('./theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/features/notificaciones/components/panel-notificaciones', () => ({
  PanelNotificaciones: () => null,
}))
vi.mock('@/features/contabilidad/components/currency-indicator', () => ({
  CurrencyIndicator: (props: { monedaPrincipal?: unknown }) => {
    capturedIndicatorProps.monedas = props
    return null
  },
}))
vi.mock('@/features/contabilidad/components/periodo-activo-indicator', () => ({
  PeriodoActivoIndicator: () => null,
}))
vi.mock('@/features/contabilidad/components/contabilidad-breadcrumb', () => ({
  ContabilidadBreadcrumb: () => null,
}))

import { SiteHeader } from './site-header'
import { resolverMonedaPrincipal } from '@/lib/services/moneda-principal-service'

describe('SiteHeader', () => {
  it('muestra el menú flotante incluso con una preferencia clásica anterior', async () => {
    window.localStorage.setItem('financemdm-sidebar-view', 'classic')
    render(await SiteHeader())

    expect(screen.getByRole('navigation', { name: 'Menú principal' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Vista de navegación' })).toBeNull()
  })

  it('pasa al indicador la moneda resuelta desde la política contable del tenant', async () => {
    render(await SiteHeader())

    expect(vi.mocked(resolverMonedaPrincipal)).toHaveBeenCalledWith('tenant-1')
    expect(capturedIndicatorProps.monedas).toEqual({
      monedas: expect.anything(),
      tasas: expect.anything(),
      monedaPrincipal: { estado: 'CONFIGURADA', moneda: 'CUP' },
    })
  })
})
