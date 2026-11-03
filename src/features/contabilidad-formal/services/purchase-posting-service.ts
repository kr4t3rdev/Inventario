import {
	postEvento,
	type ContextoPosting,
	type DecimalInput,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import { buildFunctionalValuation } from '../lib/functional-valuation';

export interface PurchaseRecognitionParams {
	compraDocumentoId: string;
	fecha: Date;
	monto: DecimalInput;
	moneda: string;
	tasaCambio?: number;
}

/**
 * @description Emite el reconocimiento de una compra contra cuentas por pagar.
 * @param {PostingTx} tx - Transacción Prisma de la compra.
 * @param {ContextoPosting} ctx - Tenant y usuario que ejecutan la compra.
 * @param {PurchaseRecognitionParams} params - Documento y valoración original.
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirReconocimientoCompra(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: PurchaseRecognitionParams,
): Promise<PostEventoResult> {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId: ctx.tenantId },
		select: { functionalCurrencyCode: true },
	});
	const functionalCurrency = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
	const currency = params.moneda.trim().toUpperCase();
	const valoracion = buildFunctionalValuation({
		monto: Number(params.monto),
		moneda: currency,
		functionalCurrency,
		tasaCambio: params.tasaCambio,
		fechaOperacion: params.fecha,
		source: 'purchase-posting-service',
	});

	return postEvento(tx, ctx, {
		tipo: 'COMPRA_CREDITO',
		fecha: params.fecha,
		descripcion: `Reconocimiento de compra ${params.compraDocumentoId}`,
		origen: { tipo: 'compra_documento', id: params.compraDocumentoId },
		monto: params.monto,
		moneda: currency,
		montoFuncional: valoracion.sameCurrency ? params.monto : valoracion.montoConvertido,
		monedaFuncional: functionalCurrency,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
	});
}
