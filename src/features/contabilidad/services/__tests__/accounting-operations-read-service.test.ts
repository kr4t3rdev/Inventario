import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transferenciaBancaria: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { AccountingOperationsReadService } from '../accounting-operations-read-service';

describe('AccountingOperationsReadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.transferenciaBancaria.count).mockResolvedValue(0);
  });

  it('applies tenant scope to bank transfer list queries', async () => {
    await AccountingOperationsReadService.getBankTransfers({ tenantId: 'tenant-a' });

    expect(prisma.transferenciaBancaria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
    expect(prisma.transferenciaBancaria.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: 'tenant-a' }),
    });
  });

  it('applies tenant scope to a bank transfer detail query', async () => {
    vi.mocked(prisma.transferenciaBancaria.findFirst).mockResolvedValue(null);

    await expect(
      AccountingOperationsReadService.getBankTransferById('transfer-1', 'tenant-a'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(prisma.transferenciaBancaria.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transferenciaId: 'transfer-1', tenantId: 'tenant-a' },
      }),
    );
  });
});
