import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import { resolverValoracionDevolucion } from '@/features/ventas/services/devolucion-valoracion';

function snapshotUsd() {
  const rateEffectiveAt = new Date('2026-09-30T00:00:00Z');
  const evidence = buildAppliedFxEvidenceExact({
    originalAmount: '2000',
    originalCurrency: 'USD',
    functionalCurrency: 'CUP',
    exchangeRate: '24',
    convertedAmount: '48000',
    rateEffectiveAt,
    source: 'facturacion-venta-credito-cxc',
    fxCatalogRateId: 'rate-usd-1',
    fxProvenanceKind: 'CATALOG_RATE',
  });
  return {
    monedaOriginal: 'USD',
    montoOriginal: new Prisma.Decimal('2000'),
    montoDeuda: new Prisma.Decimal('2000'),
    montoDeudaFuncional: new Prisma.Decimal('48000'),
    monedaFuncional: 'CUP',
    tasaCambio: new Prisma.Decimal('24'),
    rateEffectiveAt,
    fxProvenanceKind: 'CATALOG_RATE',
    fxProvenanceSource: 'facturacion-venta-credito-cxc',
    fxCatalogRateId: 'rate-usd-1',
    fxEvidenceFingerprint: evidence.evidence.fxEvidenceFingerprint,
    fxEvidenceVersion: 2,
  };
}

describe('resolverValoracionDevolucion', () => {
  it('usa moneda funcional tenant para una venta sin CxC extranjera', () => {
    const result = resolverValoracionDevolucion({
      montoOriginal: 1250,
      monedaFuncional: 'EUR',
    });

    expect(result).toEqual({
      moneda: 'EUR',
      montoFuncional: new Prisma.Decimal('1250'),
      monedaFuncional: 'EUR',
      tasaCambio: new Prisma.Decimal('1'),
      fxEvidenceFingerprint: null,
    });
  });

  it('no trata pagos extranjeros como si el precio de venta estuviera en moneda funcional', () => {
    expect(() => resolverValoracionDevolucion({
      montoOriginal: 1250,
      monedaFuncional: 'CUP',
      fuentesPago: [{ moneda: 'USD' }],
    })).toThrowError(expect.objectContaining({ code: 'FX_INSUFICIENTE' }));
  });

  it('hereda la tasa/fingerprint del snapshot CxC para una devolución parcial extranjera', () => {
    const snapshot = snapshotUsd();
    const result = resolverValoracionDevolucion({
      montoOriginal: 1000,
      monedaFuncional: 'CUP',
      snapshotCxc: snapshot,
    });

    expect(result.moneda).toBe('USD');
    expect(result.montoFuncional.eq(new Prisma.Decimal('24000'))).toBe(true);
    expect(result.monedaFuncional).toBe('CUP');
    expect(result.tasaCambio?.eq(new Prisma.Decimal('24'))).toBe(true);
    expect(result.fxEvidenceFingerprint).toBe(snapshot.fxEvidenceFingerprint);
  });

  it('rechaza CxC histórica incompleta en vez de inferir desde Factura.tasaCambio', () => {
    expect(() => resolverValoracionDevolucion({
      montoOriginal: 1000,
      monedaFuncional: 'CUP',
      snapshotCxc: {
        ...snapshotUsd(),
        montoDeudaFuncional: null,
        fxEvidenceFingerprint: null,
      },
    })).toThrowError(expect.objectContaining({ code: 'FX_INSUFICIENTE' }));
  });

  it('rechaza devolución mayor que el principal del snapshot', () => {
    expect(() => resolverValoracionDevolucion({
      montoOriginal: 2001,
      monedaFuncional: 'CUP',
      snapshotCxc: snapshotUsd(),
    })).toThrowError(expect.objectContaining({ code: 'FX_INSUFICIENTE' }));
  });

  it('rechaza un fingerprint que no corresponde al snapshot', () => {
    expect(() => resolverValoracionDevolucion({
      montoOriginal: 1000,
      monedaFuncional: 'CUP',
      snapshotCxc: { ...snapshotUsd(), fxEvidenceFingerprint: 'tampered' },
    })).toThrowError(expect.objectContaining({ code: 'FX_INSUFICIENTE' }));
  });
});
