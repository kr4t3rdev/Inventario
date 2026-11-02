import {
	postEvento,
	type ContextoPosting,
	type DecimalInput,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';

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
	const originalAmount = Number(params.monto);
	let functionalAmount: number | DecimalInput | null = null;
	let exchangeRate: number | null = null;
	let fxEvidenceFingerprint: string | null = null;

	if (functionalCurrency && currency === functionalCurrency) {
		const evidence = buildAppliedFxEvidence({
			originalAmount,
			originalCurrency: currency,
			functionalCurrency,
			source: 'purchase-posting-service',
		});
		functionalAmount = params.monto;
		exchangeRate = 1;
		fxEvidenceFingerprint = evidence.fxEvidenceFingerprint;
	} else if (functionalCurrency && params.tasaCambio != null) {
		functionalAmount = originalAmount * params.tasaCambio;
		exchangeRate = params.tasaCambio;
		const evidence = buildAppliedFxEvidence({
			originalAmount,
			originalCurrency: currency,
			functionalCurrency,
			exchangeRate,
			convertedAmount: Number(functionalAmount),
			rateEffectiveAt: params.fecha,
			source: 'purchase-posting-service',
		});
		fxEvidenceFingerprint = evidence.fxEvidenceFingerprint;
	}

	return postEvento(tx, ctx, {
		tipo: 'COMPRA_CREDITO',
		fecha: params.fecha,
		descripcion: `Reconocimiento de compra ${params.compraDocumentoId}`,
		origen: { tipo: 'compra_documento', id: params.compraDocumentoId },
		monto: params.monto,
		moneda: currency,
		montoFuncional: functionalAmount,
		monedaFuncional: functionalCurrency,
		tasaCambio: exchangeRate,
		fxEvidenceFingerprint,
	});
}
