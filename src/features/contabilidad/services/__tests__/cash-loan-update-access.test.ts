import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionError } from '@/lib/server-actions';

const mocks = vi.hoisted(() => ({
  loanFindFirst: vi.fn(),
  loanUpdate: vi.fn(),
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prestamoCash: {
      findFirst: mocks.loanFindFirst,
      update: mocks.loanUpdate,
    },
  },
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: () => 'tenant-1',
  requireFeature: mocks.requireFeature,
  requirePermission: mocks.requirePermission,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn() },
}));

describe('cash loan update tenant and plan access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFeature.mockImplementation(() => undefined);
    mocks.requirePermission.mockImplementation(() => undefined);
    mocks.loanFindFirst.mockResolvedValue({ id: 'loan-1', tenantId: 'tenant-1' });
    mocks.loanUpdate.mockResolvedValue({ id: 'loan-1', tenantId: 'tenant-1' });
  });

  it('scopes both update lookup and write to the authenticated tenant', async () => {
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await service.updateCashLoan({
      input: { id: 'loan-1', observaciones: 'Updated' },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(mocks.loanFindFirst).toHaveBeenCalledWith({
      where: { id: 'loan-1', tenantId: 'tenant-1', deletedAt: null },
    });
    expect(mocks.loanUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'loan-1', tenantId: 'tenant-1' },
    }));
  });

  it('does not reveal or update a loan owned by another tenant', async () => {
    mocks.loanFindFirst.mockResolvedValue(null);
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.updateCashLoan({
      input: { id: 'foreign-loan', observaciones: 'Updated' },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.loanUpdate).not.toHaveBeenCalled();
  });

  it('denies updates after downgrade before looking up a loan', async () => {
    mocks.requireFeature.mockImplementation(() => {
      throw new ActionError('Feature unavailable', 'FEATURE_NOT_AVAILABLE');
    });
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.updateCashLoan({
      input: { id: 'loan-1', observaciones: 'Updated' },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' });
    expect(mocks.loanFindFirst).not.toHaveBeenCalled();
    expect(mocks.loanUpdate).not.toHaveBeenCalled();
  });

  it('denies updates without accounting permission before feature or data access', async () => {
    mocks.requirePermission.mockImplementation(() => {
      throw new ActionError('Forbidden', 'FORBIDDEN');
    });
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.updateCashLoan({
      input: { id: 'loan-1', observaciones: 'Updated' },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.requireFeature).not.toHaveBeenCalled();
    expect(mocks.loanFindFirst).not.toHaveBeenCalled();
    expect(mocks.loanUpdate).not.toHaveBeenCalled();
  });
});
