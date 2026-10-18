import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cashCreatePayloadHash } from '@/lib/services/cash-create-idempotency';

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    reconciliacionVenta: { create: vi.fn(), findUnique: vi.fn() },
    deudaCash: { findFirst: vi.fn() },
    cuentaBancaria: { update: vi.fn() },
    cuentaPorPagar: { update: vi.fn() },
    cuentaPorCobrar: { update: vi.fn() },
  };
  return {
    tx,
    prismaMock: {
      deudaCash: { findFirst: vi.fn() },
      prestamoCash: { findFirst: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn().mockResolvedValue(undefined),
}));

import { AccountingCashOperationsMutationService } from '../accounting-cash-operations-mutation-service';

describe('cash payment idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.deudaCash.findFirst.mockResolvedValue({
      id: 'debt-1',
      tenantId: 'tenant-1',
      estado: 'PAGADO',
      moneda: 'USD',
      cuentaPorPagarId: 'payable-1',
      cuentaPorPagar: {
        montoDeuda: 0.0123,
        montoPagado: 0.0123,
        montoPagadoFuncional: 3.69,
      },
    });
    tx.deudaCash.findFirst.mockResolvedValue({
      id: 'debt-1',
      tenantId: 'tenant-1',
      estado: 'PAGADO',
      moneda: 'USD',
      cuentaPorPagarId: 'payable-1',
      cuentaPorPagar: {
        montoDeuda: 0.0123,
        montoPagado: 0.0123,
        montoPagadoFuncional: 3.69,
      },
    });
    tx.reconciliacionVenta.findUnique.mockResolvedValue({
      reconciliacionId: 'payment-original',
      tenantId: 'tenant-1',
      idempotencyPayloadHash: cashCreatePayloadHash({
        operation: 'CASH_DEBT_PAYMENT',
        id: 'debt-1',
        monto: '0.0123',
        cuentaId: 'bank-1',
        tipoPagoId: 'transfer-1',
        moneda: 'USD',
        tasaCambio: '300',
        observaciones: null,
      }),
      deudaCashId: 'debt-1',
      tipoReconciliacion: 'DEUDA_CASH',
      monto: 0.0123,
      moneda: 'USD',
      cuentaBancariaId: 'bank-1',
      tipoPagoId: 'transfer-1',
      tasaCambio: 300,
      montoConvertido: 3.69,
    });
  });

  it('replays the original payment before rejecting a now-closed obligation', async () => {
    const result = await AccountingCashOperationsMutationService.registerCashDebtPayment({
      input: {
        id: 'debt-1',
        monto: 0.0123,
        cuentaId: 'bank-1',
        tipoPagoId: 'transfer-1',
        moneda: 'USD',
        tasaCambio: 300,
        idempotencyKey: 'pay-debt-1',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(result).toMatchObject({ reconciliacionId: 'payment-original' });
    expect(tx.reconciliacionVenta.findUnique).toHaveBeenCalledWith({
      where: { tenantId_idempotencyKey: { tenantId: 'tenant-1', idempotencyKey: 'cash-payment:pay-debt-1' } },
    });
    expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
    expect(tx.cuentaBancaria.update).not.toHaveBeenCalled();
    expect(tx.cuentaPorPagar.update).not.toHaveBeenCalled();
  });

  it('rejects reuse of a payment key with a changed amount', async () => {
    tx.reconciliacionVenta.findUnique.mockResolvedValueOnce({
      reconciliacionId: 'payment-original',
      tenantId: 'tenant-1',
      idempotencyPayloadHash: 'different-payload',
      deudaCashId: 'debt-1',
    });

    await expect(AccountingCashOperationsMutationService.registerCashDebtPayment({
      input: {
        id: 'debt-1',
        monto: 0.0122,
        cuentaId: 'bank-1',
        tipoPagoId: 'transfer-1',
        moneda: 'USD',
        tasaCambio: 300,
        idempotencyKey: 'pay-debt-1',
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
    expect(tx.cuentaBancaria.update).not.toHaveBeenCalled();
  });
});
