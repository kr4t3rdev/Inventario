/**
 * @description Recolector de candidatos del replay historico (S7).
 *
 * Reconstruye, a partir de las fuentes operativas ya persistidas, el evento
 * formal que el writer vigente habria emitido en su momento. La regla es
 * conservadora y explicita: el recolector solo propone un asiento cuando puede
 * reconstruirlo con la misma evidencia que uso el writer; ante cualquier
 * duda (identidad ambigua, valoracion funcional no verificable, documento
 * anulado) omite la fuente dejando su causa, en lugar de contabilizar algo que
 * el writer no habria escrito.
 *
 * Alcance actual:
 *
 *  - Ventas de productos: `VENTA_CREDITO` (factura), `VENTA_CONTADO` y
 *    `COBRO_CXC` (conciliacion de venta).
 *  - Pagos de gastos y compras: `PAGO_CXP` (conciliacion de gasto).
 *  - Compras de productos: `COMPRA_CREDITO` (documento de compra).
 *  - Compras de servicios: `GASTO_CREDITO` (compra de servicio).
 *  - Ventas de servicios: `VENTA_SERVICIO_CREDITO` (venta de servicio).
 *
 * @module src/features/contabilidad-formal/services/replay-source-collector
 */
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { FORMA_PAGO_ANTICIPO_PAGO } from '@/lib/constants/anticipos';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { resolverValuacionOperativa } from '../lib/functional-valuation-resolver';
import { buildFunctionalValuation } from '../lib/functional-valuation';
import { derivarMedioCobro } from '../lib/settlement-event-builder';
import { construirEventoLiquidacion } from './settlement-posting-service';
import type { EventoContableInput } from './posting-engine';

/** Cliente Prisma que sirve tanto para lectura como para transaccion. */
export type ReplayDb = typeof prisma | Prisma.TransactionClient;

/** Candidato reconstruido con el evento formal listo para contabilizar. */
export interface CandidatoReplay {
	/** Tipo de origen del evento formal. */
	origenTipo: string;
	/** Identificador del documento que origina el evento. */
	origenId: string;
	/** Fecha de negocio del evento. */
	fecha: Date;
	/** Evento formal reconstruido. */
	evento: EventoContableInput;
	/** Causa de omision, cuando la fuente no puede contabilizarse. */
	causaOmision?: string;
}

/** Origen del reconocimiento de venta a credito: la factura. */
const VENTA_CREDITO_ORIGIN_TYPE = 'factura';

/** Origen del reconocimiento de venta al contado y del cobro: la conciliacion. */
const RECONCILIACION_VENTA_ORIGIN_TYPE = 'reconciliacion_venta';

/** Origen del reconocimiento de compra: el documento de compra. */
const COMPRA_DOCUMENTO_ORIGIN_TYPE = 'compra_documento';

/** Origen del reconocimiento de compra de servicio: la compra de servicio. */
const COMPRA_SERVICIO_ORIGIN_TYPE = 'compra_servicio';

/** Origen del reconocimiento de venta de servicio: la venta de servicio. */
const VENTA_SERVICIO_ORIGIN_TYPE = 'venta_servicio';

/** Formas de pago de una compra que generan reconocimiento formal. */
const FORMAS_PAGO_CON_RECONOCIMIENTO = new Set<string>([
	'PAGO_COMPLETO',
	'PAGO_PARCIAL',
	FORMA_PAGO_ANTICIPO_PAGO,
]);

/** Causa de omision cuando el documento fue anulado. */
const CAUSA_ANULADO = 'DOCUMENTO_ANULADO';

/** Causa de omision cuando no hay valoracion funcional verificable. */
const CAUSA_VALORACION_NO_VERIFICABLE = 'VALORACION_FUNCIONAL_NO_VERIFICABLE';

/** Causa de omision cuando la tasa de cambio no quedo persistida. */
const CAUSA_TASA_NO_PERSISTIDA = 'TASA_CAMBIO_NO_PERSISTIDA';

/**
 * @description Reconstruye los candidatos a replay de un tenant leyendo las
 * fuentes operativas historicas y derivando el evento formal equivalente al
 * que emite el writer vigente.
 *
 * Reglas de clasificacion (conservadoras: ante duda la fuente se omite):
 *
 *  - La factura de una venta a plazo (con cuenta por cobrar) genera
 *    `VENTA_CREDITO`, valorado con la tasa publicada vigente en su fecha de
 *    emision.
 *  - La conciliacion de una venta a plazo liquida esa cuenta por cobrar:
 *    genera `COBRO_CXC` con la valoracion ya persistida.
 *  - La conciliacion de una venta cobrada al contado genera `VENTA_CONTADO`
 *    con la valoracion ya persistida; si la venta tiene mas de una
 *    conciliacion, la fuente se omite por identidad ambigua.
 *  - La conciliacion de gasto que movio la tesoreria genera `PAGO_CXP` con la
 *    valoracion y la descripcion ya persistidas; una conciliacion PENDIENTE
 *    no genera asiento en el writer y aqui tampoco se propone.
 *  - El documento de compra con forma de pago a plazo o a anticipo genera
 *    `COMPRA_CREDITO`; su tasa de cambio no quedo persistida, asi que solo
 *    se propone cuando la moneda de la compra es la funcional del tenant.
 *  - La compra de servicio genera `GASTO_CREDITO` con la tasa publicada
 *    vigente en la fecha del servicio (la misma que resolvio el writer).
 *  - La venta de servicio genera `VENTA_SERVICIO_CREDITO` con la tasa
 *    publicada vigente en su fecha.
 *
 * @param {string} tenantId - Tenant propietario de las fuentes.
 * @param {ReplayDb} client - Cliente Prisma de lectura.
 * @returns {Promise<CandidatoReplay[]>} Candidatos con su fecha de negocio.
 */
export async function recolectarCandidatos(
	tenantId: string,
	client: ReplayDb = prisma,
): Promise<CandidatoReplay[]> {
	const [
		reconciliacionesVenta,
		facturas,
		cuentasPorCobrar,
		cuentasBancarias,
		reconciliacionesGasto,
		compras,
		comprasServicio,
		ventasServicio,
		politica,
	] = await Promise.all([
		client.reconciliacionVenta.findMany({
			where: { tenantId },
			select: {
				reconciliacionId: true,
				ventaId: true,
				cuentaId: true,
				monto: true,
				moneda: true,
				montoConvertido: true,
				functionalCurrency: true,
				tasaCambio: true,
				fxEvidenceFingerprint: true,
				fechaReconciliacion: true,
				observaciones: true,
				idTransferencia: true,
				venta: {
					select: {
						ventaId: true,
						deletedAt: true,
						factura: { select: { idFactura: true } },
					},
				},
			},
		}),
		client.factura.findMany({
			where: { tenantId, tipoDocumento: 'FACTURA' },
			select: {
				idFactura: true,
				ventaId: true,
				total: true,
				estado: true,
				fechaEmision: true,
			},
		}),
		client.cuentaPorCobrar.findMany({
			where: { tenantId },
			select: {
				id: true,
				facturaId: true,
				estado: true,
			},
		}),
		client.cuentaBancaria.findMany({
			where: { tenantId },
			select: { cuentaId: true, tipoCuenta: true },
		}),
		client.reconciliacionGasto.findMany({
			where: { tenantId },
			select: {
				reconciliacionId: true,
				cuentaId: true,
				monto: true,
				moneda: true,
				montoConvertido: true,
				functionalCurrency: true,
				tasaCambio: true,
				fxEvidenceFingerprint: true,
				fechaReconciliacion: true,
				descripcion: true,
				estado: true,
			},
		}),
		client.compraDocumento.findMany({
			where: { tenantId },
			select: {
				compraDocumentoId: true,
				fechaCompra: true,
				total: true,
				moneda: true,
				formaPago: true,
				deletedAt: true,
			},
		}),
		client.compraServicio.findMany({
			where: { tenantId },
			select: {
				compraServicioId: true,
				fechaServicio: true,
				total: true,
				moneda: true,
				servicio: { select: { moneda: true } },
			},
		}),
		client.ventaServicios.findMany({
			where: { tenantId },
			select: {
				ventaServicioId: true,
				total: true,
				moneda: true,
				createdAt: true,
			},
		}),
		client.tenantAccountingPolicy.findUnique({
			where: { tenantId },
			select: { functionalCurrencyCode: true },
		}),
	]);

	const tipoCuentaPorCuenta = new Map(
		cuentasBancarias.map((cuenta) => [cuenta.cuentaId, cuenta.tipoCuenta]),
	);
	const cxPorFactura = new Map(
		cuentasPorCobrar
			.filter((cuenta) => cuenta.facturaId !== null)
			.map((cuenta) => [cuenta.facturaId as string, cuenta]),
	);
	const monedaFuncional = politica?.functionalCurrencyCode?.trim().toUpperCase() || null;

	/**
	 * @description Resuelve la cuenta por cobrar de una factura.
	 * @param {string | null} facturaId - Identificador de la factura.
	 * @returns {object | undefined} Cuenta por cobrar vigente de la factura.
	 */
	const cuentaPorCobrarDe = (
		facturaId: string | null,
	): { id: string; facturaId: string | null; estado: string } | undefined =>
		facturaId ? cxPorFactura.get(facturaId) : undefined;

	const reconciliacionesPorVenta = new Map<string, typeof reconciliacionesVenta>();
	for (const reconciliacion of reconciliacionesVenta) {
		if (!reconciliacion.ventaId) continue;
		const lista = reconciliacionesPorVenta.get(reconciliacion.ventaId) ?? [];
		lista.push(reconciliacion);
		reconciliacionesPorVenta.set(reconciliacion.ventaId, lista);
	}

	const candidatos: CandidatoReplay[] = [];

	// --- Ventas de productos -------------------------------------------------

	for (const reconciliacion of reconciliacionesVenta) {
		const venta = reconciliacion.venta;
		if (!reconciliacion.ventaId || !venta) continue;
		// Las ventas directas (sin factura) no tienen contraparte formal en el
		// flujo vigente: no se inventa un asiento que el writer no emitio.
		const facturaId = venta.factura?.idFactura ?? null;
		if (!facturaId) continue;

		const cuentaPorCobrar = cuentaPorCobrarDe(facturaId);
		const esVentaAPlazo = Boolean(cuentaPorCobrar) && cuentaPorCobrar?.estado !== 'ANULADA';
		const tipoCuenta = tipoCuentaPorCuenta.get(reconciliacion.cuentaId) ?? null;
		const omision = venta.deletedAt
			? 'VENTA_ANULADA'
			: reconciliacionesPorVenta.get(reconciliacion.ventaId)!.length > 1 && !esVentaAPlazo
				? 'IDENTIDAD_AMBIGUA'
				: undefined;

		let evento: EventoContableInput;
		if (esVentaAPlazo) {
			const liquidacion = await construirEventoLiquidacion(
				client as Prisma.TransactionClient,
				{ tenantId, userId: 'replay-preflight' },
				{
					tipo: 'COBRO_CXC',
					reconciliacion: {
						reconciliacionId: reconciliacion.reconciliacionId,
						monto: reconciliacion.monto,
						moneda: reconciliacion.moneda,
						montoConvertido: reconciliacion.montoConvertido,
						functionalCurrency: reconciliacion.functionalCurrency,
						tasaCambio: reconciliacion.tasaCambio,
						fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
						fechaReconciliacion: reconciliacion.fechaReconciliacion,
					},
					treasuryAccountType: tipoCuenta,
					descripcion: reconciliacion.observaciones ?? 'Cobro de venta',
				},
			);
			evento = liquidacion;
		} else {
			evento = {
				tipo: 'VENTA_CONTADO',
				fecha: reconciliacion.fechaReconciliacion,
				descripcion: reconciliacion.observaciones ?? 'Cobro total por contra pago',
				origen: {
					tipo: RECONCILIACION_VENTA_ORIGIN_TYPE,
					id: reconciliacion.reconciliacionId,
				},
				monto: reconciliacion.monto,
				moneda: reconciliacion.moneda,
				montoFuncional: reconciliacion.montoConvertido,
				monedaFuncional: reconciliacion.functionalCurrency,
				tasaCambio: reconciliacion.tasaCambio,
				fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
				medioCobro: derivarMedioCobro(tipoCuenta),
				...(reconciliacion.idTransferencia
					? { referencia: reconciliacion.idTransferencia }
					: {}),
			};
		}

		candidatos.push({
			origenTipo: evento.origen.tipo,
			origenId: evento.origen.id,
			fecha: evento.fecha,
			evento,
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	for (const factura of facturas) {
		if (!factura.ventaId) continue;
		const cuentaPorCobrar = cuentaPorCobrarDe(factura.idFactura);
		// Sin cuenta por cobrar la venta se cobro al contado: su reconocimiento
		// es el evento del cobro, no uno de la factura.
		if (!cuentaPorCobrar || cuentaPorCobrar.estado === 'ANULADA') continue;

		const monto = Math.abs(Number(factura.total));
		const valoracion = await resolverValuacionOperativa({
			tx: client as Prisma.TransactionClient,
			tenantId,
			monto,
			moneda: 'CUP',
			fechaOperacion: factura.fechaEmision,
			source: 'replay-backfill-service',
		});
		const omision = factura.estado === 'ANULADA'
			? 'FACTURA_ANULADA'
			: valoracion.montoFuncional === null && valoracion.monedaFuncional !== 'CUP'
				? CAUSA_VALORACION_NO_VERIFICABLE
				: undefined;
		candidatos.push({
			origenTipo: VENTA_CREDITO_ORIGIN_TYPE,
			origenId: factura.idFactura,
			fecha: factura.fechaEmision,
			evento: {
				tipo: 'VENTA_CREDITO',
				fecha: factura.fechaEmision,
				descripcion: `Venta a credito ${factura.idFactura}`,
				origen: { tipo: VENTA_CREDITO_ORIGIN_TYPE, id: factura.idFactura },
				monto,
				moneda: 'CUP',
				montoFuncional: valoracion.montoFuncional,
				monedaFuncional: valoracion.monedaFuncional,
				tasaCambio: valoracion.tasaCambio,
				fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
			},
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	// --- Pagos de gastos y compras -------------------------------------------

	for (const reconciliacion of reconciliacionesGasto) {
		// El writer solo emite cuando el pago mueve la tesoreria: una
		// conciliacion PENDIENTE no descuenta el banco y no genera asiento.
		if (reconciliacion.estado === 'PENDIENTE') continue;
		const tipoCuenta = tipoCuentaPorCuenta.get(reconciliacion.cuentaId) ?? null;
		const evento = await construirEventoLiquidacion(
			client as Prisma.TransactionClient,
			{ tenantId, userId: 'replay-preflight' },
			{
				tipo: 'PAGO_CXP',
				reconciliacion: {
					reconciliacionId: reconciliacion.reconciliacionId,
					monto: reconciliacion.monto,
					moneda: reconciliacion.moneda,
					montoConvertido: reconciliacion.montoConvertido,
					functionalCurrency: reconciliacion.functionalCurrency,
					tasaCambio: reconciliacion.tasaCambio,
					fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
					fechaReconciliacion: reconciliacion.fechaReconciliacion,
				},
				treasuryAccountType: tipoCuenta,
				descripcion: reconciliacion.descripcion,
			},
		);
		const omision = evento.montoFuncional === null && evento.monedaFuncional !== evento.moneda
			? CAUSA_VALORACION_NO_VERIFICABLE
			: undefined;
		candidatos.push({
			origenTipo: evento.origen.tipo,
			origenId: evento.origen.id,
			fecha: evento.fecha,
			evento,
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	// --- Compras de productos ------------------------------------------------

	for (const compra of compras) {
		if (!FORMAS_PAGO_CON_RECONOCIMIENTO.has(compra.formaPago)) continue;
		const moneda = (compra.moneda ?? 'CUP').trim().toUpperCase();
		const monto = Math.abs(Number(compra.total));
		const valoracion = buildFunctionalValuation({
			monto,
			moneda,
			functionalCurrency: monedaFuncional,
			tasaCambio: undefined,
			fechaOperacion: compra.fechaCompra,
			source: 'purchase-posting-service',
		});
		const omision = compra.deletedAt
			? CAUSA_ANULADO
			: moneda !== monedaFuncional
				? CAUSA_TASA_NO_PERSISTIDA
				: valoracion.sameCurrency
					? undefined
					: CAUSA_VALORACION_NO_VERIFICABLE;
		candidatos.push({
			origenTipo: COMPRA_DOCUMENTO_ORIGIN_TYPE,
			origenId: compra.compraDocumentoId,
			fecha: compra.fechaCompra,
			evento: {
				tipo: 'COMPRA_CREDITO',
				fecha: compra.fechaCompra,
				descripcion: `Reconocimiento de compra ${compra.compraDocumentoId}`,
				origen: { tipo: COMPRA_DOCUMENTO_ORIGIN_TYPE, id: compra.compraDocumentoId },
				monto,
				moneda,
				montoFuncional: valoracion.sameCurrency ? monto : valoracion.montoConvertido,
				monedaFuncional: monedaFuncional,
				tasaCambio: valoracion.tasaCambio,
				fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
			},
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	// --- Compras de servicios ------------------------------------------------

	for (const compra of comprasServicio) {
		const moneda = (compra.servicio.moneda ?? compra.moneda ?? 'CUP').trim().toUpperCase();
		const monto = Math.abs(Number(compra.total));
		const tasa = moneda !== monedaFuncional
			? await exchangeRateProvider.getRateAsOf({
					sourceCurrency: moneda,
					targetCurrency: monedaFuncional ?? 'CUP',
					boundaryAt: compra.fechaServicio,
					client: client as Prisma.TransactionClient,
				})
			: null;
		const valoracion = buildFunctionalValuation({
			monto,
			moneda,
			functionalCurrency: monedaFuncional,
			tasaCambio: tasa?.tasa,
			fechaOperacion: compra.fechaServicio,
			fechaTasa: tasa?.fechaVigencia,
			fxCatalogRateId: tasa?.tasaId,
			source: 'service-purchase-posting-service',
		});
		const omision = valoracion.sameCurrency
			? undefined
			: valoracion.montoConvertido === null
				? CAUSA_VALORACION_NO_VERIFICABLE
				: undefined;
		candidatos.push({
			origenTipo: COMPRA_SERVICIO_ORIGIN_TYPE,
			origenId: compra.compraServicioId,
			fecha: compra.fechaServicio,
			evento: {
				tipo: 'GASTO_CREDITO',
				fecha: compra.fechaServicio,
				descripcion: `Reconocimiento de servicio recibido ${compra.compraServicioId}`,
				origen: { tipo: COMPRA_SERVICIO_ORIGIN_TYPE, id: compra.compraServicioId },
				monto,
				moneda,
				montoFuncional: valoracion.sameCurrency ? monto : valoracion.montoConvertido,
				monedaFuncional: monedaFuncional,
				tasaCambio: valoracion.tasaCambio,
				fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
			},
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	// --- Ventas de servicios -------------------------------------------------

	for (const venta of ventasServicio) {
		const monto = Math.abs(Number(venta.total));
		// El writer omite el evento cuando el monto no es positivo.
		if (!Number.isFinite(monto) || monto <= 0) continue;
		const moneda = (venta.moneda ?? 'CUP').trim().toUpperCase();
		const valoracion = await resolverValuacionOperativa({
			tx: client as Prisma.TransactionClient,
			tenantId,
			monto,
			moneda,
			fechaOperacion: venta.createdAt,
			source: 'service-sale-posting-service',
		});
		const omision = valoracion.montoFuncional === null && valoracion.monedaFuncional !== moneda
			? CAUSA_VALORACION_NO_VERIFICABLE
			: undefined;
		candidatos.push({
			origenTipo: VENTA_SERVICIO_ORIGIN_TYPE,
			origenId: venta.ventaServicioId,
			fecha: venta.createdAt,
			evento: {
				tipo: 'VENTA_SERVICIO_CREDITO',
				fecha: venta.createdAt,
				descripcion: `Venta de servicio ${venta.ventaServicioId}`,
				origen: { tipo: VENTA_SERVICIO_ORIGIN_TYPE, id: venta.ventaServicioId },
				monto,
				moneda,
				montoFuncional: valoracion.montoFuncional,
				monedaFuncional: valoracion.monedaFuncional,
				tasaCambio: valoracion.tasaCambio,
				fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
			},
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	candidatos.sort((left, right) => {
		const porFecha = left.fecha.getTime() - right.fecha.getTime();
		if (porFecha !== 0) return porFecha;
		if (left.origenTipo !== right.origenTipo) {
			return left.origenTipo < right.origenTipo ? -1 : 1;
		}
		return left.origenId < right.origenId ? -1 : left.origenId > right.origenId ? 1 : 0;
	});
	return candidatos;
}
