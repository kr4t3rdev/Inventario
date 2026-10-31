import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: { updateCashDebt: vi.fn() },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { PUT } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { 'deudas-cash': true },
};

describe('mobile cash debt update route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a cash debt for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.updateCashDebt).mockResolvedValue({ id: 'deuda-1', observaciones: 'Updated' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts/deuda-1', {
      method: 'PUT',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ observaciones: 'Updated' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('deuda-1');
    expect(AccountingCashOperationsMutationService.updateCashDebt).toHaveBeenCalledWith({
      input: { id: 'deuda-1', observaciones: 'Updated' },
      user: mockUser,
    });
  });

  it('denies debt edits after downgrade while preserving payment access', async () => {
    const downgradedUser = {
      ...mockUser,
      role: 'regularUser',
      tenantRole: 'manager',
      permissions: new Set(['financiero.contabilidad.acceder']),
      planFeatures: { 'deudas-cash': false },
    };
    vi.mocked(authenticateUser).mockResolvedValue({ user: downgradedUser } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts/deuda-1', {
      method: 'PUT',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ observaciones: 'Updated' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(AccountingCashOperationsMutationService.updateCashDebt).not.toHaveBeenCalled();
  });

  it('denies debt edits without financial permission', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        ...mockUser,
        role: 'regularUser',
        permissions: new Set<string>(),
      },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts/deuda-1', {
      method: 'PUT',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ observaciones: 'Updated' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);

    expect(response.status).toBe(403);
    expect(AccountingCashOperationsMutationService.updateCashDebt).not.toHaveBeenCalled();
  });
});
