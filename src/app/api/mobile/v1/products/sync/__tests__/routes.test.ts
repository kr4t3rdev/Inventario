import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockGetSnapshotPage, mockPullChanges } = vi.hoisted(() => ({
  mockGetSnapshotPage: vi.fn(),
  mockPullChanges: vi.fn(),
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/mobile-sync/product-sync-service', () => ({
  getProductSnapshotPage: mockGetSnapshotPage,
  pullProductChanges: mockPullChanges,
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { InvalidProductSyncCursorError } from '@/lib/mobile-sync/product-sync-cursor';
import { GET as getSnapshot } from '../snapshot/route';
import { GET as getChanges } from '../changes/route';

const mockUser = {
  userId: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
};

describe('mobile product sync routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    mockGetSnapshotPage.mockResolvedValue({
      items: [],
      nextPageToken: null,
      changesCursor: 'opaque-changes-cursor',
    });
    mockPullChanges.mockResolvedValue({
      changes: [],
      cursor: 'next-changes-cursor',
    });
  });

  it('requires authentication and an active tenant for snapshots', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );
    const unauthenticated = await getSnapshot(
      new NextRequest('http://localhost/api/mobile/v1/products/sync/snapshot'),
    );
    expect(unauthenticated.status).toBe(401);

    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...mockUser, tenantId: undefined },
    } as never);
    const missingTenant = await getSnapshot(
      new NextRequest('http://localhost/api/mobile/v1/products/sync/snapshot'),
    );
    expect(missingTenant.status).toBe(403);
    expect(mockGetSnapshotPage).not.toHaveBeenCalled();
  });

  it('validates snapshot page size and forwards the opaque page token', async () => {
    const invalid = await getSnapshot(
      new NextRequest('http://localhost/api/mobile/v1/products/sync/snapshot?limit=501'),
    );
    expect(invalid.status).toBe(400);
    expect(mockGetSnapshotPage).not.toHaveBeenCalled();

    const response = await getSnapshot(new NextRequest(
      'http://localhost/api/mobile/v1/products/sync/snapshot?limit=25&pageToken=signed-token',
    ));

    expect(response.status).toBe(200);
    expect(mockGetSnapshotPage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      limit: 25,
      pageToken: 'signed-token',
    });
    await expect(response.json()).resolves.toMatchObject({
      changesCursor: 'opaque-changes-cursor',
    });
  });

  it('rejects a snapshot cursor bound to another tenant', async () => {
    mockGetSnapshotPage.mockRejectedValue(new InvalidProductSyncCursorError());
    const response = await getSnapshot(new NextRequest(
      'http://localhost/api/mobile/v1/products/sync/snapshot?pageToken=foreign-tenant-token',
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_SYNC_CURSOR');
  });

  it('requires a cursor and forwards bounded incremental pull parameters', async () => {
    const missingCursor = await getChanges(
      new NextRequest('http://localhost/api/mobile/v1/products/sync/changes'),
    );
    expect(missingCursor.status).toBe(400);
    expect(mockPullChanges).not.toHaveBeenCalled();

    const response = await getChanges(new NextRequest(
      'http://localhost/api/mobile/v1/products/sync/changes?cursor=opaque-cursor&limit=10',
    ));

    expect(response.status).toBe(200);
    expect(mockPullChanges).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      cursor: 'opaque-cursor',
      limit: 10,
    });
  });

  it('returns an explicit client error for invalid incremental cursors', async () => {
    mockPullChanges.mockRejectedValue(new InvalidProductSyncCursorError());
    const response = await getChanges(new NextRequest(
      'http://localhost/api/mobile/v1/products/sync/changes?cursor=bad',
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_SYNC_CURSOR');
  });
});
