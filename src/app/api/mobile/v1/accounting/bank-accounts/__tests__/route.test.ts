import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/bank-account-read-service', () => ({
  BankAccountReadService: {
    list: vi.fn(),
  },
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { BankAccountReadService } from '@/features/contabilidad/services/bank-account-read-service';
import { requireFeature } from '@/lib/services/tenant-scope';
import { ActionError } from '@/lib/server-actions';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
};

describe('mobile accounting bank accounts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-accounts');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns tenant bank accounts from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(BankAccountReadService.list).mockResolvedValue({
      cuentas: [{ cuentaId: 'cb-1', nombreBanco: 'Banco 1' }],
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-accounts', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(BankAccountReadService.list).toHaveBeenCalledWith('tenant-1');
  });

  it('returns 403 when the tenant lacks accounting access', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requireFeature).mockImplementation(() => {
      throw new ActionError('Feature no disponible', 'FEATURE_NOT_AVAILABLE');
    });

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-accounts', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(BankAccountReadService.list).not.toHaveBeenCalled();
  });
});
