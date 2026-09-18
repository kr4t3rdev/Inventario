import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-audit-logs-service', () => ({
  AccountingAuditLogsService: {
    getLogs: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingAuditLogsService } from '@/features/contabilidad/services/accounting-audit-logs-service';
import { GET } from '../route';

const adminUser = {
  userId: 'u1',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'owner',
};

describe('mobile accounting logs route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/logs'));
    expect(response.status).toBe(401);
  });

  it('returns accounting audit logs for admin users in mobile format', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(AccountingAuditLogsService.getLogs).mockResolvedValue({
      logs: [{ id: 'log-1' }],
      total: 1,
      pagination: { limit: 20, offset: 0, total: 1 },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/mobile/v1/accounting/logs?entidad=TRANSFERENCIA&limit=20&offset=0', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.pagination.total).toBe(1);
    expect(AccountingAuditLogsService.getLogs).toHaveBeenCalledWith({
      user: adminUser,
      entidad: 'TRANSFERENCIA',
      limit: 20,
      offset: 0,
    });
  });
});
