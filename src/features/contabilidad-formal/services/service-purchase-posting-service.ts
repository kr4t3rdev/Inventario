import {
	postEvento,
	type ContextoPosting,
	type DecimalInput,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import { buildFunctionalValuation } from '../lib/functional-valuation';

export interface ServicePurchaseRecognitionParams {
	compraServicioId: string;
	fecha: Date;
	monto: DecimalInput;
	moneda: string;
	/** Tasa publicada aplicada a la conversión funcional, si existe. */
	tasaCambio?: number;
	/** Fecha de vigencia de la tasa del catálogo. */
	fechaTasa?: Date;
	/** Id de la tasa del catálogo que respalda la conversión. */
	fxCatalogRateId?: string;
}

/**
 * @description Emite el reconocimiento contable de una compra de servicio recibida.
 * Devenga el gasto contra cuentas por pagar (GASTO_CREDITO) sin recalcular moneda:
 * consume la tasa publicada informada por el writer y deja nula la valoración
 * funcional cuando no hay tasa, para que el motor falle cerrado.
 * @param {PostingTx} tx - Transacción Prisma de la compra.
 * @param {ContextoPosting} ctx - Tenant y usuario que ejecutan la compra.
 * @param {ServicePurchaseRecognitionParams} params - Documento y valoración original.
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirReconocimientoCompraServicio(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: ServicePurchaseRecognitionParams,
): Promise<PostEventoResult> {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId: ctx.tenantId },
		select: { functionalCurrencyCode: true },
	});
	const currency = params.moneda.trim().toUpperCase();
	const valoracion = buildFunctionalValuation({
		monto: Number(params.monto),
		moneda: currency,
		functionalCurrency: policy?.functionalCurrencyCode?.trim().toUpperCase() || null,
		tasaCambio: params.tasaCambio,
		fechaOperacion: params.fecha,
		fechaTasa: params.fechaTasa,
		fxCatalogRateId: params.fxCatalogRateId,
		source: 'service-purchase-posting-service',
	});

	return postEvento(tx, ctx, {
		tipo: 'GASTO_CREDITO',
		fecha: params.fecha,
		descripcion: `Reconocimiento de servicio recibido ${params.compraServicioId}`,
		origen: { tipo: 'compra_servicio', id: params.compraServicioId },
		monto: params.monto,
		moneda: currency,
		montoFuncional: valoracion.sameCurrency ? Number(params.monto) : valoracion.montoConvertido,
		monedaFuncional: policy?.functionalCurrencyCode?.trim().toUpperCase() || null,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
	});
}
