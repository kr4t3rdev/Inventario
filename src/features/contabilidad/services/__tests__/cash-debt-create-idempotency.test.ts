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
  debtFindRoot: vi.fn(),
  debtUpdateRoot: vi.fn(),
  auditStrict: vi.fn(),
  accountingPolicyFindUnique: vi.fn(),
  lock: vi.fn(),
  transaction: vi.fn(),
  postEvent: vi.fn(),
  requireFeature: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    deudaCash: { findFirst: mocks.debtFindRoot, update: mocks.debtUpdateRoot },
  },
}));
vi.mock('@/generated/prisma', () => ({
  Prisma: {
    Decimal: class Decimal {
      readonly d: number[];
      private readonly value: number;

      constructor(value: number | string | Decimal) {
        this.value = Number(value);
        this.d = [this.value];
      }

      isFinite(): boolean { return Number.isFinite(this.value); }
      isNegative(): boolean { return this.value < 0; }
      decimalPlaces(): number { return (String(this.value).split('.')[1] ?? '').length; }
      lte(other: number | string | Decimal): boolean { return this.value <= Number(other); }
      plus(other: number | string | Decimal): Decimal { return new Decimal(this.value + Number(other)); }
      minus(other: number | string | Decimal): Decimal { return new Decimal(this.value - Number(other)); }
      mul(other: number | string | Decimal): Decimal { return new Decimal(this.value * Number(other)); }
      toDecimalPlaces(places: number): Decimal {
        return new Decimal(Number(this.value.toFixed(places)));
      }
      toNumber(): number { return this.value; }
      toFixed(places?: number): string { return this.value.toFixed(places); }
      toString(): string { return String(this.value); }
    },
  },
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: () => 'tenant-1',
  requireFeature: mocks.requireFeature,
}));
vi.mock('@/lib/server-actions', () => ({
  ActionError: class ActionError extends Error {
    constructor(message: string, readonly code?: string) { super(message); }
  },
}));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: mocks.auditStrict },
}));
vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  buildPersistedAccountingAmount: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  getRequiredTenantAccountingPolicy: mocks.accountingPolicyFindUnique,
}));
vi.mock('../accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: mocks.lock }));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({ postEvento: mocks.postEvent }));

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
    mocks.accountFindFirst.mockResolvedValue({ cuentaId: 'account-1', isActive: true, moneda: 'CUP' });
    mocks.accountUpdateMany.mockResolvedValue({ count: 1 });
    mocks.vendorFindFirst.mockResolvedValue({ vendorId: 'vendor-1', nombre: 'Vendor' });
    mocks.paymentTypeFindFirst.mockResolvedValue({ tipoId: 'payment-type-1' });
    mocks.payableCreate.mockResolvedValue({ cuentaPorPagarId: 'payable-1' });
    mocks.reconciliationCreate.mockResolvedValue({ reconciliacionId: 'reconciliation-1' });
    mocks.debtCreate.mockResolvedValue({ id: 'debt-1' });
    mocks.debtFindFirst.mockResolvedValue({ id: 'debt-1' });
    mocks.debtFindRoot.mockResolvedValue({ id: 'debt-1', tenantId: 'tenant-1' });
    mocks.debtUpdateRoot.mockResolvedValue({ id: 'debt-1', tenantId: 'tenant-1' });
    mocks.auditStrict.mockResolvedValue({ auditId: 'audit-1' });
    mocks.accountingPolicyFindUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
    mocks.postEvent.mockResolvedValue({ asientoId: 'asiento-1' });
    mocks.requireFeature.mockImplementation(() => undefined);
  });

  it('scopes cash debt edits to the authenticated tenant', async () => {
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await service.updateCashDebt({
      input: { id: 'debt-1', observaciones: 'Updated' },
      user,
    } as never);

    expect(mocks.debtFindRoot).toHaveBeenCalledWith({
      where: { id: 'debt-1', tenantId: 'tenant-1', deletedAt: null },
    });
    expect(mocks.debtUpdateRoot).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'debt-1', tenantId: 'tenant-1' } }),
    );
  });

  it('fails closed on direct Cash debt creation after downgrade', async () => {
    mocks.requireFeature.mockImplementation(() => {
      const error = new Error('feature unavailable') as Error & { code: string };
      error.code = 'FEATURE_NOT_AVAILABLE';
      throw error;
    });
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashDebt({ input, user } as never)).rejects.toMatchObject({
      code: 'FEATURE_NOT_AVAILABLE',
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.vendorFindFirst).not.toHaveBeenCalled();
    expect(mocks.debtCreate).not.toHaveBeenCalled();
  });

  it('replays an existing Cash debt directly through the writer after downgrade', async () => {
    const { cashCreatePayloadHash } = await import('@/lib/services/cash-create-idempotency');
    mocks.requireFeature.mockImplementation(() => {
      const error = new Error('feature unavailable') as Error & { code: string };
      error.code = 'FEATURE_NOT_AVAILABLE';
      throw error;
    });
    mocks.reconciliationFindUnique.mockResolvedValue({
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
    mocks.debtFindFirst.mockResolvedValue({ id: 'debt-existing' });
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await expect(service.createCashDebt({ input, user } as never)).resolves.toMatchObject({
      id: 'debt-existing',
    });
    expect(mocks.requireFeature).not.toHaveBeenCalled();
    expect(mocks.vendorFindFirst).not.toHaveBeenCalled();
    expect(mocks.debtCreate).not.toHaveBeenCalled();
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
      where: { cuentaId: 'account-1', tenantId: 'tenant-1', isActive: true, moneda: 'CUP' },
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
    expect(mocks.postEvent).toHaveBeenCalledWith(expect.anything(),
      { tenantId: 'tenant-1', userId: 'user-1' }, expect.objectContaining({
        tipo: 'DEUDA_RECIBIDA',
        origen: { tipo: 'deuda_cash', id: 'debt-1' },
        montoFuncional: expect.anything(),
        monedaFuncional: 'CUP',
      }));
    expect(mocks.reconciliationCreate.mock.calls[0][0].data).toMatchObject({
      montoConvertido: expect.anything(),
      functionalCurrency: 'CUP',
      fxEvidenceFingerprint: expect.any(String),
      montoCuenta: expect.anything(),
      monedaCuenta: 'CUP',
    });
  });

  it('creates debts without a key using the same principal and ordinary/moratory rates', async () => {
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );
    const sameFinancialInput = { ...input, tasaInteresMoratorio: 4 };

    await service.createCashDebt({
      input: sameFinancialInput,
      user,
    } as never);
    const keyedPayable = mocks.payableCreate.mock.calls[0][0].data;
    const keyedDebt = mocks.debtCreate.mock.calls[0][0].data;

    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (client: unknown) => unknown) =>
      callback(tx()),
    );
    mocks.accountFindFirst.mockResolvedValue({ cuentaId: 'account-1', isActive: true, moneda: 'CUP' });
    mocks.accountUpdateMany.mockResolvedValue({ count: 1 });
    mocks.vendorFindFirst.mockResolvedValue({ vendorId: 'vendor-1', nombre: 'Vendor' });
    mocks.paymentTypeFindFirst.mockResolvedValue({ tipoId: 'payment-type-1' });
    mocks.payableCreate.mockResolvedValue({ cuentaPorPagarId: 'payable-1' });
    mocks.reconciliationCreate.mockResolvedValue({ reconciliacionId: 'reconciliation-1' });
    mocks.debtCreate.mockResolvedValue({ id: 'debt-1' });
    mocks.debtFindFirst.mockResolvedValue({ id: 'debt-1' });
    mocks.auditStrict.mockResolvedValue({ auditId: 'audit-1' });
    mocks.accountingPolicyFindUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
    mocks.postEvent.mockResolvedValue({ asientoId: 'asiento-1' });

    await service.createCashDebt({
      input: { ...sameFinancialInput, idempotencyKey: undefined },
      user,
    } as never);

    const unkeyedPayable = mocks.payableCreate.mock.calls[0][0].data;
    const unkeyedDebt = mocks.debtCreate.mock.calls[0][0].data;
    expect(unkeyedPayable.montoDeuda).toBe(keyedPayable.montoDeuda);
    expect(unkeyedPayable.saldoPendiente).toBe(keyedPayable.saldoPendiente);
    expect(unkeyedDebt.montoCapital).toBe(keyedDebt.montoCapital);
    expect(unkeyedDebt.ordinaryAnnualRate).toEqual(keyedDebt.ordinaryAnnualRate);
    expect(unkeyedDebt.moratoryAnnualRate).toEqual(keyedDebt.moratoryAnnualRate);
    expect(mocks.payableCreate.mock.calls[0][0].data).toMatchObject({
      montoDeuda: 75,
      saldoPendiente: 75,
    });
    expect(mocks.debtCreate.mock.calls[0][0].data).toMatchObject({
      montoCapital: 75,
      ordinaryAnnualRate: expect.objectContaining({ d: [10] }),
      moratoryAnnualRate: expect.objectContaining({ d: [4] }),
    });
    expect(mocks.reconciliationCreate.mock.calls[0][0].data)
      .not.toHaveProperty('idempotencyKey');
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

  it('persists functional FX evidence and posts a foreign-currency debt in one transaction', async () => {
    const { AccountingCashOperationsMutationService: service } = await import(
      '../accounting-cash-operations-mutation-service'
    );

    await service.createCashDebt({
      input: { ...input, moneda: 'USD', tasaCambio: 250 },
      user,
    } as never);

    expect(mocks.accountUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { saldo: { increment: 18_750 } },
    }));
    const reconciliation = mocks.reconciliationCreate.mock.calls[0][0].data;
    expect(reconciliation).toMatchObject({
      montoConvertido: expect.objectContaining({ value: 18_750 }),
      functionalCurrency: 'CUP',
      montoCuenta: expect.objectContaining({ value: 18_750 }),
      monedaCuenta: 'CUP',
      fxEvidenceFingerprint: expect.any(String),
      tasaCambio: expect.objectContaining({ value: 250 }),
    });
    expect(mocks.postEvent).toHaveBeenCalledWith(expect.anything(),
      { tenantId: 'tenant-1', userId: 'user-1' }, expect.objectContaining({
        tipo: 'DEUDA_RECIBIDA',
        monto: 75,
        moneda: 'USD',
        montoFuncional: expect.objectContaining({ value: 18_750 }),
        monedaFuncional: 'CUP',
      }));
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
