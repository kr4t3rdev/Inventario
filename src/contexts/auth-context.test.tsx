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
    window.history.pushState({}, '', '/');
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/auth/me') {
        return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
      }
      if (url === '/api/auth/login') {
        return new Response(JSON.stringify({
          user: { email: 'test@example.com', role: 'admin' },
          redirectTo: '/onboarding',
        }), {
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
      expect(push).toHaveBeenCalledWith('/onboarding');
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('stores the onboardingToken in sessionStorage before navigating to /onboarding', async () => {
    sessionStorage.removeItem('onboardingToken');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      user: { email: 'pending@example.com', role: 'regularUser' },
      redirectTo: '/onboarding',
      onboardingToken: 'onboarding-token-123',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const user = userEvent.setup();

    render(
      <AuthProvider initialUser={null}>
        <Probe />
      </AuthProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding'));
    expect(sessionStorage.getItem('onboardingToken')).toBe('onboarding-token-123');
  });

  it('does not overwrite sessionStorage when login returns no onboardingToken', async () => {
    sessionStorage.setItem('onboardingToken', 'existing-token');
    const user = userEvent.setup();

    render(
      <AuthProvider initialUser={null}>
        <Probe />
      </AuthProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding'));
    expect(sessionStorage.getItem('onboardingToken')).toBe('existing-token');
    sessionStorage.removeItem('onboardingToken');
  });

  it('falls back safely when login returns a redirect outside the allowlist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      user: { email: 'test@example.com', role: 'admin' },
      redirectTo: 'https://attacker.test/phishing',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const user = userEvent.setup();

    render(
      <AuthProvider initialUser={null}>
        <Probe />
      </AuthProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'));
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

  it('hydrates the authenticated user immediately from the server snapshot', async () => {
    render(
      <AuthProvider
        initialUser={{
          userId: 'user-1',
          name: 'Test User',
          email: 'tenant@example.com',
          password: '',
          role: 'manager',
          tenantRole: 'manager',
          tenantId: 'tenant-1',
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
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('user-email')).toHaveTextContent('tenant@example.com');

    await waitFor(() => {
      expect(document.body.dataset.loading).toBe('false');
    });
  });

  it('treats initialUser={null} as a resolved SSR snapshot (no fetch, loading=false, no redirect)', async () => {
    window.history.pushState({}, '', '/busy/sales/new');
    const fetchMock = vi.fn(async () => {
      throw new Error('fetch should not be called when initialUser is resolved');
    });
    global.fetch = fetchMock as typeof fetch;

    render(
      <AuthProvider initialUser={null}>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(document.body.dataset.loading).toBe('false');
    });
    expect(screen.getByTestId('user-email')).toHaveTextContent('anonymous');
    expect(push).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not log noisy console errors when auth check fails due to network fetch', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/me') {
        throw new Error('Failed to fetch');
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(document.body.dataset.loading).toBe('false');
    });

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Error checking auth:',
      'Failed to fetch',
    );

    consoleErrorSpy.mockRestore();
  });

  it('does not call /api/auth/me when initialUser was supplied by the server', async () => {
    render(
      <AuthProvider
        initialUser={{
          userId: 'user-1',
          name: 'Test User',
          email: 'tenant@example.com',
          password: '',
          role: 'manager',
          tenantRole: 'manager',
          tenantId: 'tenant-1',
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
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(document.body.dataset.loading).toBe('false');
    });

    const meCalls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => String(url) === '/api/auth/me',
    );
    expect(meCalls).toHaveLength(0);
  });

  it('does not call /api/auth/me when initialUser is explicitly null (SSR confirmed no session)', async () => {
    render(
      <AuthProvider initialUser={null}>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(document.body.dataset.loading).toBe('false');
    });
    expect(screen.getByTestId('user-email')).toHaveTextContent('anonymous');

    const meCalls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => String(url) === '/api/auth/me',
    );
    expect(meCalls).toHaveLength(0);
  });

  it('calls /api/auth/me on mount when the provider is created without initialUser', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(document.body.dataset.loading).toBe('false');
    });

    const meCalls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => String(url) === '/api/auth/me',
    );
    expect(meCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps polling /api/auth/me after the initial skip (visibility revalidation still works)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/me') {
        return new Response(
          JSON.stringify({
            userId: 'user-1',
            name: 'Test User',
            email: 'tenant@example.com',
            password: '',
            role: 'manager',
            tenantRole: 'manager',
            tenantId: 'tenant-1',
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
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    render(
      <AuthProvider
        initialUser={{
          userId: 'user-1',
          name: 'Test User',
          email: 'tenant@example.com',
          password: '',
          role: 'manager',
          tenantRole: 'manager',
          tenantId: 'tenant-1',
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
        <Probe />
      </AuthProvider>,
    );

    // 1) No call on mount thanks to SSR snap.
    await waitFor(() => {
      expect(document.body.dataset.loading).toBe('false');
    });
    const callsAfterMount = fetchMock.mock.calls.filter(
      ([url]) => String(url) === '/api/auth/me',
    ).length;
    expect(callsAfterMount).toBe(0);

    // 2) visibilitychange === 'visible' should revalidate while there's a user.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(
        ([url]) => String(url) === '/api/auth/me',
      ).length;
      expect(calls).toBeGreaterThan(0);
    });
  });
});
