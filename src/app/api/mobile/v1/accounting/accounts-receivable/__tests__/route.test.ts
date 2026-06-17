import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-accounts-service', () => ({
  AccountingAccountsService: {
    listReceivables: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { 'cuentas-cobrar': true },
};

describe('mobile accounts receivable route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/accounts-receivable');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns tenant receivables from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingAccountsService.listReceivables).mockResolvedValue({
      cuentas: [{ id: 'cxc-1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/accounts-receivable?search=f001&estado=PENDIENTE&page=1&limit=20',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingAccountsService.listReceivables).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      search: 'f001',
      estado: 'PENDIENTE',
      clienteId: null,
      page: 1,
      limit: 20,
    });
  });
});
