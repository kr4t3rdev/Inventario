import { describe, expect, it } from 'vitest';

import {
  buildAccountingAmountBackfillPlan,
  normalizeAccountingAmount,
  summarizeAccountingAmountCoverage,
} from '@/features/contabilidad/domain/accounting-amount';

const OPERATION_DATE = new Date('2026-08-19T12:00:00.000Z');
const RATE_DATE = new Date('2026-08-19T10:00:00.000Z');

describe('normalizeAccountingAmount', () => {
  it('mantiene el importe original cuando ya está en la moneda funcional', () => {
    const result = normalizeAccountingAmount({
      amount: 100,
      currency: 'cup',
      functionalCurrency: 'CUP',
      convertedAmount: 2450,
      exchangeRate: 24.5,
      operationAt: OPERATION_DATE,
      rateEffectiveAt: RATE_DATE,
    });

    expect(result).toMatchObject({
      status: 'normalized',
      amount: 100,
      currency: 'CUP',
      exchangeRate: 1,
      source: 'same_currency',
    });
  });

  it('usa la conversión persistida de una moneda extranjera', () => {
    const result = normalizeAccountingAmount({
      amount: 100,
      currency: 'USD',
      functionalCurrency: 'CUP',
      convertedAmount: 2450,
      exchangeRate: 24.5,
      operationAt: OPERATION_DATE,
      rateEffectiveAt: RATE_DATE,
    });

    expect(result).toEqual({
      status: 'normalized',
      amount: 2450,
      currency: 'CUP',
      exchangeRate: 24.5,
      rateEffectiveAt: RATE_DATE.toISOString(),
      source: 'persisted_conversion',
    });
  });

  it('marca como no resuelta una moneda extranjera sin importe convertido', () => {
    const result = normalizeAccountingAmount({
      amount: 100,
      currency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 24.5,
      operationAt: OPERATION_DATE,
      rateEffectiveAt: RATE_DATE,
    });

    expect(result).toMatchObject({ status: 'unresolved', issue: 'MISSING_CONVERSION' });
  });

  it.each([0, -1, Number.NaN])('rechaza la tasa inválida %s', (exchangeRate) => {
    const result = normalizeAccountingAmount({
      amount: 100,
      currency: 'USD',
      functionalCurrency: 'CUP',
      convertedAmount: 2450,
      exchangeRate,
      operationAt: OPERATION_DATE,
      rateEffectiveAt: RATE_DATE,
    });

    expect(result).toMatchObject({ status: 'unresolved', issue: 'INVALID_RATE' });
  });

  it('rechaza una tasa posterior a la operación', () => {
    const result = normalizeAccountingAmount({
      amount: 100,
      currency: 'USD',
      functionalCurrency: 'CUP',
      convertedAmount: 2450,
      exchangeRate: 24.5,
      operationAt: OPERATION_DATE,
      rateEffectiveAt: new Date('2026-08-20T10:00:00.000Z'),
    });

    expect(result).toMatchObject({ status: 'unresolved', issue: 'FUTURE_RATE' });
  });

  it('requiere la fecha de procedencia para una tasa extranjera', () => {
    const result = normalizeAccountingAmount({
      amount: 100,
      currency: 'USD',
      functionalCurrency: 'CUP',
      convertedAmount: 2450,
      exchangeRate: 24.5,
      operationAt: OPERATION_DATE,
    });

    expect(result).toMatchObject({ status: 'unresolved', issue: 'MISSING_RATE_DATE' });
  });

  it('rechaza una conversión que no coincide con el importe y la tasa', () => {
    const result = normalizeAccountingAmount({
      amount: 100,
      currency: 'USD',
      functionalCurrency: 'CUP',
      convertedAmount: 2500,
      exchangeRate: 24.5,
      operationAt: OPERATION_DATE,
      rateEffectiveAt: RATE_DATE,
    });

    expect(result).toMatchObject({ status: 'unresolved', issue: 'INCONSISTENT_CONVERSION' });
  });

  it('rechaza importes no positivos o no finitos', () => {
    const result = normalizeAccountingAmount({
      amount: 0,
      currency: 'CUP',
      functionalCurrency: 'CUP',
      operationAt: OPERATION_DATE,
    });

    expect(result).toMatchObject({ status: 'unresolved', issue: 'INVALID_AMOUNT' });
  });
});

describe('summarizeAccountingAmountCoverage', () => {
  it('calcula cobertura y agrupa incidencias sin convertirlas en cero', () => {
    const results = [
      normalizeAccountingAmount({
        amount: 100,
        currency: 'CUP',
        functionalCurrency: 'CUP',
        operationAt: OPERATION_DATE,
      }),
      normalizeAccountingAmount({
        amount: 50,
        currency: 'USD',
        functionalCurrency: 'CUP',
        operationAt: OPERATION_DATE,
      }),
    ];

    expect(summarizeAccountingAmountCoverage(results)).toEqual({
      total: 2,
      normalized: 1,
      unresolved: 1,
      percentage: 50,
      unresolvedByIssue: { MISSING_CONVERSION: 1 },
    });
  });

  it('normaliza por separado saldos bancarios en distintas monedas', () => {
    const results = [
      normalizeAccountingAmount({
        amount: 100,
        currency: 'CUP',
        functionalCurrency: 'CUP',
        operationAt: OPERATION_DATE,
      }),
      normalizeAccountingAmount({
        amount: 10,
        currency: 'USD',
        functionalCurrency: 'CUP',
        convertedAmount: 245,
        exchangeRate: 24.5,
        operationAt: OPERATION_DATE,
        rateEffectiveAt: RATE_DATE,
      }),
    ];

    expect(results.map((result) => result.amount)).toEqual([100, 245]);
    expect(summarizeAccountingAmountCoverage(results).percentage).toBe(100);
  });
});

describe('buildAccountingAmountBackfillPlan', () => {
  it('propone conversiones solo cuando la tasa histórica es determinista', () => {
    const result = buildAccountingAmountBackfillPlan([
      {
        id: 'rec-deterministic',
        amount: 100,
        currency: 'USD',
        functionalCurrency: 'CUP',
        exchangeRate: 24.5,
        operationAt: OPERATION_DATE,
        rateEffectiveAt: RATE_DATE,
      },
      {
        id: 'rec-missing-rate',
        amount: 50,
        currency: 'EUR',
        functionalCurrency: 'CUP',
        operationAt: OPERATION_DATE,
      },
    ]);

    expect(result).toEqual({
      dryRun: true,
      updates: [
        {
          id: 'rec-deterministic',
          convertedAmount: 2450,
          exchangeRate: 24.5,
          rateEffectiveAt: RATE_DATE.toISOString(),
        },
      ],
      unresolved: [{ id: 'rec-missing-rate', issue: 'MISSING_CONVERSION' }],
    });
  });

  it('no propone sobrescribir una conversión persistida que ya es consistente', () => {
    const result = buildAccountingAmountBackfillPlan([
      {
        id: 'rec-existing',
        amount: 100,
        currency: 'USD',
        functionalCurrency: 'CUP',
        convertedAmount: 2450,
        exchangeRate: 24.5,
        operationAt: OPERATION_DATE,
        rateEffectiveAt: RATE_DATE,
      },
    ]);

    expect(result.updates).toEqual([]);
    expect(result.unresolved).toEqual([]);
  });
});
