import { createHash } from 'crypto';

/** Tipos de procedencia soportados para la evidencia de conversión aplicada. */
export type FxProvenanceKind = 'SAME_CURRENCY' | 'MANUAL_GOVERNED';

/** Evidencia inmutable que acompaña a una reconciliación convertida. */
export interface AppliedFxEvidence {
  functionalCurrency: string;
  rateEffectiveAt: string;
  fxProvenanceKind: FxProvenanceKind;
  fxProvenanceSource: string;
  fxCatalogRateId: string | null;
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

interface VerifyAppliedFxEvidenceInput {
  originalAmount: number;
  originalCurrency: string;
  functionalCurrency: string;
  convertedAmount: number;
  exchangeRate?: number | null;
  rateEffectiveAt?: Date | string | null;
  fxProvenanceKind?: string | null;
  fxProvenanceSource?: string | null;
  fxCatalogRateId?: string | null;
  fxEvidenceFingerprint?: string | null;
  fxEvidenceVersion?: number | null;
}

/**
 * @description Verifies persisted conversion fields against canonical provenance and fingerprint rules.
 * @param {VerifyAppliedFxEvidenceInput} input - Stored amount, currency, rate and evidence fields.
 * @returns {boolean} True only when every field matches a canonical evidence record.
 */
export function verifyAppliedFxEvidence(input: VerifyAppliedFxEvidenceInput): boolean {
  if (input.fxEvidenceVersion !== 1 || !input.fxEvidenceFingerprint) return false;
  if (!input.fxProvenanceKind || !input.fxProvenanceSource) return false;
  if (!Number.isFinite(input.convertedAmount) || input.convertedAmount <= 0) return false;

  const originalCurrency = input.originalCurrency.trim().toUpperCase();
  const functionalCurrency = input.functionalCurrency.trim().toUpperCase();
  if (!originalCurrency || !functionalCurrency) return false;

  const sameCurrency = originalCurrency === functionalCurrency;
  if (sameCurrency) {
    if (input.fxProvenanceKind !== 'SAME_CURRENCY') return false;
    if (Math.abs(input.convertedAmount - input.originalAmount) > 0.01) return false;
    if (input.exchangeRate != null && Number(input.exchangeRate) !== 1) return false;
  } else if (input.fxProvenanceKind !== 'MANUAL_GOVERNED') {
    return false;
  }

  try {
    const effectiveAt = input.rateEffectiveAt == null
      ? null
      : new Date(input.rateEffectiveAt);
    const expected = buildAppliedFxEvidence({
      originalAmount: input.originalAmount,
      originalCurrency,
      functionalCurrency,
      exchangeRate: input.exchangeRate,
      convertedAmount: input.convertedAmount,
      rateEffectiveAt: effectiveAt,
      source: input.fxProvenanceSource,
      fxCatalogRateId: input.fxCatalogRateId,
    });

    return expected.fxProvenanceKind === input.fxProvenanceKind &&
      expected.functionalCurrency === functionalCurrency &&
      expected.fxProvenanceSource === input.fxProvenanceSource &&
      expected.fxCatalogRateId === (input.fxCatalogRateId ?? null) &&
      expected.fxEvidenceFingerprint === input.fxEvidenceFingerprint &&
      expected.fxEvidenceVersion === input.fxEvidenceVersion &&
      (sameCurrency || expected.rateEffectiveAt === effectiveAt?.toISOString());
  } catch {
    return false;
  }
}
