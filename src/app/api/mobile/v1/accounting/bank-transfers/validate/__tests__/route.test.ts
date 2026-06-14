import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-operations-mutation-service', () => ({
  AccountingOperationsMutationService: {
    validateBankTransfer: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import { POST } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true },
};

describe('mobile accounting bank transfer validation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/bank-transfers/validate',
      { method: 'POST' },
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('returns bank transfer validation from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.validateBankTransfer).mockResolvedValue({
      saldoSuficiente: true,
      advertencias: [],
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/bank-transfers/validate',
      {
        method: 'POST',
        headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
        body: JSON.stringify({
          cuentaOrigenId: 'cb-1',
          cuentaDestinoId: 'cb-2',
          monto: 100,
          motivo: 'Reposición',
        }),
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.saldoSuficiente).toBe(true);
    expect(AccountingOperationsMutationService.validateBankTransfer).toHaveBeenCalledWith({
      cuentaOrigenId: 'cb-1',
      cuentaDestinoId: 'cb-2',
      monto: 100,
      motivo: 'Reposición',
    });
  });
});
