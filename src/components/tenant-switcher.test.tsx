import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toastError, reloadMock, authUser } = vi.hoisted(() => ({
  toastError: vi.fn(),
  reloadMock: vi.fn(),
  authUser: {
    userId: 'user-1',
    email: 'test@example.com',
    role: 'admin',
    tenantId: 'tenant-1',
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
  },
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: authUser,
  }),
}));

import { TenantSwitcher } from './tenant-switcher';

describe('TenantSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });
  });

  it('renders alternate tenants from the stable tenants payload', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        items: [
          { tenantId: 'tenant-1', nombre: 'Tenant 1', slug: 'tenant-1', tenantRole: 'manager', isCurrent: true },
          { tenantId: 'tenant-2', nombre: 'Tenant 2', slug: 'tenant-2', tenantRole: 'manager', isCurrent: false },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ) as typeof fetch;

    render(<TenantSwitcher />);

    expect(await screen.findByText('Tenant 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tenant 2/i })).toBeInTheDocument();
  });

  it('surfaces switch errors from the stable route without dropping current UI state', async () => {
    const user = userEvent.setup();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          items: [
            { tenantId: 'tenant-1', nombre: 'Tenant 1', slug: 'tenant-1', tenantRole: 'manager', isCurrent: true },
            { tenantId: 'tenant-2', nombre: 'Tenant 2', slug: 'tenant-2', tenantRole: 'manager', isCurrent: false },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'No autorizado', code: 'FORBIDDEN' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ) as typeof fetch;

    render(<TenantSwitcher />);

    await user.click(await screen.findByRole('button', { name: /Tenant 2/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('No autorizado');
    });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(screen.getByText('Tenant 1')).toBeInTheDocument();
  });
});
