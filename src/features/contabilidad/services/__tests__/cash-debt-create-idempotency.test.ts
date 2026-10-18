import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accountFindFirst: vi.fn(),
  accountUpdateMany: vi.fn(),
  vendorFindFirst: vi.fn(),
  paymentTypeFindFirst: vi.fn(),
  payableCreate: vi.fn(),
  reconciliationCreate: vi.fn(),
  reconciliationFindUnique: vi.fn(),
  debtCreate: vi.fn(),
  debtFindFirst: vi.fn(),
  auditStrict: vi.fn(),
  accountingPolicyFindUnique: vi.fn(),
  lock: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/lib/services/tenant-scope', () => ({ requireTenant: () => 'tenant-1' }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: mocks.auditStrict },
}));
vi.mock('../accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: mocks.lock }));

const input = {
  proveedorId: 'vendor-1',
  montoCapital: 75,
  moneda: 'CUP',
  tasaInteres: 10,
  tasaInteresMoratorio: 0,
  observaciones: 'supplier advance',
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
    vendor: { findFirst: mocks.vendorFindFirst },
    tipoPago: { findFirst: mocks.paymentTypeFindFirst },
    cuentaPorPagar: { create: mocks.payableCreate },
    reconciliacionVenta: {
      create: mocks.reconciliationCreate,
      findUnique: mocks.reconciliationFindUnique,
    },
    deudaCash: { create: mocks.debtCreate, findFirst: mocks.debtFindFirst },
    auditLog: { create: mocks.auditStrict },
    tenantAccountingPolicy: { findUnique: mocks.accountingPolicyFindUnique },
  };
}

describe('cash-debt create tenant safety and idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (client: unknown) => unknown) =>
      callback(tx()),
    );
    mocks.reconciliationFindUnique.mockResolvedValue(null);
    mocks.accountFindFirst.mockResolvedValue({ cuentaId: 'account-1', isActive: true });
    mocks.accountUpdateMany.mockResolvedValue({ count: 1 });
    mocks.vendorFindFirst.mockResolvedValue({ vendorId: 'vendor-1', nombre: 'Vendor' });
    mocks.paymentTypeFindFirst.mockResolvedValue({ tipoId: 'payment-type-1' });
    mocks.payableCreate.mockResolvedValue({ cuentaPorPagarId: 'payable-1' });
    mocks.reconciliationCreate.mockResolvedValue({ reconciliacionId: 'reconciliation-1' });
    mocks.debtCreate.mockResolvedValue({ id: 'debt-1' });
    mocks.debtFindFirst.mockResolvedValue({ id: 'debt-1' });
    mocks.auditStrict.mockResolvedValue({ auditId: 'audit-1' });
    mocks.accountingPolicyFindUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
  });

  it('scopes vendor and bank ownership and records linked retry metadata in one transaction', async () => {
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await service.createCashDebt({ input, user } as never);

    expect(mocks.lock).toHaveBeenCalledWith(expect.anything(), 'tenant-1');
    expect(mocks.vendorFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { vendorId: 'vendor-1', tenantId: 'tenant-1' },
    }));
    expect(mocks.accountFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaId: 'account-1', tenantId: 'tenant-1' },
    }));
    expect(mocks.accountUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true },
    }));
    expect(mocks.reconciliationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        deudaCash: { connect: { id: 'debt-1' } },
        idempotencyKey: 'retry-1',
        idempotencyPayloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
      }),
    }));
    expect(mocks.payableCreate.mock.calls[0][0].data.montoDeuda).toBe(75);
    expect(mocks.debtCreate.mock.calls[0][0].data).toMatchObject({
      ordinaryAnnualRate: expect.objectContaining({ d: expect.any(Array) }),
      moratoryAnnualRate: expect.objectContaining({ d: expect.any(Array) }),
      cashInterestPolicyVersion: 1,
      cashInterestPrincipalRemaining: expect.objectContaining({ d: expect.any(Array) }),
    });
    expect(mocks.auditStrict).toHaveBeenCalledWith(expect.objectContaining({
      entidad: 'DEUDA_CASH',
      entidadId: 'debt-1',
    }), expect.objectContaining({ auditLog: expect.anything() }));
  });

  it('returns a matching replay before validating vendor, bank, payable, or audit writes', async () => {
    const { cashCreatePayloadHash } = await import('@/lib/services/cash-create-idempotency');
    const replay = { id: 'debt-existing' };
    mocks.reconciliationFindUnique.mockResolvedValueOnce({
      idempotencyPayloadHash: cashCreatePayloadHash({
        operation: 'CREATE_DEUDA_CASH',
        proveedorId: input.proveedorId,
        montoCapital: input.montoCapital,
        moneda: input.moneda,
        tasaInteres: input.tasaInteres,
        tasaInteresMoratorio: input.tasaInteresMoratorio,
        tasaCambio: null,
        fechaVencimiento: null,
        observaciones: input.observaciones,
        comprobanteUrl: null,
        comprobanteAsset: null,
        cuentaBancariaId: input.cuentaBancariaId,
      }),
      deudaCashId: 'debt-existing',
    });
    mocks.debtFindFirst.mockResolvedValueOnce(replay);
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashDebt({ input, user } as never)).resolves.toBe(replay);
    expect(mocks.vendorFindFirst).not.toHaveBeenCalled();
    expect(mocks.accountUpdateMany).not.toHaveBeenCalled();
    expect(mocks.payableCreate).not.toHaveBeenCalled();
    expect(mocks.auditStrict).not.toHaveBeenCalled();
  });

  it('rejects changed payload for a reused tenant key without any second write', async () => {
    mocks.reconciliationFindUnique.mockResolvedValueOnce({
      idempotencyPayloadHash: 'different-hash',
      deudaCashId: 'debt-existing',
    });
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashDebt({ input, user } as never)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    expect(mocks.accountUpdateMany).not.toHaveBeenCalled();
    expect(mocks.payableCreate).not.toHaveBeenCalled();
    expect(mocks.debtCreate).not.toHaveBeenCalled();
  });

  it('rejects foreign vendor or bank references before writes', async () => {
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );
    mocks.vendorFindFirst.mockResolvedValueOnce(null);
    await expect(service.createCashDebt({ input, user } as never)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(mocks.accountUpdateMany).not.toHaveBeenCalled();

    mocks.vendorFindFirst.mockResolvedValueOnce({ vendorId: 'vendor-1', nombre: 'Vendor' });
    mocks.accountFindFirst.mockResolvedValueOnce(null);
    await expect(service.createCashDebt({ input, user } as never)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mocks.accountUpdateMany).not.toHaveBeenCalled();
    expect(mocks.payableCreate).not.toHaveBeenCalled();
  });

  it('propagates strict audit failure through the transaction callback', async () => {
    mocks.auditStrict.mockRejectedValueOnce(new Error('audit unavailable'));
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashDebt({ input, user } as never)).rejects.toThrow('audit unavailable');
    expect(mocks.auditStrict).toHaveBeenCalledWith(expect.objectContaining({
      entidad: 'DEUDA_CASH',
      entidadId: 'debt-1',
    }), expect.objectContaining({ auditLog: expect.anything() }));
  });
});
