import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx, prismaMock, postEventoMock, permissionMock } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    ventaServicios: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cuentaBancaria: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    tipoPago: { findFirst: vi.fn() },
    reconciliacionServicio: { create: vi.fn() },
  };
  return {
    tx,
    prismaMock: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) },
    postEventoMock: vi.fn().mockResolvedValue({ estado: 'OMITIDO' }),
    permissionMock: vi.fn(),
  };
});
const reconcileServiceMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/server-actions', () => ({
  withAction: (fn: (...args: unknown[]) => unknown) => fn,
  ActionError: class extends Error {},
}));
vi.mock('@/lib/services/with-period-validation', () => ({
  withPeriodValidation: (_date: unknown, fn: unknown) => fn,
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
  requireTenant: (user: { tenantId: string }) => user.tenantId,
  requirePermission: permissionMock,
}));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn(),
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: postEventoMock,
}));
vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/contabilidad/services/accounting-reconciliation-service')>();
  return {
    ...actual,
    AccountingReconciliationService: {
      ...actual.AccountingReconciliationService,
      reconcileService: reconcileServiceMock,
    },
  };
});
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { reconciliarServicioAction } from '@/features/contabilidad/actions-reconciliacion';

/**
 * withAction esta mockeado como identidad en este archivo: la accion exportada
 * es la funcion cruda (input, user). El cast refleja el comportamiento real del
 * mock (vi.mock no cambia los tipos que ve tsc).
 */
type ReconciliarServicioInput = NonNullable<Parameters<typeof reconciliarServicioAction>[0]>;
const reconciliarServicioActionRaw = reconciliarServicioAction as unknown as (
  input: ReconciliarServicioInput,
  user: unknown,
) => ReturnType<typeof reconciliarServicioAction>;

/**
 * @description Contrato de frontera de la action: exige feature + permiso antes de
 * delegar en el servicio canónico y propaga su resultado/errores tal cual. Las
 * aserciones operativas (un posteo por fila, rollback, CxC parcial/final) viven en
 * `reconciliar-servicio-real.test.ts` (PostgreSQL) y en la suite del writer compartido.
 */
describe('reconciliarServicioAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reconcileServiceMock.mockResolvedValue({ reconciliado: true, distribuciones: 2 });
  });

  it('delega la distribución al writer compartido', async () => {
    const input = {
      ventaServicioId: 'serv-1',
      fechaReconciliacion: '2026-10-03T12:00:00.000Z',
      distribuciones: [
        { cuentaId: 'cuenta-1', tipoPagoId: 'pago-1', monto: 10, moneda: 'CUP' },
        { cuentaId: 'cuenta-2', tipoPagoId: 'pago-2', monto: 10, moneda: 'CUP' },
      ],
    };
    const user = { userId: 'actor-1', tenantId: 'tenant-1' } as never;

    const result = await reconciliarServicioActionRaw(input, user);

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(result.data.reconciliado).toBe(true);
    expect(reconcileServiceMock).toHaveBeenCalledWith({ input, user });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('aplica feature y permiso antes de delegar y propaga el resultado', async () => {
    const input = {
      ventaServicioId: 'serv-1',
      distribuciones: [
        { cuentaId: 'cuenta-1', tipoPagoId: 'pago-1', monto: 10, moneda: 'CUP' },
        { cuentaId: 'cuenta-2', tipoPagoId: 'pago-2', monto: 10, moneda: 'CUP' },
      ],
    };
    const user = { userId: 'actor-1', tenantId: 'tenant-1' } as never;

    const result = await reconciliarServicioActionRaw(input, user);

    expect(permissionMock).toHaveBeenCalledWith(
      user, 'financiero.contabilidad.acceder', 'reconciliar servicios',
    );
    expect(reconcileServiceMock).toHaveBeenCalledTimes(1);
    expect(reconcileServiceMock).toHaveBeenCalledWith({ input, user });
    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(result.data.reconciliado).toBe(true);
  });

  it('no invoca el writer compartido si el actor carece de permiso', async () => {
    permissionMock.mockImplementationOnce(() => { throw new Error('Sin permiso'); });
    await expect(reconciliarServicioActionRaw({
      ventaServicioId: 'serv-1',
      distribuciones: [{ cuentaId: 'cuenta-1', tipoPagoId: 'pago-1', monto: 20 }],
    }, { userId: 'actor-1', tenantId: 'tenant-1' } as never)).rejects.toThrow('Sin permiso');
    expect(reconcileServiceMock).not.toHaveBeenCalled();
  });

  it('propaga sin mutar el rechazo del writer compartido', async () => {
    reconcileServiceMock.mockRejectedValueOnce(new Error('saldo insuficiente del tenant'));
    await expect(reconciliarServicioActionRaw({
      ventaServicioId: 'serv-1',
      distribuciones: [{ cuentaId: 'cuenta-1', tipoPagoId: 'pago-1', monto: 20 }],
    }, { userId: 'actor-1', tenantId: 'tenant-1' } as never)).rejects.toThrow('saldo insuficiente del tenant');
    expect(permissionMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'actor-1', tenantId: 'tenant-1' }),
      'financiero.contabilidad.acceder', expect.any(String),
    );
  });
});
