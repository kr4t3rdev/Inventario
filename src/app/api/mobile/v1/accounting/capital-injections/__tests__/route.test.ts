import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-operations-read-service', () => ({
  AccountingOperationsReadService: {
    getCapitalInjections: vi.fn(),
  },
}));

vi.mock('@/features/contabilidad/services/accounting-operations-mutation-service', () => ({
  AccountingOperationsMutationService: {
    createCapitalInjection: vi.fn(),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
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

describe('mobile accounting capital injections route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/capital-injections');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns capital injections from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsReadService.getCapitalInjections).mockResolvedValue({
      inyecciones: [{ id: 'cap-1' }],
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/capital-injections?tipo=APORTE',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingOperationsReadService.getCapitalInjections).toHaveBeenCalledWith({
      tipo: 'APORTE',
      tenantId: 'tenant-1',
    });
  });

  it('creates a capital injection for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.createCapitalInjection).mockResolvedValue({
      inyeccionCapitalId: 'ic-1',
      monto: 500,
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/capital-injections', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        monto: 500,
        moneda: 'CUP',
        tipo: 'APORTE',
        descripcion: 'Capital inicial',
        cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.inyeccionCapitalId).toBe('ic-1');
    expect(AccountingOperationsMutationService.createCapitalInjection).toHaveBeenCalledWith({
      input: {
        monto: 500,
        moneda: 'CUP',
        tipo: 'APORTE',
        descripcion: 'Capital inicial',
        cuentaBancariaId: 'cb-1',
      },
      user: mockUser,
    });
  });
});
