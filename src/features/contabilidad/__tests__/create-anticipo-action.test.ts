import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  createAnticipo: vi.fn(),
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
  requireTenant: vi.fn(() => 'tenant-a'),
  auditLog: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions', () => ({
  withAction: (handler: (...args: unknown[]) => unknown) => handler,
  ActionError: class ActionError extends Error {},
}));
vi.mock('@/lib/services/with-period-validation', () => ({
  withPeriodValidation: (_date: unknown, handler: (...args: unknown[]) => unknown) => handler,
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: mocked.requireFeature,
  requirePermission: mocked.requirePermission,
  requireTenant: mocked.requireTenant,
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({
  createAnticipo: mocked.createAnticipo,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: mocked.auditLog },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn(async (callback: (tx: object) => unknown) => callback({})) },
}));

import { createAnticipoAction } from '@/features/contabilidad/actions-anticipos';

/**
 * withAction esta mockeado como identidad en este archivo: la accion exportada
 * es la funcion cruda (input, user). El cast refleja el comportamiento real del
 * mock (vi.mock no cambia los tipos que ve tsc).
 */
type CreateAnticipoInput = NonNullable<Parameters<typeof createAnticipoAction>[0]>;
const createAnticipoActionRaw = createAnticipoAction as unknown as (
  input: CreateAnticipoInput,
  user: unknown,
) => ReturnType<typeof createAnticipoAction>;

describe('createAnticipoAction — entrada con fondos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createAnticipo.mockResolvedValue({ anticipoId: 'anticipo-a' });
    mocked.auditLog.mockResolvedValue(undefined);
  });

  it('exige feature y permiso, y delega la creación con tenant y fuente de fondos', async () => {
    const user = { userId: 'user-a', tenantId: 'tenant-a', role: 'regularUser' };
    const result = await createAnticipoActionRaw({
      tipo: 'COBRO',
      contratoId: 'contract-a',
      clienteId: 'client-a',
      monto: 100,
      moneda: 'USD',
      cuentaOrigenId: 'bank-a',
      tipoPagoOrigenId: 'payment-a',
      idempotencyKey: 'advance-key-1',
    }, user as never);

    expect(result).toMatchObject({ anticipo: { anticipoId: 'anticipo-a' } });
    expect(mocked.requireFeature).toHaveBeenCalledWith(user, 'anticipos', 'crear anticipos');
    expect(mocked.requirePermission).toHaveBeenCalledWith(
      user, 'financiero.contabilidad.acceder', 'crear anticipos',
    );
    expect(mocked.createAnticipo).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-a', usuarioId: user.userId, idempotencyKey: 'advance-key-1',
    }));
  });

  it('rechaza si falta cuenta o tipo de pago de los fondos', async () => {
    await expect(createAnticipoActionRaw({
      tipo: 'COBRO', contratoId: 'contract-a', clienteId: 'client-a', monto: 100, moneda: 'CUP', cuentaOrigenId: 'account-a', tipoPagoOrigenId: 'payment-a',
    }, { userId: 'user-a', tenantId: 'tenant-a' } as never)).rejects.toMatchObject({
      name: 'ZodError',
    });

    expect(mocked.createAnticipo).not.toHaveBeenCalled();
  });
});
