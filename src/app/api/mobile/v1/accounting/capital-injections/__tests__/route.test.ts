import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ActionError } from '@/lib/server-actions';

vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
}));

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
import { requireFeature } from '@/lib/services/tenant-scope';
import { GET, POST } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true, 'inyeccion-capital': true },
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

  it('returns 403 when the capital feature is unavailable on GET', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requireFeature).mockImplementationOnce(() => {
      throw new ActionError('Función no disponible', 'FEATURE_NOT_AVAILABLE');
    });

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/capital-injections', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('returns 403 when the capital feature is unavailable on POST', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requireFeature).mockImplementationOnce(() => {
      throw new ActionError('Función no disponible', 'FEATURE_NOT_AVAILABLE');
    });

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/capital-injections', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it('rejects obsolete or invalid capital types on GET', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/capital-injections?tipo=APORTE',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(AccountingOperationsReadService.getCapitalInjections).not.toHaveBeenCalled();
  });

  it('returns capital injections from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsReadService.getCapitalInjections).mockResolvedValue({
      inyecciones: [{ id: 'cap-1' }],
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/capital-injections?tipo=CAPITAL_SOCIAL',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingOperationsReadService.getCapitalInjections).toHaveBeenCalledWith({
      tipo: 'CAPITAL_SOCIAL',
      tenantId: 'tenant-1',
    });
  });

  it('creates a capital injection for the authenticated tenant using the canonical contract', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.createCapitalInjection).mockResolvedValue({
      inyeccionCapitalId: 'ic-1',
      monto: 500,
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/capital-injections', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        montoRecibido: 500,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        descripcion: 'Capital inicial',
        cuentaId: 'cb-1',
        socio: 'Socio fundador',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.inyeccionCapitalId).toBe('ic-1');
    expect(AccountingOperationsMutationService.createCapitalInjection).toHaveBeenCalledWith({
      input: {
        montoRecibido: 500,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        descripcion: 'Capital inicial',
        cuentaId: 'cb-1',
        socio: 'Socio fundador',
      },
      user: mockUser,
    });
  });

  it('maps service validation failures to a client error', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.createCapitalInjection).mockRejectedValueOnce(
      new z.ZodError([]),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/capital-injections', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        monto: 500,
        moneda: 'CUP',
        tipo: 'APORTE',
        cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(AccountingOperationsMutationService.createCapitalInjection).toHaveBeenCalledOnce();
  });
});
