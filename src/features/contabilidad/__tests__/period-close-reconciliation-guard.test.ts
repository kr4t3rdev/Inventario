import { describe, expect, it } from 'vitest';
import {
  getPeriodCloseReconciliationsAtCutoff,
  isPermittedOpenDebtForClose,
  isReconciledAmountComplete,
} from '@/features/contabilidad/services/period-close-reconciliation-guard';

describe('period close reconciliation guard', () => {
  it('excludes reconciliations after the period cutoff and rejects invalid dates', () => {
    const before = { fechaReconciliacion: new Date('2026-08-31T23:59:59.999Z'), monto: 100 }
    const after = { fechaReconciliacion: new Date('2026-09-01T00:00:00.000Z'), monto: 900 }
    const cutoff = new Date('2026-08-31T23:59:59.999Z')

    expect(getPeriodCloseReconciliationsAtCutoff([before, after], cutoff)).toEqual([before])
    expect(getPeriodCloseReconciliationsAtCutoff([
      { fechaReconciliacion: new Date(Number.NaN), monto: 1 },
    ], cutoff)).toBeNull()
  })

  it('permits a fully unpaid and directly linked debt only when amounts and tenant match', () => {
    expect(isPermittedOpenDebtForClose({
      operationTenantId: 'tenant-a',
      operationAmount: 4300,
      debt: {
        tenantId: 'tenant-a',
        state: 'PENDIENTE',
        amount: 4300,
        paidAmount: 0,
        linkedDirectly: true,
      },
    })).toBe(true);
  });

  it('permits a partially paid debt only when recorded payments are fully reconciled', () => {
    expect(isPermittedOpenDebtForClose({
      operationTenantId: 'tenant-a',
      operationAmount: 4300,
      debt: {
        tenantId: 'tenant-a',
        state: 'PARCIAL',
        amount: 4300,
        paidAmount: 900,
        reconciledAmount: 900,
        linkedDirectly: true,
      },
    })).toBe(true);
    expect(isPermittedOpenDebtForClose({
      operationTenantId: 'tenant-a',
      operationAmount: 4300,
      debt: {
        tenantId: 'tenant-a',
        state: 'PARCIAL',
        amount: 4300,
        paidAmount: 900,
        reconciledAmount: 700,
        linkedDirectly: true,
      },
    })).toBe(false);
  });

  it.each([
    ['cross-tenant debt', { tenantId: 'tenant-b', state: 'PENDIENTE', amount: 4300, paidAmount: 0, linkedDirectly: true }],
    ['unlinked debt', { tenantId: 'tenant-a', state: 'PENDIENTE', amount: 4300, paidAmount: 0, linkedDirectly: false }],
    ['partially paid debt', { tenantId: 'tenant-a', state: 'PARCIAL', amount: 4300, paidAmount: 100, linkedDirectly: true }],
    ['amount mismatch', { tenantId: 'tenant-a', state: 'PENDIENTE', amount: 4299, paidAmount: 0, linkedDirectly: true }],
    ['unknown state', { tenantId: 'tenant-a', state: 'UNKNOWN', amount: 4300, paidAmount: 0, linkedDirectly: true }],
  ] as const)('does not permit %s', (_name, debt) => {
    expect(isPermittedOpenDebtForClose({
      operationTenantId: 'tenant-a',
      operationAmount: 4300,
      debt,
    })).toBe(false);
  });

  it('requires every amount to reconcile; one partial reconciliation is not enough', () => {
    expect(isReconciledAmountComplete(4300, [4300])).toBe(true);
    expect(isReconciledAmountComplete(4300, [1200])).toBe(false);
    expect(isReconciledAmountComplete(4300, [1200, 3100])).toBe(true);
    expect(isReconciledAmountComplete(4300, [4400])).toBe(false);
    expect(isReconciledAmountComplete(4300, [1200, Number.NaN])).toBe(false);
  });
});
