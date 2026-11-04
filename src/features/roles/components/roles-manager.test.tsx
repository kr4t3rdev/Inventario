import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockListTenantRolesAction = vi.fn()
const mockListTenantMembersAction = vi.fn()

vi.mock('@/features/roles/actions', () => ({
  listTenantRolesAction: (...args: unknown[]) => mockListTenantRolesAction(...args),
  listTenantMembersAction: (...args: unknown[]) => mockListTenantMembersAction(...args),
  createTenantRoleAction: vi.fn(),
  updateTenantRoleAction: vi.fn(),
  deleteTenantRoleAction: vi.fn(),
  assignCustomRoleAction: vi.fn(),
}))

import { RolesManager } from './roles-manager'

describe('RolesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListTenantRolesAction.mockResolvedValue({
      success: true,
      data: { roles: [] },
    })
    mockListTenantMembersAction.mockResolvedValue({
      success: true,
      data: { memberships: [] },
    })
  })

  it('usa el encabezado común y conserva la acción para crear roles', async () => {
    render(<RolesManager />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Roles' })).toBeInTheDocument()
    })
    const createButton = screen.getByRole('button', { name: 'Crear rol' })
    expect(createButton).toBeInTheDocument()

    fireEvent.click(createButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Crear rol personalizado' })).toBeInTheDocument()
  })
})
