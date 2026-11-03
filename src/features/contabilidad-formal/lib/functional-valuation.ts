import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';

/** Entrada para valorar un importe operativo en la moneda funcional del tenant. */
export interface FunctionalValuationInput {
	/** Importe original en la moneda de la operación. */
	monto: number;
	/** Moneda de la operación (ya normalizada en mayúsculas). */
	moneda: string;
	/** Moneda funcional del tenant; null si no hay política definida. */
	functionalCurrency: string | null;
	/** Tasa informada para convertir a la moneda funcional. */
	tasaCambio?: number | null;
	/** Fecha de operación del documento (fallback de vigencia de la tasa). */
	fechaOperacion: Date;
	/** Fecha de vigencia de la tasa del catálogo, si proviene de una tasa publicada. */
	fechaTasa?: Date | null;
	/** Id de la tasa del catálogo que respalda la conversión. */
	fxCatalogRateId?: string | null;
	/** Fuente que construye la evidencia (nombre del emisor). */
	source: string;
}

/** Valoración funcional derivada de la evidencia persistida, sin recalcular moneda. */
export interface FunctionalValuation {
	/** true cuando la moneda de la operación ya es la funcional. */
	sameCurrency: boolean;
	/** Importe convertido a la moneda funcional; null si no hay conversión posible. */
	montoConvertido: number | null;
	/** Tasa aplicada: 1 en misma moneda, la informada en conversión, null sin tasa. */
	tasaCambio: number | null;
	/** Huella de la evidencia FX aplicada; null cuando no hay conversión valorada. */
	fxEvidenceFingerprint: string | null;
}

/**
 * @description Deriva la valoración funcional de un importe operativo sin recalcular moneda:
 * misma moneda usa tasa 1 con evidencia SAME_CURRENCY; moneda extranjera exige tasa informada
 * (con vigencia, del catálogo o de la fecha de operación) y produce evidencia MANUAL_GOVERNED;
 * sin tasa devuelve importe funcional nulo para que el motor falle cerrado.
 * @param {FunctionalValuationInput} input - Importe, monedas, tasa y vigencia disponibles.
 * @returns {FunctionalValuation} Valoración y huella de evidencia para el asiento formal.
 */
export function buildFunctionalValuation(input: FunctionalValuationInput): FunctionalValuation {
	const functionalCurrency = input.functionalCurrency?.trim().toUpperCase() || null;
	const currency = input.moneda.trim().toUpperCase();
	const monto = Number(input.monto);

	if (!functionalCurrency || currency === functionalCurrency) {
		if (!functionalCurrency) {
			return { sameCurrency: false, montoConvertido: null, tasaCambio: null, fxEvidenceFingerprint: null };
		}
		const evidence = buildAppliedFxEvidence({
			originalAmount: monto,
			originalCurrency: currency,
			functionalCurrency,
			source: input.source,
		});
		return {
			sameCurrency: true,
			montoConvertido: null,
			tasaCambio: 1,
			fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
		};
	}

	const tasa = input.tasaCambio;
	if (tasa == null || !Number.isFinite(tasa) || tasa <= 0) {
		return { sameCurrency: false, montoConvertido: null, tasaCambio: null, fxEvidenceFingerprint: null };
	}

	const rateEffectiveAt = input.fechaTasa ?? input.fechaOperacion;
	const montoConvertido = monto * tasa;
	const evidence = buildAppliedFxEvidence({
		originalAmount: monto,
		originalCurrency: currency,
		functionalCurrency,
		exchangeRate: tasa,
		convertedAmount: montoConvertido,
		rateEffectiveAt,
		fxCatalogRateId: input.fxCatalogRateId ?? null,
		source: input.source,
	});

	return {
		sameCurrency: false,
		montoConvertido,
		tasaCambio: tasa,
		fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
	};
}
