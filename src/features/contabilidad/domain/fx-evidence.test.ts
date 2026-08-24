import { describe, expect, it } from 'vitest';

import {
  buildAppliedFxEvidence,
  FxEvidenceError,
} from './fx-evidence';

describe('buildAppliedFxEvidence', () => {
  it('produce evidencia determinista para la misma moneda', () => {
    const a = buildAppliedFxEvidence({
      originalAmount: 100,
      originalCurrency: 'cup',
      functionalCurrency: 'CUP',
      source: 'test',
    });
    const b = buildAppliedFxEvidence({
      originalAmount: 100,
      originalCurrency: 'CUP',
      functionalCurrency: 'CUP',
      source: 'test',
    });

    expect(a.fxProvenanceKind).toBe('SAME_CURRENCY');
    expect(a.functionalCurrency).toBe('CUP');
    expect(a.fxEvidenceVersion).toBe(1);
    expect(a.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(a.fxEvidenceFingerprint).toBe(b.fxEvidenceFingerprint);
  });

  it('produce evidencia manual gobernable con fecha efectiva y huella estable', () => {
    const effective = new Date('2026-01-15T12:00:00.000Z');
    const evidence = buildAppliedFxEvidence({
      originalAmount: 100,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      convertedAmount: 2400,
      rateEffectiveAt: effective,
      source: 'pago-gastos-workflow',
    });
    const repeat = buildAppliedFxEvidence({
      originalAmount: 100,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      convertedAmount: 2400,
      rateEffectiveAt: new Date('2026-01-15T12:00:00.000Z'),
      source: 'pago-gastos-workflow',
    });

    expect(evidence.fxProvenanceKind).toBe('MANUAL_GOVERNED');
    expect(evidence.rateEffectiveAt).toBe(effective.toISOString());
    expect(evidence.fxProvenanceSource).toBe('pago-gastos-workflow');
    expect(evidence.fxEvidenceFingerprint).toBe(repeat.fxEvidenceFingerprint);

    const mutated = buildAppliedFxEvidence({
      originalAmount: 101,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      convertedAmount: 2424,
      rateEffectiveAt: effective,
      source: 'pago-gastos-workflow',
    });
    expect(mutated.fxEvidenceFingerprint).not.toBe(evidence.fxEvidenceFingerprint);
  });

  it('rechaza conversión inconsistente, fecha ausente y fuente vacía', () => {
    const base = {
      originalAmount: 100,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      convertedAmount: 2400,
      rateEffectiveAt: new Date('2026-01-15T12:00:00.000Z'),
      source: 'test',
    };

    expect(() => buildAppliedFxEvidence({ ...base, convertedAmount: 999 }))
      .toThrow(FxEvidenceError);
    expect(() => buildAppliedFxEvidence({ ...base, convertedAmount: 999 }))
      .toThrow(/INCONSISTENT_CONVERSION/);
    expect(() => buildAppliedFxEvidence({ ...base, rateEffectiveAt: null }))
      .toThrow(/MISSING_RATE_DATE/);
    expect(() => buildAppliedFxEvidence({ ...base, source: '  ' }))
      .toThrow(/INVALID_SOURCE/);
  });
});
