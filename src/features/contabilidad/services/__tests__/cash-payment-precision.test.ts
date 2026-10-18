import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx, prismaMock, validarEscrituraPeriodo, postEventoMock } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    reconciliacionVenta: { create: vi.fn() },
    deudaCash: { findFirst: vi.fn(), update: vi.fn() },
    prestamoCash: { findFirst: vi.fn(), update: vi.fn() },
    cuentaBancaria: { findFirst: vi.fn(), update: vi.fn() },
    cuentaPorPagar: { update: vi.fn() },
    cuentaPorCobrar: { update: vi.fn() },
    cashPaymentInterestAllocation: { create: vi.fn() },
  };
  return {
    tx,
    validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'disabled' }),
    postEventoMock: vi.fn().mockResolvedValue({ estado: 'OMITIDO', motivo: 'test' }),
    prismaMock: {
      deudaCash: { findFirst: vi.fn() },
      prestamoCash: { findFirst: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(null),
    logStrict: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('../accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/services/validate-period-write', () => ({ validarEscrituraPeriodo }));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: postEventoMock,
}));

import { AccountingCashOperationsMutationService } from '../accounting-cash-operations-mutation-service';

function versionedInterestSnapshot() {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return {
    ordinaryAnnualRate: 0,
    moratoryAnnualRate: 0,
    cashInterestPolicyVersion: 1,
    cashInterestGrantDate: today,
    cashInterestMaturityDate: null,
    cashInterestAccruedThroughDate: today,
    cashInterestPrincipalRemaining: 1,
    cashInterestOrdinaryCarry: 0,
    cashInterestMoratoryCarry: 0,
  };
}

describe('cash payment precision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validarEscrituraPeriodo.mockResolvedValue({ permitido: true, modo: 'disabled' });
    tx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'bank-1',
      tenantId: 'tenant-1',
      isActive: true,
      moneda: 'CUP',
    });
    prismaMock.deudaCash.findFirst.mockResolvedValue({
      ...versionedInterestSnapshot(),
      id: 'debt-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorPagarId: 'payable-1',
      cuentaPorPagar: {
        montoDeuda: 1,
        montoPagado: 0,
        montoDeudaFuncional: 1,
        montoPagadoFuncional: 0,
        monedaOriginal: 'CUP',
        monedaFuncional: 'CUP',
      },
    });
    prismaMock.prestamoCash.findFirst.mockResolvedValue({
      ...versionedInterestSnapshot(),
      id: 'loan-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'receivable-1',
      cuentaPorCobrar: {
        montoDeuda: 1,
        montoPagado: 0,
        montoDeudaFuncional: 1,
        montoPagadoFuncional: 0,
        monedaOriginal: 'CUP',
        monedaFuncional: 'CUP',
      },
    });
    tx.deudaCash.findFirst.mockResolvedValue({
      ...versionedInterestSnapshot(),
      id: 'debt-1',
      tenantId: 'tenant-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorPagarId: 'payable-1',
      cuentaPorPagar: {
        montoDeuda: 1,
        montoPagado: 0,
        montoDeudaFuncional: 1,
        montoPagadoFuncional: 0,
        monedaOriginal: 'CUP',
        monedaFuncional: 'CUP',
      },
    });
    tx.prestamoCash.findFirst.mockResolvedValue({
      ...versionedInterestSnapshot(),
      id: 'loan-1',
      tenantId: 'tenant-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'receivable-1',
      cuentaPorCobrar: {
        montoDeuda: 1,
        montoPagado: 0,
        montoDeudaFuncional: 1,
        montoPagadoFuncional: 0,
        monedaOriginal: 'CUP',
        monedaFuncional: 'CUP',
      },
    });
    tx.reconciliacionVenta.create.mockResolvedValue({ reconciliacionId: 'payment-1' });
  });

  it.each(['debt', 'loan'] as const)(
    'checks the current operation date in the transaction for %s payments, not a caller date',
    async (kind) => {
      validarEscrituraPeriodo.mockResolvedValue({
        permitido: false,
        modo: 'enforce',
        error: { code: 'PERIODO_CERRADO', message: 'closed' },
      });
      const input = {
        id: kind === 'debt' ? 'debt-1' : 'loan-1',
        monto: 0.0123,
        cuentaId: 'bank-1',
        tipoPagoId: 'payment-type-1',
        fechaOperacion: '2020-01-01T00:00:00.000Z',
      };
      const call = kind === 'debt'
        ? AccountingCashOperationsMutationService.registerCashDebtPayment({
            input: input as never,
            user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
          })
        : AccountingCashOperationsMutationService.registerCashLoanPayment({
            input: input as never,
            user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
          });

      await expect(call).rejects.toMatchObject({ code: 'PERIODO_CERRADO' });
      const [params, client] = validarEscrituraPeriodo.mock.calls[0];
      expect(params.tenantId).toBe('tenant-1');
      expect(params.fecha).toBeInstanceOf(Date);
      expect(params.fecha.toISOString()).not.toBe(input.fechaOperacion);
      expect(client).toBe(tx);
      expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
      expect(tx.cuentaBancaria.update).not.toHaveBeenCalled();
    },
  );

  it('persists a 0.0123 partial debt payment without rounding it to cents', async () => {
    await AccountingCashOperationsMutationService.registerCashDebtPayment({
      input: {
        id: 'debt-1',
        monto: 0.0123,
        cuentaId: 'bank-1',
        tipoPagoId: 'payment-type-1',
      },
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
      } as never,
    });

    expect(tx.reconciliacionVenta.create.mock.calls[0][0].data.monto.toString()).toBe('0.0123');
    expect(tx.cuentaBancaria.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { saldo: { decrement: 0.0123 } },
    }));
    expect(tx.cuentaPorPagar.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ montoPagado: 0.0123, saldoPendiente: 0.9877 }),
    }));
  });

  it.each(['debt', 'loan'] as const)('rejects %s payments with more than four decimals before writes', async (kind) => {
    const payment = {
      monto: 0.01234,
      cuentaId: 'bank-1',
      tipoPagoId: 'payment-type-1',
    };
    const call = kind === 'debt'
      ? AccountingCashOperationsMutationService.registerCashDebtPayment({
          input: { id: 'debt-1', ...payment },
          user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
        })
      : AccountingCashOperationsMutationService.registerCashLoanPayment({
          input: { id: 'loan-1', ...payment },
          user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
        });

    await expect(call).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
    expect(tx.cuentaBancaria.update).not.toHaveBeenCalled();
    expect(tx.cuentaPorPagar.update).not.toHaveBeenCalled();
  });

  it.each(['debt', 'loan'] as const)(
    'fails closed for legacy %s rows without a versioned interest snapshot',
    async (kind) => {
      if (kind === 'debt') {
        tx.deudaCash.findFirst.mockResolvedValue({
          ...versionedInterestSnapshot(),
          cashInterestPolicyVersion: null,
          id: 'debt-1',
          tenantId: 'tenant-1',
          estado: 'ACTIVO',
          moneda: 'CUP',
          cuentaPorPagarId: 'payable-1',
          cuentaPorPagar: {
            montoDeuda: 1,
            montoPagado: 0,
            montoDeudaFuncional: 1,
            montoPagadoFuncional: 0,
            monedaOriginal: 'CUP',
            monedaFuncional: 'CUP',
          },
        });
      } else {
        tx.prestamoCash.findFirst.mockResolvedValue({
          ...versionedInterestSnapshot(),
          cashInterestPolicyVersion: null,
          id: 'loan-1',
          tenantId: 'tenant-1',
          estado: 'ACTIVO',
          moneda: 'CUP',
          cuentaPorCobrarId: 'receivable-1',
          cuentaPorCobrar: {
            montoDeuda: 1,
            montoPagado: 0,
            montoDeudaFuncional: 1,
            montoPagadoFuncional: 0,
            monedaOriginal: 'CUP',
            monedaFuncional: 'CUP',
          },
        });
      }
      const payment = {
        id: kind === 'debt' ? 'debt-1' : 'loan-1',
        monto: 0.0123,
        cuentaId: 'bank-1',
        tipoPagoId: 'payment-type-1',
      };
      const call = kind === 'debt'
        ? AccountingCashOperationsMutationService.registerCashDebtPayment({
            input: payment,
            user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
          })
        : AccountingCashOperationsMutationService.registerCashLoanPayment({
            input: payment,
            user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
          });

      await expect(call).rejects.toMatchObject({ code: 'INTEREST_SNAPSHOT_REQUIRED' });
      expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
      expect(tx.cuentaBancaria.update).not.toHaveBeenCalled();
    },
  );

  it('persists the same four-decimal amount for a loan payment and its bank movement', async () => {
    await AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: {
        id: 'loan-1',
        monto: 0.0123,
        cuentaId: 'bank-1',
        tipoPagoId: 'payment-type-1',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(tx.reconciliacionVenta.create.mock.calls[0][0].data.monto.toString()).toBe('0.0123');
    expect(tx.cuentaBancaria.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { saldo: { increment: 0.0123 } },
    }));
    expect(tx.cuentaPorPagar.update).not.toHaveBeenCalled();
    expect(tx.cuentaPorCobrar.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ montoPagado: 0.0123, estado: 'PARCIAL' }),
    }));
  });

  it.each(['debt', 'loan'] as const)(
    'posts the exact annual-interest split and allocation snapshot for a %s payment',
    async (kind) => {
      const grantDate = new Date();
      grantDate.setUTCDate(grantDate.getUTCDate() - 365);
      grantDate.setUTCHours(0, 0, 0, 0);
      const interestSnapshot = {
        ...versionedInterestSnapshot(),
        ordinaryAnnualRate: 12,
        cashInterestGrantDate: grantDate,
        cashInterestAccruedThroughDate: grantDate,
        cashInterestPrincipalRemaining: 300,
      };
      const obligation = {
        montoDeuda: 300,
        montoPagado: 0,
        montoDeudaFuncional: 300,
        montoPagadoFuncional: 0,
        monedaOriginal: 'CUP',
        monedaFuncional: 'CUP',
      };
      if (kind === 'debt') {
        tx.deudaCash.findFirst.mockResolvedValue({
          ...interestSnapshot,
          id: 'debt-1',
          tenantId: 'tenant-1',
          estado: 'ACTIVO',
          moneda: 'CUP',
          cuentaPorPagarId: 'payable-1',
          cuentaPorPagar: obligation,
        });
      } else {
        tx.prestamoCash.findFirst.mockResolvedValue({
          ...interestSnapshot,
          id: 'loan-1',
          tenantId: 'tenant-1',
          estado: 'ACTIVO',
          moneda: 'CUP',
          cuentaPorCobrarId: 'receivable-1',
          cuentaPorCobrar: obligation,
        });
      }

      const input = {
        id: kind === 'debt' ? 'debt-1' : 'loan-1',
        monto: 36.0123,
        cuentaId: 'bank-1',
        tipoPagoId: 'payment-type-1',
      };
      const result = kind === 'debt'
        ? await AccountingCashOperationsMutationService.registerCashDebtPayment({
            input,
            user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
          })
        : await AccountingCashOperationsMutationService.registerCashLoanPayment({
            input,
            user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
          });

      expect(result).toBeDefined();
      const event = postEventoMock.mock.calls.at(-1)?.[2];
      expect(event.auxiliares.intereses.toString()).toBe('36');
      expect(event.auxiliares.interesesMoratorios.toString()).toBe('0');
      expect(tx.cashPaymentInterestAllocation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          paymentAmount: expect.objectContaining({ d: expect.any(Array) }),
          ordinaryAllocated: expect.objectContaining({ d: expect.any(Array) }),
          principalAllocated: expect.objectContaining({ d: expect.any(Array) }),
          ordinaryElapsedDays: 365,
          moratoryElapsedDays: 0,
        }),
      }));
      const snapshotUpdate = kind === 'debt'
        ? tx.deudaCash.update.mock.calls.at(-1)?.[0].data
        : tx.prestamoCash.update.mock.calls.at(-1)?.[0].data;
      expect(snapshotUpdate.cashInterestPrincipalRemaining.toFixed(4)).toBe('299.9877');
      expect(snapshotUpdate.cashInterestAccruedThroughDate).toBeInstanceOf(Date);
    },
  );

  it.each(['debt', 'loan'] as const)(
    'accumulates exact functional currency for a %s payment',
    async (kind) => {
      const obligation = {
        montoDeuda: 1,
        montoPagado: 0,
        montoDeudaFuncional: 10,
        montoPagadoFuncional: 0,
        monedaOriginal: 'USD',
        monedaFuncional: 'CUP',
      };
      if (kind === 'debt') {
        tx.deudaCash.findFirst.mockResolvedValue({
          ...versionedInterestSnapshot(),
          id: 'debt-1',
          tenantId: 'tenant-1',
          estado: 'ACTIVO',
          moneda: 'USD',
          cuentaPorPagarId: 'payable-1',
          cuentaPorPagar: obligation,
        });
      } else {
        tx.prestamoCash.findFirst.mockResolvedValue({
          ...versionedInterestSnapshot(),
          id: 'loan-1',
          tenantId: 'tenant-1',
          estado: 'ACTIVO',
          moneda: 'USD',
          cuentaPorCobrarId: 'receivable-1',
          cuentaPorCobrar: obligation,
        });
      }
      const input = {
        monto: 0.0123,
        cuentaId: 'bank-1',
        tipoPagoId: 'payment-type-1',
        moneda: 'USD',
        tasaCambio: 300,
      };
      if (kind === 'debt') {
        await AccountingCashOperationsMutationService.registerCashDebtPayment({
          input: { id: 'debt-1', ...input },
          user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
        });
        const persisted = tx.reconciliacionVenta.create.mock.calls.at(-1)?.[0].data;
        expect(persisted.monto.toString()).toBe('0.0123');
        expect(persisted.montoConvertido.toString()).toBe('3.69');
        expect(persisted.fxEvidenceJson.functionalAmount).toBe('3.6900');
        expect(persisted.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(persisted.fxEvidenceJson).toMatchObject({
          originalAmount: '0.0123',
          originalCurrency: 'USD',
          functionalAmount: '3.6900',
          functionalCurrency: 'CUP',
          exchangeRate: '300.0000000000',
          fxEvidenceFingerprint: persisted.fxEvidenceFingerprint,
          fxProvenanceKind: 'MANUAL_GOVERNED',
          fxProvenanceSource: 'cash-debt-payment',
          fxEvidenceVersion: 1,
        });
        expect(tx.cuentaPorPagar.update.mock.calls.at(-1)?.[0].data.montoPagadoFuncional.toString())
          .toBe('3.69');
        expect(tx.cuentaBancaria.update.mock.calls.at(-1)?.[0].data.saldo.decrement)
          .toBe(3.69);
      } else {
        await AccountingCashOperationsMutationService.registerCashLoanPayment({
          input: { id: 'loan-1', ...input },
          user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
        });
        const persisted = tx.reconciliacionVenta.create.mock.calls.at(-1)?.[0].data;
        expect(persisted.monto.toString()).toBe('0.0123');
        expect(persisted.montoConvertido.toString()).toBe('3.69');
        expect(persisted.fxEvidenceJson.functionalAmount).toBe('3.6900');
        expect(persisted.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(persisted.fxEvidenceJson).toMatchObject({
          originalAmount: '0.0123',
          originalCurrency: 'USD',
          functionalAmount: '3.6900',
          functionalCurrency: 'CUP',
          exchangeRate: '300.0000000000',
          fxEvidenceFingerprint: persisted.fxEvidenceFingerprint,
          fxProvenanceKind: 'MANUAL_GOVERNED',
          fxProvenanceSource: 'cash-loan-payment',
          fxEvidenceVersion: 1,
        });
        expect(tx.cuentaPorCobrar.update.mock.calls.at(-1)?.[0].data.montoPagadoFuncional.toString())
          .toBe('3.69');
        expect(tx.cuentaBancaria.update.mock.calls.at(-1)?.[0].data.saldo.increment)
          .toBe(3.69);
      }
    },
  );
});
