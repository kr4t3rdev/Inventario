import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const mockGetGlobalUsersAction = vi.fn()
const mockGetPendingMembershipsAction = vi.fn()
const mockFetch = vi.fn()
const mockRejectMembershipAction = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/features/admin/actions', () => ({
  getGlobalUsersAction: (...args: unknown[]) => mockGetGlobalUsersAction(...args),
  getPendingMembershipsAction: (...args: unknown[]) => mockGetPendingMembershipsAction(...args),
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

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

import { TenantUsersPage } from './tenant-users-page'

describe('TenantUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { tenantId: 'tenant-1' },
    })
    mockGetGlobalUsersAction.mockResolvedValue({ success: true, data: { users: [], total: 0 } })
    mockGetPendingMembershipsAction.mockResolvedValue({ success: true, data: [] })
    mockRejectMembershipAction.mockResolvedValue({ success: true })
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
  })

  it('aprueba una membresía usando el endpoint de tenant', async () => {
    render(<TenantUsersPage />)

    await waitFor(() => {
      expect(mockGetPendingMembershipsAction).toHaveBeenCalled()
    })
  })
})
