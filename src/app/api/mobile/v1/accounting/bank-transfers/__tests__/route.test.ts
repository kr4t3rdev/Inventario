import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-operations-read-service', () => ({
  AccountingOperationsReadService: {
    getBankTransfers: vi.fn(),
  },
}));

vi.mock('@/features/contabilidad/services/accounting-operations-mutation-service', () => ({
  AccountingOperationsMutationService: {
    createBankTransfer: vi.fn(),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import { GET, POST } from '../route';

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

describe('mobile accounting bank transfers route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-transfers');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns bank transfers from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsReadService.getBankTransfers).mockResolvedValue({
      transferencias: [{ transferenciaId: 'tb-1' }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/bank-transfers?fechaInicio=2026-01-01&fechaFin=2026-01-31&cuentaId=cb-1',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingOperationsReadService.getBankTransfers).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      cuentaId: 'cb-1',
    });
  });

  it('creates a bank transfer for the authenticated user', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.createBankTransfer).mockResolvedValue({
      transferencia: { transferenciaId: 'tb-1' },
      numeroComprobante: 'TRF-000001',
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-transfers', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        cuentaOrigenId: 'cb-1',
        cuentaDestinoId: 'cb-2',
        montoOrigen: 100,
        motivo: 'Reposición',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.numeroComprobante).toBe('TRF-000001');
    expect(AccountingOperationsMutationService.createBankTransfer).toHaveBeenCalledWith({
      input: {
        cuentaOrigenId: 'cb-1',
        cuentaDestinoId: 'cb-2',
        montoOrigen: 100,
        motivo: 'Reposición',
      },
      user: mockUser,
    });
  });

  it('maps transfer validation errors to 400', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.createBankTransfer).mockRejectedValue(
      new ActionError('Saldo insuficiente en la cuenta origen', 'VALIDATION_ERROR'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-transfers', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        cuentaOrigenId: 'cb-1',
        cuentaDestinoId: 'cb-2',
        montoOrigen: 100,
        motivo: 'Reposición',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
