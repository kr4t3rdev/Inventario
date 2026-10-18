import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/admin/server/admin-global-queries', () => ({
  getAdminTenantDetail: vi.fn(),
  updateAdminTenant: vi.fn(),
  activateAdminTenant: vi.fn(),
  deactivateAdminTenant: vi.fn(),
  deleteAdminTenant: vi.fn(),
  getAdminTenantUsers: vi.fn(),
  removeAdminTenantUser: vi.fn(),
  getAdminTenantLicense: vi.fn(),
  assignAdminTenantLicense: vi.fn(),
  updateAdminTenantLicense: vi.fn(),
  deactivateAdminLicense: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import {
  getAdminTenantDetail,
  updateAdminTenant,
  activateAdminTenant,
  deactivateAdminTenant,
  deleteAdminTenant,
  getAdminTenantUsers,
  removeAdminTenantUser,
  getAdminTenantLicense,
  assignAdminTenantLicense,
  updateAdminTenantLicense,
  deactivateAdminLicense,
} from '@/features/admin/server/admin-global-queries';
import { GET as detailGET } from '../tenants/detail/route';
import { PATCH as updatePATCH } from '../tenants/update/route';
import { POST as activatePOST } from '../tenants/activate/route';
import { POST as deactivatePOST } from '../tenants/deactivate/route';
import { POST as deletePOST } from '../tenants/delete/route';
import { GET as usersGET } from '../tenants/users/route';
import { POST as removeUserPOST } from '../tenants/remove-user/route';
import { GET as licenseGET } from '../tenants/license/route';
import { POST as licenseAssignPOST } from '../tenants/license/assign/route';
import { PATCH as licenseUpdatePATCH } from '../tenants/license/update/route';
import { POST as licenseDeactivatePOST } from '../tenants/license/deactivate/route';

const adminUser = { userId: 'admin-1', role: 'admin', tenantId: null };

function authenticatedAs(role: string): void {
  vi.mocked(authenticateUser).mockResolvedValue({ user: { ...adminUser, role } } as never);
}

function unauthenticated(): void {
  vi.mocked(authenticateUser).mockResolvedValue(
    NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
  );
}

function buildRequest(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/mobile/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('mobile admin tenant management routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedAs('admin');
  });

  it('returns the tenant detail', async () => {
    const detail = { tenant: { tenantId: 't-1', nombre: 'Acme' }, currentLicense: null };
    vi.mocked(getAdminTenantDetail).mockResolvedValue(detail as never);

    const response = await detailGET(buildRequest('/admin/tenants/detail?tenantId=t-1', 'GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(detail);
    expect(getAdminTenantDetail).toHaveBeenCalledWith(
      { tenantId: 't-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('maps unknown tenant detail to 404', async () => {
    vi.mocked(getAdminTenantDetail).mockRejectedValue(new ActionError('Empresa no encontrada', 'NOT_FOUND'));

    const response = await detailGET(buildRequest('/admin/tenants/detail?tenantId=missing', 'GET'));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updates tenant data', async () => {
    const payload = { tenant: { tenantId: 't-1', nombre: 'Acme SA' }, message: 'Empresa actualizada correctamente' };
    vi.mocked(updateAdminTenant).mockResolvedValue(payload as never);

    const response = await updatePATCH(
      buildRequest('/admin/tenants/update', 'PATCH', { tenantId: 't-1', nombre: 'Acme SA', taxId: '123' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(updateAdminTenant).toHaveBeenCalledWith(
      { tenantId: 't-1', nombre: 'Acme SA', taxId: '123' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('activates a tenant', async () => {
    const payload = { tenantId: 't-1', membershipsActivated: 3, message: 'Acme activada: 3 membresías reactivadas' };
    vi.mocked(activateAdminTenant).mockResolvedValue(payload as never);

    const response = await activatePOST(buildRequest('/admin/tenants/activate', 'POST', { tenantId: 't-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('deactivates a tenant', async () => {
    const payload = { tenantId: 't-1', membershipsDeactivated: 3, message: 'Acme desactivada: 3 membresías bloqueadas' };
    vi.mocked(deactivateAdminTenant).mockResolvedValue(payload as never);

    const response = await deactivatePOST(buildRequest('/admin/tenants/deactivate', 'POST', { tenantId: 't-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(deactivateAdminTenant).toHaveBeenCalledWith(
      { tenantId: 't-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('deletes a tenant', async () => {
    const payload = { success: true, tenantId: 't-1', message: 'Empresa Acme eliminada permanentemente' };
    vi.mocked(deleteAdminTenant).mockResolvedValue(payload as never);

    const response = await deletePOST(buildRequest('/admin/tenants/delete', 'POST', { tenantId: 't-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('lists tenant users', async () => {
    const payload = { users: [{ userId: 'u-1', tenantRole: 'manager' }], total: 1, tenantId: 't-1' };
    vi.mocked(getAdminTenantUsers).mockResolvedValue(payload as never);

    const response = await usersGET(buildRequest('/admin/tenants/users?tenantId=t-1', 'GET'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(getAdminTenantUsers).toHaveBeenCalledWith(
      { tenantId: 't-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('removes a user from the tenant', async () => {
    const payload = { success: true, membershipId: 'm-1', message: 'Ana fue quitado de Acme' };
    vi.mocked(removeAdminTenantUser).mockResolvedValue(payload as never);

    const response = await removeUserPOST(
      buildRequest('/admin/tenants/remove-user', 'POST', { tenantId: 't-1', userId: 'u-1' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('maps removing a non-member to 404', async () => {
    vi.mocked(removeAdminTenantUser).mockRejectedValue(new ActionError('El usuario no pertenece a esta empresa', 'NOT_FOUND'));

    const response = await removeUserPOST(
      buildRequest('/admin/tenants/remove-user', 'POST', { tenantId: 't-1', userId: 'u-9' }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns the tenant licenses', async () => {
    const payload = { licenses: [{ tenantLicenseId: 'lic-1' }], current: { tenantLicenseId: 'lic-1' }, tenantId: 't-1' };
    vi.mocked(getAdminTenantLicense).mockResolvedValue(payload as never);

    const response = await licenseGET(buildRequest('/admin/tenants/license?tenantId=t-1', 'GET'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('assigns a license to the tenant', async () => {
    const payload = { license: { tenantLicenseId: 'lic-2' }, message: 'Licencia Pro asignada a Acme' };
    vi.mocked(assignAdminTenantLicense).mockResolvedValue(payload as never);

    const response = await licenseAssignPOST(
      buildRequest('/admin/tenants/license/assign', 'POST', { tenantId: 't-1', planId: 'plan-pro' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(assignAdminTenantLicense).toHaveBeenCalledWith(
      { tenantId: 't-1', planId: 'plan-pro' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('updates a license plan and limits', async () => {
    const payload = { license: { tenantLicenseId: 'lic-1' }, message: 'Licencia actualizada correctamente' };
    vi.mocked(updateAdminTenantLicense).mockResolvedValue(payload as never);

    const response = await licenseUpdatePATCH(
      buildRequest('/admin/tenants/license/update', 'PATCH', { tenantLicenseId: 'lic-1', planId: 'plan-pro', maxUsuarios: 10 }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('deactivates a tenant license', async () => {
    const payload = { license: { tenantLicenseId: 'lic-1', activa: false }, message: 'Licencia desactivada correctamente' };
    vi.mocked(deactivateAdminLicense).mockResolvedValue(payload as never);

    const response = await licenseDeactivatePOST(
      buildRequest('/admin/tenants/license/deactivate', 'POST', { tenantLicenseId: 'lic-1' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('rejects unauthenticated requests', async () => {
    unauthenticated();

    const response = await detailGET(buildRequest('/admin/tenants/detail?tenantId=t-1', 'GET'));

    expect(response.status).toBe(401);
  });

  it('rejects non-admin roles', async () => {
    authenticatedAs('regularUser');

    const response = await deletePOST(buildRequest('/admin/tenants/delete', 'POST', { tenantId: 't-1' }));

    expect(response.status).toBe(403);
  });
});
