import { createHash } from 'crypto';
import { Prisma } from '@/generated/prisma';

/** Tipos de procedencia soportados para la evidencia de conversión aplicada. */
export type FxProvenanceKind = 'SAME_CURRENCY' | 'MANUAL_GOVERNED' | 'CATALOG_RATE';

/** Cotización cruzada que respalda la pata de tesorería de una transferencia. */
export type CrossQuoteEvidence = {
  rate: string;
  fromCurrency: string;
  toCurrency: string;
  kind: 'DIRECT' | 'INVERSE' | 'TRIANGULATED' | 'MANUAL';
  catalogRateIds: string[];
  rateEffectiveAt: string;
};

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

/** Evidencia y valoración calculadas sin conversiones intermedias a Number. */
export interface ExactAppliedFxEvidence {
  montoConvertido: Prisma.Decimal;
  tasaCambio: Prisma.Decimal;
  rateEffectiveAt: Date | null;
  evidence: AppliedFxEvidence & {
    originalAmount: string;
    functionalAmount: string;
    originalCurrency: string;
    crossQuote: CrossQuoteEvidence | null;
  };
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
      | 'INVALID_SOURCE'
      | 'PRECISION_FUNCIONAL_INVALIDA',
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

interface BuildExactEvidenceInput {
  originalAmount: Prisma.Decimal | string;
  originalCurrency: string;
  functionalCurrency: string;
  exchangeRate?: Prisma.Decimal | string | null;
  convertedAmount?: Prisma.Decimal | string | null;
  rateEffectiveAt?: Date | null;
  source: string;
  fxCatalogRateId?: string | null;
  fxProvenanceKind?: Exclude<FxProvenanceKind, 'SAME_CURRENCY'>;
  /** Cotización cruzada de tesorería; se incluye en el JSON y en el fingerprint. */
  crossQuote?: CrossQuoteEvidence;
  /**
   * Redondeo declarado para conversiones cuya precisión exacta excede la escala
   * persistible (p. ej. triangulaciones vía CUP). Se verifica
   * convertedAmount == round_half_up(originalAmount × exchangeRate, 4) y el
   * redondeo queda cubierto por el fingerprint.
   */
  rounding?: 'HALF_UP_4DP';
}

/**
 * @description Serializa un valor con claves ordenadas recursivamente para
 * huella determinista. A diferencia de JSON.stringify con array de claves
 * (que filtra las claves de los objetos anidados), este ordena cada nivel
 * sin perder campos. Para payloads planos produce la misma serialización
 * que la versión anterior, por lo que las huellas ya persistidas sin
 * objetos anidados se mantienen compatibles.
 * @param {unknown} value - Valor a serializar.
 * @returns {string} Texto JSON canónico.
 */
function canonicalStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * @description Construye la huella canónica SHA-256 de un objeto ordenado en todos
 * sus niveles (objetos anidados incluidos, p. ej. `crossQuote`).
 * @param {Record<string, unknown>} payload - Datos de la evidencia.
 * @returns {string} Huella hexadecimal estable.
 */
function fingerprint(payload: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalStringify(payload), 'utf8').digest('hex');
}

/**
 * @description Construye valoración y evidencia versionada usando aritmética decimal exacta.
 * @param {BuildExactEvidenceInput} input - Importes, tasa y procedencia de la valoración.
 * @returns {ExactAppliedFxEvidence} Resultado funcional exacto y evidencia persistible.
 */
export function buildAppliedFxEvidenceExact(
  input: BuildExactEvidenceInput,
): ExactAppliedFxEvidence {
  const originalCurrency = input.originalCurrency.trim().toUpperCase();
  const functionalCurrency = input.functionalCurrency.trim().toUpperCase();
  const source = input.source.trim();
  let originalAmount: Prisma.Decimal;

  try {
    originalAmount = new Prisma.Decimal(input.originalAmount);
  } catch {
    throw new FxEvidenceError('INVALID_AMOUNT', 'INVALID_AMOUNT: El importe original no es válido');
  }
  if (!originalAmount.isFinite() || !originalAmount.gt(0)) {
    throw new FxEvidenceError('INVALID_AMOUNT', 'INVALID_AMOUNT: El importe original no es válido');
  }
  if (!originalCurrency || !functionalCurrency) {
    throw new FxEvidenceError('INVALID_AMOUNT', 'INVALID_AMOUNT: La moneda es obligatoria');
  }
  if (!source) {
    throw new FxEvidenceError('INVALID_SOURCE', 'INVALID_SOURCE: La fuente de la evidencia es obligatoria');
  }

  let rate: Prisma.Decimal;
  let converted: Prisma.Decimal;
  let effectiveAt: string | null = null;
  let kind: FxProvenanceKind;

  if (originalCurrency === functionalCurrency) {
    rate = new Prisma.Decimal(1);
    converted = originalAmount;
    kind = 'SAME_CURRENCY';
    if (input.convertedAmount != null) {
      const supplied = parseExactDecimal(input.convertedAmount, 'INVALID_AMOUNT');
      if (!supplied.eq(converted)) {
        throw new FxEvidenceError('INCONSISTENT_CONVERSION', 'INCONSISTENT_CONVERSION: La conversión persistida no coincide');
      }
    }
  } else {
    rate = parseExactDecimal(input.exchangeRate, 'INVALID_RATE');
    if (!rate.gt(0)) {
      throw new FxEvidenceError('INVALID_RATE', 'INVALID_RATE: La tasa aplicada no es válida');
    }
    if (input.rateEffectiveAt == null) {
      throw new FxEvidenceError('MISSING_RATE_DATE', 'MISSING_RATE_DATE: La fecha efectiva de la tasa es obligatoria');
    }
    const effectiveTime = input.rateEffectiveAt.getTime();
    if (Number.isNaN(effectiveTime)) {
      throw new FxEvidenceError('INVALID_RATE_DATE', 'INVALID_RATE_DATE: La fecha efectiva de la tasa no es válida');
    }
    effectiveAt = new Date(effectiveTime).toISOString();
    converted = originalAmount.mul(rate);
    kind = input.fxProvenanceKind ?? 'MANUAL_GOVERNED';
    if (input.convertedAmount != null) {
      const supplied = parseExactDecimal(input.convertedAmount, 'INVALID_AMOUNT');
      if (input.rounding === 'HALF_UP_4DP') {
        const rounded = converted.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
        if (!supplied.eq(rounded)) {
          throw new FxEvidenceError('INCONSISTENT_CONVERSION', 'INCONSISTENT_CONVERSION: La conversión redondeada no coincide');
        }
        converted = supplied;
      } else if (!supplied.eq(converted)) {
        throw new FxEvidenceError('INCONSISTENT_CONVERSION', 'INCONSISTENT_CONVERSION: La conversión persistida no coincide');
      }
    }
  }

  if (!converted.mul(10000).isInteger()) {
    throw new FxEvidenceError(
      'PRECISION_FUNCIONAL_INVALIDA',
      'PRECISION_FUNCIONAL_INVALIDA: El importe funcional excede cuatro decimales',
    );
  }

  const originalAmountText = originalAmount.toFixed();
  const functionalAmount = converted.toFixed();
  const evidence: ExactAppliedFxEvidence['evidence'] = {
    functionalCurrency,
    rateEffectiveAt: effectiveAt ?? '',
    fxProvenanceKind: kind,
    fxProvenanceSource: source,
    fxCatalogRateId: input.fxCatalogRateId ?? null,
    originalAmount: originalAmountText,
    functionalAmount,
    originalCurrency,
    crossQuote: input.crossQuote ?? null,
    fxEvidenceFingerprint: fingerprint({
      amount: originalAmountText,
      catalogRateId: input.fxCatalogRateId ?? null,
      convertedAmount: functionalAmount,
      ...(input.crossQuote ? { crossQuote: input.crossQuote } : {}),
      currency: originalCurrency,
      effectiveAt,
      functionalCurrency,
      kind,
      rate: rate.toFixed(),
      rounding: input.rounding ?? null,
      source,
      version: 2,
    }),
    fxEvidenceVersion: 2,
  };

  return {
    montoConvertido: converted,
    tasaCambio: rate,
    rateEffectiveAt: effectiveAt ? new Date(effectiveAt) : null,
    evidence,
  };
}

function parseExactDecimal(
  value: Prisma.Decimal | string | null | undefined,
  issue: 'INVALID_AMOUNT' | 'INVALID_RATE',
): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    if (value == null) throw new Error('missing');
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new FxEvidenceError(issue, `${issue}: El valor decimal no es válido`);
  }
  if (!decimal.isFinite()) {
    throw new FxEvidenceError(issue, `${issue}: El valor decimal no es válido`);
  }
  return decimal;
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
