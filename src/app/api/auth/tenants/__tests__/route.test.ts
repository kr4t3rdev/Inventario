import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/features/auth/services/auth-service', () => ({
  AuthService: {
    listTenants: vi.fn(),
    switchTenant: vi.fn(),
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

import { AuthService } from '@/features/auth/services/auth-service';
import { authenticateUser } from '@/lib/auth-middleware';
import { GET, POST } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { productos: true },
};

describe('/api/auth/tenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the active tenant list for the authenticated web user', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AuthService.listTenants).mockResolvedValue([
      { tenantId: 'tenant-1', nombre: 'Tenant 1', slug: 'tenant-1', tenantRole: 'manager', isCurrent: true },
      { tenantId: 'tenant-2', nombre: 'Tenant 2', slug: 'tenant-2', tenantRole: 'manager', isCurrent: false },
    ] as never);

    const request = new NextRequest('http://localhost/api/auth/tenants', {
      method: 'GET',
      headers: { authorization: 'Bearer token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].tenantId).toBe('tenant-1');
  });

  it('switches tenant and refreshes auth cookies', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AuthService.switchTenant).mockResolvedValue({
      tenantId: 'tenant-2',
      tenantRole: 'manager',
      tokens: {
        accessToken: 'switch-access',
        refreshToken: 'switch-refresh',
        accessTokenMaxAge: 1800,
        refreshTokenMaxAge: 2592000,
      },
    } as never);

    const request = new NextRequest('http://localhost/api/auth/tenants', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token',
        'content-type': 'application/json',
        'user-agent': 'vitest',
      },
      body: JSON.stringify({ tenantId: 'tenant-2' }),
    });

    const response = await POST(request);
    const data = await response.json();
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(data.tenantId).toBe('tenant-2');
    expect(data.tenantRole).toBe('manager');
    expect(setCookie).toContain('auth_token=switch-access');
    expect(setCookie).toContain('refreshToken=switch-refresh');
  });

  it('forwards auth failures from authenticateUser', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/auth/tenants', {
      method: 'GET',
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});
