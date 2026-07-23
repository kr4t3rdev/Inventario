import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-config-read-service', () => ({
  AccountingConfigReadService: {
    getPaymentTypes: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingConfigReadService } from '@/features/contabilidad/services/accounting-config-read-service';
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

describe('mobile accounting payment types route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/payment-types');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns payment types using the shared config service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingConfigReadService.getPaymentTypes).mockResolvedValue({
      data: [{ tipoId: 'tp-1', nombre: 'Transferencia' }],
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/payment-types?includeInactive=true&requiereCuenta=true',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
        expect(AccountingConfigReadService.getPaymentTypes).toHaveBeenCalledWith(
          'tenant-1',
          {
            includeInactive: true,
            requiereCuenta: true,
          },
        );
  });
});
