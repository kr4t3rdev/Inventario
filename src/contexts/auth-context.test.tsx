import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { push, toastMock, toastError } = vi.hoisted(() => ({
  push: vi.fn(),
  toastMock: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(toastMock, { error: toastError }),
}));

import { AuthProvider, useAuth } from './auth-context';

function Probe() {
  const { login, logout, user, loading } = useAuth();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.loading = String(loading);
      document.body.dataset.user = user?.email ?? '';
    }
  }, [loading, user]);

  return (
    <div>
      <button onClick={() => login('test@example.com', 'secret123')}>login</button>
      <button onClick={() => logout()}>logout</button>
      <span data-testid="user-email">{user?.email ?? 'anonymous'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/auth/me') {
        return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
      }
      if (url === '/api/auth/login') {
        return new Response(JSON.stringify({ user: { email: 'test@example.com', role: 'admin' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/auth/logout') {
        return new Response(JSON.stringify({ message: 'Logout exitoso' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
    }) as typeof fetch;
  });

  it('logs in through the stable auth route instead of a client Server Action', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/admin');
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('logs out through the stable auth route and clears client auth state', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'login' }));
    await waitFor(() => expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com'));

    await user.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/login');
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByTestId('user-email')).toHaveTextContent('anonymous');
  });
});
