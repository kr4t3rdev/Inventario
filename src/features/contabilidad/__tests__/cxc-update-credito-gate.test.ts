/**
 * @description Gate de cupo común para la EDICIÓN manual de CxC
 * (`updateCuentaPorCobrarAction`): un incremento neto de exposición dentro de
 * la transacción exige intención explícita + permiso `financiero.cuentas-cobrar.credito-override`
 * + motivo, con auditoría estricta en el mismo commit. Reducciones no requieren override.
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
  cuentaPorCobrar: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  cliente: { findFirst: vi.fn() },
  auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaPorCobrar: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
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
import { updateCuentaPorCobrarAction } from '@/features/contabilidad/actions-cuentas';
import { requirePermission } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager: AuthenticatedUser = {
  userId: 'user-upd-1',
  name: 'Manager CXC',
  email: 'manager-cxc@test.local',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-cxc',
  tenantRole: 'manager',
  planFeatures: { 'cuentas-cobrar': true },
  permissions: new Set(['financiero.cuentas-cobrar.credito-override']),
} as unknown as AuthenticatedUser;

const dependiente: AuthenticatedUser = {
  ...manager,
  userId: 'user-upd-2',
  tenantRole: 'dependiente',
  planFeatures: { 'cuentas-cobrar': true },
  permissions: new Set(),
} as unknown as AuthenticatedUser;

/** @description Cuenta existente: deuda 100, nada pagado, saldo vivo 100. */
function existente(): Record<string, unknown> {
  return {
    id: 'cxc-1',
    tenantId: 'tenant-cxc',
    clienteId: 'cli-1',
    montoDeuda: 100,
    montoPagado: 0,
    estado: 'PENDIENTE',
    monedaOriginal: 'CUP',
  };
}

/** @description Fila enriquecida devuelta por la lectura posterior al update. */
function cuentaActualizada(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cxc-1',
    idCC: 1,
    facturaId: null,
    numeroFactura: 'M-1',
    clienteId: 'cli-1',
    montoDeuda: 250,
    montoPagado: 0,
    estado: 'PENDIENTE',
    tipoCuenta: null,
    fechaVencimiento: null,
    idTransferencia: null,
    monedaOriginal: 'CUP',
    createdAt: new Date('2026-09-27T12:00:00.000Z'),
    updatedAt: new Date('2026-09-27T12:00:00.000Z'),
    cliente: { clienteId: 'cli-1', nombre: 'Cliente' },
    factura: null,
    prestamoCash: null,
    ...over,
  };
}

describe('gate 4.4.b: edición manual de CxC bajo cupo común', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(manager);
    // Discriminador determinista: la lectura posterior al commit incluye relaciones
    // (`include`); las lecturas previas/vigente devuelven la cuenta base. Así el mock
    // no depende del número de consultas que haga el gate antes de rechazar.
    vi.mocked(prisma.cuentaPorCobrar.findFirst).mockImplementation(
      async (args?: { include?: unknown }) =>
        (args?.include ? cuentaActualizada() : existente()) as never,
    );
    // Relectura dentro de la transacción (delta neto) y saldo del cliente.
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue(existente() as never);
    mockTx.cuentaPorCobrar.findMany.mockResolvedValue([
      { montoDeuda: 100, montoPagado: 0, monedaOriginal: 'CUP' },
    ] as never);
    mockTx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 } as never);
    mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'cli-1', limiteCredito: 200 } as never);
  });

  it('rechaza CREDITO_EXCEDIDO al aumentar la deuda por encima del límite sin override', async () => {
    const result = await updateCuentaPorCobrarAction({
      id: 'cxc-1', montoDeuda: 500,
    });

    expect(result).toMatchObject({ success: false, error: { code: 'CREDITO_EXCEDIDO' } });
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
    expect(prisma.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
    expect(AuditLogService.logStrict).not.toHaveBeenCalled();
  });

  it('rechaza FORBIDDEN al exceder con motivo pero sin permiso de override', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependiente);

    const result = await updateCuentaPorCobrarAction({
      id: 'cxc-1', montoDeuda: 500,
      solicitarCreditoOverride: true, motivoCreditoOverride: 'Incremento aprobado',
    });

    expect(result).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.cuentas-cobrar.credito-override', expect.any(String),
    );
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
  });

  it('autoriza el exceso con permiso + motivo y audita estricto dentro de la transacción', async () => {
    const result = await updateCuentaPorCobrarAction({
      id: 'cxc-1', montoDeuda: 300,
      solicitarCreditoOverride: true, motivoCreditoOverride: 'Regularización aprobada por gerencia',
    });

    expect(result, JSON.stringify(result)).toMatchObject({ success: true });
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.cuentas-cobrar.credito-override', expect.any(String),
    );
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cxc-1', tenantId: 'tenant-cxc', estado: { not: 'ANULADA' } },
      }),
    );
    expect(AuditLogService.logStrict).toHaveBeenCalledWith(expect.objectContaining({
      detalles: expect.objectContaining({
        tipo: 'CREDITO_OVERRIDE',
        clienteId: 'cli-1',
        motivo: 'Regularización aprobada por gerencia',
      }),
    }), mockTx);
  });

  it('no exige override cuando la edición reduce la exposición (delta neto ≤ 0)', async () => {
    // Deuda 100 / pagado 0 → pagado 40: el saldo vivo baja de 100 a 60.
    const result = await updateCuentaPorCobrarAction({
      id: 'cxc-1', montoPagado: 40, estado: 'PARCIAL',
    });

    expect(result, JSON.stringify(result)).toMatchObject({ success: true });
    expect(requirePermission).not.toHaveBeenCalledWith(
      expect.anything(), 'financiero.cuentas-cobrar.credito-override', expect.any(String),
    );
    expect(mockTx.$queryRaw).toHaveBeenCalledOnce();
    expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockTx.cuentaPorCobrar.findFirst.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(AuditLogService.logStrict).not.toHaveBeenCalled();
  });

  it('fail-closed: aumento sobre cuenta sin moneda verificable → FX_INSUFICIENTE', async () => {
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      ...existente(),
      monedaOriginal: null,
    } as never);
    mockTx.cuentaPorCobrar.findMany.mockResolvedValue([
      { montoDeuda: 100, montoPagado: 0, monedaOriginal: null },
    ] as never);

    const result = await updateCuentaPorCobrarAction({
      id: 'cxc-1', montoDeuda: 150,
      solicitarCreditoOverride: true, motivoCreditoOverride: 'Ajuste',
    });

    expect(result).toMatchObject({ success: false, error: { code: 'FX_INSUFICIENTE' } });
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
  });

  it('cliente sin límite configurado permite el aumento sin override (sin tope)', async () => {
    mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'cli-1', limiteCredito: null } as never);

    const result = await updateCuentaPorCobrarAction({
      id: 'cxc-1', montoDeuda: 500,
    });

    expect(result, JSON.stringify(result)).toMatchObject({ success: true });
    expect(requirePermission).not.toHaveBeenCalled();
    expect(AuditLogService.logStrict).not.toHaveBeenCalled();
  });
});
