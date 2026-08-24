import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tenantAccountingPolicy: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  moneda: { findFirst: vi.fn() },
  financialAuxiliaryCheckpoint: { count: vi.fn() },
  snapshotPeriodo: { count: vi.fn() },
  reconciliacionVenta: { count: vi.fn() },
  reconciliacionServicio: { count: vi.fn() },
  reconciliacionGasto: { count: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('tenant accounting policy service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.moneda.findFirst.mockResolvedValue({ codigo: 'USD' });
    prismaMock.financialAuxiliaryCheckpoint.count.mockResolvedValue(0);
    prismaMock.snapshotPeriodo.count.mockResolvedValue(0);
    prismaMock.reconciliacionVenta.count.mockResolvedValue(0);
    prismaMock.reconciliacionServicio.count.mockResolvedValue(0);
    prismaMock.reconciliacionGasto.count.mockResolvedValue(0);
  });

  it('returns only the explicit policy owned by the requested tenant', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
      updatedBy: 'user-a',
    });
    const { getRequiredTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    const policy = await getRequiredTenantAccountingPolicy('tenant-a');

    expect(policy.functionalCurrencyCode).toBe('USD');
    expect(prismaMock.tenantAccountingPolicy.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      select: expect.objectContaining({ tenantId: true, functionalCurrencyCode: true }),
    });
  });

  it('fails closed when no independently configured policy exists', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    const { getRequiredTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    await expect(getRequiredTenantAccountingPolicy('tenant-a')).rejects.toMatchObject({
      code: 'TENANT_ACCOUNTING_POLICY_REQUIRED',
    });
    expect(prismaMock.moneda.findFirst).not.toHaveBeenCalled();
  });

  it('blocks a currency change after immutable accounting evidence exists', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-old',
    });
    prismaMock.financialAuxiliaryCheckpoint.count.mockResolvedValue(1);
    const { setTenantAccountingPolicy } = await import('./tenant-accounting-policy-service');

    await expect(setTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
      updatedBy: 'user-new',
    })).rejects.toMatchObject({ code: 'FUNCTIONAL_CURRENCY_IMMUTABLE' });
    expect(prismaMock.tenantAccountingPolicy.update).not.toHaveBeenCalled();
  });
});
