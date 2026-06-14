import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-config-read-service', () => ({
  AccountingConfigReadService: {
    getAvailableAccounts: vi.fn(),
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

describe('mobile accounting available accounts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/payment-types/available-accounts');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns available accounts using the shared config service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingConfigReadService.getAvailableAccounts).mockResolvedValue({
      cuentas: [{ cuentaId: 'cb-1', nombreBanco: 'Banco 1' }],
      estadisticas: { totalCuentas: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/payment-types/available-accounts?moneda=USD&tipoCuenta=CORRIENTE',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingConfigReadService.getAvailableAccounts).toHaveBeenCalledWith({
      moneda: 'USD',
      tipoCuenta: 'CORRIENTE',
    });
  });
});
