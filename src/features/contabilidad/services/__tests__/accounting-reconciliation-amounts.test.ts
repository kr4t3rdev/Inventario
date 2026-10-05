import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { buildPersistedAccountingAmount } from '../accounting-reconciliation-service';

describe('buildPersistedAccountingAmount', () => {
  it('persiste el mismo importe y tasa 1 para la moneda funcional', () => {
    const result = buildPersistedAccountingAmount(100, 'CUP');

    expect(result.montoConvertido?.toString()).toBe('100');
    expect(result.tasaCambio?.toString()).toBe('1');
    expect(result.fxEvidence?.fxProvenanceKind).toBe('SAME_CURRENCY');
    expect(result.fxEvidence?.rateEffectiveAt).toBeNull();
    expect(result.fxEvidence?.fxEvidenceVersion).toBe(2);
  });

  it('calcula el importe funcional usando la tasa proporcionada', () => {
    const effectiveAt = new Date('2026-08-19T12:00:00.000Z');
    const result = buildPersistedAccountingAmount(100, 'USD', 25, effectiveAt);

    expect(result.montoConvertido?.toString()).toBe('2500');
    expect(result.tasaCambio?.toString()).toBe('25');
    expect(result.fxEvidence?.fxProvenanceKind).toBe('MANUAL_GOVERNED');
    expect(result.fxEvidence?.rateEffectiveAt).toEqual(effectiveAt);
  });

  it('no inventa conversión cuando falta la tasa o la fecha efectiva', () => {
    const sinTasa = buildPersistedAccountingAmount(100, 'USD');
    const sinFecha = buildPersistedAccountingAmount(100, 'USD', 25, null);

    expect(sinTasa).toMatchObject({ montoConvertido: null, tasaCambio: null, fxEvidence: null });
    expect(sinFecha).toMatchObject({ montoConvertido: null, tasaCambio: null, fxEvidence: null });
  });

  it('mantiene Decimal exacto sin error binario (0.1 × 0.2)', () => {
    const result = buildPersistedAccountingAmount('0.1', 'USD', '0.2', new Date('2026-08-19T12:00:00.000Z'));

    expect(result.montoConvertido).toBeInstanceOf(Prisma.Decimal);
    expect(result.montoConvertido?.toFixed()).toBe('0.02');
  });
});
