import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/bank-account-read-service', () => ({
  BankAccountReadService: {
    getHistory: vi.fn(),
  },
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { BankAccountReadService } from '@/features/contabilidad/services/bank-account-read-service';
import { requireFeature } from '@/lib/services/tenant-scope';
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

describe('mobile accounting bank account history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns history using the shared bank account service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(BankAccountReadService.getHistory).mockResolvedValue({
      transacciones: [],
      resumen: { saldoActual: 100, totalMovimientos: 0 },
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/bank-accounts/cb-1/history?page=2&limit=10&tipoMovimiento=venta&fechaInicio=2026-01-01&fechaFin=2026-01-31',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request, { params: Promise.resolve({ id: 'cb-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.resumen.saldoActual).toBe(100);
    expect(BankAccountReadService.getHistory).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      cuentaId: 'cb-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      tipoMovimiento: 'venta',
      page: 2,
      limit: 10,
    });
  });

  it('maps missing bank account history to 404', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(BankAccountReadService.getHistory).mockRejectedValue(
      new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND'),
    );

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/bank-accounts/missing/history',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Cuenta bancaria no encontrada');
  });

  it('returns 403 before reading history without accounting access', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requireFeature).mockImplementation(() => {
      throw new ActionError('Feature no disponible', 'FEATURE_NOT_AVAILABLE');
    });

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-accounts/cb-1/history', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'cb-1' }) } as never);

    expect(response.status).toBe(403);
    expect(BankAccountReadService.getHistory).not.toHaveBeenCalled();
  });
});
