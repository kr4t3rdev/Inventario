import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tipoPago: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    cuentaBancaria: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn(async () => ({ permitido: true })),
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(async () => undefined) },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { DELETE, GET, PUT } from './route';

const user = {
  userId: 'user-a',
  name: 'Manager A',
  email: 'manager-a@example.com',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-a',
  tenantRole: 'manager',
};
const params = { params: Promise.resolve({ id: 'type-b' }) };

describe('/api/contabilidad/tipos-pago/[id] tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
  });

  it('does not return a payment type from another tenant', async () => {
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago/type-b'),
      params,
    );

    expect(response.status).toBe(404);
    expect(prisma.tipoPago.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tipoId: 'type-b', tenantId: 'tenant-a' },
      }),
    );
  });

  it('does not update a payment type from another tenant', async () => {
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue(null);

    const response = await PUT(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago/type-b', {
        method: 'PUT',
        body: JSON.stringify({ nombre: 'Alterado' }),
      }),
      params,
    );

    expect(response.status).toBe(404);
    expect(prisma.tipoPago.updateMany).not.toHaveBeenCalled();
  });

  it('does not delete a payment type from another tenant', async () => {
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago/type-b', {
        method: 'DELETE',
      }),
      params,
    );

    expect(response.status).toBe(404);
    expect(prisma.tipoPago.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects update and delete by a non-manager tenant member', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...user, tenantRole: 'dependiente' },
    } as never);

    const updateResponse = await PUT(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago/type-b', {
        method: 'PUT',
        body: JSON.stringify({ nombre: 'Alterado' }),
      }),
      params,
    );
    const deleteResponse = await DELETE(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago/type-b', {
        method: 'DELETE',
      }),
      params,
    );

    expect(updateResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(prisma.tipoPago.updateMany).not.toHaveBeenCalled();
    expect(prisma.tipoPago.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps the tenant predicate on the actual update write', async () => {
    const existing = {
      tipoId: 'type-b',
      tenantId: 'tenant-a',
      nombre: 'Efectivo',
      requiereCuenta: false,
      cuentaDefecto: null,
      _count: {
        reconciliacionesVenta: 0,
        reconciliacionesServicio: 0,
        reconciliacionesGasto: 0,
      },
    };
    vi.mocked(prisma.tipoPago.findFirst)
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...existing, nombre: 'Caja' } as never);
    vi.mocked(prisma.tipoPago.updateMany).mockResolvedValue({ count: 1 });

    const response = await PUT(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago/type-b', {
        method: 'PUT',
        body: JSON.stringify({ nombre: 'Caja' }),
      }),
      params,
    );

    expect(response.status).toBe(200);
    expect(prisma.tipoPago.updateMany).toHaveBeenCalledWith({
      where: { tipoId: 'type-b', tenantId: 'tenant-a' },
      data: { nombre: 'Caja' },
    });
  });

  it('keeps the tenant predicate on the actual delete write', async () => {
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'type-b',
      tenantId: 'tenant-a',
      nombre: 'Efectivo',
      _count: {
        reconciliacionesVenta: 0,
        reconciliacionesServicio: 0,
        reconciliacionesGasto: 0,
      },
    } as never);
    vi.mocked(prisma.tipoPago.deleteMany).mockResolvedValue({ count: 1 });

    const response = await DELETE(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago/type-b', {
        method: 'DELETE',
      }),
      params,
    );

    expect(response.status).toBe(200);
    expect(prisma.tipoPago.deleteMany).toHaveBeenCalledWith({
      where: { tipoId: 'type-b', tenantId: 'tenant-a' },
    });
  });

  it('rejects clearing the account while the payment type still requires one', async () => {
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'type-b',
      tenantId: 'tenant-a',
      nombre: 'Transferencia',
      requiereCuenta: true,
      cuentaDefecto: 'account-a',
      _count: {
        reconciliacionesVenta: 0,
        reconciliacionesServicio: 0,
        reconciliacionesGasto: 0,
      },
    } as never);

    const response = await PUT(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago/type-b', {
        method: 'PUT',
        body: JSON.stringify({ cuentaDefecto: null }),
      }),
      params,
    );

    expect(response.status).toBe(400);
    expect(prisma.tipoPago.updateMany).not.toHaveBeenCalled();
  });
});
