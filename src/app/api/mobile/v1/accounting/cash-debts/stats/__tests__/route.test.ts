import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ActionError } from '@/lib/server-actions';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requirePermission: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    getCashDebtStats: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { requirePermission } from '@/lib/services/tenant-scope';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'manager',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { 'deudas-cash': false },
};

/** @description Builds an authenticated mobile cash debt stats request. */
function statsRequest(): NextRequest {
  return new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts/stats', {
    headers: { authorization: 'Bearer mobile-access' },
  });
}

describe('mobile cash debts stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockImplementation(() => undefined);
  });

  it('returns tenant cash debt stats after the accounting permission check', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.getCashDebtStats).mockResolvedValue({
      totalActivas: 2,
      montoTotalDeuda: { CUP: 200 },
    } as never);

    const response = await GET(statsRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalActivas).toBe(2);
    expect(requirePermission).toHaveBeenCalledWith(
      mockUser, 'financiero.contabilidad.acceder', 'consultar estadísticas de deudas cash',
    );
    expect(AccountingCashOperationsService.getCashDebtStats).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
    });
  });

  it('denies stats without the financial accounting permission', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requirePermission).mockImplementation(() => {
      throw new ActionError('No tienes permisos', 'FORBIDDEN');
    });

    const response = await GET(statsRequest());

    expect(response.status).toBe(403);
    expect(AccountingCashOperationsService.getCashDebtStats).not.toHaveBeenCalled();
  });
});
