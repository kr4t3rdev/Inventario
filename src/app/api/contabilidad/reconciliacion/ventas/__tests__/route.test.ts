import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    venta: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    cuentaBancaria: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    tipoPago: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

const hasPermissionMock = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/lib/services/tenant-scope', () => ({
  hasFeature: vi.fn((user: { role?: string; planFeatures?: Record<string, boolean> }, feature: string) =>
    user.role === 'admin' || user.planFeatures?.[feature] === true,
  ),
  hasPermission: hasPermissionMock,
  requireTenant: vi.fn((user: { tenantId?: string }) => {
    if (!user.tenantId) {
      throw new Error('Se requiere una membresía de empresa activa para acceder a este recurso');
    }
    return user.tenantId;
  }),
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn(),
  extraerFechaDeBody: vi.fn().mockReturnValue(new Date()),
}));

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { hasPermission, requireTenant } from '@/lib/services/tenant-scope';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import { GET, POST } from '../route';

interface RawSqlArg {
  strings?: readonly string[];
  values?: readonly unknown[];
}

/**
 * @description Extrae el SQL parametrizado generado por Prisma para aserciones estables.
 * @param {unknown} query - Argumento recibido por prisma.$queryRaw.
 * @returns {string} Texto SQL con marcadores de parámetros.
 */
function getSqlText(query: unknown): string {
  const rawQuery = query as RawSqlArg;
  return rawQuery.strings?.join('?') ?? String(query);
}

describe('web accounting reconciliation sales route - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasPermission).mockReturnValue(true);
  });

  it('rejects reads when the user lacks accounting permission', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'qa-user', tenantId: 'tenant-user' },
    } as never);
    vi.mocked(hasPermission).mockReturnValue(false);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/ventas'),
    );

    expect(response.status).toBe(403);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('filtra ventas pendientes por tenantId del usuario autenticado', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'qa-user', tenantId: 'tenant-user' },
    } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ ventaId: 'venta-own', totalPagado: 25 }] as never)
      .mockResolvedValueOnce([{ total: 1 }] as never);
    vi.mocked(prisma.venta.findMany).mockResolvedValue([
      {
        ventaId: 'venta-own',
        tenantId: 'tenant-user',
        total: 100,
        producto: null,
        puntoDeVenta: null,
        empleado: null,
        cliente: null,
        reconciliaciones: [],
      },
    ] as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/ventas'),
    );

    const pendingRowsQuery = vi.mocked(prisma.$queryRaw).mock.calls[0]?.[0];
    const totalRowsQuery = vi.mocked(prisma.$queryRaw).mock.calls[1]?.[0];

    expect(response.status).toBe(200);
    expect(requireTenant).toHaveBeenCalledWith({
      userId: 'qa-user',
      tenantId: 'tenant-user',
    });
    expect(getSqlText(pendingRowsQuery)).toContain('v."tenantId" = ');
    expect(getSqlText(pendingRowsQuery)).toContain('NOT EXISTS');
    expect(getSqlText(pendingRowsQuery)).toContain('"CuentaPorCobrar"');
		expect(getSqlText(pendingRowsQuery)).toContain('::"EstadoCuentaPorCobrar"');
		expect((pendingRowsQuery as RawSqlArg).values).toEqual(
			expect.arrayContaining(['PENDIENTE', 'PARCIAL']),
		);
    expect(getSqlText(pendingRowsQuery)).toContain('"PuntoDeVenta"');
    expect(getSqlText(pendingRowsQuery)).toContain('"Producto"');
    expect((pendingRowsQuery as RawSqlArg).values).toContain('tenant-user');
    expect(getSqlText(totalRowsQuery)).toContain('v."tenantId" = ');
    expect(getSqlText(totalRowsQuery)).toContain('"CuentaPorCobrar"');
		expect(getSqlText(totalRowsQuery)).toContain('::"EstadoCuentaPorCobrar"');
		expect((totalRowsQuery as RawSqlArg).values).toEqual(
			expect.arrayContaining(['PENDIENTE', 'PARCIAL']),
		);
    expect(getSqlText(totalRowsQuery)).toContain('"PuntoDeVenta"');
    expect((totalRowsQuery as RawSqlArg).values).toContain('tenant-user');
    expect(prisma.venta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-user',
          ventaId: { in: ['venta-own'] },
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
          ]),
        }),
        include: expect.objectContaining({
          reconciliaciones: {
            where: { tenantId: 'tenant-user' },
            select: { monto: true },
          },
        }),
      }),
    );
  });

  it('prevents creating a new receivable in a plan without accounts receivable', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'qa-user', tenantId: 'tenant-user', planFeatures: { 'cuentas-cobrar': false } },
    } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never);
    vi.mocked(prisma.venta.findFirst).mockResolvedValue({
      ventaId: 'venta-own', tenantId: 'tenant-user', total: 100, clienteId: 'cliente-own',
      ordenId: 'orden-own', factura: null, cliente: null,
    } as never);
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cuenta-own', tenantId: 'tenant-user', isActive: true, moneda: 'CUP', saldo: 0,
    } as never);
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'tipo-own', tenantId: 'tenant-user', isActive: true,
      requiereCuenta: false, cuentaDefecto: null,
    } as never);
    const transactionClient = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      cuentaBancaria: {
        findFirst: vi.fn().mockResolvedValue({
          cuentaId: 'cuenta-own', tenantId: 'tenant-user', isActive: true, moneda: 'CUP', saldo: 0,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reconciliacionVenta: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ reconciliacionId: 'rec-own' }),
      },
      cuentaPorCobrar: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transactionClient as never),
    );

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/ventas', {
        method: 'POST',
        body: JSON.stringify({ ventaId: 'venta-own', cuentaId: 'cuenta-own', tipoPagoId: 'tipo-own', monto: 20 }),
      }),
    );

    expect(response.status).toBe(403);
    expect(transactionClient.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });
});

describe('web accounting reconciliation sales route - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasPermission).mockReturnValue(true);
  });

  it('rejects payment when the user lacks accounting permission', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'qa-user', tenantId: 'tenant-user' },
    } as never);
    vi.mocked(hasPermission).mockReturnValue(false);

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/ventas', {
        method: 'POST',
        body: JSON.stringify({
          ventaId: 'venta-own',
          cuentaId: 'cuenta-own',
          tipoPagoId: 'tipo-own',
          monto: 20,
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopea todas las lecturas iniciales al tenant autenticado', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'qa-user', tenantId: 'tenant-user' },
    } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never);
    const venta = {
      ventaId: 'venta-own',
      tenantId: 'tenant-user',
      total: 100,
      factura: null,
      cliente: null,
    };
    vi.mocked(prisma.venta.findFirst).mockResolvedValue(venta as never);
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cuenta-own',
      tenantId: 'tenant-user',
      isActive: true,
      moneda: 'CUP',
      saldo: 0,
    } as never);
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'tipo-own',
      tenantId: 'tenant-user',
      isActive: true,
      requiereCuenta: false,
      cuentaDefecto: null,
    } as never);
    const transactionClient = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      cuentaBancaria: {
        findFirst: vi.fn().mockResolvedValue({
          cuentaId: 'cuenta-own',
          tenantId: 'tenant-user',
          isActive: true,
          moneda: 'CUP',
          saldo: 0,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reconciliacionVenta: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({
          reconciliacionId: 'reconciliacion-own',
          ventaId: 'venta-own',
          cuentaId: 'cuenta-own',
          tipoPagoId: 'tipo-own',
          monto: 100,
          moneda: 'CUP',
          montoConvertido: 100,
        }),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transactionClient as never),
    );

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/ventas', {
        method: 'POST',
        body: JSON.stringify({
          ventaId: 'venta-own',
          cuentaId: 'cuenta-own',
          tipoPagoId: 'tipo-own',
          monto: 100,
        }),
      }),
    );

    expect(response.status).not.toBe(500);
    expect(prisma.venta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ventaId: 'venta-own',
          tenantId: 'tenant-user',
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
          ]),
        }),
      }),
    );
    expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cuentaId: 'cuenta-own', tenantId: 'tenant-user' } }),
    );
    expect(getSqlText(transactionClient.$queryRaw.mock.calls[0]?.[0])).toContain('"tenantId"');
    expect(getSqlText(transactionClient.$queryRaw.mock.calls[1]?.[0])).toContain('"tenantId"');
    expect(transactionClient.cuentaBancaria.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cuentaId: 'cuenta-own', tenantId: 'tenant-user' } }),
    );
    expect(transactionClient.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ventaId: 'venta-own', tenantId: 'tenant-user' } }),
    );
    expect(transactionClient.cuentaBancaria.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cuentaId: 'cuenta-own', tenantId: 'tenant-user' } }),
    );
  });
});
