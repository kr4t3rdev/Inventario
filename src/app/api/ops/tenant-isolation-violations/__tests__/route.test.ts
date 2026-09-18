import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/db/shadow-violation-store', () => ({
  getShadowViolationSnapshot: vi.fn(),
}));

import { GET } from '@/app/api/ops/tenant-isolation-violations/route';
import { authenticateUser } from '@/lib/auth-middleware';
import { getShadowViolationSnapshot } from '@/lib/db/shadow-violation-store';

const authenticateUserMock = vi.mocked(authenticateUser);
const getSnapshotMock = vi.mocked(getShadowViolationSnapshot);

describe('GET /api/ops/tenant-isolation-violations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSnapshotMock.mockReturnValue({
      startedAt: '2026-09-07T00:00:00.000Z',
      totalCaptured: 1,
      dropped: 0,
      capacity: 500,
      reports: [{
        kind: 'missing-context',
        model: 'Venta',
        operation: 'findMany',
        mode: 'shadow',
        recordedAt: '2026-09-07T00:01:00.000Z',
      }],
    });
  });

  it('propaga la respuesta 401 de autenticación', async () => {
    authenticateUserMock.mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }),
    );

    const response = await GET(new NextRequest('http://localhost/api/ops/tenant-isolation-violations'));

    expect(response.status).toBe(401);
    expect(getSnapshotMock).not.toHaveBeenCalled();
  });

  it('rechaza usuarios que no sean administradores de plataforma', async () => {
    authenticateUserMock.mockResolvedValue({
      user: { userId: 'user-1', role: 'regularUser', isActive: true },
    } as Awaited<ReturnType<typeof authenticateUser>>);

    const response = await GET(new NextRequest('http://localhost/api/ops/tenant-isolation-violations'));

    expect(response.status).toBe(403);
    expect(getSnapshotMock).not.toHaveBeenCalled();
  });

  it('devuelve el snapshot local y advierte que no agrega réplicas', async () => {
    authenticateUserMock.mockResolvedValue({
      user: { userId: 'admin-1', role: 'admin', isActive: true },
    } as Awaited<ReturnType<typeof authenticateUser>>);

    const response = await GET(new NextRequest('http://localhost/api/ops/tenant-isolation-violations'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      isolationMode: 'off',
      scope: 'single-instance',
      totalCaptured: 1,
      reports: [{ model: 'Venta' }],
    });
    expect(body.instanceId).toEqual(expect.any(String));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('acepta el alias legado SUPERADMIN mediante normalización de rol', async () => {
    authenticateUserMock.mockResolvedValue({
      user: { userId: 'admin-legacy', role: 'SUPERADMIN', isActive: true },
    } as Awaited<ReturnType<typeof authenticateUser>>);

    const response = await GET(new NextRequest('http://localhost/api/ops/tenant-isolation-violations'));

    expect(response.status).toBe(200);
    expect(getSnapshotMock).toHaveBeenCalledOnce();
  });
});
