import { describe, expect, it, vi } from 'vitest';

const mockTx = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([]),
  cuentaPorCobrar: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
  },
}));

import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';

describe('AccountingAccountsService.annulReceivable credit lock', () => {
  it('locks the customer before changing an active receivable state', async () => {
    vi.clearAllMocks();
    mockTx.cuentaPorCobrar.findFirst
      .mockResolvedValueOnce({ id: 'cxc-1', clienteId: 'client-1', estado: 'PARCIAL' })
      .mockResolvedValueOnce({ id: 'cxc-1', clienteId: 'client-1', estado: 'PARCIAL' })
      .mockResolvedValueOnce({ id: 'cxc-1', clienteId: 'client-1', estado: 'ANULADA' });
    mockTx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 });

    const result = await AccountingAccountsService.annulReceivable({
      id: 'cxc-1',
      tenantId: 'tenant-1',
    });

    expect(result).toMatchObject({ changed: true, previousState: 'PARCIAL' });
    expect(mockTx.$queryRaw).toHaveBeenCalledOnce();
    expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockTx.cuentaPorCobrar.updateMany.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
});
