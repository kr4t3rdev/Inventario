import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ActionError } from '@/lib/server-actions';

const mocks = vi.hoisted(() => ({
  user: { userId: 'user-1', tenantId: 'tenant-1', role: 'manager' },
  findFirst: vi.fn(),
  update: vi.fn(),
  requirePermission: vi.fn(),
  requireFeature: vi.fn(),
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: (...args: any[]) => unknown) =>
    (request: unknown, context: unknown) => handler(request, context, mocks.user),
  withAuthPost: (handler: (...args: any[]) => unknown) =>
    (request: unknown, context: unknown) => handler(request, context, mocks.user),
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    prestamoCash: { findFirst: mocks.findFirst, update: mocks.update },
  },
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: () => 'tenant-1',
  requirePermission: mocks.requirePermission,
  requireFeature: mocks.requireFeature,
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true }),
  extraerFechaDeBody: vi.fn(() => null),
}));
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: { log: vi.fn() } }));

describe('web cash loan detail tenant and edit access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true');
    mocks.requirePermission.mockImplementation(() => undefined);
    mocks.requireFeature.mockImplementation(() => undefined);
  });

  it('scopes detail lookup to the authenticated tenant', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const { GET } = await import('../route');
    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/prestamos-cash/loan-1'),
      { params: Promise.resolve({ id: 'loan-1' }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      mocks.user, 'financiero.contabilidad.acceder', 'consultar préstamos cash',
    );
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'loan-1', tenantId: 'tenant-1', deletedAt: null },
    }));
  });

  it('denies edit without feature before reading or updating a loan', async () => {
    mocks.requireFeature.mockImplementation(() => {
      throw new ActionError('Feature unavailable', 'FEATURE_NOT_AVAILABLE');
    });
    const { PUT } = await import('../route');
    const response = await PUT(
      new NextRequest('http://localhost/api/contabilidad/prestamos-cash/loan-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ observaciones: 'Updated' }),
      }),
      { params: Promise.resolve({ id: 'loan-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      mocks.user, 'financiero.contabilidad.acceder', 'editar préstamos cash',
    );
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
