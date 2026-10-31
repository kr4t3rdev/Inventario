import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const accountFindFirst = vi.fn();
  const accountUpdateMany = vi.fn();
  const clientFindFirst = vi.fn();
  const paymentTypeFindFirst = vi.fn();
  const receivableCreate = vi.fn();
  const reconciliationCreate = vi.fn();
  const reconciliationFindUnique = vi.fn();
  const reconciliationUpdate = vi.fn();
  const loanCreate = vi.fn();
  const loanFindFirst = vi.fn();
  const auditStrict = vi.fn();
  const accountingPolicyFindUnique = vi.fn();
  const lock = vi.fn();
  const transaction = vi.fn();
  const requireFeature = vi.fn();
  return {
    accountFindFirst,
    accountUpdateMany,
    clientFindFirst,
    paymentTypeFindFirst,
    receivableCreate,
    reconciliationCreate,
    reconciliationFindUnique,
    reconciliationUpdate,
    loanCreate,
    loanFindFirst,
    auditStrict,
    accountingPolicyFindUnique,
    lock,
    transaction,
    requireFeature,
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: () => 'tenant-1',
  requireFeature: mocks.requireFeature,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: mocks.auditStrict },
}));
vi.mock('../accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: mocks.lock,
}));

const input = {
  clienteId: 'client-1',
  montoCapital: 75,
  moneda: 'CUP',
  tasaInteres: 0,
  tasaInteresMoratorio: 0,
  cuentaBancariaId: 'account-1',
  idempotencyKey: 'retry-1',
};
const user = { userId: 'user-1', tenantId: 'tenant-1' } as never;

function tx() {
  return {
    cuentaBancaria: {
      findFirst: mocks.accountFindFirst,
      updateMany: mocks.accountUpdateMany,
    },
    cliente: { findFirst: mocks.clientFindFirst },
    tipoPago: { findFirst: mocks.paymentTypeFindFirst },
    cuentaPorCobrar: { create: mocks.receivableCreate },
    reconciliacionVenta: {
      create: mocks.reconciliationCreate,
      findUnique: mocks.reconciliationFindUnique,
      update: mocks.reconciliationUpdate,
    },
    prestamoCash: { create: mocks.loanCreate, findFirst: mocks.loanFindFirst },
    auditLog: { create: mocks.auditStrict },
    tenantAccountingPolicy: { findUnique: mocks.accountingPolicyFindUnique },
  };
}

describe('cash-loan create tenant safety and atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (client: unknown) => unknown) =>
      callback(tx()));
    mocks.reconciliationFindUnique.mockResolvedValue(null);
    mocks.accountFindFirst.mockResolvedValue({ cuentaId: 'account-1', saldo: 100, isActive: true });
    mocks.accountUpdateMany.mockResolvedValue({ count: 1 });
    mocks.clientFindFirst.mockResolvedValue({ clienteId: 'client-1' });
    mocks.paymentTypeFindFirst.mockResolvedValue({ tipoId: 'payment-type-1' });
    mocks.receivableCreate.mockResolvedValue({ id: 'receivable-1' });
    mocks.reconciliationCreate.mockResolvedValue({ reconciliacionId: 'reconciliation-1' });
    mocks.reconciliationUpdate.mockResolvedValue({});
    mocks.loanCreate.mockResolvedValue({ id: 'loan-1' });
    mocks.auditStrict.mockResolvedValue({ id: 'audit-1' });
    mocks.accountingPolicyFindUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
    mocks.requireFeature.mockImplementation(() => undefined);
  });

  it('scopes both bank account and client ownership to the authenticated tenant', async () => {
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await service.createCashLoan({ input, user });

    expect(mocks.accountFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaId: 'account-1', tenantId: 'tenant-1' },
    }));
    expect(mocks.clientFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { clienteId: 'client-1', tenantId: 'tenant-1' },
    }));
    expect(mocks.receivableCreate.mock.calls[0][0].data.montoDeuda).toBe(75);
    expect(mocks.loanCreate.mock.calls[0][0].data).toMatchObject({
      ordinaryAnnualRate: expect.objectContaining({ d: expect.any(Array) }),
      moratoryAnnualRate: expect.objectContaining({ d: expect.any(Array) }),
      cashInterestPolicyVersion: 1,
      cashInterestPrincipalRemaining: expect.objectContaining({ d: expect.any(Array) }),
    });
  });

  it('replays an existing loan directly through the writer after downgrade', async () => {
    const { cashCreatePayloadHash } = await import('@/lib/services/cash-create-idempotency');
    const replay = { id: 'loan-existing' };
    mocks.requireFeature.mockImplementation(() => {
      const error = new Error('feature unavailable') as Error & { code: string };
      error.code = 'FEATURE_NOT_AVAILABLE';
      throw error;
    });
    mocks.reconciliationFindUnique.mockResolvedValueOnce({
      idempotencyPayloadHash: cashCreatePayloadHash({
        operation: 'CREATE_PRESTAMO_CASH',
        clienteId: input.clienteId,
        montoCapital: input.montoCapital,
        moneda: input.moneda,
        tasaInteres: input.tasaInteres,
        tasaInteresMoratorio: input.tasaInteresMoratorio,
        tasaCambioAlCrear: null,
        fechaVencimiento: null,
        observaciones: null,
        cuentaBancariaId: input.cuentaBancariaId,
      }),
      prestamoCashId: 'loan-existing',
    });
    mocks.loanFindFirst.mockResolvedValueOnce(replay);
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashLoan({ input, user })).resolves.toBe(replay);
    expect(mocks.requireFeature).not.toHaveBeenCalled();
    expect(mocks.clientFindFirst).not.toHaveBeenCalled();
    expect(mocks.loanCreate).not.toHaveBeenCalled();
  });

  it('rejects a foreign-tenant bank account before any balance or loan write', async () => {
    mocks.accountFindFirst.mockResolvedValueOnce(null);
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashLoan({ input, user })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mocks.accountUpdateMany).not.toHaveBeenCalled();
    expect(mocks.receivableCreate).not.toHaveBeenCalled();
  });

  it('rejects a foreign-tenant client before any balance or loan write', async () => {
    mocks.clientFindFirst.mockResolvedValueOnce(null);
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashLoan({ input, user })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(mocks.accountUpdateMany).not.toHaveBeenCalled();
    expect(mocks.receivableCreate).not.toHaveBeenCalled();
  });

  it('does not create a receivable when locked conditional debit finds insufficient balance', async () => {
    mocks.accountUpdateMany.mockResolvedValueOnce({ count: 0 });
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashLoan({ input, user })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mocks.lock).toHaveBeenCalledWith(expect.anything(), 'tenant-1');
    expect(mocks.accountUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cuentaId: 'account-1', tenantId: 'tenant-1', saldo: { gte: 75 } }),
    }));
    expect(mocks.receivableCreate).not.toHaveBeenCalled();
  });

  it('propagates strict audit failure through the transaction callback', async () => {
    mocks.auditStrict.mockRejectedValueOnce(new Error('audit unavailable'));
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashLoan({ input, user })).rejects.toThrow('audit unavailable');
    expect(mocks.auditStrict).toHaveBeenCalledWith(expect.objectContaining({
      entidad: 'PRESTAMO_CASH',
      entidadId: 'loan-1',
    }), expect.objectContaining({ auditLog: expect.anything() }));
  });

  it('returns an existing retry without revalidating accounts or writing a duplicate audit', async () => {
    const replay = { id: 'loan-existing' };
    const { cashCreatePayloadHash } = await import('@/lib/services/cash-create-idempotency');
    mocks.reconciliationFindUnique.mockResolvedValueOnce({
      idempotencyPayloadHash: cashCreatePayloadHash({
        operation: 'CREATE_PRESTAMO_CASH',
        clienteId: input.clienteId,
        montoCapital: input.montoCapital,
        moneda: input.moneda,
        tasaInteres: input.tasaInteres,
        tasaInteresMoratorio: input.tasaInteresMoratorio,
        tasaCambioAlCrear: null,
        fechaVencimiento: null,
        observaciones: null,
        cuentaBancariaId: input.cuentaBancariaId,
      }),
      prestamoCashId: 'loan-existing',
    });
    mocks.loanFindFirst.mockResolvedValueOnce(replay);
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashLoan({ input, user })).resolves.toBe(replay);
    expect(mocks.accountFindFirst).not.toHaveBeenCalled();
    expect(mocks.clientFindFirst).not.toHaveBeenCalled();
    expect(mocks.accountUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditStrict).not.toHaveBeenCalled();
  });
});
