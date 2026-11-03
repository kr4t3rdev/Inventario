/**
 * @description Resuelve la moneda funcional del tenant y la tasa publicada
 * vigente para valorar un importe operativo en la capa formal.
 *
 * Los emisores de reconocimiento (compra, gasto de servicio, venta de
 * servicios y venta de productos) valoran un importe que la operacion todavia
 * no tiene persistido en una conciliacion: la tasa sale del catalogo de
 * exchange con la fecha de la operacion. Si la moneda difiere de la funcional y
 * no hay tasa publicada, el importe funcional queda nulo y el motor falla
 * cerrado en vez de inventar una conversion.
 *
 * @module src/features/contabilidad-formal/lib/functional-valuation-resolver
 */
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { buildFunctionalValuation } from './functional-valuation';
import type { PostingTx } from '../services/posting-engine';

/** Valoracion funcional lista para el motor de asientos. */
export interface ValuacionOperativa {
	/** Moneda funcional del tenant; null si no hay politica contable. */
	monedaFuncional: string | null;
	/** Importe en moneda funcional; null cuando no hay conversion posible. */
	montoFuncional: number | null;
	/** Tasa aplicada; 1 en la misma moneda, null sin conversion. */
	tasaCambio: number | null;
	/** Huella de la evidencia FX aplicada. */
	fxEvidenceFingerprint: string | null;
}

/** Datos necesarios para valorar un importe operativo. */
export interface ResolverValuacionParams {
	/** Transaccion Prisma del writer operativo. */
	tx: PostingTx;
	/** Tenant dueño de la operacion. */
	tenantId: string;
	/** Importe positivo en la moneda de la operacion. */
	monto: number;
	/** Moneda de la operacion. */
	moneda: string;
	/** Fecha efectiva de la operacion (vigencia de la tasa). */
	fechaOperacion: Date;
	/** Fuente que construye la evidencia (nombre del emisor). */
	source: string;
}

/**
 * @description Valora un importe operativo en la moneda funcional del tenant.
 * @param {ResolverValuacionParams} params - Importe, moneda, fecha y fuente.
 * @returns {Promise<ValuacionOperativa>} Valoracion y huella de evidencia FX.
 */
export async function resolverValuacionOperativa(
	params: ResolverValuacionParams,
): Promise<ValuacionOperativa> {
	const policy = await params.tx.tenantAccountingPolicy.findUnique({
		where: { tenantId: params.tenantId },
		select: { functionalCurrencyCode: true },
	});
	const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
	const moneda = params.moneda.trim().toUpperCase();
	const tasa =
		monedaFuncional && monedaFuncional !== moneda
			? await exchangeRateProvider.getRateAsOf({
					sourceCurrency: moneda,
					targetCurrency: monedaFuncional,
					boundaryAt: params.fechaOperacion,
					client: params.tx,
				})
			: null;
	const valoracion = buildFunctionalValuation({
		monto: params.monto,
		moneda,
		functionalCurrency: monedaFuncional,
		tasaCambio: tasa?.tasa,
		fechaOperacion: params.fechaOperacion,
		fechaTasa: tasa?.fechaVigencia ?? params.fechaOperacion,
		fxCatalogRateId: tasa?.tasaId,
		source: params.source,
	});

	return {
		monedaFuncional,
		montoFuncional: valoracion.sameCurrency ? params.monto : valoracion.montoConvertido,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
	};
}
