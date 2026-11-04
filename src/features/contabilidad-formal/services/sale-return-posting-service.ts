/**
 * @description Emisor formal de la devolución de venta.
 *
 * La devolución no es una ventasimple: el writer operativo reparte el importe
 * devuelto entre tres salidas reales (cuentas por cobrar aplicadas, saldo a
 * favor del cliente y reembolso en efectivo) y además repone la mercadería en
 * inventario. El asiento formal refleja ese desglose:
 *
 *  - `DEBE` ventas por el ingreso revertido (el total de la devolución).
 *  - `HABER` cuentas por cobrar por la parte efectivamente aplicada.
 *  - `HABER` anticipos de clientes por el saldo a favor.
 *  - `HABER` caja por el reembolso en efectivo.
 *  - `DEBE` inventarios / `HABER` costo de ventas por el costo FIFO repuesto.
 *
 * El emisor consume la valoración ya persistida por el writer (importe,
 * moneda y tasa de la devolución) y no recalcula moneda. Si la moneda operativa
 * no tiene conversión posible, el importe funcional queda nulo y el motor falla
 * cerrado en vez de inventar una equivalencia.
 *
 * El efectivo se reconoce al registrar la devolución: el reembolso queda
 * pendiente en el turno y el efectivo físico sale al cerrarlo. Esa diferencia
 * de timing está documentada y es la misma que asume la plantilla del plan.
 *
 * @module src/features/contabilidad-formal/services/sale-return-posting-service
 */
import { buildFunctionalValuation } from '../lib/functional-valuation';
import {
	postEvento,
	type ContextoPosting,
	type DecimalInput,
	type EventoContableInput,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';

/** Origen idempotente de la devolución de venta. */
export const DEVOLUCION_VENTA_ORIGIN_TYPE = 'devolucion_venta';

/** Fuente de la evidencia FX construida por este emisor. */
const EVIDENCE_SOURCE = 'sale-return-posting-service';

/** Datos de la devolución ya persistidos por el writer operativo. */
export interface DevolucionVentaPostingParams {
	/** Identificador de la devolución (`DevolucionVenta.devolucionId`). */
	devolucionId: string;
	/** Fecha de la operación (momento de registrar la devolución). */
	fecha: Date;
	/** Importe total devuelto, en la moneda de la operación. */
	monto: DecimalInput;
	/** Moneda de la operación. */
	moneda: string;
	/** Parte del importe aplicada a cuentas por cobrar. */
	montoAplicadoCxc: DecimalInput;
	/** Parte del importe que queda como saldo a favor del cliente. */
	montoSaldoFavor: DecimalInput;
	/** Parte del importe que se reembolsa en efectivo. */
	montoReembolsado: DecimalInput;
	/** Costo FIFO repuesto en moneda funcional; null si no se pudo valorar. */
	costoFifo?: number | null;
	/** Tasa aplicada por el writer operativo, si la moneda no es funcional. */
	tasaCambio?: DecimalInput | null;
	/** Descripcion legible del asiento. */
	descripcion?: string;
	/** Referencia operativa (clave de idempotencia) de la devolución. */
	referencia?: string | null;
}

/**
 * @description Convierte un importe operativo a moneda funcional con la tasa ya
 * decidida por el writer. Devuelve null cuando la moneda no es funcional y no
 * hay tasa utilizable, para que el motor falle cerrado.
 * @param {number} monto - Importe en la moneda de la operación.
 * @param {string} moneda - Moneda de la operación.
 * @param {string | null} functionalCurrency - Moneda funcional del tenant.
 * @param {number | null} tasaCambio - Tasa persistida por el writer.
 * @param {Date} fecha - Fecha de la operación.
 * @returns {number | null} Importe en moneda funcional o null si no se puede valorar.
 */
function aMonedaFuncional(
	monto: number,
	moneda: string,
	functionalCurrency: string | null,
	tasaCambio: number | null,
	fecha: Date,
): number | null {
	// Una salida que no aplica vale cero: no genera línea y no necesita tasa.
	if (!Number.isFinite(monto) || monto === 0) return 0;
	const valoracion = buildFunctionalValuation({
		monto,
		moneda,
		functionalCurrency,
		tasaCambio,
		fechaOperacion: fecha,
		source: EVIDENCE_SOURCE,
	});
	if (valoracion.sameCurrency) return monto;
	return valoracion.montoConvertido;
}

/**
 * @description Construye el evento formal de la devolución de venta.
 *
 * El constructor es puro y compartido: el writer y el replay histórico
 * construyen el evento con la misma función, de modo que el asiento
 * reconstruido por el replay es el mismo que emitió el writer.
 *
 * @param {DevolucionVentaPostingParams} params - Devolución persistida y su desglose.
 * @param {string | null} functionalCurrency - Moneda funcional del tenant.
 * @returns {EventoContableInput} Evento formal listo para contabilizar.
 */
export function construirEventoDevolucionVenta(
	params: DevolucionVentaPostingParams,
	functionalCurrency: string | null,
): EventoContableInput {
	const moneda = params.moneda.trim().toUpperCase();
	const tasaCambio = params.tasaCambio == null ? null : Number(params.tasaCambio);

	const total = Math.abs(Number(params.monto));
	const aplicado = Math.abs(Number(params.montoAplicadoCxc));
	const reembolsado = Math.abs(Number(params.montoReembolsado));

	const totalFuncional = aMonedaFuncional(total, moneda, functionalCurrency, tasaCambio, params.fecha);
	const aplicadoFuncional = aMonedaFuncional(aplicado, moneda, functionalCurrency, tasaCambio, params.fecha);
	const reembolsadoFuncional = aMonedaFuncional(
		reembolsado,
		moneda,
		functionalCurrency,
		tasaCambio,
		params.fecha,
	);
	// El saldo a favor es el residuo del writer (lo que no se aplicó a cuentas
	// por cobrar ni se reembolsa): en moneda funcional absorbe la diferencia de
	// redondeo de la conversión para que el asiento siempre cuadre.
	const saldoFavorFuncional = totalFuncional == null || aplicadoFuncional == null ||
		reembolsadoFuncional == null
		? null
		: totalFuncional - aplicadoFuncional - reembolsadoFuncional;

	const valoracionTotal = buildFunctionalValuation({
		monto: total,
		moneda,
		functionalCurrency,
		tasaCambio,
		fechaOperacion: params.fecha,
		source: EVIDENCE_SOURCE,
	});

	return {
		tipo: 'DEVOLUCION_VENTA',
		fecha: params.fecha,
		descripcion: params.descripcion ?? `Devolucion de venta ${params.devolucionId}`,
		origen: { tipo: DEVOLUCION_VENTA_ORIGIN_TYPE, id: params.devolucionId },
		monto: total,
		moneda,
		montoFuncional: totalFuncional,
		monedaFuncional: functionalCurrency,
		tasaCambio: valoracionTotal.tasaCambio,
		fxEvidenceFingerprint: valoracionTotal.fxEvidenceFingerprint,
		auxiliares: {
			...(aplicadoFuncional == null ? {} : { montoAplicadoCxc: aplicadoFuncional }),
			...(saldoFavorFuncional == null ? {} : { montoSaldoFavor: saldoFavorFuncional }),
			...(reembolsadoFuncional == null ? {} : { montoReembolsado: reembolsadoFuncional }),
			...(params.costoFifo == null ? {} : { costoFifo: params.costoFifo }),
		},
		...(params.referencia ? { referencia: params.referencia } : {}),
	};
}

/**
 * @description Emite el asiento formal de una devolución de venta.
 *
 * El ingreso revertido se compensa con las tres salidas que el writer ya
 * resolvió (cuentas por cobrar, anticipo y reembolso) y la mercadería repuesta
 * reingresa al inventario por su costo FIFO.
 *
 * @param {PostingTx} tx - Transacción Prisma de la devolución.
 * @param {ContextoPosting} ctx - Tenant y usuario que registraron la devolución.
 * @param {DevolucionVentaPostingParams} params - Devolución persistida y su desglose.
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirDevolucionVenta(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: DevolucionVentaPostingParams,
): Promise<PostEventoResult> {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId: ctx.tenantId },
		select: { functionalCurrencyCode: true },
	});
	const functionalCurrency = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;

	return postEvento(
		tx,
		ctx,
		construirEventoDevolucionVenta(params, functionalCurrency),
	);
}
