import { createHash } from 'crypto';

/** Tipos de procedencia soportados para la evidencia de conversión aplicada. */
export type FxProvenanceKind = 'SAME_CURRENCY' | 'MANUAL_GOVERNED';

/** Evidencia inmutable que acompaña a una reconciliación convertida. */
export interface AppliedFxEvidence {
  functionalCurrency: string;
  rateEffectiveAt: string;
  fxProvenanceKind: FxProvenanceKind;
  fxProvenanceSource: string;
  fxCatalogRateId: null;
  fxEvidenceFingerprint: string;
  fxEvidenceVersion: number;
}

/** Error tipado con el código de incidencia de evidencia FX. */
export class FxEvidenceError extends Error {
  constructor(
    public readonly issue:
      | 'INVALID_AMOUNT'
      | 'INVALID_RATE'
      | 'INCONSISTENT_CONVERSION'
      | 'MISSING_RATE_DATE'
      | 'INVALID_RATE_DATE'
      | 'INVALID_SOURCE',
    message: string,
  ) {
    super(message);
    this.name = 'FxEvidenceError';
  }
}

interface BuildEvidenceInput {
  originalAmount: number;
  originalCurrency: string;
  functionalCurrency: string;
  exchangeRate?: number | null;
  convertedAmount?: number | null;
  rateEffectiveAt?: Date | null;
  source: string;
  fxCatalogRateId?: string | null;
}

/**
 * @description Construye la huella canónica SHA-256 de un objeto ordenado.
 * @param {Record<string, unknown>} payload - Datos de la evidencia.
 * @returns {string} Huella hexadecimal estable.
 */
function fingerprint(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * @description Construye la evidencia inmutable de una conversión aplicada.
 * @param {BuildEvidenceInput} input - Importes, monedas, tasa, fecha efectiva y fuente.
 * @returns {AppliedFxEvidence} Evidencia lista para persistir junto a la reconciliación.
 */
export function buildAppliedFxEvidence(input: BuildEvidenceInput): AppliedFxEvidence {
  const originalCurrency = input.originalCurrency.trim().toUpperCase();
  const functionalCurrency = input.functionalCurrency.trim().toUpperCase();
  const source = input.source.trim();

  if (!Number.isFinite(input.originalAmount) || input.originalAmount <= 0) {
    throw new FxEvidenceError('INVALID_AMOUNT', 'INVALID_AMOUNT: El importe original no es válido');
  }
  if (!source) {
    throw new FxEvidenceError('INVALID_SOURCE', 'INVALID_SOURCE: La fuente de la evidencia es obligatoria');
  }

  if (originalCurrency === functionalCurrency) {
    return {
      functionalCurrency,
      rateEffectiveAt: '',
      fxProvenanceKind: 'SAME_CURRENCY',
      fxProvenanceSource: source,
      fxCatalogRateId: input.fxCatalogRateId ?? null,
      fxEvidenceFingerprint: fingerprint({
        amount: input.originalAmount,
        catalogRateId: input.fxCatalogRateId ?? null,
        currency: originalCurrency,
        kind: 'SAME_CURRENCY',
        source,
      }),
      fxEvidenceVersion: 1,
    };
  }

  const rate = Number(input.exchangeRate);
  const converted = Number(input.convertedAmount);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new FxEvidenceError('INVALID_RATE', 'INVALID_RATE: La tasa aplicada no es válida');
  }
  if (input.rateEffectiveAt == null) {
    throw new FxEvidenceError('MISSING_RATE_DATE', 'MISSING_RATE_DATE: La fecha efectiva de la tasa es obligatoria');
  }
  const effectiveTime = input.rateEffectiveAt.getTime();
  if (Number.isNaN(effectiveTime)) {
    throw new FxEvidenceError('INVALID_RATE_DATE', 'INVALID_RATE_DATE: La fecha efectiva de la tasa no es válida');
  }

  const expected = input.originalAmount * rate;
  const tolerance = Math.max(0.01, Math.abs(expected) * 0.000001);
  if (!Number.isFinite(converted) || Math.abs(converted - expected) > tolerance) {
    throw new FxEvidenceError('INCONSISTENT_CONVERSION', 'INCONSISTENT_CONVERSION: La conversión persistida no coincide');
  }

  return {
    functionalCurrency,
    rateEffectiveAt: new Date(effectiveTime).toISOString(),
    fxProvenanceKind: 'MANUAL_GOVERNED',
    fxProvenanceSource: source,
    fxCatalogRateId: input.fxCatalogRateId ?? null,
    fxEvidenceFingerprint: fingerprint({
      amount: input.originalAmount,
      catalogRateId: input.fxCatalogRateId ?? null,
      convertedAmount: converted,
      currency: originalCurrency,
      effectiveAt: new Date(effectiveTime).toISOString(),
      kind: 'MANUAL_GOVERNED',
      rate,
      source,
    }),
    fxEvidenceVersion: 1,
  };
}
