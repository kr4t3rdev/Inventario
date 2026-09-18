import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/admin/server/admin-global-queries', () => ({
  approveAdminMembership: vi.fn(),
  rejectAdminMembership: vi.fn(),
  lockAdminUser: vi.fn(),
  unlockAdminUser: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import {
  approveAdminMembership,
  lockAdminUser,
  rejectAdminMembership,
  unlockAdminUser,
} from '@/features/admin/server/admin-global-queries';
import { POST as approvePOST } from '../memberships/approve/route';
import { POST as rejectPOST } from '../memberships/reject/route';
import { POST as lockPOST } from '../users/lock/route';
import { POST as unlockPOST } from '../users/unlock/route';

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

describe('mobile admin mutation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedAs('admin');
  });

  it('approves a membership with role assignment', async () => {
    vi.mocked(approveAdminMembership).mockResolvedValue({ success: true, empleadoCreado: false } as never);

    const response = await approvePOST(
      buildRequest('/admin/memberships/approve', { membershipId: 'membership-1', tenantRole: 'dependiente' }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, empleadoCreado: false });
    expect(approveAdminMembership).toHaveBeenCalledWith(
      { membershipId: 'membership-1', tenantRole: 'dependiente' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('maps unknown membership approval to 404', async () => {
    vi.mocked(approveAdminMembership).mockRejectedValue(new ActionError('Solicitud no encontrada', 'NOT_FOUND'));

    const response = await approvePOST(
      buildRequest('/admin/memberships/approve', { membershipId: 'missing', tenantRole: 'dependiente' }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('maps approving an already-active membership to 409', async () => {
    vi.mocked(approveAdminMembership).mockRejectedValue(new ActionError('Esta membresía ya está activa', 'CONFLICT'));

    const response = await approvePOST(
      buildRequest('/admin/memberships/approve', { membershipId: 'membership-1', tenantRole: 'dependiente' }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CONFLICT' });
  });

  it('maps invalid role approval to 400', async () => {
    vi.mocked(approveAdminMembership).mockRejectedValue(
      new ActionError('Rol inválido: owner. Roles válidos: manager, economico, dependiente, admin', 'VALIDATION'),
    );

    const response = await approvePOST(
      buildRequest('/admin/memberships/approve', { membershipId: 'membership-1', tenantRole: 'owner' }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects a membership with confirmation', async () => {
    vi.mocked(rejectAdminMembership).mockResolvedValue({ success: true } as never);

    const response = await rejectPOST(
      buildRequest('/admin/memberships/reject', { membershipId: 'membership-1' }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('locks a user returning updated state and message', async () => {
    const payload = { user: { userId: 'user-1', lockedUntil: '2026-09-04T00:00:00.000Z', loginAttempts: 3 }, message: 'Usuario bloqueado por 24 horas' };
    vi.mocked(lockAdminUser).mockResolvedValue(payload as never);

    const response = await lockPOST(buildRequest('/admin/users/lock', { userId: 'user-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(payload);
    expect(lockAdminUser).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('unlocks a user returning updated state and message', async () => {
    const payload = { user: { userId: 'user-1', lockedUntil: null, loginAttempts: 0 }, message: 'Usuario desbloqueado correctamente' };
    vi.mocked(unlockAdminUser).mockResolvedValue(payload as never);

    const response = await unlockPOST(buildRequest('/admin/users/unlock', { userId: 'user-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it('maps locking an unknown user to 404', async () => {
    vi.mocked(lockAdminUser).mockRejectedValue(new ActionError('Usuario no encontrado', 'NOT_FOUND'));

    const response = await lockPOST(buildRequest('/admin/users/lock', { userId: 'missing' }));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects mutations for non-admin roles with 403', async () => {
    authenticatedAs('user');

    const response = await approvePOST(
      buildRequest('/admin/memberships/approve', { membershipId: 'membership-1', tenantRole: 'dependiente' }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(approveAdminMembership).not.toHaveBeenCalled();
  });

  it('propagates authentication failures without running mutations', async () => {
    unauthenticated();

    const response = await lockPOST(buildRequest('/admin/users/lock', { userId: 'user-1' }));

    expect(response.status).toBe(401);
    expect(lockAdminUser).not.toHaveBeenCalled();
  });
});
