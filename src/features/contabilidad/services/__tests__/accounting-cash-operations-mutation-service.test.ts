import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tx: {
    reconciliacionVenta: { findUnique: vi.fn() },
    prestamoCash: { findFirst: vi.fn() },
  },
  validarEscrituraPeriodo: vi.fn(),
  acquireLock: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: async (fn: any) => fn(mocks.tx) } }));
vi.mock('@/lib/services/validate-period-write', () => ({ validarEscrituraPeriodo: mocks.validarEscrituraPeriodo }));
vi.mock('../accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: mocks.acquireLock }));

import { AccountingCashOperationsMutationService } from '../accounting-cash-operations-mutation-service';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validarEscrituraPeriodo.mockResolvedValue({ permitido: true });
  mocks.tx.reconciliacionVenta.findUnique.mockResolvedValue(null);
  mocks.tx.prestamoCash.findFirst.mockResolvedValue({
    id: 'prest-1', estado: 'ACTIVO',
    cuentaPorCobrar: { id: 'cxc-1', inicializacionId: 'init-1' },
  });
});

describe('registerCashLoanPayment con préstamo inicial', () => {
  it('bloquea el cobro por préstamos-cash cuando la CxC es inicial', async () => {
    await expect(AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: { id: 'prest-1', monto: 10, cuentaId: 'banco-1', tipoPagoId: 'tp-1' },
      user: { userId: 'user-1', tenantId: 'tenant-a' } as never,
    })).rejects.toMatchObject({ code: 'COBRO_PRESTAMO_INICIAL_BLOQUEADO' });
  });
});
