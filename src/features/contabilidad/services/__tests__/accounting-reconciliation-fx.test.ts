import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { buildPersistedAccountingAmount } from '../accounting-reconciliation-service';

describe('buildPersistedAccountingAmount evidencia FX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produce evidencia SAME_CURRENCY sin fecha efectiva para CUP', () => {
    const result = buildPersistedAccountingAmount(100, 'cup', undefined);

    expect(result.montoConvertido).toBe(100);
    expect(result.tasaCambio).toBe(1);
    expect(result.fxEvidence).not.toBeNull();
    expect(result.fxEvidence?.fxProvenanceKind).toBe('SAME_CURRENCY');
    expect(result.fxEvidence?.functionalCurrency).toBe('CUP');
    expect(result.fxEvidence?.rateEffectiveAt).toBeUndefined();
    expect(result.fxEvidence?.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.fxEvidence?.fxEvidenceVersion).toBe(1);
  });

  it('produce evidencia MANUAL_GOVERNED con fecha efectiva para moneda extranjera', () => {
    const effectiveAt = new Date('2026-08-19T12:00:00.000Z');
    const result = buildPersistedAccountingAmount(100, 'USD', 24.5, effectiveAt);

    expect(result.montoConvertido).toBe(2450);
    expect(result.tasaCambio).toBe(24.5);
    expect(result.fxEvidence?.fxProvenanceKind).toBe('MANUAL_GOVERNED');
    expect(result.fxEvidence?.rateEffectiveAt).toEqual(effectiveAt);
    expect(result.fxEvidence?.functionalCurrency).toBe('CUP');
    expect(result.fxEvidence?.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('propaga el id de tasa del catálogo a la evidencia extranjera', () => {
    const result = buildPersistedAccountingAmount(
      100,
      'USD',
      24.5,
      new Date('2026-08-19T12:00:00.000Z'),
      'tasa-9',
    );

    expect(result.fxEvidence?.fxCatalogRateId).toBe('tasa-9');
  });

  it('no fabrica evidencia para extranjero sin tasa o sin fecha efectiva', () => {
    const sinTasa = buildPersistedAccountingAmount(100, 'USD', undefined);
    const sinFecha = buildPersistedAccountingAmount(100, 'USD', 24.5, null);

    expect(sinTasa.montoConvertido).toBeNull();
    expect(sinTasa.tasaCambio).toBeNull();
    expect(sinTasa.fxEvidence).toBeNull();
    expect(sinFecha.montoConvertido).toBeNull();
    expect(sinFecha.fxEvidence).toBeNull();
  });
});
