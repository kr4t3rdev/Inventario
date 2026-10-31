import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { ActionError } from '@/lib/server-actions';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-accounts-service', () => ({
  AccountingAccountsService: {
    listReceivables: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'manager',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true, 'cuentas-cobrar': false },
};

/** @description Builds an authenticated mobile receivables request. */
function receivablesRequest(): NextRequest {
  return new NextRequest(
    'http://localhost/api/mobile/v1/accounting/accounts-receivable?search=f001&estado=PENDIENTE&page=1&limit=20',
    { headers: { authorization: 'Bearer mobile-access' } },
  );
}

describe('mobile accounts receivable route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireFeature).mockImplementation(() => undefined);
    vi.mocked(requirePermission).mockImplementation(() => undefined);
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/accounts-receivable'));

    expect(response.status).toBe(401);
  });

  it('returns tenant receivables after the contabilidad feature and permission checks', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingAccountsService.listReceivables).mockResolvedValue({
      cuentas: [{ id: 'cxc-1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as never);

    const response = await GET(receivablesRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(requireFeature).toHaveBeenCalledWith(
      mockUser, 'contabilidad', 'consultar las cuentas por cobrar existentes',
    );
    expect(requirePermission).toHaveBeenCalledWith(
      mockUser, 'financiero.contabilidad.acceder', 'consultar las cuentas por cobrar',
    );
    expect(AccountingAccountsService.listReceivables).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      search: 'f001',
      estado: 'PENDIENTE',
      clienteId: null,
      page: 1,
      limit: 20,
    });
  });

  it('maps a missing contabilidad feature to a forbidden response', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requireFeature).mockImplementation(() => {
      throw new ActionError('Tu plan actual no incluye la funcionalidad', 'FEATURE_NOT_AVAILABLE');
    });

    const response = await GET(receivablesRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(AccountingAccountsService.listReceivables).not.toHaveBeenCalled();
  });

  it('denies receivables without the financial accounting permission', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requirePermission).mockImplementation(() => {
      throw new ActionError('No tienes permisos', 'FORBIDDEN');
    });

    const response = await GET(receivablesRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
    expect(AccountingAccountsService.listReceivables).not.toHaveBeenCalled();
  });

  it('returns TENANT_REQUIRED when the authenticated user has no tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...mockUser, tenantId: undefined },
    } as never);

    const response = await GET(receivablesRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('TENANT_REQUIRED');
  });
});
