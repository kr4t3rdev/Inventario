import { describe, expect, it } from 'vitest';

import {
  classifyLegacyReconciliation,
  classifyReconciliation,
} from '@/features/contabilidad/domain/reconciliation-policy';

describe('classifyReconciliation', () => {
  it.each([
    ['SALE', 'operating', 'inflow', 1, true],
    ['SERVICE_SALE', 'operating', 'inflow', 1, true],
    ['SALARY_EXPENSE', 'operating', 'outflow', -1, true],
    ['GENERAL_EXPENSE', 'operating', 'outflow', -1, true],
    ['INVENTORY_PURCHASE', 'operating', 'outflow', -1, false],
  ] as const)(
    'clasifica %s como %s %s',
    (kind, category, direction, sign, affectsOperatingResult) => {
      expect(classifyReconciliation({ kind, status: 'POSTED' })).toMatchObject({
        status: 'classified',
        category,
        direction,
        sign,
        effectiveSign: sign,
        affectsOperatingResult,
        affectsCashFlow: true,
        coverage: 'complete',
      });
    },
  );

  it.each([
    ['CASH_LOAN_DISBURSEMENT', 'outflow', -1],
    ['CASH_LOAN_PAYMENT', 'inflow', 1],
    ['CASH_DEBT_DISBURSEMENT', 'inflow', 1],
    ['CASH_DEBT_PAYMENT', 'outflow', -1],
    ['EXTERNAL_DEBT_RECEIPT', 'inflow', 1],
  ] as const)('clasifica %s como flujo financiero', (kind, direction, sign) => {
    expect(classifyReconciliation({ kind, status: 'POSTED' })).toMatchObject({
      status: 'classified',
      category: 'financial',
      direction,
      sign,
      affectsOperatingResult: false,
      affectsCashFlow: true,
    });
  });

  it('clasifica capital como flujo patrimonial no operativo', () => {
    expect(classifyReconciliation({ kind: 'CAPITAL_CONTRIBUTION', status: 'POSTED' }))
      .toMatchObject({
        status: 'classified',
        category: 'equity',
        direction: 'inflow',
        sign: 1,
        affectsOperatingResult: false,
      });
  });

  it.each([
    ['BANK_TRANSFER_IN', 'transfer', 'inflow', 1],
    ['BANK_TRANSFER_OUT', 'transfer', 'outflow', -1],
    ['BANK_ADJUSTMENT_IN', 'adjustment', 'inflow', 1],
    ['BANK_ADJUSTMENT_OUT', 'adjustment', 'outflow', -1],
  ] as const)('mantiene %s fuera del resultado operativo', (kind, category, direction, sign) => {
    expect(classifyReconciliation({ kind, status: 'POSTED' })).toMatchObject({
      status: 'classified',
      category,
      direction,
      sign,
      affectsOperatingResult: false,
    });
  });

  it.each([
    ['SALE_REVERSAL', 'outflow', -1],
    ['EXPENSE_REVERSAL', 'inflow', 1],
    ['CAPITAL_REVERSAL', 'outflow', -1],
  ] as const)('aplica el signo contable de %s', (kind, direction, sign) => {
    expect(classifyReconciliation({ kind, status: 'POSTED' })).toMatchObject({
      status: 'classified',
      direction,
      sign,
      effectiveSign: sign,
    });
  });

  it('no contabiliza reconciliaciones pendientes', () => {
    expect(classifyReconciliation({ kind: 'GENERAL_EXPENSE', status: 'PENDING' }))
      .toMatchObject({
        status: 'classified',
        recognition: 'pending',
        effectiveSign: 0,
        coverage: 'indeterminate',
        affectsCashFlow: false,
      });
  });

  it('contabiliza el importe parcial con cobertura parcial', () => {
    expect(classifyReconciliation({ kind: 'GENERAL_EXPENSE', status: 'PARTIAL' }))
      .toMatchObject({
        status: 'classified',
        recognition: 'posted',
        effectiveSign: -1,
        coverage: 'partial',
        affectsCashFlow: true,
      });
  });

  it.each(['VOIDED', 'CANCELLED'] as const)('excluye el estado %s', (status) => {
    expect(classifyReconciliation({ kind: 'SALE', status })).toMatchObject({
      status: 'classified',
      recognition: 'excluded',
      effectiveSign: 0,
      affectsCashFlow: false,
      affectsOperatingResult: false,
    });
  });
});

describe('classifyLegacyReconciliation', () => {
  it.each([
    [{ source: 'sale', kind: null }, 'SALE'],
    [{ source: 'service', kind: null }, 'SERVICE_SALE'],
    [{ source: 'expense', kind: 'salario' }, 'SALARY_EXPENSE'],
    [{ source: 'expense', kind: 'venta_servicio' }, 'SOLD_SERVICE_COST'],
    [{ source: 'sale', kind: 'PRESTAMO_CASH_DESEMBOLSO' }, 'CASH_LOAN_DISBURSEMENT'],
    [{ source: 'sale', kind: 'PRESTAMO_CASH' }, 'CASH_LOAN_PAYMENT'],
    [{ source: 'sale', kind: 'DEUDA_CASH_DESEMBOLSO' }, 'CASH_DEBT_DISBURSEMENT'],
    [{ source: 'sale', kind: 'DEUDA_CASH' }, 'CASH_DEBT_PAYMENT'],
  ] as const)('normaliza el tipo legacy a %s', (input, expectedKind) => {
    expect(classifyLegacyReconciliation(input)).toMatchObject({
      status: 'classified',
      kind: expectedKind,
    });
  });

  it.each([
    ['PENDIENTE', 'pending', 'indeterminate'],
    ['PARCIAL', 'posted', 'partial'],
    ['PAGADA', 'posted', 'complete'],
    ['ANULADA', 'excluded', 'complete'],
    ['CANCELADA', 'excluded', 'complete'],
  ] as const)('normaliza el estado legacy %s', (legacyStatus, recognition, coverage) => {
    expect(classifyLegacyReconciliation({
      source: 'expense',
      kind: 'gastoDE',
      status: legacyStatus,
    })).toMatchObject({ status: 'classified', recognition, coverage });
  });

  it('devuelve incidencia explícita para un tipo desconocido', () => {
    expect(classifyLegacyReconciliation({
      source: 'sale',
      kind: 'NUEVO_TIPO_NO_CLASIFICADO',
    })).toEqual({
      status: 'unclassified',
      issue: 'UNKNOWN_KIND',
      rawKind: 'NUEVO_TIPO_NO_CLASIFICADO',
      rawStatus: null,
    });
  });

  it('devuelve incidencia explícita para un estado desconocido', () => {
    expect(classifyLegacyReconciliation({
      source: 'expense',
      kind: 'gastoDE',
      status: 'EN_REVISION_MANUAL',
    })).toEqual({
      status: 'unclassified',
      issue: 'UNKNOWN_STATUS',
      rawKind: 'gastoDE',
      rawStatus: 'EN_REVISION_MANUAL',
    });
  });
});
