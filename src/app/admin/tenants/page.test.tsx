import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockGetTenantsAction = vi.fn()
const mockGetSystemHealthAction = vi.fn()
const mockExportToCSV = vi.fn()

vi.mock('@/features/admin', () => ({
  getAdminTenantsAction: (...args: unknown[]) => mockGetTenantsAction(...args),
  getAdminSystemHealthAction: (...args: unknown[]) => mockGetSystemHealthAction(...args),
}))

vi.mock('@/lib/export-csv', () => ({
  exportToCSV: (...args: unknown[]) => mockExportToCSV(...args),
}))

import TenantsPage from './page'

const baseTenant = {
  tenantId: 'tenant-1',
  nombre: 'Empresa Demo',
  totalUsers: 3,
  activeUsers: 2,
  totalProductos: 40,
  totalAlmacenes: 1,
  totalVentas: 10,
  plan: 'Profesional',
  licenseActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  consumption: { usuarios: 10, productos: 100, almacenes: 2 },
}

describe('TenantsPage (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTenantsAction.mockResolvedValue({ success: true, data: [baseTenant] })
    mockGetSystemHealthAction.mockResolvedValue({ success: true, data: null })
  })

  it('agrupa acciones de fila con un trigger accesible (aria-label descriptivo)', async () => {
    render(<TenantsPage />)

    await waitFor(() => {
      expect(screen.getByText('Empresa Demo')).toBeInTheDocument()
    })

    const trigger = screen.getByRole('button', { name: /acciones .*Empresa Demo/i })
    expect(trigger).toBeInTheDocument()
  })

  it('no expone acciones muertas: solo "Ver detalles" está disponible y abre el diálogo', async () => {
    const user = userEvent.setup()
    render(<TenantsPage />)

    await waitFor(() => {
      expect(screen.getByText('Empresa Demo')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /acciones .*Empresa Demo/i }))

    const detailsItem = await screen.findByText('Ver detalles')
    expect(detailsItem).toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.queryByText('Suspender')).not.toBeInTheDocument()

    await user.click(detailsItem)

    await waitFor(() => {
      expect(screen.getByText(/Detalles y métricas del tenant/i)).toBeInTheDocument()
    })
  })

  it('expone controles de filtro accesibles: búsqueda y selects con nombre accesible', async () => {
    render(<TenantsPage />)

    await waitFor(() => {
      expect(screen.getByText('Empresa Demo')).toBeInTheDocument()
    })

    expect(screen.getByRole('textbox', { name: /buscar tenant/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /licencia/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /ordenar/i })).toBeInTheDocument()
  })

  it('botón exportar CSV es accesible y dispara la exportación', async () => {
    render(<TenantsPage />)

    await waitFor(() => {
      expect(screen.getByText('Empresa Demo')).toBeInTheDocument()
    })

    const exportBtn = screen.getByRole('button', { name: /exportar csv/i })
    expect(exportBtn).toBeEnabled()
    exportBtn.click()
    expect(mockExportToCSV).toHaveBeenCalledTimes(1)
  })
})