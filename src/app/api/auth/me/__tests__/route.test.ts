import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/auth/services/auth-service', () => ({
  AuthService: {
    me: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AuthService } from '@/features/auth/services/auth-service';
import { GET } from '../route';

describe('/api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the authenticated user payload when the auth context is valid', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        tenantId: 'tenant-1',
        tenantRole: 'manager',
      },
    } as never);
    vi.mocked(AuthService.me).mockResolvedValue({
      user: {
        userId: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
      },
    } as never);

    const request = new NextRequest('http://localhost/api/auth/me', {
      headers: { cookie: 'auth_token=token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userId).toBe('user-1');
    expect(data.tenantId).toBe('tenant-1');
    expect(AuthService.me).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', tenantId: 'tenant-1' }),
    );
  });

  it('forwards auth failures from authenticateUser', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/auth/me');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Token no proporcionado');
  });
});
