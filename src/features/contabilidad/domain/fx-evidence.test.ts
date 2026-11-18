import { describe, expect, it } from 'vitest';

import {
  buildAppliedFxEvidence,
  FxEvidenceError,
  verifyAppliedFxEvidence,
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

  it('registra importe cero entre monedas sin tasa como ZERO_AMOUNT', () => {
    const a = buildAppliedFxEvidence({
      originalAmount: 0,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: null,
      convertedAmount: 0,
      rateEffectiveAt: null,
      source: 'initial-inventory',
    });
    const b = buildAppliedFxEvidence({
      originalAmount: 0,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: null,
      convertedAmount: 0,
      rateEffectiveAt: null,
      source: 'initial-inventory',
    });

    expect(a.fxProvenanceKind).toBe('ZERO_AMOUNT');
    expect(a.rateEffectiveAt).toBe('');
    expect(a.fxCatalogRateId).toBeNull();
    expect(a.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(a.fxEvidenceFingerprint).toBe(b.fxEvidenceFingerprint);
  });

  it('sigue rechazando la tasa ausente cuando el importe no es cero', () => {
    expect(() => buildAppliedFxEvidence({
      originalAmount: 100,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: null,
      convertedAmount: 0,
      rateEffectiveAt: null,
      source: 'initial-inventory',
    })).toThrow(/INVALID_RATE/);
  });
});

describe('verifyAppliedFxEvidence', () => {
  it('verifica la evidencia de importe cero sin tasa atribuida', () => {
    const evidence = buildAppliedFxEvidence({
      originalAmount: 0,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: null,
      convertedAmount: 0,
      rateEffectiveAt: null,
      source: 'initial-inventory',
    });

    expect(verifyAppliedFxEvidence({
      originalAmount: 0,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      convertedAmount: 0,
      exchangeRate: null,
      rateEffectiveAt: null,
      fxProvenanceKind: evidence.fxProvenanceKind,
      fxProvenanceSource: evidence.fxProvenanceSource,
      fxCatalogRateId: evidence.fxCatalogRateId,
      fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
      fxEvidenceVersion: evidence.fxEvidenceVersion,
    })).toBe(true);
  });

  it('rechaza una evidencia cero que afirma una conversión gobernada sin tasa', () => {
    expect(verifyAppliedFxEvidence({
      originalAmount: 0,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      convertedAmount: 0,
      exchangeRate: null,
      rateEffectiveAt: null,
      fxProvenanceKind: 'MANUAL_GOVERNED',
      fxProvenanceSource: 'initial-inventory',
      fxCatalogRateId: null,
      fxEvidenceFingerprint: 'a'.repeat(64),
      fxEvidenceVersion: 1,
    })).toBe(false);
  });
});
