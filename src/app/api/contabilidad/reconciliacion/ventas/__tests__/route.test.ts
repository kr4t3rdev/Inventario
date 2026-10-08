import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  const mockedPrisma = {
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
  };
  return { default: mockedPrisma, prisma: mockedPrisma };
});

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((user: { tenantId?: string }) => {
    if (!user.tenantId) {
      throw new Error('Se requiere una membresía de empresa activa para acceder a este recurso');
    }
    return user.tenantId;
  }),
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: vi.fn(),
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(undefined),
    logStrict: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn(),
  extraerFechaDeBody: vi.fn().mockReturnValue(new Date()),
}));

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
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
});

describe('web accounting reconciliation sales route - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      tenantAccountingPolicy: {
        findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ auditId: 'audit-1' }) },
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
        create: vi.fn().mockImplementation(async ({ data }) => ({
          ...data,
          reconciliacionId: 'reconciliacion-own',
        })),
      },
      cuentaPorCobrar: { findFirst: vi.fn().mockResolvedValue(null) },
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
    expect(postEvento).toHaveBeenCalledTimes(1);
    expect(postEvento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'tenant-user', userId: 'qa-user' }),
      expect.objectContaining({
        tipo: 'VENTA_CONTADO',
        montoFuncional: 100,
        fxEvidenceFingerprint: expect.any(String),
      }),
    );
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
