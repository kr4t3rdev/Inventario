import { describe, expect, it } from 'vitest';

import {
  classifyBackfillRow,
  type BackfillRowInput,
  type CatalogCandidate,
} from './fx-backfill';

const CUP = 'CUP';

function row(overrides: Partial<BackfillRowInput> = {}): BackfillRowInput {
  return {
    id: 'rec-1',
    monto: 100,
    moneda: 'USD',
    montoConvertido: 2400,
    tasaCambio: 24,
    fechaReconciliacion: new Date('2026-03-15T12:00:00.000Z'),
    ...overrides,
  };
}

function cand(overrides: Partial<CatalogCandidate> = {}): CatalogCandidate {
  return {
    tasaId: 'tasa-1',
    tasa: 24,
    fechaVigencia: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('classifyBackfillRow', () => {
  it('marca moneda funcional sin catálogo', () => {
    const result = classifyBackfillRow(row({ moneda: CUP }), [], CUP);
    expect(result.disposition).toBe('same_currency');
    expect(result.proposedUpdate).toBeUndefined();
  });

  it('respeta filas que ya tienen evidencia completa', () => {
    const result = classifyBackfillRow(
      row({ rateEffectiveAt: new Date('2026-01-01T00:00:00.000Z'), fxEvidenceFingerprint: 'a'.repeat(64) }),
      [],
      CUP,
    );
    expect(result.disposition).toBe('already_complete');
    expect(result.proposedUpdate).toBeUndefined();
  });

  it('invalída filas con importes o conversión inconsistente', () => {
    expect(classifyBackfillRow(row({ monto: -5 }), [], CUP).disposition).toBe('invalid_row');
    expect(
      classifyBackfillRow(row({ montoConvertido: 999 }), [], CUP).disposition,
    ).toBe('invalid_row');
    expect(
      classifyBackfillRow(row({ tasaCambio: null, montoConvertido: null }), [], CUP).disposition,
    ).toBe('missing_evidence');
  });

  it('prueba única cuando un solo candidato coincide en tasa e importe', () => {
    const result = classifyBackfillRow(row(), [cand()], CUP);

    expect(result.disposition).toBe('uniquely_provable');
    expect(result.proposedUpdate?.rateEffectiveAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.proposedUpdate?.fxCatalogRateId).toBe('tasa-1');
    expect(result.proposedUpdate?.fxProvenanceKind).toBe('GLOBAL_CATALOG_DIRECT');
    expect(result.proposedUpdate?.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('declara ambiguo cuando dos candidatos idénticos califican', () => {
    const result = classifyBackfillRow(row(), [cand(), cand({ tasaId: 'tasa-2' })], CUP);
    expect(result.disposition).toBe('ambiguous');
    expect(result.proposedUpdate).toBeUndefined();
  });

  it('exige vigencia anterior a la operación y tasa exacta', () => {
    const tardia = classifyBackfillRow(
      row(),
      [cand({ fechaVigencia: new Date('2026-06-01T00:00:00.000Z') })],
      CUP,
    );
    expect(tardia.disposition).toBe('missing_evidence');

    const otraTasa = classifyBackfillRow(row(), [cand({ tasa: 24.5 })], CUP);
    expect(otraTasa.disposition).toBe('missing_evidence');

    const importeDistinto = classifyBackfillRow(
      row({ montoConvertido: 2400 }),
      [cand({ tasa: 24, fechaVigencia: new Date('2025-06-01T00:00:00.000Z') })],
      CUP,
    );
    expect(importeDistinto.disposition).toBe('uniquely_provable');
  });
});
