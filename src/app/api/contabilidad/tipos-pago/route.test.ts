import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tipoPago: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
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
import { GET, POST } from './route';

const user = {
  userId: 'user-a',
  name: 'Manager A',
  email: 'manager-a@example.com',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-a',
  tenantRole: 'manager',
};

describe('/api/contabilidad/tipos-pago tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
  });

  it('requires authentication before listing payment types', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as never,
    );

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago'),
    );

    expect(response.status).toBe(401);
    expect(prisma.tipoPago.findMany).not.toHaveBeenCalled();
  });

  it('lists and enriches payment types only within the authenticated tenant', async () => {
    vi.mocked(prisma.tipoPago.findMany).mockResolvedValue([
      { tipoId: 'type-a', cuentaDefecto: 'account-a' },
    ] as never);
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'account-a',
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago'),
    );

    expect(response.status).toBe(200);
    expect(prisma.tipoPago.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
    expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cuentaId: 'account-a', tenantId: 'tenant-a' },
      }),
    );
  });

  it('creates the payment type with the authenticated tenantId', async () => {
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tipoPago.create).mockResolvedValue({
      tipoId: 'type-a',
      tenantId: 'tenant-a',
      nombre: 'Efectivo',
      requiereCuenta: false,
      cuentaDefecto: null,
    } as never);

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago', {
        method: 'POST',
        body: JSON.stringify({
          nombre: 'Efectivo',
          requiereCuenta: false,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(prisma.tipoPago.findFirst).toHaveBeenCalledWith({
      where: {
        nombre: { equals: 'Efectivo' },
        tenantId: 'tenant-a',
      },
    });
    expect(prisma.tipoPago.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
  });

  it('rejects creation by a non-manager tenant member', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...user, tenantRole: 'dependiente' },
    } as never);

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago', {
        method: 'POST',
        body: JSON.stringify({
          nombre: 'Efectivo',
          requiereCuenta: false,
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(prisma.tipoPago.create).not.toHaveBeenCalled();
  });

  it('rejects a default account owned by another tenant', async () => {
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(null);

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/tipos-pago', {
        method: 'POST',
        body: JSON.stringify({
          nombre: 'Transferencia',
          requiereCuenta: true,
          cuentaDefecto: 'account-b',
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith({
      where: { cuentaId: 'account-b', tenantId: 'tenant-a' },
    });
    expect(prisma.tipoPago.create).not.toHaveBeenCalled();
  });
});
