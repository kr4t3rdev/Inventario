import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/admin/server/admin-global-queries', () => ({
  renewAdminLicense: vi.fn(),
  activateAdminLicense: vi.fn(),
  deactivateAdminLicense: vi.fn(),
  deleteAdminLicense: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import {
  renewAdminLicense,
  activateAdminLicense,
  deactivateAdminLicense,
  deleteAdminLicense,
} from '@/features/admin/server/admin-global-queries';
import { POST as renewPOST } from '../licenses/renew/route';
import { POST as activatePOST } from '../licenses/activate/route';
import { POST as deactivatePOST } from '../licenses/deactivate/route';
import { POST as deletePOST } from '../licenses/delete/route';

const adminUser = { userId: 'admin-1', role: 'admin', tenantId: null };

function authenticatedAs(role: string): void {
  vi.mocked(authenticateUser).mockResolvedValue({ user: { ...adminUser, role } } as never);
}

function unauthenticated(): void {
  vi.mocked(authenticateUser).mockResolvedValue(
    NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
  );
}

function buildRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/mobile/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('mobile admin license management routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedAs('admin');
  });

  it('renews a license extending its expiration', async () => {
    const payload = {
      tenantLicenseId: 'lic-1',
      newExpiracion: '2027-01-01T00:00:00.000Z',
      newPlanId: 'plan-pro',
      previousExpiracion: '2026-01-01T00:00:00.000Z',
      previousPlanId: 'plan-basic',
      message: 'Licencia renovada correctamente',
    };
    vi.mocked(renewAdminLicense).mockResolvedValue(payload as never);

    const response = await renewPOST(
      buildRequest('/admin/licenses/renew', { tenantLicenseId: 'lic-1', planId: 'plan-pro' }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(payload);
    expect(renewAdminLicense).toHaveBeenCalledWith(
      { tenantLicenseId: 'lic-1', planId: 'plan-pro' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('maps unknown license renewal to 404', async () => {
    vi.mocked(renewAdminLicense).mockRejectedValue(new ActionError('Licencia no encontrada', 'NOT_FOUND'));

    const response = await renewPOST(
      buildRequest('/admin/licenses/renew', { tenantLicenseId: 'missing' }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('activates a license', async () => {
    const payload = {
      license: { tenantLicenseId: 'lic-1', activa: true },
      message: 'Licencia activada correctamente',
    };
    vi.mocked(activateAdminLicense).mockResolvedValue(payload as never);

    const response = await activatePOST(buildRequest('/admin/licenses/activate', { tenantLicenseId: 'lic-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('maps activating an active license to 409', async () => {
    vi.mocked(activateAdminLicense).mockRejectedValue(new ActionError('La licencia ya está activa', 'CONFLICT'));

    const response = await activatePOST(buildRequest('/admin/licenses/activate', { tenantLicenseId: 'lic-1' }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CONFLICT' });
  });

  it('deactivates a license', async () => {
    const payload = {
      license: { tenantLicenseId: 'lic-1', activa: false },
      message: 'Licencia desactivada correctamente',
    };
    vi.mocked(deactivateAdminLicense).mockResolvedValue(payload as never);

    const response = await deactivatePOST(buildRequest('/admin/licenses/deactivate', { tenantLicenseId: 'lic-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(deactivateAdminLicense).toHaveBeenCalledWith(
      { tenantLicenseId: 'lic-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('deletes a license', async () => {
    vi.mocked(deleteAdminLicense).mockResolvedValue({ success: true, tenantLicenseId: 'lic-1' } as never);

    const response = await deletePOST(buildRequest('/admin/licenses/delete', { tenantLicenseId: 'lic-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, tenantLicenseId: 'lic-1' });
  });

  it('rejects unauthenticated requests', async () => {
    unauthenticated();

    const response = await renewPOST(buildRequest('/admin/licenses/renew', { tenantLicenseId: 'lic-1' }));

    expect(response.status).toBe(401);
  });

  it('rejects non-admin roles', async () => {
    authenticatedAs('regularUser');

    const response = await deletePOST(buildRequest('/admin/licenses/delete', { tenantLicenseId: 'lic-1' }));

    expect(response.status).toBe(403);
  });
});
