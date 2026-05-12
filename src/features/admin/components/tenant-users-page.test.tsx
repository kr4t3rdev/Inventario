import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const mockGetGlobalUsersAction = vi.fn()
const mockGetPendingMembershipsAction = vi.fn()
const mockApproveGlobalUserAction = vi.fn()
const mockRejectMembershipAction = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/features/admin/actions', () => ({
  getGlobalUsersAction: (...args: unknown[]) => mockGetGlobalUsersAction(...args),
  getPendingMembershipsAction: (...args: unknown[]) => mockGetPendingMembershipsAction(...args),
  approveGlobalUserAction: (...args: unknown[]) => mockApproveGlobalUserAction(...args),
  rejectMembershipAction: (...args: unknown[]) => mockRejectMembershipAction(...args),
}))

vi.mock('./tenant-users-stats', () => ({
  TenantUsersStats: () => <div data-testid="stats" />,
}))

vi.mock('./tenant-users-table', () => ({
  TenantUsersTable: () => <div data-testid="users-table" />,
}))

vi.mock('./pending-memberships-table', () => ({
  PendingMembershipsTable: () => <div data-testid="pending-table" />,
}))

vi.mock('./membership-action-dialog', () => ({
  MembershipActionDialog: () => <div data-testid="dialog" />,
}))

vi.mock('./tenant-users-skeleton', () => ({
  TenantUsersSkeleton: () => <div data-testid="skeleton" />,
}))

import { TenantUsersPage } from './tenant-users-page'

describe('TenantUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { tenantId: 'tenant-1' },
    })
    mockGetGlobalUsersAction.mockResolvedValue({ success: true, data: { users: [], total: 0 } })
    mockGetPendingMembershipsAction.mockResolvedValue({ success: true, data: [] })
    mockApproveGlobalUserAction.mockResolvedValue({ success: true })
    mockRejectMembershipAction.mockResolvedValue({ success: true })
  })

  it('renderiza sin usar refetchPending inexistente', async () => {
    expect(() => render(<TenantUsersPage />)).not.toThrow()
  })
})
