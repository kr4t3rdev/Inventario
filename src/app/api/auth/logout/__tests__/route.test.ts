import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/auth/services/auth-service', () => ({
  AuthService: {
    logout: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AuthService } from '@/features/auth/services/auth-service';
import { POST } from '../route';

describe('/api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears cookies and deactivates the session when the user is authenticated', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
      },
    } as never);
    vi.mocked(AuthService.logout).mockResolvedValue({ success: true } as never);

    const request = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { cookie: 'auth_token=token; refreshToken=refresh' },
    });

    const response = await POST(request);
    const data = await response.json();
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(data.message).toBe('Logout exitoso');
    expect(setCookie).toContain('auth_token=;');
    expect(setCookie).toContain('refreshToken=;');
    expect(AuthService.logout).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('still clears cookies and returns success when auth is already invalid', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(data.message).toBe('Logout exitoso');
    expect(setCookie).toContain('auth_token=;');
    expect(setCookie).toContain('refreshToken=;');
    expect(AuthService.logout).not.toHaveBeenCalled();
  });
});
