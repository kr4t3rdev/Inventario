import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ lock: vi.fn(), findSale: vi.fn(), findAccount: vi.fn(),
  create: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  $transaction: state.transaction,
  venta: { findFirst: state.findSale },
  cuentaPorCobrar: { findFirst: state.findAccount, create: state.create },
} }));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: state.lock,
}));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: 'u1', tenantId: 't1', role: 'admin',
    isActive: true, planFeatures: { 'cuentas-cobrar': true } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: { log: vi.fn().mockResolvedValue(undefined) } }));

import { createCuentaPorCobrarAction } from '@/features/contabilidad/actions-cuentas';

describe('creación de CxC durante apertura inicial', () => {
  it('espera el bloqueo de la empresa antes de validar la venta y escribir', async () => {
    let release!: () => void;
    state.lock.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const tx = { venta: { findFirst: state.findSale },
      cuentaPorCobrar: { findFirst: state.findAccount, create: state.create } };
    state.transaction.mockImplementation((run) => run(tx));
    state.findSale.mockResolvedValue(null);
    const result = createCuentaPorCobrarAction({ ventaId: 'v1', clienteId: 'c1', monto: 100, moneda: 'CUP' });
    await vi.waitFor(() => expect(state.lock).toHaveBeenCalledWith(tx, 't1'));
    expect(state.findSale).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
    release();
    expect((await result).success).toBe(false);
    expect(state.findSale).toHaveBeenCalledOnce();
  });
});
