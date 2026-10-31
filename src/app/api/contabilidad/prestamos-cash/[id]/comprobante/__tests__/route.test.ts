import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ActionError } from '@/lib/server-actions';

const mocks = vi.hoisted(() => ({
  user: { userId: 'user-1', tenantId: 'tenant-1', role: 'manager' },
  findFirst: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: (...args: any[]) => unknown) =>
    (request: unknown, context: unknown) => handler(request, context, mocks.user),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    prestamoCash: { findFirst: mocks.findFirst },
  },
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: () => 'tenant-1',
  requirePermission: mocks.requirePermission,
}));

/** @description Builds a voucher request for a loan id. */
function voucherRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/contabilidad/prestamos-cash/${id}/comprobante`);
}

describe('web cash loan voucher access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockImplementation(() => undefined);
  });

  it('denies the voucher without the financial accounting permission', async () => {
    mocks.requirePermission.mockImplementation(() => {
      throw new ActionError('No tienes permisos', 'FORBIDDEN');
    });

    const { GET } = await import('../route');
    const response = await GET(
      voucherRequest('loan-1'),
      { params: Promise.resolve({ id: 'loan-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('scopes the voucher lookup to the authenticated tenant', async () => {
    mocks.findFirst.mockResolvedValue(null);

    const { GET } = await import('../route');
    const response = await GET(
      voucherRequest('loan-1'),
      { params: Promise.resolve({ id: 'loan-1' }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      mocks.user, 'financiero.contabilidad.acceder', 'descargar comprobantes de préstamos cash',
    );
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'loan-1', tenantId: 'tenant-1', deletedAt: null },
    }));
  });

  it('returns the pdf voucher for an owned loan', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 'loan-1',
      idNumerico: 42,
      cliente: { nombre: 'Cliente Demo' },
      cuentaPorCobrar: { montoDeuda: 120 },
      montoCapital: 100,
      moneda: 'CUP',
      tasaCambioAlCrear: null,
      fechaOtorgamiento: new Date('2026-06-22T00:00:00.000Z'),
      fechaVencimiento: new Date('2026-07-22T00:00:00.000Z'),
      observaciones: 'Prueba',
    });

    const { GET } = await import('../route');
    const response = await GET(
      voucherRequest('loan-1'),
      { params: Promise.resolve({ id: 'loan-1' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('comprobante-PREST-42.pdf');
  });
});
