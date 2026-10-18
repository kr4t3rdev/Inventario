import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/admin/server/admin-global-queries', () => ({
  getAdminActivityLogs: vi.fn(),
  getAdminUserLoginHistory: vi.fn(),
  getAdminSessions: vi.fn(),
  revokeAdminSession: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import {
  getAdminActivityLogs,
  getAdminUserLoginHistory,
  getAdminSessions,
  revokeAdminSession,
} from '@/features/admin/server/admin-global-queries';
import { GET as activityLogsGET } from '../activity-logs/route';
import { GET as loginHistoryGET } from '../users/login-history/route';
import { GET as sessionsGET } from '../sessions/route';
import { POST as revokePOST } from '../sessions/revoke/route';

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

describe('mobile admin activity logs and sessions routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedAs('admin');
  });

  it('returns the activity logs', async () => {
    const payload = { logs: [{ id: 'log-1', action: 'LOGIN' }], total: 1 };
    vi.mocked(getAdminActivityLogs).mockResolvedValue(payload as never);

    const response = await activityLogsGET(buildRequest('/admin/activity-logs', 'GET'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(getAdminActivityLogs).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('filters activity logs by user and limit', async () => {
    vi.mocked(getAdminActivityLogs).mockResolvedValue({ logs: [], total: 0 } as never);

    const response = await activityLogsGET(
      buildRequest('/admin/activity-logs?userId=u-1&limit=25', 'GET'),
    );

    expect(response.status).toBe(200);
    expect(getAdminActivityLogs).toHaveBeenCalledWith(
      { userId: 'u-1', limit: 25 },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('returns the login history of a user', async () => {
    const payload = { sessions: [{ id: 's-1' }], total: 1, userId: 'u-1' };
    vi.mocked(getAdminUserLoginHistory).mockResolvedValue(payload as never);

    const response = await loginHistoryGET(
      buildRequest('/admin/users/login-history?userId=u-1', 'GET'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(getAdminUserLoginHistory).toHaveBeenCalledWith(
      { userId: 'u-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('returns the active sessions', async () => {
    const payload = { sessions: [{ id: 's-1' }, { id: 's-2' }], total: 2 };
    vi.mocked(getAdminSessions).mockResolvedValue(payload as never);

    const response = await sessionsGET(buildRequest('/admin/sessions', 'GET'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(getAdminSessions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('revokes a single session', async () => {
    const payload = { success: true, sessionId: 's-1', message: 'Sesión de Ana revocada correctamente' };
    vi.mocked(revokeAdminSession).mockResolvedValue(payload as never);

    const response = await revokePOST(
      buildRequest('/admin/sessions/revoke', 'POST', { sessionId: 's-1' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(revokeAdminSession).toHaveBeenCalledWith(
      { sessionId: 's-1' },
      expect.objectContaining({ role: 'admin' }),
    );
  });

  it('maps revoking an unknown session to 404', async () => {
    vi.mocked(revokeAdminSession).mockRejectedValue(new ActionError('Sesión no encontrada', 'NOT_FOUND'));

    const response = await revokePOST(
      buildRequest('/admin/sessions/revoke', 'POST', { sessionId: 'missing' }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects unauthenticated requests', async () => {
    unauthenticated();

    const response = await sessionsGET(buildRequest('/admin/sessions', 'GET'));

    expect(response.status).toBe(401);
  });

  it('rejects non-admin roles', async () => {
    authenticatedAs('regularUser');

    const response = await revokePOST(
      buildRequest('/admin/sessions/revoke', 'POST', { sessionId: 's-1' }),
    );

    expect(response.status).toBe(403);
  });
});
