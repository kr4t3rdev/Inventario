import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  lock: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
  $transaction: state.transaction,
  cuentaPorPagar: { findFirst: state.findFirst, create: state.create },
} }));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: state.lock,
}));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: 'u1', tenantId: 't1', role: 'admin',
    isActive: true, planFeatures: { 'cuentas-pagar': true } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: { log: vi.fn().mockResolvedValue(undefined) } }));

import { createCuentaPorPagarAction } from '@/features/contabilidad/actions-cuentas';

describe('creación de CxP durante apertura inicial', () => {
  it('espera el bloqueo de la empresa antes de consultar duplicados o escribir', async () => {
    let release!: () => void;
    state.lock.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const tx = { cuentaPorPagar: { findFirst: state.findFirst, create: state.create } };
    state.transaction.mockImplementation((run) => run(tx));
    state.findFirst.mockResolvedValue({ cuentaPorPagarId: 'existing' });
    const result = createCuentaPorPagarAction({ numeroFactura: 'F-1', tipo: 'compra',
      proveedorId: 'p1', montoDeuda: 100 });
    await vi.waitFor(() => expect(state.lock).toHaveBeenCalledWith(tx, 't1'));
    expect(state.findFirst).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
    release();
    expect((await result).success).toBe(false);
    expect(state.findFirst).toHaveBeenCalledOnce();
  });
});
