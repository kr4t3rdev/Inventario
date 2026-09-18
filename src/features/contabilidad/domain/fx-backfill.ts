import { createHash } from 'crypto';

/** Disposiciones posibles de una fila legacy frente al catálogo histórico. */
export type BackfillDisposition =
  | 'same_currency'
  | 'already_complete'
  | 'uniquely_provable'
  | 'ambiguous'
  | 'missing_evidence'
  | 'invalid_row';

/** Fila de reconciliación normalizada para clasificación. */
export interface BackfillRowInput {
  id: string;
  monto: number;
  moneda: string;
  montoConvertido: number | null;
  tasaCambio: number | null;
  fechaReconciliacion: Date;
  rateEffectiveAt?: Date | null;
  fxEvidenceFingerprint?: string | null;
}

/** Candidato del catálogo histórico de tasas. */
export interface CatalogCandidate {
  tasaId: string;
  tasa: number;
  fechaVigencia: Date;
}

/** Actualización propuesta para filas únicamente demostrables. */
export interface BackfillProposedUpdate {
  rateEffectiveAt: string;
  fxCatalogRateId: string;
  fxProvenanceKind: 'GLOBAL_CATALOG_DIRECT';
  fxEvidenceFingerprint: string;
}

export interface BackfillRowResult {
  id: string;
  disposition: BackfillDisposition;
  proposedUpdate?: BackfillProposedUpdate;
}

/**
 * @description Cuantiza un importe a 2 decimales con redondeo half-up.
 * @param {number} value - Importe positivo a cuantizar.
 * @returns {number} Importe en centavos exactos.
 */
function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * @description Compara tasas con precisión fija de 12 decimales.
 * @param {number} left - Tasa izquierda.
 * @param {number} right - Tasa derecha.
 * @returns {boolean} Indica si son iguales a 12 decimales.
 */
function sameRate(left: number, right: number): boolean {
  return left.toFixed(12) === right.toFixed(12);
}

/**
 * @description Construye la huella canónica de la evidencia propuesta.
 * @param {object} input - Datos que participan en la huella.
 * @returns {string} Huella SHA-256 hexadecimal.
 */
function fingerprint(input: {
  id: string;
  amount: number;
  currency: string;
  convertedAmount: number;
  rate: number;
  effectiveAt: Date;
}): string {
  const canonical = JSON.stringify({
    amount: input.amount,
    convertedAmount: input.convertedAmount,
    currency: input.currency,
    effectiveAt: input.effectiveAt.toISOString(),
    kind: 'GLOBAL_CATALOG_DIRECT',
    rate: input.rate,
    rowId: input.id,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

const FOREIGN_TOLERANCE = Math.pow(10, -9);

/**
 * @description Clasifica una fila legacy como demostrable, ambigua, faltante, inválida o
 * ya completa usando únicamente evidencia histórica del catálogo. Nunca propone usar la
 * fecha de reconciliación como fecha efectiva: se adopta la vigencia del candidato.
 * @param {BackfillRowInput} row - Fila persistida a clasificar.
 * @param {CatalogCandidate[]} catalog - Candidatos del par de monedas ordenados por vigencia.
 * @param {string} functionalCurrency - Moneda funcional objetivo.
 * @returns {BackfillRowResult} Disposición y actualización propuesta cuando corresponde.
 */
export function classifyBackfillRow(
  row: BackfillRowInput,
  catalog: CatalogCandidate[],
  functionalCurrency: string,
): BackfillRowResult {
  if (row.moneda.trim().toUpperCase() === functionalCurrency.trim().toUpperCase()) {
    return { id: row.id, disposition: 'same_currency' };
  }

  if (row.rateEffectiveAt != null && Boolean(row.fxEvidenceFingerprint)) {
    return { id: row.id, disposition: 'already_complete' };
  }

  const amount = Number(row.monto);
  const storedConverted = row.montoConvertido == null ? NaN : Number(row.montoConvertido);
  const storedRate = row.tasaCambio == null ? NaN : Number(row.tasaCambio);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { id: row.id, disposition: 'invalid_row' };
  }
  if (!Number.isFinite(storedRate) || !Number.isFinite(storedConverted)) {
    return { id: row.id, disposition: 'missing_evidence' };
  }
  if (storedRate <= 0 || storedConverted <= 0 || money(storedConverted) !== money(amount * storedRate)) {
    return { id: row.id, disposition: 'invalid_row' };
  }

  const operationAt = row.fechaReconciliacion.getTime();
  const eligible = catalog.filter((candidate) => {
    if (candidate.fechaVigencia.getTime() > operationAt) return false;
    if (!sameRate(Number(candidate.tasa), storedRate)) return false;
    return (
      Math.abs(money(amount * Number(candidate.tasa)) - money(storedConverted)) <
      FOREIGN_TOLERANCE
    );
  });

  if (eligible.length === 1) {
    const candidate = eligible[0];
    return {
      id: row.id,
      disposition: 'uniquely_provable',
      proposedUpdate: {
        rateEffectiveAt: candidate.fechaVigencia.toISOString(),
        fxCatalogRateId: candidate.tasaId,
        fxProvenanceKind: 'GLOBAL_CATALOG_DIRECT',
        fxEvidenceFingerprint: fingerprint({
          id: row.id,
          amount,
          currency: row.moneda.trim().toUpperCase(),
          convertedAmount: money(storedConverted),
          rate: Number(candidate.tasa),
          effectiveAt: candidate.fechaVigencia,
        }),
      },
    };
  }

  return {
    id: row.id,
    disposition: eligible.length > 1 ? 'ambiguous' : 'missing_evidence',
  };
}
