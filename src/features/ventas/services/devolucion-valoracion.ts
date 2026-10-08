import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import { ActionError } from '@/lib/server-actions';

export interface SnapshotCxcDevolucion {
  monedaOriginal: string | null;
  montoOriginal: Prisma.Decimal | string | null;
  montoDeuda: Prisma.Decimal | string;
  montoDeudaFuncional: Prisma.Decimal | string | null;
  monedaFuncional: string | null;
  tasaCambio: Prisma.Decimal | string | null;
  rateEffectiveAt: Date | null;
  fxProvenanceKind: string | null;
  fxProvenanceSource: string | null;
  fxCatalogRateId: string | null;
  fxEvidenceFingerprint: string | null;
  fxEvidenceVersion: number | null;
}

export interface FuentePagoDevolucion {
  moneda: string;
}

export interface ValoracionDevolucion {
  moneda: string;
  montoFuncional: Prisma.Decimal;
  monedaFuncional: string;
  tasaCambio: Prisma.Decimal | null;
  fxEvidenceFingerprint: string | null;
}

/** @description Valora una devolución desde política funcional o snapshot CxC original. */
export function resolverValoracionDevolucion(params: {
  montoOriginal: Prisma.Decimal | string | number;
  monedaFuncional: string;
  snapshotCxc?: SnapshotCxcDevolucion | null;
  fuentesPago?: FuentePagoDevolucion[];
}): ValoracionDevolucion {
  const monedaFuncional = params.monedaFuncional.trim().toUpperCase();
  let monto = new Prisma.Decimal(params.montoOriginal);
  if (
    !monedaFuncional || !monto.isFinite() || !monto.gt(0) ||
    !monto.mul(10000).isInteger()
  ) {
    throw new ActionError('El monto de la devolución no es representable', 'FX_INSUFICIENTE');
  }

  const snapshot = params.snapshotCxc;
  if (!snapshot) {
    if ((params.fuentesPago ?? []).some((fuente) =>
      fuente.moneda.trim().toUpperCase() !== monedaFuncional,
    )) {
      throw new ActionError(
        'El pago de la venta está en otra moneda y no hay snapshot FX de la CxC para reversarlo',
        'FX_INSUFICIENTE',
      );
    }
    return {
      moneda: monedaFuncional,
      montoFuncional: monto,
      monedaFuncional,
      tasaCambio: new Prisma.Decimal(1),
      fxEvidenceFingerprint: null,
    };
  }

  const monedaOriginal = snapshot.monedaOriginal?.trim().toUpperCase();
  const monedaSnapshotFuncional = snapshot.monedaFuncional?.trim().toUpperCase();
  if (
    !monedaOriginal ||
    !monedaSnapshotFuncional ||
    monedaSnapshotFuncional !== monedaFuncional ||
    snapshot.montoOriginal == null ||
    snapshot.montoDeudaFuncional == null ||
    !snapshot.fxEvidenceFingerprint ||
    snapshot.fxEvidenceVersion !== 2 ||
    !snapshot.fxProvenanceSource
  ) {
    throw new ActionError(
      'La cuenta por cobrar origen no tiene una valoración FX verificable',
      'FX_INSUFICIENTE',
    );
  }

  const montoOriginalCxc = new Prisma.Decimal(snapshot.montoOriginal);
  const montoDeuda = new Prisma.Decimal(snapshot.montoDeuda);
  if (!montoOriginalCxc.eq(montoDeuda) || monto.gt(montoOriginalCxc)) {
    throw new ActionError(
      'El snapshot de la cuenta por cobrar no coincide con la devolución',
      'FX_INSUFICIENTE',
    );
  }

  const esMismaMoneda = monedaOriginal === monedaSnapshotFuncional;
  if (
    (esMismaMoneda && snapshot.fxProvenanceKind !== 'SAME_CURRENCY') ||
    (!esMismaMoneda && !['CATALOG_RATE', 'MANUAL_GOVERNED'].includes(
      snapshot.fxProvenanceKind ?? '',
    ))
  ) {
    throw new ActionError('La procedencia FX de la CxC origen no es válida', 'FX_INSUFICIENTE');
  }

  let canonical: ReturnType<typeof buildAppliedFxEvidenceExact>;
  try {
    canonical = buildAppliedFxEvidenceExact({
      originalAmount: montoOriginalCxc,
      originalCurrency: monedaOriginal,
      functionalCurrency: monedaSnapshotFuncional,
      exchangeRate: snapshot.tasaCambio,
      convertedAmount: snapshot.montoDeudaFuncional,
      rateEffectiveAt: snapshot.rateEffectiveAt,
      source: snapshot.fxProvenanceSource,
      fxCatalogRateId: snapshot.fxCatalogRateId,
      fxProvenanceKind: esMismaMoneda
        ? undefined
        : snapshot.fxProvenanceKind as 'CATALOG_RATE' | 'MANUAL_GOVERNED',
    });
  } catch {
    throw new ActionError('La evidencia FX de la CxC origen no es válida', 'FX_INSUFICIENTE');
  }
  if (
    canonical.evidence.fxEvidenceFingerprint !== snapshot.fxEvidenceFingerprint ||
    canonical.evidence.fxEvidenceVersion !== snapshot.fxEvidenceVersion ||
    canonical.evidence.fxProvenanceKind !== snapshot.fxProvenanceKind
  ) {
    throw new ActionError('La evidencia FX de la CxC origen fue alterada', 'FX_INSUFICIENTE');
  }

  const tasaCambio = esMismaMoneda ? new Prisma.Decimal(1) : new Prisma.Decimal(snapshot.tasaCambio!);
  const montoFuncional = esMismaMoneda
    ? monto
    : monto.mul(tasaCambio);
  if (
    !montoFuncional.isFinite() ||
    !montoFuncional.mul(10000).isInteger() ||
    !montoFuncional.abs().lt('10000000000000000')
  ) {
    throw new ActionError(
      'La valoración funcional de la devolución excede la precisión contable',
      'FX_INSUFICIENTE',
    );
  }

  return {
    moneda: monedaOriginal,
    montoFuncional,
    monedaFuncional: monedaSnapshotFuncional,
    tasaCambio,
    fxEvidenceFingerprint: snapshot.fxEvidenceFingerprint,
  };
}
