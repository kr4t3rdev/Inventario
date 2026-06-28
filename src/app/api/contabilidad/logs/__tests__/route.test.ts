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

describe('web accounting logs route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/logs'));
    expect(response.status).toBe(401);
  });

  it('returns accounting audit logs for admin users', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(AccountingAuditLogsService.getLogs).mockResolvedValue({
      logs: [{ id: 'log-1' }],
      total: 1,
      pagination: { limit: 20, offset: 0, total: 1 },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/logs?entidad=TRANSFERENCIA&limit=20&offset=0'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.logs).toHaveLength(1);
    expect(AccountingAuditLogsService.getLogs).toHaveBeenCalledWith({
      user: adminUser,
      entidad: 'TRANSFERENCIA',
      accion: null,
      desde: null,
      hasta: null,
      limit: 20,
      offset: 0,
    });
  });

  it('returns 403 for basic plan users even if authentication succeeds', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        ...adminUser,
        role: 'user',
        tenantRole: 'economico',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': true },
      },
    } as never);

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/logs'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBeDefined();
    expect(AccountingAuditLogsService.getLogs).not.toHaveBeenCalled();
  });
});
