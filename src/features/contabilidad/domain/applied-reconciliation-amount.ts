import { verifyAppliedFxEvidence } from './fx-evidence';

interface AppliedReconciliationAmountInput {
	monto: unknown;
	montoConvertido?: unknown;
	moneda?: string | null;
	functionalCurrency?: string | null;
	tasaCambio?: unknown;
	rateEffectiveAt?: Date | string | null;
	fxProvenanceKind?: string | null;
	fxProvenanceSource?: string | null;
	fxCatalogRateId?: string | null;
	fxEvidenceFingerprint?: string | null;
	fxEvidenceVersion?: number | null;
}

/**
 * @description Resolves a persisted reconciliation amount in functional currency when evidence exists.
 * @param {AppliedReconciliationAmountInput} row - Persisted amount and optional conversion evidence.
 * @returns {number | null} Functional amount, or null when its currency cannot be established.
 */
export function resolveAppliedReconciliationAmount(
	row: AppliedReconciliationAmountInput,
): number | null {
	const amount = Number(row.monto);
	const converted = Number(row.montoConvertido);
	if (!Number.isFinite(amount) || row.montoConvertido == null || !Number.isFinite(converted)) {
		return null;
	}
	const currency = row.moneda?.trim().toUpperCase();
	const functionalCurrency = row.functionalCurrency?.trim().toUpperCase();
	const rate = row.tasaCambio == null ? null : Number(row.tasaCambio);
	if (!currency || !functionalCurrency) return null;
	return verifyAppliedFxEvidence({
		originalAmount: amount,
		originalCurrency: currency,
		functionalCurrency,
		convertedAmount: converted,
		exchangeRate: rate != null && Number.isFinite(rate) ? rate : null,
		rateEffectiveAt: row.rateEffectiveAt,
		fxProvenanceKind: row.fxProvenanceKind,
		fxProvenanceSource: row.fxProvenanceSource,
		fxCatalogRateId: row.fxCatalogRateId,
		fxEvidenceFingerprint: row.fxEvidenceFingerprint,
		fxEvidenceVersion: row.fxEvidenceVersion,
	}) ? converted : null;
}
