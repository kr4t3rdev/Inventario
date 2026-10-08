/**
 * @description Gate de cupo común en el POST HTTP `/api/contabilidad/reconciliacion/ventas`:
 * la reconciliación que materializa una CxC faltante o aumenta la exposición neta
 * (p. ej. reactivar una cuenta anulada) exige override explícito con el permiso del
 * origen probado (`ventas.venta.credito-override`), motivo y auditoría estricta en tx.
 * Los cobros que solo reducen exposición no requieren override.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockTx = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([]),
  tenantAccountingPolicy: {
    findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
  },
  cuentaBancaria: {
    findFirst: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  reconciliacionVenta: {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
  cuentaPorCobrar: {
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  cliente: { findFirst: vi.fn() },
  auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  transaccionMoneda: { create: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    venta: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    cuentaBancaria: { findFirst: vi.fn(), findUnique: vi.fn() },
    tipoPago: { findFirst: vi.fn() },
  },
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    venta: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    cuentaBancaria: { findFirst: vi.fn(), findUnique: vi.fn() },
    tipoPago: { findFirst: vi.fn() },
  },
}));

const authHolder = vi.hoisted(() => ({
  user: {
    userId: 'user-rec-1',
    tenantId: 'tenant-rec',
    role: 'user',
    tenantRole: 'manager',
    planFeatures: { contabilidad: true },
    permissions: new Set<string>(['financiero.contabilidad.acceder']),
  } as Record<string, unknown>,
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({ user: authHolder.user })),
}));

vi.mock('@/lib/services/tenant-scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/tenant-scope')>();
  return {
    ...actual,
    requireFeature: vi.fn(actual.requireFeature),
    requirePermission: vi.fn(actual.requirePermission),
    requireTenant: vi.fn(actual.requireTenant),
  };
});

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(null),
    logStrict: vi.fn((_params: unknown, client: typeof mockTx) => client.auditLog.create({ data: _params })),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true }),
  extraerFechaDeBody: vi.fn().mockReturnValue(new Date('2026-09-30T12:00:00.000Z')),
}));

import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { requirePermission } from '@/lib/services/tenant-scope';
import { POST } from '../route';

/** @description Request POST base de reconciliación por 100 CUP. */
function requestPago(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/contabilidad/reconciliacion/ventas', {
    method: 'POST',
    body: JSON.stringify({
      ventaId: 'venta-1',
      cuentaId: 'cuenta-1',
      tipoPagoId: 'tipo-1',
      monto: 100,
      ...body,
    }),
  });
}

/** @description Venta de 1000 CUP con cliente, sin factura ni CxC previa. */
function ventaCredito(): Record<string, unknown> {
  return {
    ventaId: 'venta-1',
    tenantId: 'tenant-rec',
    total: 1000,
    ordenId: 'ORD-1',
    clienteId: 'c-1',
    factura: null,
    cliente: { clienteId: 'c-1', nombre: 'Cliente Uno' },
  };
}

describe('gate 4.2.c/4.4.b: reconciliación de ventas que aumenta exposición CxC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHolder.user = {
      userId: 'user-rec-1',
      tenantId: 'tenant-rec',
      role: 'user',
      tenantRole: 'manager',
      planFeatures: { contabilidad: true },
      permissions: new Set(['financiero.contabilidad.acceder']),
    };
    vi.mocked(prisma.venta.findFirst).mockResolvedValue(ventaCredito() as never);
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cuenta-1', tenantId: 'tenant-rec', isActive: true, moneda: 'CUP', saldo: 0,
    } as never);
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'tipo-1', tenantId: 'tenant-rec', isActive: true,
      requiereCuenta: false, cuentaDefecto: null,
    } as never);
    mockTx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cuenta-1', tenantId: 'tenant-rec', isActive: true, moneda: 'CUP', saldo: 0,
    } as never);
    mockTx.reconciliacionVenta.findMany.mockResolvedValue([] as never);
    mockTx.reconciliacionVenta.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      reconciliacionId: 'rec-1',
      fechaReconciliacion: new Date('2026-09-30T12:00:00.000Z'),
    }) as never);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue(null as never);
    mockTx.cuentaPorCobrar.findMany.mockResolvedValue([] as never);
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-new' } as never);
    mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'c-1', limiteCredito: 500 } as never);
  });

  it('rechaza la creación de CxC faltante que excede el cupo sin override', async () => {
    const response = await POST(requestPago());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'CREDITO_EXCEDIDO' });
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('autoriza el faltante con permiso del origen y motivo, auditando en la transacción', async () => {
    authHolder.user = {
      ...authHolder.user,
      permissions: new Set(['financiero.contabilidad.acceder', 'ventas.venta.credito-override']),
    };

    const response = await POST(requestPago({
      solicitarCreditoOverride: true,
      motivoCreditoOverride: 'Cliente autorizado por gerencia',
    }));

    expect(response.status).toBe(201);
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'ventas.venta.credito-override', expect.any(String),
    );
    // Deuda materializada en CUP con snapshot FX de identidad (fila 7).
    expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-rec',
          clienteId: 'c-1',
          montoDeuda: new Prisma.Decimal('1000'),
          montoPagado: new Prisma.Decimal('100'),
          estado: 'PARCIAL',
          monedaOriginal: 'CUP',
          montoOriginal: new Prisma.Decimal('1000'),
          montoDeudaFuncional: new Prisma.Decimal('1000'),
          montoPagadoFuncional: new Prisma.Decimal('100'),
        }),
      }),
    );
    expect(AuditLogService.logStrict).toHaveBeenCalledWith(expect.objectContaining({
      detalles: expect.objectContaining({
        tipo: 'CREDITO_OVERRIDE',
        clienteId: 'c-1',
        motivo: 'Cliente autorizado por gerencia',
      }),
    }), mockTx);
  });

  it('rechaza FORBIDDEN cuando falta el permiso de override al materializar deuda', async () => {
    const response = await POST(requestPago({
      solicitarCreditoOverride: true,
      motivoCreditoOverride: 'Sin permiso asignado',
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('cobro parcial sobre CxC existente (delta ≤ 0) no exige override', async () => {
    // CxC existente: deuda 1000, pagado 400 → saldo 600; cobro 100 → saldo 500.
    mockTx.reconciliacionVenta.findMany.mockResolvedValue([
      { monto: 400, moneda: 'CUP', tasaCambio: null, montoConvertido: 400 },
    ] as never);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1', idCC: 9, montoDeuda: 1000, montoPagado: 400,
      estado: 'PARCIAL', monedaOriginal: 'CUP', idTransferencia: null,
    } as never);
    mockTx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 } as never);

    const response = await POST(requestPago());

    expect(response.status, await response.clone().text()).toBe(201);
    expect(requirePermission).not.toHaveBeenCalledWith(
      expect.anything(), 'ventas.venta.credito-override', expect.any(String),
    );
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cxc-1', tenantId: 'tenant-rec' },
        data: expect.objectContaining({ montoPagado: new Prisma.Decimal('500'), estado: 'PARCIAL' }),
      }),
    );
    expect(AuditLogService.logStrict).toHaveBeenCalledWith(expect.objectContaining({
      entidad: 'RECONCILIACION',
      entidadId: 'rec-1',
      usuarioId: 'user-rec-1',
      detalles: expect.objectContaining({ tipo: 'VENTA', ventaId: 'venta-1' }),
    }), mockTx);
  });

  it('reactivar una CxC ANULADA se rechaza antes del gate: 400 CXC_ANULADA', async () => {
    // Cuenta anulada: el route la rechaza de plano (no se cobra sobre anuladas).
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1', idCC: 9, montoDeuda: 1000, montoPagado: 1000,
      estado: 'ANULADA', monedaOriginal: 'CUP', idTransferencia: null,
    } as never);

    const response = await POST(requestPago());

    expect(response.status, await response.clone().text()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'CXC_ANULADA' });
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
  });
});
