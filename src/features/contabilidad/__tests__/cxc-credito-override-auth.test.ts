/**
 * @description Verifica autorización por origen y auditoría transaccional al
 * crear una cuenta por cobrar manual por encima del límite de crédito.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(null),
    logStrict: vi.fn((_params: unknown, client: typeof mockTx) => client.auditLog.create({ data: _params })),
  },
}));

const mockTx = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([]),
  cuentaPorCobrar: { findMany: vi.fn(), create: vi.fn() },
  cliente: { findFirst: vi.fn() },
  auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    venta: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    cuentaPorCobrar: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  },
}));

// Espías pass-through: conservan la lógica real (planFeatures/permissions del
// user) y permiten verificar qué autorización se exige por entrada.
vi.mock('@/lib/services/tenant-scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/tenant-scope')>();
  return {
    ...actual,
    requireFeature: vi.fn(actual.requireFeature),
    requirePermission: vi.fn(actual.requirePermission),
    requireTenant: vi.fn(actual.requireTenant),
  };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { createCuentaPorCobrarAction } from '@/features/contabilidad/actions-cuentas';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const admin: AuthenticatedUser = {
  userId: 'user-cxc-1',
  name: 'Admin CXC',
  email: 'admin-cxc@test.local',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-cxc',
  tenantRole: 'admin',
} as unknown as AuthenticatedUser;

const dependienteConFeature: AuthenticatedUser = {
  ...admin,
  userId: 'user-cxc-2',
  role: 'user',
  tenantRole: 'dependiente',
  planFeatures: { 'cuentas-cobrar': true },
  permissions: new Set(),
} as unknown as AuthenticatedUser;

/** @description Row de venta asociada al cliente del cargo manual.
 * @returns {Record<string, unknown>} Venta con factura.
 */
function ventaAsociada(): Record<string, unknown> {
  return {
    ventaId: 'sale-1',
    clienteId: 'client-1',
    factura: { idFactura: 'invoice-1' },
  };
}

describe('gate 1.3: autorización efectiva del cargo manual de CxC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(admin);
    vi.mocked(prisma.venta.findFirst).mockResolvedValue(ventaAsociada() as never);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'client-1',
      limiteCredito: 100,
    } as never);
    vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue(null);
    mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'receivable-1' });
    vi.mocked(mockTx.cuentaPorCobrar.create).mockResolvedValue({
      id: 'receivable-1', idCC: 1, facturaId: 'invoice-1', numeroFactura: 'INV-1',
      clienteId: 'client-1', montoDeuda: 500, montoPagado: 0, estado: 'PENDIENTE',
      monedaOriginal: 'CUP', createdAt: new Date(), updatedAt: new Date(),
      cliente: { clienteId: 'client-1', nombre: 'Cliente' },
    } as never);
    mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'client-1', limiteCredito: 100 });
    vi.mocked(prisma.cuentaPorCobrar.create).mockResolvedValue({
      id: 'receivable-1',
      idCC: 1,
      facturaId: 'invoice-1',
      numeroFactura: 'INV-1',
      clienteId: 'client-1',
      montoDeuda: 500,
      montoPagado: 0,
      idTransferencia: null,
      estado: 'PENDIENTE',
      fechaVencimiento: null,
      monedaOriginal: 'USD',
      montoOriginal: 500,
      cliente: { clienteId: 'client-1', nombre: 'Cliente' },
      factura: null,
      prestamoCash: null,
      createdAt: new Date('2026-09-27T12:00:00.000Z'),
      updatedAt: new Date('2026-09-27T12:00:00.000Z'),
    } as never);
  });

  it('requiere autorización explícita para exceder el límite', async () => {
    const result = await createCuentaPorCobrarAction({
      ventaId: 'sale-1', clienteId: 'client-1', monto: 125, moneda: 'USD',
    });

    expect(result).toMatchObject({ success: false, error: { code: 'CREDITO_EXCEDIDO' } });
    expect(requireFeature).toHaveBeenCalledWith(expect.anything(), 'cuentas-cobrar', expect.any(String));
    expect(requireTenant).toHaveBeenCalled();
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it('evidencia: dependiente sin feature queda denegado antes de escribir', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...dependienteConFeature,
      planFeatures: {},
	} as unknown as AuthenticatedUser);

    const result = await createCuentaPorCobrarAction({
      ventaId: 'sale-1', clienteId: 'client-1', monto: 125, moneda: 'USD',
    });

    expect(result).toMatchObject({ success: false, error: { code: 'FEATURE_NOT_AVAILABLE' } });
    expect(prisma.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('registra auditoría estricta en la transacción al autorizar exceso', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...admin,
      role: 'user',
      tenantRole: 'manager',
      planFeatures: { 'cuentas-cobrar': true },
      permissions: new Set(['financiero.cuentas-cobrar.credito-override']),
	} as unknown as AuthenticatedUser);

    const result = await createCuentaPorCobrarAction({
      ventaId: 'sale-1', clienteId: 'client-1', monto: 500, moneda: 'CUP',
      solicitarCreditoOverride: true, motivoCreditoOverride: 'Ajuste aprobado',
    });

    expect(result, JSON.stringify(result)).toMatchObject({ success: true });
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.cuentas-cobrar.credito-override', expect.any(String),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalled();
    expect(AuditLogService.logStrict).toHaveBeenCalledWith(expect.objectContaining({
      detalles: expect.objectContaining({ tipo: 'CREDITO_OVERRIDE', motivo: 'Ajuste aprobado' }),
    }), mockTx);
  });
});
