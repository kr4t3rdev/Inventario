import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/admin/server/admin-global-queries', () => ({
  getAdminHealth: vi.fn(),
  getAdminUsers: vi.fn(),
  getAdminTenants: vi.fn(),
  getAdminLicenses: vi.fn(),
  getAdminLicenseStats: vi.fn(),
  getAdminPendingMemberships: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import {
  getAdminHealth,
  getAdminLicenseStats,
  getAdminLicenses,
  getAdminPendingMemberships,
  getAdminTenants,
  getAdminUsers,
} from '@/features/admin/server/admin-global-queries';
import { GET as healthGET } from '../health/route';
import { GET as usersGET } from '../users/route';
import { GET as tenantsGET } from '../tenants/route';
import { GET as licensesGET } from '../licenses/route';
import { GET as licenseStatsGET } from '../licenses/stats/route';
import { GET as pendingGET } from '../memberships/pending/route';

const adminUser = { userId: 'admin-1', role: 'admin', tenantId: null };

function authenticatedAs(role: string): void {
  vi.mocked(authenticateUser).mockResolvedValue({ user: { ...adminUser, role } } as never);
}

function unauthenticated(): void {
  vi.mocked(authenticateUser).mockResolvedValue(
    NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
  );
}

function buildRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost/api/mobile/v1${path}`, { method: 'GET' });
}

describe('mobile admin read routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedAs('admin');
  });

  it('returns platform health metrics', async () => {
    const health = {
      users: { total: 10, byRole: [{ role: 'admin', count: 1 }] },
      tenants: { total: 3 },
      sessions: { active: 5 },
      licenses: { total: 3, active: 2, expiringSoon: 1 },
      usersTrend: [],
      usersComparison: { current7DaysUsers: 2, previous7DaysUsers: 1 },
    };
    vi.mocked(getAdminHealth).mockResolvedValue(health as never);

    const response = await healthGET(buildRequest('/admin/health'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(health);
  });

  it('lists users and forwards tenant and limit filters', async () => {
    vi.mocked(getAdminUsers).mockResolvedValue({ users: [], total: 0 } as never);

    const response = await usersGET(
      new NextRequest('http://localhost/api/mobile/v1/admin/users?tenantId=tenant-1&limit=10'),
    );

    expect(response.status).toBe(200);
    expect(getAdminUsers).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', limit: 10 },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('lists platform tenants as an array', async () => {
    const tenants = [{ tenantId: 'tenant-1', nombre: 'Empresa', totalUsers: 4 }];
    vi.mocked(getAdminTenants).mockResolvedValue(tenants as never);

    const response = await tenantsGET(buildRequest('/admin/tenants'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(tenants);
  });

  it('lists licenses with pagination envelope', async () => {
    const payload = { licencias: [], total: 0, page: 1, limit: 25 };
    vi.mocked(getAdminLicenses).mockResolvedValue(payload as never);

    const response = await licensesGET(
      new NextRequest('http://localhost/api/mobile/v1/admin/licenses?page=2&limit=10'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(payload);
    expect(getAdminLicenses).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('returns license stats aggregates', async () => {
    const stats = { total: 5, activas: 3, expiradas: 1, demos: 1, porVencer: 1, adminTest: 0 };
    vi.mocked(getAdminLicenseStats).mockResolvedValue(stats as never);

    const response = await licenseStatsGET(buildRequest('/admin/license-stats'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(stats);
  });

  it('lists pending memberships as an array', async () => {
    const pending = [{ membershipId: 'membership-1', isActive: false }];
    vi.mocked(getAdminPendingMemberships).mockResolvedValue(pending as never);

    const response = await pendingGET(buildRequest('/admin/memberships/pending'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(pending);
  });

  it('rejects non-admin roles with 403', async () => {
    authenticatedAs('user');

    const response = await healthGET(buildRequest('/admin/health'));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(getAdminHealth).not.toHaveBeenCalled();
  });

  it('propagates authentication failures', async () => {
    unauthenticated();

    const response = await tenantsGET(buildRequest('/admin/tenants'));

    expect(response.status).toBe(401);
    expect(getAdminTenants).not.toHaveBeenCalled();
  });
});
