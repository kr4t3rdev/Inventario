import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import type { Prisma } from '@/generated/prisma';
import { buildFunctionalValuation } from '../lib/functional-valuation';
import {
	postEvento,
	type ContextoPosting,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import { resolverModoTenant } from '../lib/modo-tenant';

const MERMA_ORIGIN_TYPE = 'ajuste_merma';
const MERMA_REVERSAL_ORIGIN_TYPE = 'ajuste_merma_reversado';

interface MermaPostingParams {
	ajusteInventarioId: string;
	fecha: Date;
	costoTotal: number;
	/** Fecha de la tasa que valoró el evento original; solo para la compensación. */
	fechaValoracionOriginal?: Date;
}

interface ProductionPostingParams {
	ordenProduccionId: string;
	fecha: Date;
	costoMaterialesCUP: number;
}

/**
 * @description Valora un costo de inventario expresado en CUP usando la política
 * funcional del tenant y la tasa publicada vigente en la fecha de valoración.
 * @param {PostingTx} tx - Transacción Prisma del writer operativo.
 * @param {ContextoPosting} ctx - Tenant y usuario que originan el evento.
 * @param {number} montoCUP - Costo positivo persistido en la operación.
 * @param {Date} fechaOperacion - Fecha efectiva del asiento.
 * @param {Date} fechaTasa - Fecha límite para seleccionar la tasa publicada.
 * @param {string} source - Identificador del writer que genera la evidencia.
 * @returns {Promise<{ monedaFuncional: string | null; montoFuncional: number | null; tasaCambio: number | null; fxEvidenceFingerprint: string | null }>} Valoración lista para el motor.
 */
async function valorarCostoInventario(
	tx: PostingTx,
	ctx: ContextoPosting,
	montoCUP: number,
	fechaOperacion: Date,
	fechaTasa: Date,
	source: string,
) {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId: ctx.tenantId },
		select: { functionalCurrencyCode: true },
	});
	const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
	const tasa = monedaFuncional && monedaFuncional !== 'CUP'
		? await exchangeRateProvider.getRateAsOf({
			sourceCurrency: 'CUP',
			targetCurrency: monedaFuncional,
			boundaryAt: fechaTasa,
			client: tx,
		})
		: null;
	const valoracion = buildFunctionalValuation({
		monto: montoCUP,
		moneda: 'CUP',
		functionalCurrency: monedaFuncional,
		tasaCambio: tasa?.tasa,
		fechaOperacion,
		fechaTasa: tasa?.fechaVigencia ?? fechaTasa,
		fxCatalogRateId: tasa?.tasaId,
		source,
	});

	return {
		monedaFuncional,
		montoFuncional: valoracion.sameCurrency ? montoCUP : valoracion.montoConvertido,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
		fechaTasa: tasa?.fechaVigencia ?? null,
		catalogoTasaId: tasa?.tasaId ?? null,
	};
}

/**
 * @description Devenga el costo de una merma contra la cuenta de inventarios,
 * anclando la idempotencia a la versión concreta del AjusteInventario.
 * @param {PostingTx} tx - Transacción Prisma de la merma.
 * @param {ContextoPosting} ctx - Tenant y usuario que registran la merma.
 * @param {MermaPostingParams} params - Ajuste persistido y costo histórico.
 * @returns {Promise<PostEventoResult>} Resultado de la emisión formal.
 */
export async function emitirReconocimientoMerma(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: MermaPostingParams,
): Promise<PostEventoResult> {
	const monto = Math.abs(params.costoTotal);
	if (!Number.isFinite(monto) || monto <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	const valoracion = await valorarCostoInventario(
		tx,
		ctx,
		monto,
		params.fecha,
		params.fecha,
		'inventory-adjustment-posting-service',
	);

	return postEvento(tx, ctx, {
		tipo: 'MERMA_INVENTARIO',
		fecha: params.fecha,
		descripcion: `Reconocimiento de merma ${params.ajusteInventarioId}`,
		origen: { tipo: MERMA_ORIGIN_TYPE, id: params.ajusteInventarioId },
		monto,
		moneda: 'CUP',
		montoFuncional: valoracion.montoFuncional,
		monedaFuncional: valoracion.monedaFuncional,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
	});
}

/**
 * @description Compensa una merma solo cuando su reconocimiento original quedó
 * contabilizado o simulado; nunca crea un asiento inverso huérfano para datos legacy.
 * @param {PostingTx} tx - Transacción Prisma de edición o eliminación.
 * @param {ContextoPosting} ctx - Tenant y usuario que realizan la mutación.
 * @param {MermaPostingParams} params - Ajuste original que se está anulando.
 * @returns {Promise<PostEventoResult | null>} Resultado formal o null si no había origen emitido.
 */
export async function emitirReversionMermaSiContabilizada(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: MermaPostingParams,
): Promise<PostEventoResult | null> {
	const modo = await resolverModoTenant(tx, ctx.tenantId);
	if (modo !== 'shadow' && modo !== 'enforce') return null;

	const origin = { tipo: MERMA_ORIGIN_TYPE, id: params.ajusteInventarioId };
	const [asientoOriginal, shadowOriginal] = await Promise.all([
		tx.asiento.findFirst({
			where: {
				tenantId: ctx.tenantId,
				origenTipo: origin.tipo,
				origenId: origin.id,
			},
			select: { asientoId: true },
		}),
		tx.shadowPosteoOutbox.findFirst({
			where: {
				tenantId: ctx.tenantId,
				tipoEvento: 'MERMA_INVENTARIO',
				origenTipo: origin.tipo,
				origenId: origin.id,
				estado: 'SIMULADO',
			},
			select: { id: true },
		}),
	]);
	if (!asientoOriginal && !shadowOriginal) return null;

	const monto = Math.abs(params.costoTotal);
	if (!Number.isFinite(monto) || monto <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	const fechaValoracion = params.fechaValoracionOriginal ?? params.fecha;
	const valoracion = await valorarCostoInventario(
		tx,
		ctx,
		monto,
		params.fecha,
		fechaValoracion,
		'inventory-adjustment-posting-service',
	);

	const resultado = await postEvento(tx, ctx, {
		tipo: 'MERMA_INVENTARIO_REVERSADA',
		fecha: params.fecha,
		descripcion: `Reversión de merma ${params.ajusteInventarioId}`,
		origen: { tipo: MERMA_REVERSAL_ORIGIN_TYPE, id: params.ajusteInventarioId },
		monto,
		moneda: 'CUP',
		montoFuncional: valoracion.montoFuncional,
		monedaFuncional: valoracion.monedaFuncional,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
	});
	if ((resultado.estado === 'CONTABILIZADO' || resultado.estado === 'SIMULADO') &&
		valoracion.monedaFuncional && valoracion.monedaFuncional !== 'CUP' &&
		valoracion.montoFuncional !== null && valoracion.tasaCambio !== null && valoracion.fechaTasa) {
		const source = 'inventory-adjustment-posting-service';
		const evidencia = buildAppliedFxEvidence({ originalAmount: monto, originalCurrency: 'CUP',
			functionalCurrency: valoracion.monedaFuncional, exchangeRate: valoracion.tasaCambio,
			convertedAmount: valoracion.montoFuncional, rateEffectiveAt: valoracion.fechaTasa,
			fxCatalogRateId: valoracion.catalogoTasaId, source });
		if (evidencia.fxEvidenceFingerprint !== valoracion.fxEvidenceFingerprint) {
			throw new Error('MERMA_REVERSION_FX_EVIDENCIA_CONFLICTO');
		}
		await tx.fxEvidence.create({ data: { tenantId: ctx.tenantId, sourceType: MERMA_REVERSAL_ORIGIN_TYPE,
			sourceId: params.ajusteInventarioId, originalAmount: monto, originalCurrency: 'CUP',
			functionalAmount: valoracion.montoFuncional, functionalCurrency: valoracion.monedaFuncional,
			exchangeRate: valoracion.tasaCambio, rateEffectiveAt: valoracion.fechaTasa, cutoffAt: fechaValoracion,
			fxCatalogRateId: valoracion.catalogoTasaId, provenance: evidencia.fxProvenanceKind,
			source: evidencia.fxProvenanceSource,
			evidence: { ...evidencia, rawConvertedAmount: valoracion.montoFuncional,
				rawExchangeRate: valoracion.tasaCambio } as Prisma.InputJsonValue,
			evidenceFingerprint: evidencia.fxEvidenceFingerprint, evidenceVersion: evidencia.fxEvidenceVersion } });
	}
	return resultado;
}

/**
 * @description Revierte los ajustes activos de una merma antes de editarla o
 * eliminarla, conservando la trazabilidad por versión de AjusteInventario.
 * @param {PostingTx} tx - Transacción Prisma de la mutación operativa.
 * @param {ContextoPosting} ctx - Tenant y usuario que realizan la mutación.
 * @param {string} mermaId - Identificador del documento operativo.
 * @returns {Promise<void>} Completa todas las compensaciones necesarias.
 */
export async function revertirMermaContableEnTransaccion(
	tx: PostingTx,
	ctx: ContextoPosting,
	mermaId: string,
): Promise<void> {
	const ajustes = await tx.ajusteInventario.findMany({
		where: { tenantId: ctx.tenantId, origenMermaId: mermaId, estado: 'APLICADO' },
		select: { id: true, costoTotal: true, createdAt: true },
		orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
	});
	const fecha = new Date();

	for (const ajuste of ajustes) {
		const registro = await tx.ajusteInventario.updateMany({
			where: { id: ajuste.id, tenantId: ctx.tenantId, origenMermaId: mermaId,
				estado: 'APLICADO', mermaReversionFecha: null },
			data: { mermaReversionFecha: fecha, mermaReversionRegistradaAt: fecha },
		});
		if (registro.count !== 1) {
			throw new Error('MERMA_REVERSION_EVIDENCIA_CONFLICTO');
		}
		const resultado = await emitirReversionMermaSiContabilizada(tx, ctx, {
			ajusteInventarioId: ajuste.id,
			fecha,
			costoTotal: ajuste.costoTotal,
			fechaValoracionOriginal: ajuste.createdAt,
		});
		if (resultado?.estado === 'YA_EXISTENTE') {
			throw new Error('MERMA_REVERSION_EVIDENCIA_CONFLICTO');
		}
		if (!resultado || (resultado.estado !== 'CONTABILIZADO' && resultado.estado !== 'SIMULADO')) {
			const limpieza = await tx.ajusteInventario.updateMany({
				where: { id: ajuste.id, tenantId: ctx.tenantId, mermaReversionFecha: fecha },
				data: { mermaReversionFecha: null, mermaReversionRegistradaAt: null },
			});
			if (limpieza.count !== 1) throw new Error('MERMA_REVERSION_EVIDENCIA_CONFLICTO');
		}
	}
}

/**
 * @description Reclasifica el costo histórico consumido en producción hacia el
 * producto terminado, usando las líneas originales del kardex como evidencia.
 * @param {PostingTx} tx - Transacción Prisma de completar la orden.
 * @param {ContextoPosting} ctx - Tenant y usuario que completan la producción.
 * @param {ProductionPostingParams} params - Orden y costo neto consumido del kardex.
 * @returns {Promise<PostEventoResult>} Resultado de la emisión formal.
 */
export async function emitirProduccionInventario(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: ProductionPostingParams,
): Promise<PostEventoResult> {
	if (!Number.isFinite(params.costoMaterialesCUP) || params.costoMaterialesCUP <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	const valoracion = await valorarCostoInventario(
		tx,
		ctx,
		params.costoMaterialesCUP,
		params.fecha,
		params.fecha,
		'inventory-adjustment-posting-service',
	);

	return postEvento(tx, ctx, {
		tipo: 'PRODUCCION_SALIDA',
		fecha: params.fecha,
		descripcion: `Reclasificación de costo de producción ${params.ordenProduccionId}`,
		origen: { tipo: 'orden_produccion', id: params.ordenProduccionId },
		monto: params.costoMaterialesCUP,
		moneda: 'CUP',
		montoFuncional: valoracion.montoFuncional,
		monedaFuncional: valoracion.monedaFuncional,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
	});
}
