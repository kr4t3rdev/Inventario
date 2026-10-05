import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma';

import {
  buildAppliedFxEvidence,
  buildAppliedFxEvidenceExact,
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

describe('buildAppliedFxEvidenceExact', () => {
  it('mantiene importes y tasas exactos como strings, sin pasar por number', () => {
    const valuation = buildAppliedFxEvidenceExact({
      originalAmount: '9007199254740993.125',
      originalCurrency: 'USD',
      functionalCurrency: 'MLC',
      exchangeRate: '1',
      convertedAmount: '9007199254740993.125',
      rateEffectiveAt: new Date('2026-01-15T12:00:00.000Z'),
      source: 'service-credit-cxc',
    });

    expect(valuation.montoConvertido.toFixed()).toBe('9007199254740993.125');
    expect(valuation.evidence.originalAmount).toBe('9007199254740993.125');
    expect(valuation.evidence.functionalAmount).toBe('9007199254740993.125');
    expect(valuation.evidence.fxEvidenceVersion).toBe(2);
  });

  it('construye evidencia SAME_CURRENCY sin exigir una tasa publicada', () => {
    const valuation = buildAppliedFxEvidenceExact({
      originalAmount: '100.25',
      originalCurrency: 'mlc',
      functionalCurrency: 'MLC',
      source: 'service-credit-cxc',
    });

    expect(valuation.montoConvertido.toFixed()).toBe('100.25');
    expect(valuation.tasaCambio.toFixed()).toBe('1');
    expect(valuation.rateEffectiveAt).toBeNull();
    expect(valuation.evidence.fxProvenanceKind).toBe('SAME_CURRENCY');
  });

  it('rechaza resultado funcional que necesite más de cuatro decimales', () => {
    expect(() => buildAppliedFxEvidenceExact({
      originalAmount: '1',
      originalCurrency: 'USD',
      functionalCurrency: 'MLC',
      exchangeRate: '0.00005',
      rateEffectiveAt: new Date('2026-01-15T12:00:00.000Z'),
      source: 'service-credit-cxc',
    })).toThrow(/PRECISION_FUNCIONAL_INVALIDA/);
  });

  it('rechaza monto convertido que no coincide exactamente con la tasa y la fecha faltante', () => {
    const base = {
      originalAmount: '10',
      originalCurrency: 'USD',
      functionalCurrency: 'MLC',
      exchangeRate: '24.125',
      rateEffectiveAt: new Date('2026-01-15T12:00:00.000Z'),
      source: 'service-credit-cxc',
    };

    expect(() => buildAppliedFxEvidenceExact({ ...base, convertedAmount: '241.251' }))
      .toThrow(/INCONSISTENT_CONVERSION/);
    expect(() => buildAppliedFxEvidenceExact({ ...base, rateEffectiveAt: null }))
      .toThrow(/MISSING_RATE_DATE/);
  });
});

describe('buildAppliedFxEvidenceExact — sensibilidad del fingerprint a crossQuote (F2)', () => {
  const baseCrossQuote = {
    rate: '1.0833',
    fromCurrency: 'EUR',
    toCurrency: 'USD',
    kind: 'TRIANGULATED' as const,
    catalogRateIds: ['tasa-eur-cup', 'tasa-usd-cup'],
    rateEffectiveAt: '2026-10-01T00:00:00.000Z',
  };

  function buildWithCrossQuote(crossQuote: typeof baseCrossQuote) {
    return buildAppliedFxEvidenceExact({
      originalAmount: '100',
      originalCurrency: 'EUR',
      functionalCurrency: 'USD',
      exchangeRate: '1.0833',
      convertedAmount: '108.33',
      rateEffectiveAt: new Date('2026-10-01T00:00:00.000Z'),
      source: 'test-cross-quote',
      fxProvenanceKind: 'CATALOG_RATE',
      crossQuote,
    });
  }

  it('es determinista para la misma cotización', () => {
    const a = buildWithCrossQuote(baseCrossQuote);
    const b = buildWithCrossQuote({ ...baseCrossQuote });
    expect(a.evidence.fxEvidenceFingerprint).toBe(b.evidence.fxEvidenceFingerprint);
  });

  it('cambia si cambia fromCurrency', () => {
    const base = buildWithCrossQuote(baseCrossQuote);
    const mut = buildWithCrossQuote({ ...baseCrossQuote, fromCurrency: 'GBP' });
    expect(mut.evidence.fxEvidenceFingerprint).not.toBe(base.evidence.fxEvidenceFingerprint);
  });

  it('cambia si cambia toCurrency', () => {
    const base = buildWithCrossQuote(baseCrossQuote);
    const mut = buildWithCrossQuote({ ...baseCrossQuote, toCurrency: 'MLC' });
    expect(mut.evidence.fxEvidenceFingerprint).not.toBe(base.evidence.fxEvidenceFingerprint);
  });

  it('cambia si cambian los ids de catálogo', () => {
    const base = buildWithCrossQuote(baseCrossQuote);
    const mut = buildWithCrossQuote({ ...baseCrossQuote, catalogRateIds: ['otra-tasa'] });
    expect(mut.evidence.fxEvidenceFingerprint).not.toBe(base.evidence.fxEvidenceFingerprint);
  });

  it('cambia si cambia la fecha efectiva de la cotización', () => {
    const base = buildWithCrossQuote(baseCrossQuote);
    const mut = buildWithCrossQuote({ ...baseCrossQuote, rateEffectiveAt: '2026-10-02T00:00:00.000Z' });
    expect(mut.evidence.fxEvidenceFingerprint).not.toBe(base.evidence.fxEvidenceFingerprint);
  });

  it('no depende del orden de las claves del objeto', () => {
    const base = buildWithCrossQuote(baseCrossQuote);
    const reordered = buildWithCrossQuote({
      rateEffectiveAt: '2026-10-01T00:00:00.000Z',
      catalogRateIds: ['tasa-eur-cup', 'tasa-usd-cup'],
      kind: 'TRIANGULATED',
      toCurrency: 'USD',
      fromCurrency: 'EUR',
      rate: '1.0833',
    });
    expect(reordered.evidence.fxEvidenceFingerprint).toBe(base.evidence.fxEvidenceFingerprint);
  });
});

describe('buildAppliedFxEvidenceExact — redondeo declarado HALF_UP_4DP (F3)', () => {
  it('produce evidencia v2 para triangulación con cociente no terminante', () => {
    // EUR→USD vía CUP: 26/24 no termina; el importe funcional se redondea a 4dp.
    const valuation = buildAppliedFxEvidenceExact({
      originalAmount: '100',
      originalCurrency: 'EUR',
      functionalCurrency: 'USD',
      exchangeRate: new Prisma.Decimal('26').div('24'),
      convertedAmount: '108.3333',
      rateEffectiveAt: new Date('2026-10-01T00:00:00.000Z'),
      source: 'inventory-cost-valuation',
      rounding: 'HALF_UP_4DP',
    });

    expect(valuation.evidence.fxEvidenceVersion).toBe(2);
    expect(valuation.montoConvertido.toFixed()).toBe('108.3333');
    expect(valuation.evidence.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rechaza importe redondeado que no coincide con la tasa', () => {
    expect(() => buildAppliedFxEvidenceExact({
      originalAmount: '100',
      originalCurrency: 'EUR',
      functionalCurrency: 'USD',
      exchangeRate: new Prisma.Decimal('26').div('24'),
      convertedAmount: '108.3334',
      rateEffectiveAt: new Date('2026-10-01T00:00:00.000Z'),
      source: 'inventory-cost-valuation',
      rounding: 'HALF_UP_4DP',
    })).toThrow(/INCONSISTENT_CONVERSION/);
  });
});
