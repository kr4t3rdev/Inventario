import { describe, expect, it } from 'vitest';
import { buildPersistedAccountingAmount } from '../accounting-reconciliation-service';

const FECHA = new Date('2026-01-15T12:00:00.000Z');

describe('buildPersistedAccountingAmount (FX-2: Decimal + evidencia v2)', () => {
  it('misma moneda: importe exacto, tasa 1 y evidencia v2 con JSON canónico', () => {
    const r = buildPersistedAccountingAmount(100, 'USD', undefined, FECHA, undefined, 'USD');
    expect(r.montoConvertido?.toString()).toBe('100');
    expect(r.tasaCambio?.toString()).toBe('1');
    expect(r.fxEvidence?.fxEvidenceVersion).toBe(2);
    expect(r.fxEvidence?.fxEvidenceJson).toBeTruthy();
    const json = r.fxEvidence?.fxEvidenceJson as Record<string, unknown>;
    expect(json.fxEvidenceVersion).toBe(2);
    expect(json.fxEvidenceFingerprint).toEqual(expect.any(String));
  });

  it('multiplicación decimal exacta: 0.1 × 0.2 = 0.02 sin error binario', () => {
    const r = buildPersistedAccountingAmount('0.1', 'USD', '0.2', FECHA, undefined, 'CUP');
    // Con aritmética Number sería 0.020000000000000004.
    expect(r.montoConvertido?.toString()).toBe('0.02');
    expect(r.tasaCambio?.toString()).toBe('0.2');
    expect(r.fxEvidence?.fxEvidenceVersion).toBe(2);
  });

  it('convierte 100 USD × 24 exacto a 2400 CUP', () => {
    const r = buildPersistedAccountingAmount(100, 'USD', 24, FECHA, undefined, 'CUP');
    expect(r.montoConvertido?.toString()).toBe('2400');
    expect(r.tasaCambio?.toString()).toBe('24');
  });

  it('sin tasa para moneda extranjera: nulos para fallar cerrado', () => {
    const r = buildPersistedAccountingAmount(100, 'USD', undefined, FECHA, undefined, 'CUP');
    expect(r.montoConvertido).toBeNull();
    expect(r.tasaCambio).toBeNull();
    expect(r.fxEvidence).toBeNull();
  });

  it('rechaza importe funcional con más de 4 decimales', () => {
    // 1 × 0.12345 = 0.12345 (5 decimales) excede la precisión persistible.
    const r = buildPersistedAccountingAmount(1, 'USD', '0.12345', FECHA, undefined, 'CUP');
    expect(r.montoConvertido).toBeNull();
    expect(r.fxEvidence).toBeNull();
  });

  it('acepta Decimal como entrada sin perder precisión', () => {
    // Misma moneda: la tasa es 1 por definición, la tasa informada se ignora.
    const r = buildPersistedAccountingAmount('110', 'USD', '1.1', FECHA, undefined, 'USD');
    expect(r.montoConvertido?.toString()).toBe('110');
    expect(r.tasaCambio?.toString()).toBe('1');
  });
});
