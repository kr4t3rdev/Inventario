import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { AdminLayoutClient } from '@/components/admin-layout-client';

function Probe() {
  const { user } = useAuth();

  return <span data-testid="user-email">{user?.email ?? 'anonymous'}</span>;
}

describe('AdminLayoutClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/me') {
        return new Response(JSON.stringify({ error: 'No autenticado' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;
  });

  it('preserves the authenticated snapshot provided by the root AuthProvider', async () => {
    render(
      <AuthProvider
        initialUser={{
          userId: 'user-1',
          name: 'Admin User',
          email: 'admin@test.local',
          password: '',
          role: 'admin',
          isActive: true,
          avatar: null,
          activatedAt: null,
          expiresAt: null,
          createdAt: '',
          updatedAt: '',
          lastModifiedBy: null,
          loginAttempts: 0,
          lockedUntil: null,
          lastFailedLogin: null,
        }}
      >
        <AdminLayoutClient>
          <Probe />
        </AdminLayoutClient>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('admin@test.local');
    });
  });
});
