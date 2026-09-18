import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/features/auth/services/auth-service', () => ({
  AuthService: {
    login: vi.fn(),
    refresh: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    listTenants: vi.fn(),
    switchTenant: vi.fn(),
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

import { AuthService } from '@/features/auth/services/auth-service';
import { authenticateUser } from '@/lib/auth-middleware';
import { POST as loginPOST } from '../login/route';
import { POST as refreshPOST } from '../refresh/route';
import { GET as meGET } from '../me/route';
import { POST as logoutPOST } from '../logout/route';
import { GET as tenantsGET, POST as tenantsPOST } from '../tenants/route';

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

describe('mobile auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login returns token JSON without requiring cookies', async () => {
    vi.mocked(AuthService.login).mockResolvedValue({
      user: mockUser,
      tokens: {
        accessToken: 'mobile-access',
        refreshToken: 'mobile-refresh',
        accessTokenMaxAge: 1800,
        refreshTokenMaxAge: 2592000,
      },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'vitest-mobile' },
      body: JSON.stringify({ email: 'test@example.com', password: 'secret123' }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.tenantId).toBe('tenant-1');
    expect(data.accessToken.token).toBe('mobile-access');
    expect(data.refreshToken.token).toBe('mobile-refresh');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('refresh accepts refreshToken in JSON body', async () => {
    vi.mocked(AuthService.refresh).mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      accessTokenMaxAge: 900,
      refreshTokenMaxAge: 2592000,
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': 'tenant-1' },
      body: JSON.stringify({ refreshToken: 'mobile-refresh' }),
    });

    const response = await refreshPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accessToken.token).toBe('new-access');
    expect(vi.mocked(AuthService.refresh)).toHaveBeenCalledWith({
      refreshToken: 'mobile-refresh',
      client: expect.objectContaining({ tenantId: 'tenant-1' }),
    });
  });

  it('me returns 401 when authenticateUser rejects the request', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/auth/me', {
      method: 'GET',
    });

    const response = await meGET(request);
    expect(response.status).toBe(401);
  });

  it('logout deactivates the current mobile session', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AuthService.logout).mockResolvedValue({ success: true } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/auth/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access' },
    });

    const response = await logoutPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(vi.mocked(AuthService.logout)).toHaveBeenCalledWith(mockUser);
  });

  it('tenants GET returns active tenant list for the bearer user', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AuthService.listTenants).mockResolvedValue([
      { tenantId: 'tenant-1', nombre: 'Tenant 1', slug: 'tenant-1', tenantRole: 'manager', isCurrent: true },
      { tenantId: 'tenant-2', nombre: 'Tenant 2', slug: 'tenant-2', tenantRole: 'manager', isCurrent: false },
    ] as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/auth/tenants', {
      method: 'GET',
      headers: { authorization: 'Bearer mobile-access' },
    });

    const response = await tenantsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(data.items[1].tenantId).toBe('tenant-2');
  });

  it('tenants POST switches tenant and returns new token context', async () => {
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

    const request = new NextRequest('http://localhost/api/mobile/v1/auth/tenants', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'x-tenant-id': 'tenant-1',
      },
      body: JSON.stringify({ tenantId: 'tenant-2' }),
    });

    const response = await tenantsPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tenantId).toBe('tenant-2');
    expect(data.accessToken.token).toBe('switch-access');
    expect(vi.mocked(AuthService.switchTenant)).toHaveBeenCalledWith({
      tenantId: 'tenant-2',
      user: mockUser,
      client: expect.objectContaining({ tenantId: 'tenant-1' }),
    });
  });
});
