import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';

const prismaMock = vi.hoisted(() => ({
  cuentaPorCobrar: {
    aggregate: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('AccountingAccountsService CxC metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calculates porVencer from active accounts only, excluding PAGADA and ANULADA', async () => {
    prismaMock.cuentaPorCobrar.aggregate.mockResolvedValue({ _sum: { montoDeuda: 300 } });
    prismaMock.cuentaPorCobrar.count
      .mockResolvedValueOnce(1) // active overdue
      .mockResolvedValueOnce(3) // active total
      .mockResolvedValueOnce(5); // all rows, including paid/annulled

    const result = await AccountingAccountsService.getReceivablesMetrics({ tenantId: 'tenant-1' });

    expect(result).toEqual({
      totalPendiente: 300,
      vencidas: 1,
      cuentasActivas: 3,
      porVencer: 2,
      totalCuentas: 5,
    });
    expect(prismaMock.cuentaPorCobrar.count).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
      }),
    }));
  });
});
