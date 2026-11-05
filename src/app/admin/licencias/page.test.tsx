import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminActions = vi.hoisted(() => ({
  getAdminPlanesAction: vi.fn(),
  getGlobalUsersAction: vi.fn(),
  deleteLicenciaAction: vi.fn(),
  updateLicenciaAction: vi.fn(),
  generateLicenciasAction: vi.fn(),
  createDemoTenantAction: vi.fn(),
  cleanupExpiredDemoLicenciasAction: vi.fn(),
  convertDemoToPaidPlanAction: vi.fn(),
  changePlanAction: vi.fn(),
  renewLicenciaAction: vi.fn(),
  getLicenciasPaginatedAction: vi.fn(),
  getLicenciasStatsAction: vi.fn(),
  updateLicenseAccountingOverridesAction: vi.fn(),
}))

vi.mock('@/features/admin', () => adminActions)

import AdminLicenciasPage from './page'

describe('AdminLicenciasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminActions.getLicenciasPaginatedAction.mockResolvedValue({
      success: true,
      data: { licencias: [], total: 0 },
    })
    adminActions.getLicenciasStatsAction.mockResolvedValue({
      success: true,
      data: { activas: 0, expiradas: 0, demos: 0, adminTest: 0, porVencer: 0 },
    })
    adminActions.getAdminPlanesAction.mockResolvedValue({ success: true, data: [] })
    adminActions.getGlobalUsersAction.mockResolvedValue({
      success: true,
      data: { users: [] },
    })
    adminActions.cleanupExpiredDemoLicenciasAction.mockResolvedValue({
      success: true,
      data: { count: 0 },
    })
  })

  it('usa el encabezado común con las acciones administrativas existentes', async () => {
    render(<AdminLicenciasPage />)

    await screen.findByText('No hay licencias')

    const heading = screen.getByRole('heading', { name: 'Licencias' })
    const header = heading.closest('header')

    expect(header).toBeInTheDocument()
    expect(header).toHaveTextContent('Gestión de licencias y activaciones')
    expect(header).toContainElement(
      screen.getByRole('button', { name: 'Limpiar Demos Expiradas' }),
    )
    expect(header).toContainElement(screen.getByRole('button', { name: 'Crear Demo' }))
    expect(header).toContainElement(
      screen.getByRole('button', { name: 'Generar Licencias' }),
    )
    expect(screen.getByRole('textbox', { name: 'Buscar licencias' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
