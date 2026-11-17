import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fusionarClientesAction } from '@/features/crm/actions';
import { acquireAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service';
import { expectActionFailure } from '@/test/action-response';

const state = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  tx: {
    cliente: { findFirst: vi.fn(), delete: vi.fn() },
    cuentaPorCobrar: { findFirst: vi.fn(), updateMany: vi.fn() },
    venta: { updateMany: vi.fn() }, factura: { updateMany: vi.fn() },
    contrato: { updateMany: vi.fn() }, oferta: { updateMany: vi.fn() },
    anticipo: { updateMany: vi.fn() }, clienteLealtad: { updateMany: vi.fn() },
    clienteSegmento: { updateMany: vi.fn() }, clienteDuplicado: { create: vi.fn() },
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: vi.fn((fn) => fn(state.tx)) } }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: state.getCurrentUser }));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const input = { clientePrincipal: 'principal', clienteSecundario: 'secundario' };

beforeEach(() => {
  vi.clearAllMocks();
  state.getCurrentUser.mockResolvedValue({
    userId: 'u1', tenantId: 'tenant-1', name: 'QA', email: 'test@test.invalid',
    role: 'ADMIN', isActive: true, planFeatures: { 'crm-cdp': true },
  });
  state.tx.cliente.findFirst.mockImplementation(({ where }) => Promise.resolve({ clienteId: where.clienteId }));
  state.tx.cuentaPorCobrar.findFirst.mockResolvedValue(null);
});

describe('fusión de clientes con evidencia contable de apertura', () => {
  it.each(['principal', 'secundario'])(
    'rechaza si el cliente %s tiene CxC inicial y no reasigna relaciones', async (clienteId) => {
      state.tx.cuentaPorCobrar.findFirst.mockResolvedValue({ id: 'cxc-inicial', clienteId });
      const result = await fusionarClientesAction(input);
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIAL_RECEIVABLE_MERGE_BLOCKED');
      expect(state.tx.cuentaPorCobrar.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1', clienteId: { in: ['principal', 'secundario'] },
          OR: [{ inicializacionId: { not: null } }, { tipoCuenta: 'APERTURA_EXTERNA' }],
        }, select: { id: true },
      });
      expect(state.tx.venta.updateMany).not.toHaveBeenCalled();
      expect(state.tx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
      expect(state.tx.cliente.delete).not.toHaveBeenCalled();
    },
  );

  it('serializa con la inicialización y permite la fusión cuando no hay CxC inicial', async () => {
    const result = await fusionarClientesAction(input);
    expect(result.success).toBe(true);
    expect(acquireAccountingTenantLock).toHaveBeenCalledWith(state.tx, 'tenant-1');
    expect(vi.mocked(acquireAccountingTenantLock).mock.invocationCallOrder[0])
      .toBeLessThan(state.tx.cuentaPorCobrar.findFirst.mock.invocationCallOrder[0]);
    expect(state.tx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
      where: { clienteId: 'secundario', tenantId: 'tenant-1' },
      data: { clienteId: 'principal' },
    });
  });
});
