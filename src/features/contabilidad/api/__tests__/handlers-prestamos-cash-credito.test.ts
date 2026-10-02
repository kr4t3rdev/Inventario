/**
 * @description Gate de cupo común en el handler legacy `handlePostPrestamosCash`
 * (alta alternativa de CxC `PRESTAMO_CASH` fuera de la ruta principal): si el
 * desembolso excede el cupo exige override explícito con
 * `financiero.prestamos-cash.credito-override`, motivo y auditoría estricta en tx.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockTx = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([]),
  cuentaBancaria: { update: vi.fn().mockResolvedValue({}) },
  cuentaPorCobrar: {
    create: vi.fn(), findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(), update: vi.fn(),
  },
  reconciliacionVenta: { create: vi.fn() },
  prestamoCash: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  cliente: { findFirst: vi.fn() },
  auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    cuentaBancaria: { findUnique: vi.fn() },
    tipoPago: { findFirst: vi.fn() },
    prestamoCash: { findFirst: vi.fn() },
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };
  return { prisma, default: prisma };
});

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(null),
    logStrict: vi.fn((_params: unknown, client: typeof mockTx) => client.auditLog.create({ data: _params })),
  },
}));

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: vi.fn().mockResolvedValue(undefined),
}));

// Espías pass-through sobre la autorización real.
vi.mock('@/lib/services/tenant-scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/tenant-scope')>();
  return {
    ...actual,
    requireFeature: vi.fn(actual.requireFeature),
    requirePermission: vi.fn(actual.requirePermission),
    requireTenant: vi.fn(actual.requireTenant),
  };
});

import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { requirePermission } from '@/lib/services/tenant-scope';
import {
  handlePostPrestamoCashPago,
  handlePostPrestamosCash,
} from '@/features/contabilidad/api/handlers-prestamos-cash';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const managerConOverride: AuthenticatedUser = {
  userId: 'user-legacy-1',
  name: 'Manager Legacy',
  email: 'legacy@test.local',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-legacy',
  tenantRole: 'manager',
  planFeatures: { 'prestamos-cash': true },
  permissions: new Set(['financiero.prestamos-cash.credito-override']),
} as unknown as AuthenticatedUser;

/** @description Request HTTP del alta legacy de préstamo. */
function requestAlta(extra: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
    method: 'POST',
    body: JSON.stringify({
      clienteId: 'c-1',
      montoCapital: 5000,
      moneda: 'CUP',
      cuentaBancariaId: 'cta-1',
      ...extra,
    }),
  });
}

describe('gate 4.2.c: handler legacy de alta de préstamos cash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true');
    vi.mocked(prisma.cuentaBancaria.findUnique).mockResolvedValue({
      cuentaId: 'cta-1', saldo: 100_000, isActive: true,
    } as never);
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'tp-1', nombre: 'Transferencia', isActive: true, tenantId: 'tenant-legacy',
    } as never);
    mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'c-1', limiteCredito: 100 } as never);
    mockTx.cuentaPorCobrar.findMany.mockResolvedValue([] as never);
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-1' } as never);
    mockTx.reconciliacionVenta.create.mockResolvedValue({ reconciliacionId: 'rec-1' } as never);
    mockTx.prestamoCash.create.mockResolvedValue({ id: 'p-1' } as never);
  });

  it('rechaza CREDITO_EXCEDIDO al superar el cupo sin override explícito', async () => {
    await expect(handlePostPrestamosCash(requestAlta(), managerConOverride))
      .rejects.toMatchObject({ code: 'CREDITO_EXCEDIDO' });
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
    expect(mockTx.cuentaBancaria.update).not.toHaveBeenCalled();
    expect(AuditLogService.logStrict).not.toHaveBeenCalled();
  });

  it('autoriza el exceso con permiso + motivo y audita estricto dentro de la tx', async () => {
    const response = await handlePostPrestamosCash(requestAlta({
      solicitarCreditoOverride: true,
      motivoCreditoOverride: 'Desembolso excepcional autorizado',
    }), managerConOverride);

    expect(response.status).toBe(201);
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.prestamos-cash.credito-override', expect.any(String),
    );
    expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoCuenta: 'PRESTAMO_CASH',
          montoDeuda: 5000,
          monedaOriginal: 'CUP',
        }),
      }),
    );
    expect(AuditLogService.logStrict).toHaveBeenCalledWith(expect.objectContaining({
      detalles: expect.objectContaining({
        tipo: 'CREDITO_OVERRIDE',
        clienteId: 'c-1',
        motivo: 'Desembolso excepcional autorizado',
      }),
    }), mockTx);
  });

  it('serializa el pago legacy y rechaza un saldo cambiado antes de mover banco', async () => {
    const prismaModule = await import('@/lib/prisma');
    vi.mocked(prismaModule.prisma.prestamoCash.findFirst).mockResolvedValue({
      id: 'p-1',
      tenantId: 'tenant-legacy',
      clienteId: 'c-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'cxc-1',
      cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 0 },
    } as never);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1', montoDeuda: 1000, montoPagado: 800, estado: 'PARCIAL',
    } as never);

    const response = await handlePostPrestamoCashPago(
      new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
        method: 'POST',
        body: JSON.stringify({ monto: 500, cuentaId: 'cta-1', tipoPagoId: 'tp-1' }),
      }),
      { params: Promise.resolve({ id: 'p-1' }) },
      { userId: 'user-legacy-1' },
    );

    expect(response.status).toBe(409);
    expect(mockTx.$queryRaw).toHaveBeenCalledOnce();
    expect(mockTx.cuentaPorCobrar.update).not.toHaveBeenCalled();
    expect(mockTx.cuentaBancaria.update).not.toHaveBeenCalled();
    expect(mockTx.reconciliacionVenta.create).not.toHaveBeenCalled();
  });
});
