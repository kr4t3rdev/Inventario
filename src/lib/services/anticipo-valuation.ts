import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { ActionError } from '@/lib/server-actions/types';

/**
 * @description Resuelve la valoración exacta del anticipo bajo la política del tenant.
 * @param {Prisma.TransactionClient} tx - Transacción del writer.
 * @param {string} tenantId - Tenant propietario.
 * @param {Prisma.Decimal} amount - Importe nominal.
 * @param {string} currency - Moneda original.
 * @returns {Promise<object>} Snapshot canónico persistible y valoración del evento.
 */
export async function valueAnticipo(
  tx: Prisma.TransactionClient, tenantId: string, amount: Prisma.Decimal, currency: string,
  source = 'anticipo-recognition',
) {
  const policy = await tx.tenantAccountingPolicy.findUnique({ where: { tenantId } });
  const functionalCurrency = policy?.functionalCurrencyCode?.trim().toUpperCase();
  if (!functionalCurrency) {
    throw new ActionError('El anticipo requiere una moneda funcional configurada', 'FX_INSUFICIENTE');
  }
  const originalCurrency = currency.trim().toUpperCase();
  const rate = originalCurrency === functionalCurrency ? null
    : await exchangeRateProvider.getRateAsOfExact({
      sourceCurrency: originalCurrency, targetCurrency: functionalCurrency,
      boundaryAt: new Date(), client: tx,
    });
  if (originalCurrency !== functionalCurrency && !rate) {
    throw new ActionError('No hay tasa verificable para valorar el anticipo', 'FX_INSUFICIENTE');
  }
  const valued = buildAppliedFxEvidenceExact({
    originalAmount: amount, originalCurrency, functionalCurrency,
    exchangeRate: rate?.tasa, rateEffectiveAt: rate?.fechaVigencia,
    fxCatalogRateId: rate?.tasaId, source,
    fxProvenanceKind: rate ? 'CATALOG_RATE' : undefined,
  });
  return {
    ...valued.evidence, exchangeRate: valued.tasaCambio.toString(),
  };
}

/**
 * @description Valida el snapshot sin reconsultar tasas y valora una aplicación histórica.
 * @param {Prisma.JsonValue | null} snapshot - Evidencia persistida de reconocimiento.
 * @param {Prisma.Decimal} original - Total nominal del anticipo.
 * @param {string} currency - Moneda nominal persistida.
 * @param {Prisma.Decimal} amount - Importe nominal aplicado.
 * @returns {object} Snapshot de aplicación exacto basado en el reconocimiento.
 */
export function valueAnticipoApplication(
  snapshot: Prisma.JsonValue | null, original: Prisma.Decimal,
  currency: string, amount: Prisma.Decimal,
) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new ActionError('El anticipo no conserva una valoración verificable', 'FX_INSUFICIENTE');
  }
  const text = (key: string): string => {
    const value = snapshot[key];
    if (typeof value !== 'string') {
      throw new ActionError('El snapshot del anticipo está incompleto', 'FX_INSUFICIENTE');
    }
    return value;
  };
  const rateDate = text('rateEffectiveAt');
  const recognized = buildAppliedFxEvidenceExact({
    originalAmount: original, originalCurrency: currency,
    functionalCurrency: text('functionalCurrency'), exchangeRate: text('exchangeRate'),
    convertedAmount: text('functionalAmount'),
    rateEffectiveAt: rateDate ? new Date(rateDate) : null,
    source: text('fxProvenanceSource'),
    fxCatalogRateId: typeof snapshot.fxCatalogRateId === 'string' ? snapshot.fxCatalogRateId : null,
    fxProvenanceKind: snapshot.fxProvenanceKind === 'CATALOG_RATE' ? 'CATALOG_RATE' : undefined,
  });
  if (snapshot.originalAmount !== original.toString() || snapshot.originalCurrency !== currency ||
      snapshot.fxEvidenceFingerprint !== recognized.evidence.fxEvidenceFingerprint ||
      snapshot.fxEvidenceVersion !== recognized.evidence.fxEvidenceVersion) {
    throw new ActionError('La valoración del anticipo fue alterada', 'FX_INSUFICIENTE');
  }
  const applied = buildAppliedFxEvidenceExact({
    originalAmount: amount, originalCurrency: currency,
    functionalCurrency: recognized.evidence.functionalCurrency,
    exchangeRate: recognized.tasaCambio, rateEffectiveAt: recognized.rateEffectiveAt,
    source: 'anticipo-application', fxCatalogRateId: recognized.evidence.fxCatalogRateId,
    fxProvenanceKind: snapshot.fxProvenanceKind === 'CATALOG_RATE' ? 'CATALOG_RATE' : undefined,
  });
  return { ...applied.evidence, exchangeRate: applied.tasaCambio.toString() };
}

/**
 * @description Construye la valoración contable usando exclusivamente el snapshot persistido.
 * @param {Awaited<ReturnType<typeof valueAnticipo>>} snapshot - Evidencia canónica.
 * @returns {object} Importes Decimal y metadatos del evento.
 */
export function anticipoEventValuation(snapshot: Awaited<ReturnType<typeof valueAnticipo>>) {
  return {
    monto: new Prisma.Decimal(snapshot.originalAmount), moneda: snapshot.originalCurrency,
    montoFuncional: new Prisma.Decimal(snapshot.functionalAmount),
    monedaFuncionalCodigo: snapshot.functionalCurrency,
    tasaCambio: new Prisma.Decimal(snapshot.exchangeRate),
    fxEvidenceFingerprint: snapshot.fxEvidenceFingerprint,
  };
}
