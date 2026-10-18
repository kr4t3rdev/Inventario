import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/admin/server/admin-global-queries', () => ({
  getAdminUserDetail: vi.fn(),
  updateAdminUser: vi.fn(),
  activateAdminUser: vi.fn(),
  deactivateAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
  resetAdminUserPassword: vi.fn(),
  verifyAdminUserEmail: vi.fn(),
  resendAdminUserVerification: vi.fn(),
  assignAdminUserTenant: vi.fn(),
  changeAdminUserTenantRole: vi.fn(),
  revokeAdminUserSessions: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import {
  getAdminUserDetail,
  updateAdminUser,
  activateAdminUser,
  deactivateAdminUser,
  deleteAdminUser,
  resetAdminUserPassword,
  verifyAdminUserEmail,
  resendAdminUserVerification,
  assignAdminUserTenant,
  changeAdminUserTenantRole,
  revokeAdminUserSessions,
} from '@/features/admin/server/admin-global-queries';
import { GET as detailGET } from '../users/detail/route';
import { PATCH as updatePATCH } from '../users/update/route';
import { POST as activatePOST } from '../users/activate/route';
import { POST as deactivatePOST } from '../users/deactivate/route';
import { POST as deletePOST } from '../users/delete/route';
import { POST as resetPasswordPOST } from '../users/reset-password/route';
import { POST as verifyEmailPOST } from '../users/verify-email/route';
import { POST as resendVerificationPOST } from '../users/resend-verification/route';
import { POST as assignTenantPOST } from '../users/assign-tenant/route';
import { PATCH as changeTenantRolePATCH } from '../users/change-tenant-role/route';
import { POST as revokeSessionsPOST } from '../users/revoke-sessions/route';

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

describe('mobile admin user management routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedAs('admin');
  });

  it('returns the individual user detail', async () => {
    const detail = { user: { userId: 'user-1', name: 'Ana', activeSessions: 2 } };
    vi.mocked(getAdminUserDetail).mockResolvedValue(detail as never);

    const response = await detailGET(buildRequest('/admin/users/detail?userId=user-1', 'GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(detail);
    expect(getAdminUserDetail).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('maps unknown user detail to 404', async () => {
    vi.mocked(getAdminUserDetail).mockRejectedValue(new ActionError('Usuario no encontrado', 'NOT_FOUND'));

    const response = await detailGET(buildRequest('/admin/users/detail?userId=missing', 'GET'));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updates name, email and role', async () => {
    const payload = { user: { userId: 'user-1', name: 'Ana P', role: 'regularUser' }, message: 'Usuario actualizado correctamente' };
    vi.mocked(updateAdminUser).mockResolvedValue(payload as never);

    const response = await updatePATCH(
      buildRequest('/admin/users/update', 'PATCH', { userId: 'user-1', name: 'Ana P', email: 'ana@x.com', role: 'regularUser' }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(payload);
    expect(updateAdminUser).toHaveBeenCalledWith(
      { userId: 'user-1', name: 'Ana P', email: 'ana@x.com', role: 'regularUser' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('maps email conflict on update to 409', async () => {
    vi.mocked(updateAdminUser).mockRejectedValue(new ActionError('El email ya está en uso por otro usuario', 'CONFLICT'));

    const response = await updatePATCH(
      buildRequest('/admin/users/update', 'PATCH', { userId: 'user-1', email: 'taken@x.com' }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CONFLICT' });
  });

  it('activates a user', async () => {
    const payload = { user: { userId: 'user-1', isActive: true, lockedUntil: null }, message: 'Usuario activado correctamente' };
    vi.mocked(activateAdminUser).mockResolvedValue(payload as never);

    const response = await activatePOST(buildRequest('/admin/users/activate', 'POST', { userId: 'user-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('deactivates a user revoking sessions', async () => {
    const payload = { user: { userId: 'user-1', isActive: false, lockedUntil: null }, message: 'Usuario desactivado y sesiones revocadas' };
    vi.mocked(deactivateAdminUser).mockResolvedValue(payload as never);

    const response = await deactivatePOST(buildRequest('/admin/users/deactivate', 'POST', { userId: 'user-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('maps self deactivation to 403', async () => {
    vi.mocked(deactivateAdminUser).mockRejectedValue(new ActionError('No puedes desactivar tu propio usuario', 'FORBIDDEN'));

    const response = await deactivatePOST(buildRequest('/admin/users/deactivate', 'POST', { userId: 'admin-1' }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('deletes a user', async () => {
    vi.mocked(deleteAdminUser).mockResolvedValue({ success: true, userId: 'user-1' } as never);

    const response = await deletePOST(buildRequest('/admin/users/delete', 'POST', { userId: 'user-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, userId: 'user-1' });
  });

  it('sends the password reset link', async () => {
    const payload = { success: true, message: 'Enlace de restablecimiento enviado a ana@x.com' };
    vi.mocked(resetAdminUserPassword).mockResolvedValue(payload as never);

    const response = await resetPasswordPOST(buildRequest('/admin/users/reset-password', 'POST', { userId: 'user-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('marks email as verified', async () => {
    const payload = { user: { userId: 'user-1', email: 'ana@x.com' }, alreadyVerified: false, message: 'Email marcado como verificado' };
    vi.mocked(verifyAdminUserEmail).mockResolvedValue(payload as never);

    const response = await verifyEmailPOST(buildRequest('/admin/users/verify-email', 'POST', { userId: 'user-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('resends the verification email', async () => {
    const payload = { success: true, message: 'Email de verificación reenviado a ana@x.com' };
    vi.mocked(resendAdminUserVerification).mockResolvedValue(payload as never);

    const response = await resendVerificationPOST(buildRequest('/admin/users/resend-verification', 'POST', { userId: 'user-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('maps resend on verified email to 409', async () => {
    vi.mocked(resendAdminUserVerification).mockRejectedValue(new ActionError('El email de este usuario ya está verificado', 'CONFLICT'));

    const response = await resendVerificationPOST(buildRequest('/admin/users/resend-verification', 'POST', { userId: 'user-1' }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CONFLICT' });
  });

  it('assigns a user to a tenant', async () => {
    const payload = { membership: { membershipId: 'm-1', tenantRole: 'manager' }, message: 'Usuario asignado a Acme como manager' };
    vi.mocked(assignAdminUserTenant).mockResolvedValue(payload as never);

    const response = await assignTenantPOST(
      buildRequest('/admin/users/assign-tenant', 'POST', { userId: 'user-1', tenantId: 'tenant-1', tenantRole: 'manager', deactivateOthers: true }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('changes the tenant role', async () => {
    const payload = { membership: { membershipId: 'm-1', tenantRole: 'economico' }, message: 'Rol actualizado a economico en Acme' };
    vi.mocked(changeAdminUserTenantRole).mockResolvedValue(payload as never);

    const response = await changeTenantRolePATCH(
      buildRequest('/admin/users/change-tenant-role', 'PATCH', { userId: 'user-1', tenantId: 'tenant-1', tenantRole: 'economico' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('maps missing membership on role change to 404', async () => {
    vi.mocked(changeAdminUserTenantRole).mockRejectedValue(new ActionError('El usuario no tiene membresía en esta empresa. Usa asignar empresa primero', 'NOT_FOUND'));

    const response = await changeTenantRolePATCH(
      buildRequest('/admin/users/change-tenant-role', 'PATCH', { userId: 'user-1', tenantId: 'tenant-9', tenantRole: 'manager' }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('revokes active sessions', async () => {
    const payload = { revoked: 3, message: 'Se revocaron 3 sesiones activas' };
    vi.mocked(revokeAdminUserSessions).mockResolvedValue(payload as never);

    const response = await revokeSessionsPOST(buildRequest('/admin/users/revoke-sessions', 'POST', { userId: 'user-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(revokeAdminUserSessions).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('rejects unauthenticated requests', async () => {
    unauthenticated();

    const response = await detailGET(buildRequest('/admin/users/detail?userId=user-1', 'GET'));

    expect(response.status).toBe(401);
  });

  it('rejects non-admin roles', async () => {
    authenticatedAs('regularUser');

    const response = await deletePOST(buildRequest('/admin/users/delete', 'POST', { userId: 'user-1' }));

    expect(response.status).toBe(403);
  });
});
