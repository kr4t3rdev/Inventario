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
 *  - Devoluciones de venta: `DEVOLUCION_VENTA` (devolucion registrada), con el
 *    desglose y el costo FIFO repuesto que el writer persistio.
 *  - Ajustes bancarios: `AJUSTE_BANCARIO_ABONO` / `AJUSTE_BANCARIO_CARGO`.
 *  - Inyecciones de capital: `INYECCION_CAPITAL` / `DEUDA_RECIBIDA`.
 *
 * @module src/features/contabilidad-formal/services/replay-source-collector
 */
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { FORMA_PAGO_ANTICIPO_PAGO } from '@/lib/constants/anticipos';
import { resolveAppliedReconciliationAmount } from '@/features/contabilidad/domain/applied-reconciliation-amount';
import { verifyAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { resolverValuacionOperativa } from '../lib/functional-valuation-resolver';
import {
	buildReplayManifestEvidence,
	type ReplayCollectorQueryId,
} from './replay-source-manifest';
import { buildFunctionalValuation } from '../lib/functional-valuation';
import { buildAnticipoEvent } from '../lib/advance-event-builder';
import { buildCashPaymentEvent } from '../lib/cash-payment-event-builder';
import { cashPaymentAllocationFingerprint } from '../lib/cash-payment-allocation-fingerprint';
import { getCostoFifoVentaValorado } from '@/lib/services/fifo-allocation';
import type { TipoEventoClave } from '../lib/plan-default';
import { derivarMedioCobro } from '../lib/settlement-event-builder';
import { construirEventoLiquidacion } from './settlement-posting-service';
import {
	construirEventoAjusteBancario,
	construirEventoInyeccionCapital,
	AJUSTE_BANCARIO_ORIGIN_TYPE,
	INYECCION_CAPITAL_ORIGIN_TYPE,
} from './capital-adjustment-posting-service';
import {
	construirEventoDevolucionVenta,
	DEVOLUCION_VENTA_ORIGIN_TYPE,
} from './sale-return-posting-service';
import {
	construirEventoDevolucionCompra,
	DEVOLUCION_COMPRA_ORIGIN_TYPE,
} from './supplier-return-posting-service';
import type { EventoContableInput } from './posting-engine';

/** Cliente Prisma que sirve tanto para lectura como para transaccion. */
export type ReplayDb = typeof prisma | Prisma.TransactionClient;

const QUERY_ID_BY_MODEL = {
	reconciliacionVenta: 'reconciliacionVenta',
	reconciliacionServicio: 'reconciliacionServicio',
	transferenciaBancaria: 'transferenciaBancaria',
	factura: 'factura',
	cuentaPorCobrar: 'cuentaPorCobrar',
	cuentaBancaria: 'cuentaBancaria',
	reconciliacionGasto: 'reconciliacionGasto',
	compraDocumento: 'compraDocumento',
	compraServicio: 'compraServicio',
	ventaServicios: 'ventaServicios',
	anticipoMovimiento: 'anticipoMovimiento',
	devolucionVenta: 'devolucionVenta',
	devolucionCompra: 'devolucionCompra',
	ajusteBancario: 'ajusteBancario',
	inyeccionCapital: 'inyeccionCapital',
	deudaCash: 'deudaCash',
	prestamoCash: 'prestamoCash',
	ajusteInventario: 'ajusteInventarioMerma',
	asiento: 'asientoMerma',
	cuentaRolTenant: 'cuentaRolTenantMerma',
	fxEvidence: 'fxEvidenceMermaReversada',
	tenantAccountingPolicy: 'tenantAccountingPolicy',
	venta: 'ventaConCosto',
	ordenProduccion: 'ordenProduccion',
} as const satisfies Record<string, ReplayCollectorQueryId>;

/**
 * @description Observes source-query model operations without changing the Prisma client.
 * @param {ReplayDb} db - Prisma client used by the collector.
 * @param {(queryId: ReplayCollectorQueryId) => void} onQuery - Query evidence sink.
 * @returns {ReplayDb} Prisma proxy that records invoked source queries.
 */
function trackSourceQueries(
	db: ReplayDb,
	onQuery: (queryId: ReplayCollectorQueryId) => void,
): ReplayDb {
	return new Proxy(db, {
		get(target, model, receiver) {
			const delegate = Reflect.get(target, model, receiver);
			const queryId = QUERY_ID_BY_MODEL[String(model) as keyof typeof QUERY_ID_BY_MODEL];
			if (!queryId || !delegate || typeof delegate !== 'object') return delegate;
			return new Proxy(delegate, {
				get(queryTarget, method, queryReceiver) {
					const operation = Reflect.get(queryTarget, method, queryReceiver);
					if ((method !== 'findMany' && method !== 'findUnique') ||
						typeof operation !== 'function') return operation;
					return (...args: unknown[]) => {
						const result = Reflect.apply(operation, queryTarget, args);
						onQuery(queryId);
						return result;
					};
				},
			});
		},
	});
}

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
 * @description Deriva la diferencia de cambio residual de un movimiento de
 * anticipo a partir de los dos valores funcionales que el movimiento persiste.
 * @param {object} movimiento - Movimiento de anticipo persistido.
 * @returns {number | undefined} Diferencia residual; undefined si falta un valor.
 */
function diferenciaFxPersistida(movimiento: {
	valorAnticipoFuncional: Prisma.Decimal | null;
	valorTesoreriaFuncional: Prisma.Decimal | null;
}): number | undefined {
	if (
		movimiento.valorAnticipoFuncional === null ||
		movimiento.valorTesoreriaFuncional === null
	) {
		return undefined;
	}
	return (
		Number(movimiento.valorTesoreriaFuncional) - Number(movimiento.valorAnticipoFuncional)
	);
}

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
 *  - La devolucion de venta registrada genera `DEVOLUCION_VENTA` con el
 *    desglose persistido (cuentas por cobrar, saldo a favor y reembolso) y el
 *    costo FIFO repuesto ya valorado; una devolucion anulada se omite.
 *  - El ajuste bancario genera `AJUSTE_BANCARIO_ABONO` o
 *    `AJUSTE_BANCARIO_CARGO` con la tasa que persistio.
 *  - La inyeccion de capital genera `INYECCION_CAPITAL` o `DEUDA_RECIBIDA` con
 *    la tasa y el importe convertido que persistio.
 *
 * @param {string} tenantId - Tenant propietario de las fuentes.
 * @param {ReplayDb} client - Cliente Prisma de lectura.
 * @returns {Promise<CandidatoReplay[]>} Candidatos con su fecha de negocio.
 */
export async function recolectarCandidatos(
	tenantId: string,
	db: ReplayDb = prisma,
	onQueryExecuted: (queryId: ReplayCollectorQueryId) => void = () => undefined,
): Promise<CandidatoReplay[]> {
	const executedQueryIds = new Set<ReplayCollectorQueryId>();
	let client = trackSourceQueries(db, (queryId) => {
		executedQueryIds.add(queryId);
		onQueryExecuted(queryId);
	});
	const [
		reconciliacionesVenta,
		reconciliacionesServicio,
		transferenciasBancarias,
		facturas,
		cuentasPorCobrar,
		cuentasBancarias,
		reconciliacionesGasto,
		compras,
		comprasServicio,
		ventasServicio,
		movimientosAnticipo,
		devolucionesVenta,
		devolucionesCompra,
		ajustesBancarios,
		inyeccionesCapital,
		deudasCash,
		prestamosCash,
		ajustesMerma,
		originalesMerma,
		rolesMerma,
		fxReversosMerma,
		politica,
		ventasConCosto,
		ordenesProduccion,
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
				rateEffectiveAt: true,
				fxProvenanceKind: true,
				fxProvenanceSource: true,
				fxCatalogRateId: true,
				fxEvidenceVersion: true,
				fechaReconciliacion: true,
				observaciones: true,
				idTransferencia: true,
				deudaCashId: true,
				prestamoCashId: true,
				idempotencyKey: true,
				tipoReconciliacion: true,
				cashInterestAllocation: { include: { asiento: {
					select: { tenantId: true, origenTipo: true, origenId: true },
				} } },
				venta: {
					select: {
						ventaId: true,
						deletedAt: true,
						factura: { select: { idFactura: true } },
					},
				},
			},
		}),
		client.reconciliacionServicio.findMany({
			where: { tenantId },
			select: {
				reconciliacionId: true,
				ventaServicioId: true,
				cuentaId: true,
				monto: true,
				moneda: true,
				montoConvertido: true,
				functionalCurrency: true,
				tasaCambio: true,
				fxEvidenceFingerprint: true,
				rateEffectiveAt: true,
				fxProvenanceKind: true,
				fxProvenanceSource: true,
				fxCatalogRateId: true,
				fxEvidenceVersion: true,
				fechaReconciliacion: true,
				observaciones: true,
			},
		}),
		client.transferenciaBancaria.findMany({
			where: { tenantId },
			select: {
				transferenciaId: true,
				tenantId: true,
				numeroComprobante: true,
				cuentaOrigenId: true,
				cuentaDestinoId: true,
				montoOrigen: true,
				monedaOrigen: true,
				montoDestino: true,
				monedaDestino: true,
				tasaCambio: true,
				motivo: true,
				descripcion: true,
				fechaTransferencia: true,
				existe: true,
				cuentaOrigen: { select: { cuentaId: true, tenantId: true, moneda: true } },
				cuentaDestino: { select: { cuentaId: true, tenantId: true, moneda: true } },
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
		client.anticipoMovimiento.findMany({
			where: { anticipo: { tenantId } },
			select: {
				movimientoId: true,
				tipoMovimiento: true,
				cuentaId: true,
				monto: true,
				moneda: true,
				tasaAplicada: true,
				montoFuncional: true,
				functionalCurrency: true,
				fxEvidenceFingerprint: true,
				valorAnticipoFuncional: true,
				valorTesoreriaFuncional: true,
				createdAt: true,
				anticipo: { select: { tipo: true, referenciaExterna: true } },
			},
		}),
		client.devolucionVenta.findMany({
			where: { tenantId },
			select: {
				devolucionId: true,
				ventaId: true,
				estado: true,
				total: true,
				moneda: true,
				tasaCambio: true,
				montoAplicadoCxc: true,
				montoSaldoFavor: true,
				montoReembolsado: true,
				costoFifoFuncional: true,
				idempotencyKey: true,
				createdAt: true,
			},
		}),
		client.devolucionCompra.findMany({
			where: { tenantId },
			select: {
				devolucionId: true,
				estado: true,
				montoTotal: true,
				montoImputado: true,
				montoImputadoFuncional: true,
				saldoAFavor: true,
				moneda: true,
				idempotencyKey: true,
				createdAt: true,
				completadaAt: true,
				compraDocumento: {
					select: { cuentaPorPagar: { select: { tasaCambio: true } } },
				},
			},
		}),
		client.ajusteBancario.findMany({
			where: { tenantId },
			select: {
				ajusteId: true,
				tipo: true,
				monto: true,
				moneda: true,
				tasaCambio: true,
				descripcion: true,
				idempotencyKey: true,
				fechaOperacion: true,
			},
		}),
		client.inyeccionCapital.findMany({
			where: { tenantId },
			select: {
				id: true,
				tipo: true,
				montoRecibido: true,
				moneda: true,
				tasaCambio: true,
				descripcion: true,
				idempotencyKey: true,
				fechaRegistro: true,
			},
		}),
		client.deudaCash.findMany({
			where: { tenantId },
			select: {
				id: true, tenantId: true, proveedorId: true, montoCapital: true, moneda: true,
				observaciones: true, deletedAt: true, cashInterestGrantDate: true, createdAt: true,
			},
		}),
		client.prestamoCash.findMany({
			where: { tenantId },
			select: {
				id: true, tenantId: true, clienteId: true, montoCapital: true, moneda: true,
				observaciones: true, deletedAt: true, cashInterestGrantDate: true, fechaOtorgamiento: true,
			},
		}),
		client.ajusteInventario.findMany({
			where: { tenantId, origenMermaId: { not: null } },
			select: { id: true, tenantId: true, origenMermaId: true, estado: true, costoTotal: true, createdAt: true,
				mermaReversionFecha: true, mermaReversionRegistradaAt: true },
		}),
		client.asiento.findMany({ where: { tenantId, origenTipo: 'ajuste_merma' },
			select: { origenId: true, fecha: true, estado: true, lineas: { select: {
				cuentaId: true, debe: true, haber: true, monedaOriginal: true, montoOriginal: true, tasaCambio: true,
				fxEvidenceFingerprint: true,
			} } } }),
		client.cuentaRolTenant.findMany({ where: { tenantId, rol: { in: ['MERMAS', 'INVENTARIOS'] } },
			select: { rol: true, cuentaId: true } }),
		client.fxEvidence.findMany({ where: { tenantId, sourceType: 'ajuste_merma_reversado' } }),
		client.tenantAccountingPolicy.findUnique({
			where: { tenantId },
			select: { functionalCurrencyCode: true },
		}),
			client.venta.findMany({
			where: {
				tenantId,
				deletedAt: null,
				estado: { in: ['ENTREGADA', 'FACTURADA'] },
				items: { some: {} },
			},
			select: {
				ventaId: true,
				estado: true,
				createdAt: true,
				costoVentaFecha: true,
				items: { select: { cantidad: true, productoId: true, allocations: { select: {
					cantidad: true,
					compraDocumentoItemId: true,
					recepcionItemId: true,
					purchaseReceiptInvoiceAllocationId: true,
					costoUnitarioSnapshot: true,
					fifoMonedaOrigen: true,
					fifoFechaFuente: true,
					fifoMonedaFuncional: true,
					fifoCostoFuncional: true,
					fifoEvidenciaFx: true,
					purchaseReceiptInvoiceAllocation: { select: {
						id: true, tenantId: true, compraDocumentoItemId: true, recepcionItemId: true,
						cantidad: true, costoUnitarioSnapshot: true, fifoMonedaOrigen: true,
						fifoFechaFuente: true, fifoMonedaFuncional: true, fifoCostoFuncional: true,
						fifoEvidenciaFx: true,
						compraDocumentoItem: { select: {
							compraDocumentoItemId: true, tenantId: true, productoId: true,
							compraDocumento: { select: { tenantId: true, estado: true, deletedAt: true } },
						} },
					} },
					compraDocumentoItem: { select: {
						compraDocumentoItemId: true,
						tenantId: true,
						productoId: true,
						compraDocumento: { select: { tenantId: true, estado: true, deletedAt: true } },
					} },
				} } } } },
			}),
			client.ordenProduccion.findMany({
				where: { tenantId, estado: 'COMPLETADA', fechaContabilizacion: { not: null } },
				select: {
					ordenProduccionId: true,
					tenantId: true,
					fechaContabilizacion: true,
					costoMateriales: true,
				},
			}),
		]);
	client = db;
	const tipoCuentaPorCuenta = new Map(
		cuentasBancarias.map((cuenta) => [cuenta.cuentaId, cuenta.tipoCuenta]),
	);
	const cxPorFactura = new Map(
		cuentasPorCobrar
			.filter((cuenta) => cuenta.facturaId !== null)
			.map((cuenta) => [cuenta.facturaId as string, cuenta]),
	);
	const monedaFuncional = politica?.functionalCurrencyCode?.trim().toUpperCase() || null;
	const candidatosMerma: CandidatoReplay[] = ajustesMerma.map((ajuste) => {
		const monto = Math.abs(Number(ajuste.costoTotal));
		const duplicado = ajustesMerma.some((otro) => otro.id !== ajuste.id && otro.estado === 'APLICADO' &&
			ajuste.estado === 'APLICADO' && otro.origenMermaId === ajuste.origenMermaId);
		const causa = ajuste.tenantId !== tenantId || !ajuste.origenMermaId ? 'IDENTIDAD_NO_VERIFICABLE' :
			ajuste.estado !== 'APLICADO' ? CAUSA_ANULADO : duplicado ? 'IDENTIDAD_AMBIGUA' :
			!Number.isFinite(monto) || monto <= 0 ? 'MONTO_NO_POSITIVO' :
			monedaFuncional !== 'CUP' ? CAUSA_VALORACION_NO_VERIFICABLE : undefined;
		const valoracion = Number.isFinite(monto) && monto > 0 && monedaFuncional === 'CUP' ? buildFunctionalValuation({ monto, moneda: 'CUP', functionalCurrency: monedaFuncional,
			fechaOperacion: ajuste.createdAt, fechaTasa: ajuste.createdAt, source: 'inventory-adjustment-posting-service' }) : null;
		return { origenTipo: 'ajuste_merma', origenId: ajuste.id, fecha: ajuste.createdAt,
			evento: { tipo: 'MERMA_INVENTARIO', fecha: ajuste.createdAt,
				descripcion: `Reconocimiento de merma ${ajuste.id}`, origen: { tipo: 'ajuste_merma', id: ajuste.id },
				monto, moneda: 'CUP', montoFuncional: monedaFuncional === 'CUP' ? monto : null,
				monedaFuncional, tasaCambio: valoracion?.tasaCambio ?? null, fxEvidenceFingerprint: valoracion?.fxEvidenceFingerprint ?? null },
			...(causa ? { causaOmision: causa } : {}) };
	});
	for (const ajuste of ajustesMerma) {
		const fecha = ajuste.mermaReversionFecha;
		if (!fecha) continue;
		const monto = Math.abs(Number(ajuste.costoTotal));
		const original = originalesMerma.find((asiento) => asiento.origenId === ajuste.id);
		const cuentaMerma = rolesMerma.find((rol) => rol.rol === 'MERMAS')?.cuentaId;
		const cuentaInventario = rolesMerma.find((rol) => rol.rol === 'INVENTARIOS')?.cuentaId;
		const registrosFx = fxReversosMerma.filter((item) => item.sourceId === ajuste.id);
		const fx = registrosFx.length === 1 ? registrosFx[0] : null;
		const detalleFx = fx?.evidence && typeof fx.evidence === 'object' && !Array.isArray(fx.evidence)
			? fx.evidence as Prisma.JsonObject : null;
		const montoSinRedondear = typeof detalleFx?.rawConvertedAmount === 'number'
			? detalleFx.rawConvertedAmount : null;
		const tasaSinRedondear = typeof detalleFx?.rawExchangeRate === 'number' ? detalleFx.rawExchangeRate : null;
		const fxValido = Boolean(fx && fx.tenantId === tenantId && fx.originalCurrency === 'CUP' &&
			fx.functionalCurrency === monedaFuncional && fx.source === 'inventory-adjustment-posting-service' &&
			fx.originalAmount.equals(monto) && fx.cutoffAt.getTime() === ajuste.createdAt.getTime() &&
			montoSinRedondear !== null && Number.isFinite(montoSinRedondear) &&
			tasaSinRedondear !== null && Number.isFinite(tasaSinRedondear) &&
			new Prisma.Decimal(montoSinRedondear).toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP).equals(fx.functionalAmount) &&
			new Prisma.Decimal(tasaSinRedondear).toDecimalPlaces(10, Prisma.Decimal.ROUND_HALF_UP).equals(fx.exchangeRate) &&
			fx.rateEffectiveAt <= fx.cutoffAt && verifyAppliedFxEvidence({ originalAmount: monto,
				originalCurrency: fx.originalCurrency, functionalCurrency: fx.functionalCurrency,
				convertedAmount: montoSinRedondear, exchangeRate: tasaSinRedondear,
				rateEffectiveAt: fx.rateEffectiveAt, fxProvenanceKind: fx.provenance, fxProvenanceSource: fx.source,
				fxCatalogRateId: fx.fxCatalogRateId, fxEvidenceFingerprint: fx.evidenceFingerprint,
				fxEvidenceVersion: fx.evidenceVersion }));
		const valorFuncional = monedaFuncional === 'CUP' ? monto : fxValido ? montoSinRedondear : null;
		const importe = new Prisma.Decimal(valorFuncional ?? 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
		const importeOriginal = new Prisma.Decimal(monto);
		const lineaValida = (cuentaId: string | undefined, lado: 'debe' | 'haber') =>
			Boolean(cuentaId && original?.lineas.some((linea) => linea.cuentaId === cuentaId &&
				linea[lado].equals(importe) && linea[lado === 'debe' ? 'haber' : 'debe'].isZero() &&
				linea.monedaOriginal === 'CUP' && linea.montoOriginal.equals(importeOriginal) &&
				(monedaFuncional === 'CUP' ? (linea.tasaCambio === null || linea.tasaCambio.equals(1)) :
					Boolean(fx && linea.tasaCambio?.equals(fx.exchangeRate) && linea.fxEvidenceFingerprint === fx.evidenceFingerprint))));
		const originalValido = original?.estado === 'CONTABILIZADO' &&
			original.fecha.getTime() === ajuste.createdAt.getTime() && original.lineas.length === 2 &&
			cuentaMerma !== cuentaInventario && lineaValida(cuentaMerma, 'debe') && lineaValida(cuentaInventario, 'haber');
		if (monedaFuncional !== 'CUP' && fxValido && fx && originalValido) {
			const indice = candidatosMerma.findIndex((item) => item.origenTipo === 'ajuste_merma' && item.origenId === ajuste.id);
			if (indice >= 0) {
				const candidatoOriginal = candidatosMerma[indice];
				candidatosMerma[indice] = { ...candidatoOriginal, evento: { ...candidatoOriginal.evento,
					montoFuncional: valorFuncional, tasaCambio: tasaSinRedondear,
					fxEvidenceFingerprint: fx.evidenceFingerprint } };
			}
		}
		const causa = ajuste.tenantId !== tenantId || !ajuste.origenMermaId || ajuste.estado !== 'ANULADO' ||
			!ajuste.mermaReversionRegistradaAt || ajuste.mermaReversionRegistradaAt.getTime() !== fecha.getTime() ||
			fecha < ajuste.createdAt ? 'REVERSION_NO_VERIFICABLE' :
			!Number.isFinite(monto) || monto <= 0 ? 'MONTO_NO_POSITIVO' :
			valorFuncional === null ? CAUSA_VALORACION_NO_VERIFICABLE :
			!originalValido ? 'ORIGINAL_NO_VERIFICABLE' : undefined;
		const valoracion = !causa && monedaFuncional === 'CUP' ? buildFunctionalValuation({ monto, moneda: 'CUP', functionalCurrency: monedaFuncional,
			fechaOperacion: fecha, fechaTasa: ajuste.createdAt, source: 'inventory-adjustment-posting-service' }) : null;
		candidatosMerma.push({ origenTipo: 'ajuste_merma_reversado', origenId: ajuste.id, fecha,
			evento: { tipo: 'MERMA_INVENTARIO_REVERSADA', fecha, descripcion: `Reversión de merma ${ajuste.id}`,
				origen: { tipo: 'ajuste_merma_reversado', id: ajuste.id }, monto, moneda: 'CUP',
				montoFuncional: valorFuncional, monedaFuncional,
				tasaCambio: valoracion?.tasaCambio ?? (fxValido ? tasaSinRedondear : null),
				fxEvidenceFingerprint: valoracion?.fxEvidenceFingerprint ?? (fxValido && fx ? fx.evidenceFingerprint : null) },
			...(causa ? { causaOmision: causa } : {}) });
	}

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

	const candidatos: CandidatoReplay[] = [...candidatosMerma];

	for (const orden of ordenesProduccion) {
		const fecha = orden.fechaContabilizacion;
		if (!fecha || orden.tenantId !== tenantId) continue;
		const monto = Math.abs(Number(orden.costoMateriales));
		const valoracion = Number.isFinite(monto) && monto > 0
			? await resolverValuacionOperativa({
				tx: client as Prisma.TransactionClient,
				tenantId,
				monto,
				moneda: 'CUP',
				fechaOperacion: fecha,
				source: 'inventory-adjustment-posting-service',
			})
			: null;
		const omision = !Number.isFinite(monto) || monto <= 0
			? 'MONTO_NO_POSITIVO'
			: !valoracion?.monedaFuncional || valoracion.montoFuncional === null
				? CAUSA_VALORACION_NO_VERIFICABLE
				: undefined;
		candidatos.push({
			origenTipo: 'orden_produccion',
			origenId: orden.ordenProduccionId,
			fecha,
			evento: {
				tipo: 'PRODUCCION_SALIDA',
				fecha,
				descripcion: `Reclasificación de costo de producción ${orden.ordenProduccionId}`,
				origen: { tipo: 'orden_produccion', id: orden.ordenProduccionId },
				monto,
				moneda: 'CUP',
				montoFuncional: valoracion?.montoFuncional ?? null,
				monedaFuncional: valoracion?.monedaFuncional ?? null,
				tasaCambio: valoracion?.tasaCambio ?? null,
				fxEvidenceFingerprint: valoracion?.fxEvidenceFingerprint ?? null,
			},
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	for (const venta of ventasConCosto) {
		// La fecha efectiva del devengo la persiste el writer; sin ella no se
		// puede atribuir el costo a un periodo y la fuente queda omitida.
		const fecha = venta.costoVentaFecha ?? venta.createdAt;
		const asignaciones = venta.items.flatMap((item) => item.allocations.map((asignacion) => ({
			...asignacion,
			productoIdVenta: item.productoId,
		})));
		const cantidadEsperada = venta.items.reduce((total, item) => total + item.cantidad, 0);
		const cantidadAsignada = asignaciones.reduce((total, item) => total + item.cantidad, 0);
		const asignacionesVerificables = cantidadEsperada > 0 && asignaciones.length > 0 &&
			cantidadAsignada === cantidadEsperada && asignaciones.every((item) => {
				const hasReceipt = item.recepcionItemId !== null;
				const hasInvoiceLayer = item.purchaseReceiptInvoiceAllocationId !== null;
				const compraDirecta = item.compraDocumentoItem;
				const fuenteDirectaVerificable = !hasReceipt && Boolean(compraDirecta &&
					compraDirecta.compraDocumentoItemId === item.compraDocumentoItemId &&
					compraDirecta.tenantId === tenantId && compraDirecta.productoId === item.productoIdVenta &&
					compraDirecta.compraDocumento.tenantId === tenantId &&
					compraDirecta.compraDocumento.estado !== 'ANULADA' &&
					compraDirecta.compraDocumento.deletedAt === null);
				const capaRecepcion = item.purchaseReceiptInvoiceAllocation;
				const lineaCapa = capaRecepcion?.compraDocumentoItem;
				const fuenteRecepcionVerificable = hasReceipt && Boolean(capaRecepcion && lineaCapa &&
					item.compraDocumentoItemId === null && capaRecepcion.id === item.purchaseReceiptInvoiceAllocationId &&
					capaRecepcion.tenantId === tenantId && capaRecepcion.recepcionItemId === item.recepcionItemId &&
					capaRecepcion.cantidad >= item.cantidad && capaRecepcion.costoUnitarioSnapshot !== null &&
					capaRecepcion.fifoMonedaOrigen?.trim() && capaRecepcion.fifoFechaFuente &&
					capaRecepcion.fifoMonedaFuncional?.trim() && capaRecepcion.fifoCostoFuncional !== null &&
					capaRecepcion.fifoEvidenciaFx &&
					lineaCapa.compraDocumentoItemId === capaRecepcion.compraDocumentoItemId &&
					lineaCapa.tenantId === tenantId && lineaCapa.productoId === item.productoIdVenta &&
					lineaCapa.compraDocumento.tenantId === tenantId &&
					lineaCapa.compraDocumento.deletedAt === null &&
					item.costoUnitarioSnapshot === capaRecepcion.costoUnitarioSnapshot &&
					item.fifoMonedaOrigen?.trim().toUpperCase() ===
						capaRecepcion.fifoMonedaOrigen.trim().toUpperCase() &&
					item.fifoFechaFuente?.getTime() === capaRecepcion.fifoFechaFuente.getTime());
				return Number.isSafeInteger(item.cantidad) && item.cantidad > 0 &&
					item.costoUnitarioSnapshot !== null && item.fifoMonedaOrigen?.trim() &&
					item.fifoFechaFuente && item.fifoMonedaFuncional?.trim() &&
					item.fifoCostoFuncional !== null && item.fifoEvidenciaFx &&
					((hasReceipt ? fuenteRecepcionVerificable :
						item.compraDocumentoItemId !== null && fuenteDirectaVerificable)) &&
					hasReceipt === hasInvoiceLayer;
			});
		const tieneDevoluciones = devolucionesVenta.some((item) => item.ventaId === venta.ventaId);
		const fechaPersistida = venta.costoVentaFecha != null;
		const costo = !tieneDevoluciones && fechaPersistida && asignacionesVerificables
			? await getCostoFifoVentaValorado(client as Prisma.TransactionClient, tenantId, venta.ventaId)
			: null;
		const causa = tieneDevoluciones ? 'DEVOLUCION_FIFO_NO_RECONSTRUIBLE' :
			!fechaPersistida ? 'FECHA_COSTO_FIFO_NO_PERSISTIDA' :
			!asignacionesVerificables ? 'ASIGNACION_FIFO_NO_VERIFICABLE' :
			!costo || costo.cantidad !== cantidadEsperada || costo.montoFuncional === null ||
			!costo.monedaFuncional || !Number.isFinite(costo.montoFuncional) || costo.montoFuncional <= 0
				? CAUSA_VALORACION_NO_VERIFICABLE : undefined;
		const monto = costo?.montoFuncional ?? 0;
		const moneda = costo?.monedaFuncional ?? monedaFuncional;
		candidatos.push({
			origenTipo: 'venta_costo',
			origenId: venta.ventaId,
			fecha,
			evento: {
				tipo: 'COSTO_VENTA_DEVENGADO',
				fecha,
				descripcion: 'Costo FIFO histórico de venta ' + venta.ventaId,
				origen: { tipo: 'venta_costo', id: venta.ventaId },
				monto,
				moneda,
				montoFuncional: causa ? null : monto,
				monedaFuncional: moneda,
				tasaCambio: null,
				fxEvidenceFingerprint: null,
				...(causa ? {} : { auxiliares: { costoFifo: monto } }),
			},
			...(causa ? { causaOmision: causa } : {}),
		});
	}

	// Los desembolsos Cash solo se acreditan con su conciliación original.
	const obligaciones = [
		...deudasCash.map((deuda) => ({
			...deuda, tipoOrigen: 'deuda_cash' as const, tipoEvento: 'DEUDA_RECIBIDA' as const,
			tipoConciliacion: 'DEUDA_CASH_DESEMBOLSO', parteId: deuda.proveedorId,
			textoPredeterminado: `Desembolso de deuda cash para proveedor ${deuda.proveedorId}`,
			fechaAlternativa: deuda.cashInterestGrantDate ?? deuda.createdAt,
		})),
		...prestamosCash.map((prestamo) => ({
			...prestamo, tipoOrigen: 'prestamo_cash' as const, tipoEvento: 'PRESTAMO_OTORGADO' as const,
			tipoConciliacion: 'PRESTAMO_CASH_DESEMBOLSO', parteId: prestamo.clienteId,
			textoPredeterminado: `Desembolso de préstamo cash para cliente ${prestamo.clienteId}`,
			fechaAlternativa: prestamo.cashInterestGrantDate ?? prestamo.fechaOtorgamiento,
		})),
	];
	for (const deuda of obligaciones) {
		const desembolsos = reconciliacionesVenta.filter((item) =>
			(item.deudaCashId === deuda.id && deuda.tipoOrigen === 'deuda_cash' ||
				item.prestamoCashId === deuda.id && deuda.tipoOrigen === 'prestamo_cash') &&
			item.tipoReconciliacion === deuda.tipoConciliacion);
		const desembolso = desembolsos.length === 1 ? desembolsos[0] : null;
		const moneda = deuda.moneda.trim().toUpperCase();
		const funcional = desembolso?.functionalCurrency?.trim().toUpperCase() || null;
		const monto = new Prisma.Decimal(deuda.montoCapital);
		const mismoMonto = desembolso && monto.equals(desembolso.monto);
		const mismaMoneda = desembolso && moneda === desembolso.moneda.trim().toUpperCase();
		const valor = desembolso?.montoConvertido;
		const descripcionGuardada = desembolso?.observaciones;
		const descripcionAmbigua = !descripcionGuardada || descripcionGuardada === deuda.textoPredeterminado;
		const fxValido = funcional && funcional === monedaFuncional && desembolso &&
			resolveAppliedReconciliationAmount(desembolso) !== null;
		const causa = deuda.tenantId !== tenantId || deuda.deletedAt ? 'DEUDA_NO_VERIFICABLE' :
			desembolsos.length > 1 ? 'IDENTIDAD_AMBIGUA' :
			!desembolso || !monto.greaterThan(0) || !mismoMonto || !mismaMoneda ? 'DESEMBOLSO_NO_VERIFICABLE' :
			!fxValido ? 'VALORACION_FUNCIONAL_NO_VERIFICABLE' :
			descripcionAmbigua ? 'DESCRIPCION_NO_VERIFICABLE' : undefined;
		const fecha = desembolso?.fechaReconciliacion ?? deuda.fechaAlternativa;
		candidatos.push({
			origenTipo: deuda.tipoOrigen, origenId: deuda.id, fecha,
			evento: {
				tipo: deuda.tipoEvento, fecha,
				descripcion: descripcionGuardada || 'Descripción de deuda no verificable',
				origen: { tipo: deuda.tipoOrigen, id: deuda.id }, monto: deuda.montoCapital, moneda,
				montoFuncional: valor ?? null, monedaFuncional: funcional,
				tasaCambio: desembolso?.tasaCambio ?? null,
				fxEvidenceFingerprint: desembolso?.fxEvidenceFingerprint ?? null, medioCobro: 'BANCOS',
				...(deuda.tipoOrigen === 'prestamo_cash' && desembolso
					? { referencia: desembolso.idempotencyKey ?? desembolso.reconciliacionId } : {}),
			},
			...(causa ? { causaOmision: causa } : {}),
		});
	}
	for (const desembolso of reconciliacionesVenta) {
		const esDeuda = desembolso.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO';
		const esPrestamo = desembolso.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO';
		if ((!esDeuda && !esPrestamo) || (esDeuda && deudasCash.some((deuda) => deuda.id === desembolso.deudaCashId)) ||
			(esPrestamo && prestamosCash.some((prestamo) => prestamo.id === desembolso.prestamoCashId))) continue;
		const tipoOrigen = esDeuda ? 'desembolso_deuda_no_verificado' : 'desembolso_prestamo_no_verificado';
		candidatos.push({
			origenTipo: tipoOrigen, origenId: desembolso.reconciliacionId,
			fecha: desembolso.fechaReconciliacion, causaOmision: 'DESEMBOLSO_NO_VERIFICABLE',
			evento: {
				tipo: esDeuda ? 'DEUDA_RECIBIDA' : 'PRESTAMO_OTORGADO', fecha: desembolso.fechaReconciliacion,
				descripcion: 'Desembolso Cash no verificable',
				origen: { tipo: tipoOrigen, id: desembolso.reconciliacionId },
				monto: desembolso.monto, moneda: desembolso.moneda,
				montoFuncional: desembolso.montoConvertido, monedaFuncional: desembolso.functionalCurrency,
				tasaCambio: desembolso.tasaCambio, fxEvidenceFingerprint: desembolso.fxEvidenceFingerprint,
				medioCobro: 'BANCOS',
			},
		});
	}

	// Pagos Cash usan conciliaciones de venta, incluso cuando el origen contable es gasto.
	for (const pago of reconciliacionesVenta) {
		const esDeuda = pago.tipoReconciliacion === 'DEUDA_CASH';
		const esPrestamo = pago.tipoReconciliacion === 'PRESTAMO_CASH';
		if (!esDeuda && !esPrestamo) continue;
		const origenTipo = esDeuda ? 'reconciliacion_gasto' : 'reconciliacion_venta';
		const asignacion = pago.cashInterestAllocation;
		const obligacion = esDeuda
			? deudasCash.find((item) => item.id === pago.deudaCashId)
			: prestamosCash.find((item) => item.id === pago.prestamoCashId);
		const tipoCuenta = tipoCuentaPorCuenta.get(pago.cuentaId);
		const componentes = asignacion && [asignacion.moratoryAllocated, asignacion.ordinaryAllocated,
			asignacion.principalAllocated, asignacion.moratoryFunctional, asignacion.ordinaryFunctional,
			asignacion.principalFunctional];
		const asientoValido = asignacion && (!asignacion.asientoId || (
			asignacion.asiento?.tenantId === tenantId && asignacion.asiento.origenTipo === origenTipo &&
			asignacion.asiento.origenId === pago.reconciliacionId));
		const evidenciaValida = Boolean(asignacion && obligacion && !obligacion.deletedAt && tipoCuenta &&
			(esDeuda ? Boolean(pago.deudaCashId) && !pago.prestamoCashId :
				Boolean(pago.prestamoCashId) && !pago.deudaCashId) &&
			asignacion.tenantId === tenantId && asignacion.obligationType === (esDeuda ? 'debt' : 'loan') &&
			asignacion.policyVersion === 1 && asignacion.paymentDate.toISOString().slice(0, 10) ===
				pago.fechaReconciliacion.toISOString().slice(0, 10) &&
			asignacion.paymentAmount.equals(pago.monto) && pago.montoConvertido &&
			asignacion.functionalAmount.equals(pago.montoConvertido) &&
			asignacion.functionalCurrency === pago.functionalCurrency && pago.functionalCurrency === monedaFuncional &&
			asignacion.fxEvidenceFingerprint === pago.fxEvidenceFingerprint &&
			resolveAppliedReconciliationAmount(pago) !== null &&
			componentes?.every((valor) => valor.isFinite() && !valor.isNegative()) &&
			pago.tasaCambio && asignacion.moratoryFunctional.equals(
				asignacion.moratoryAllocated.mul(pago.tasaCambio).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)) &&
			asignacion.ordinaryFunctional.equals(
				asignacion.ordinaryAllocated.mul(pago.tasaCambio).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)) &&
			asignacion.moratoryAllocated.plus(asignacion.ordinaryAllocated).plus(asignacion.principalAllocated)
				.equals(asignacion.paymentAmount) &&
			asignacion.moratoryFunctional.plus(asignacion.ordinaryFunctional).plus(asignacion.principalFunctional)
				.equals(asignacion.functionalAmount) && asientoValido &&
			cashPaymentAllocationFingerprint(asignacion) === asignacion.eventFingerprint);
		const evento = buildCashPaymentEvent({
			obligation: esDeuda ? 'debt' : 'loan', reconciliationId: pago.reconciliacionId,
			amount: pago.monto, currency: pago.moneda, functionalAmount: pago.montoConvertido ?? 0,
			functionalCurrency: pago.functionalCurrency ?? '', exchangeRate: pago.tasaCambio,
			fxEvidenceFingerprint: pago.fxEvidenceFingerprint, interest: asignacion?.ordinaryAllocated,
			moratoryInterest: asignacion?.moratoryAllocated, treasuryAccountType: tipoCuenta,
			fecha: pago.fechaReconciliacion, reference: pago.idempotencyKey ?? pago.reconciliacionId,
		});
		candidatos.push({
			origenTipo, origenId: pago.reconciliacionId, fecha: pago.fechaReconciliacion, evento,
			...(!evidenciaValida ? { causaOmision: 'ASIGNACION_NO_VERIFICABLE' } : {}),
		});
	}

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

	// --- Cobros de servicios ---------------------------------------------------

	for (const reconciliacion of reconciliacionesServicio) {
		const monto = new Prisma.Decimal(reconciliacion.monto);
		const moneda = reconciliacion.moneda.trim().toUpperCase();
		const monedaFuncional = reconciliacion.functionalCurrency?.trim().toUpperCase() ?? null;
		const montoFuncional = reconciliacion.montoConvertido === null
			? null : new Prisma.Decimal(reconciliacion.montoConvertido);
		const tasaCambio = reconciliacion.tasaCambio === null
			? null : new Prisma.Decimal(reconciliacion.tasaCambio);
		const mismaMoneda = monedaFuncional === moneda;
		const evidenciaFxValida = mismaMoneda
			? montoFuncional !== null && montoFuncional.eq(monto)
			: Boolean(monedaFuncional && montoFuncional && tasaCambio &&
				reconciliacion.rateEffectiveAt &&
				reconciliacion.rateEffectiveAt <= reconciliacion.fechaReconciliacion &&
				reconciliacion.fxProvenanceKind && reconciliacion.fxProvenanceSource &&
				reconciliacion.fxEvidenceFingerprint && reconciliacion.fxEvidenceVersion &&
				verifyAppliedFxEvidence({
					originalAmount: monto.toNumber(),
					originalCurrency: moneda,
					functionalCurrency: monedaFuncional,
					convertedAmount: montoFuncional.toNumber(),
					exchangeRate: tasaCambio.toNumber(),
					rateEffectiveAt: reconciliacion.rateEffectiveAt,
					fxProvenanceKind: reconciliacion.fxProvenanceKind,
					fxProvenanceSource: reconciliacion.fxProvenanceSource,
					fxCatalogRateId: reconciliacion.fxCatalogRateId,
					fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
					fxEvidenceVersion: reconciliacion.fxEvidenceVersion,
				}));
		const evento = await construirEventoLiquidacion(
			client as Prisma.TransactionClient,
			{ tenantId, userId: 'replay-preflight' },
			{
				tipo: 'COBRO_SERVICIO',
				reconciliacion: {
					reconciliacionId: reconciliacion.reconciliacionId,
					monto,
					moneda,
					montoConvertido: montoFuncional,
					functionalCurrency: monedaFuncional,
					tasaCambio,
					fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
					fechaReconciliacion: reconciliacion.fechaReconciliacion,
				},
				treasuryAccountType: tipoCuentaPorCuenta.get(reconciliacion.cuentaId),
				descripcion: reconciliacion.observaciones ?? 'Cobro de servicio',
			},
		);
		candidatos.push({
			origenTipo: 'reconciliacion_servicio',
			origenId: reconciliacion.reconciliacionId,
			fecha: reconciliacion.fechaReconciliacion,
			evento,
			...(!evidenciaFxValida ? { causaOmision: CAUSA_VALORACION_NO_VERIFICABLE } : {}),
		});
	}

	// --- Transferencias bancarias ---------------------------------------------

	for (const transferencia of transferenciasBancarias) {
		const montoOrigen = new Prisma.Decimal(transferencia.montoOrigen);
		const montoDestino = new Prisma.Decimal(transferencia.montoDestino);
		const monedaOrigen = transferencia.monedaOrigen.trim().toUpperCase();
		const monedaDestino = transferencia.monedaDestino.trim().toUpperCase();
		const monedaFuncional = politica?.functionalCurrencyCode?.trim().toUpperCase() ?? null;
		const tasaCambio = transferencia.tasaCambio === null
			? null : new Prisma.Decimal(transferencia.tasaCambio);
		const cuentasDistintas = transferencia.cuentaOrigenId !== transferencia.cuentaDestinoId;
		const cuentasTenantValidas = transferencia.cuentaOrigen.tenantId === tenantId &&
			transferencia.cuentaDestino.tenantId === tenantId &&
			transferencia.cuentaOrigen.cuentaId === transferencia.cuentaOrigenId &&
			transferencia.cuentaDestino.cuentaId === transferencia.cuentaDestinoId;
		const monedasPersistidasCoherentes =
			transferencia.cuentaOrigen.moneda.trim().toUpperCase() === monedaOrigen &&
			transferencia.cuentaDestino.moneda.trim().toUpperCase() === monedaDestino;
		const monedaFuncionalCoincide = monedaFuncional !== null &&
			monedaOrigen === monedaFuncional && monedaDestino === monedaFuncional;
		const valoracionVerificable = Boolean(
			transferencia.existe &&
			cuentasDistintas &&
			cuentasTenantValidas &&
			monedasPersistidasCoherentes &&
			monedaFuncional &&
			monedaOrigen === monedaFuncional &&
			monedaDestino === monedaFuncional &&
			montoOrigen.gt(0) &&
			montoOrigen.eq(montoDestino) &&
			(tasaCambio === null || tasaCambio.eq(1)),
		);
		const causaOmision = !transferencia.existe
			? 'TRANSFERENCIA_NO_ACTIVA'
			: !cuentasDistintas
				? 'TRANSFERENCIA_CUENTAS_IGUALES'
			: !cuentasTenantValidas
				? 'TRANSFERENCIA_CUENTA_TENANT_NO_COINCIDE'
				: !monedasPersistidasCoherentes
					? 'TRANSFERENCIA_VALORES_NO_COINCIDEN'
					: !monedaFuncionalCoincide
						? CAUSA_VALORACION_NO_VERIFICABLE
						: !montoOrigen.gt(0) || !montoOrigen.eq(montoDestino) ||
							(tasaCambio !== null && !tasaCambio.eq(1))
							? 'TRANSFERENCIA_VALORES_NO_COINCIDEN'
							: undefined;

		candidatos.push({
			origenTipo: 'transferencia_bancaria',
			origenId: transferencia.transferenciaId,
			fecha: transferencia.fechaTransferencia,
			evento: {
				tipo: 'TRANSFERENCIA_BANCARIA',
				fecha: transferencia.fechaTransferencia,
				descripcion: transferencia.descripcion ?? transferencia.motivo,
				origen: { tipo: 'transferencia_bancaria', id: transferencia.transferenciaId },
				monto: montoOrigen,
				moneda: monedaOrigen,
				montoFuncional: valoracionVerificable ? montoOrigen : null,
				monedaFuncional,
				tasaCambio: valoracionVerificable ? tasaCambio : null,
				referencia: transferencia.numeroComprobante,
			},
			...(causaOmision ? { causaOmision } : {}),
		});
	}

	// --- Devoluciones de venta ------------------------------------------------

	for (const devolucion of devolucionesCompra) {
		if (devolucion.estado === 'PENDIENTE') continue;
		const total = Math.abs(Number(devolucion.montoTotal));
		if (!Number.isFinite(total) || total <= 0) continue;
		// La fecha efectiva es la de completado: el writer postea con
		// completadaAt, así que el replay debe caer en el mismo periodo.
		const fechaEfectiva = devolucion.completadaAt ?? devolucion.createdAt;
		// Sin CxP (compra al contado) la tasa es undefined: se normaliza a null
		// para no convertirla en NaN ni clasificar mal la causa de omisión.
		const tasaCambio = devolucion.compraDocumento?.cuentaPorPagar?.tasaCambio ?? null;
		const evento = construirEventoDevolucionCompra({
			devolucionId: devolucion.devolucionId,
			fecha: fechaEfectiva,
			montoTotal: total,
			montoImputado: Number(devolucion.montoImputado),
			montoImputadoFuncional: devolucion.montoImputadoFuncional === null
				? null
				: Number(devolucion.montoImputadoFuncional),
			saldoAFavor: Number(devolucion.saldoAFavor),
			moneda: devolucion.moneda,
			tasaCambio: tasaCambio === null ? null : Number(tasaCambio),
		}, monedaFuncional);
		const causaOmision = devolucion.estado === 'ANULADA'
			? CAUSA_ANULADO
			: evento.montoFuncional === null && evento.monedaFuncional !== evento.moneda
				? tasaCambio === null ? CAUSA_TASA_NO_PERSISTIDA : CAUSA_VALORACION_NO_VERIFICABLE
				: undefined;
		candidatos.push({
			origenTipo: DEVOLUCION_COMPRA_ORIGIN_TYPE,
			origenId: devolucion.devolucionId,
			fecha: fechaEfectiva,
			evento,
			...(causaOmision ? { causaOmision } : {}),
		});
	}

	// --- Devoluciones de venta ------------------------------------------------

	for (const devolucion of devolucionesVenta) {
		const total = Math.abs(Number(devolucion.total));
		// El writer solo emite cuando el importe devuelto es positivo.
		if (!Number.isFinite(total) || total <= 0) continue;
		// El desglose y el costo FIFO repuesto se leen de lo que el writer
		// persistio: el replay no recalcula nada que el asiento no registrara.
		const evento = construirEventoDevolucionVenta(
			{
				devolucionId: devolucion.devolucionId,
				fecha: devolucion.createdAt,
				monto: total,
				moneda: devolucion.moneda ?? 'CUP',
				montoAplicadoCxc: devolucion.montoAplicadoCxc,
				montoSaldoFavor: devolucion.montoSaldoFavor,
				montoReembolsado: devolucion.montoReembolsado,
				costoFifo: devolucion.costoFifoFuncional === null
					? null
					: Number(devolucion.costoFifoFuncional),
				tasaCambio: devolucion.tasaCambio === null
					? null
					: Number(devolucion.tasaCambio),
				descripcion: `Devolucion de la venta ${devolucion.ventaId}`,
				referencia: devolucion.idempotencyKey,
			},
			monedaFuncional,
		);
		const omision = devolucion.estado === 'ANULADA'
			? CAUSA_ANULADO
			: evento.montoFuncional === null && evento.monedaFuncional !== evento.moneda
				? devolucion.tasaCambio === null
					? CAUSA_TASA_NO_PERSISTIDA
					: CAUSA_VALORACION_NO_VERIFICABLE
				: undefined;
		candidatos.push({
			origenTipo: DEVOLUCION_VENTA_ORIGIN_TYPE,
			origenId: devolucion.devolucionId,
			fecha: devolucion.createdAt,
			evento,
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	// --- Ajustes bancarios e inyecciones de capital --------------------------

	for (const ajuste of ajustesBancarios) {
		const monto = Number(ajuste.monto);
		if (!Number.isFinite(monto) || monto <= 0) continue;
		const evento = construirEventoAjusteBancario(
			{
				ajusteId: ajuste.ajusteId,
				fecha: ajuste.fechaOperacion,
				monto,
				moneda: ajuste.moneda ?? 'CUP',
				tasaCambio: ajuste.tasaCambio === null ? null : Number(ajuste.tasaCambio),
				descripcion: ajuste.descripcion,
				referencia: ajuste.idempotencyKey,
				tipo: ajuste.tipo === 'egreso' ? 'egreso' : 'ingreso',
			},
			monedaFuncional,
		);
		const omision = evento.montoFuncional === null && evento.monedaFuncional !== evento.moneda
			? CAUSA_TASA_NO_PERSISTIDA
			: undefined;
		candidatos.push({
			origenTipo: AJUSTE_BANCARIO_ORIGIN_TYPE,
			origenId: ajuste.ajusteId,
			fecha: ajuste.fechaOperacion,
			evento,
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	for (const inyeccion of inyeccionesCapital) {
		const monto = Number(inyeccion.montoRecibido);
		if (!Number.isFinite(monto) || monto <= 0) continue;
		const evento = construirEventoInyeccionCapital(
			{
				inyeccionId: inyeccion.id,
				fecha: inyeccion.fechaRegistro,
				monto,
				moneda: inyeccion.moneda ?? 'CUP',
				tasaCambio: inyeccion.tasaCambio === null ? null : Number(inyeccion.tasaCambio),
				descripcion: inyeccion.descripcion,
				referencia: inyeccion.idempotencyKey,
				tipo: inyeccion.tipo === 'DEUDA_EXTERNA' ? 'DEUDA_EXTERNA' : 'CAPITAL_SOCIAL',
			},
			monedaFuncional,
		);
		const omision = evento.montoFuncional === null && evento.monedaFuncional !== evento.moneda
			? CAUSA_TASA_NO_PERSISTIDA
			: undefined;
		candidatos.push({
			origenTipo: INYECCION_CAPITAL_ORIGIN_TYPE,
			origenId: inyeccion.id,
			fecha: inyeccion.fechaRegistro,
			evento,
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	// --- Anticipos (movimientos) ----------------------------------------------

	for (const movimiento of movimientosAnticipo) {
		const esCliente = movimiento.anticipo.tipo === 'COBRO';
		// Un anticipo nacido de una nota de credito no genera asiento de
		// aplicacion: el writer lo omite y aqui tampoco se propone.
		const esSaldoNotaCredito =
			movimiento.anticipo.referenciaExterna?.startsWith('NC:') ?? false;
		const monto = Number(movimiento.monto);
		if (!Number.isFinite(monto) || monto <= 0) continue;

		let tipo: TipoEventoClave | null = null;
		let montoFuncional: number | null = null;
		let moneda = movimiento.moneda;
		let treasuryAccountType: string | undefined;
		let diferenciaFx: number | undefined;

		switch (movimiento.tipoMovimiento) {
			case 'RECEPCION':
				tipo = 'ANTICIPO_CLIENTE_RECIBIDO';
				montoFuncional = movimiento.montoFuncional === null
					? 0
					: Number(movimiento.montoFuncional);
				treasuryAccountType = movimiento.cuentaId
					? tipoCuentaPorCuenta.get(movimiento.cuentaId) ?? undefined
					: undefined;
				break;
			case 'ENTREGA':
				tipo = 'ANTICIPO_PROVEEDOR_ENTREGADO';
				montoFuncional = movimiento.montoFuncional === null
					? 0
					: Number(movimiento.montoFuncional);
				treasuryAccountType = movimiento.cuentaId
					? tipoCuentaPorCuenta.get(movimiento.cuentaId) ?? undefined
					: undefined;
				break;
			case 'EJECUCION':
				if (esSaldoNotaCredito) continue;
				tipo = esCliente ? 'ANTICIPO_CLIENTE_APLICADO' : 'ANTICIPO_PROVEEDOR_APLICADO';
				montoFuncional = movimiento.montoFuncional === null
					? null
					: Number(movimiento.montoFuncional);
				break;
			case 'REVERSO':
				if (esSaldoNotaCredito) continue;
				tipo = esCliente
					? 'ANTICIPO_CLIENTE_APLICACION_REVERSADA'
					: 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA';
				montoFuncional = movimiento.montoFuncional === null
					? null
					: Number(movimiento.montoFuncional);
				// El writer del reverso fija la moneda original en CUP.
				moneda = 'CUP';
				break;
			case 'DEVOLUCION':
				tipo = 'ANTICIPO_CLIENTE_DEVUELTO';
				montoFuncional = movimiento.valorTesoreriaFuncional === null
					? 0
					: Number(movimiento.valorTesoreriaFuncional);
				diferenciaFx = diferenciaFxPersistida(movimiento);
				treasuryAccountType = movimiento.cuentaId
					? tipoCuentaPorCuenta.get(movimiento.cuentaId) ?? undefined
					: undefined;
				break;
			case 'REINTEGRO':
				tipo = 'ANTICIPO_PROVEEDOR_REINTEGRADO';
				montoFuncional = movimiento.valorTesoreriaFuncional === null
					? 0
					: Number(movimiento.valorTesoreriaFuncional);
				diferenciaFx = diferenciaFxPersistida(movimiento);
				treasuryAccountType = movimiento.cuentaId
					? tipoCuentaPorCuenta.get(movimiento.cuentaId) ?? undefined
					: undefined;
				break;
			default:
				// CREACION_RESERVA y cualquier tipo desconocido no producen asiento.
				continue;
		}

		const monedaFuncional = movimiento.functionalCurrency ?? 'CUP';
		const omision = (tipo === 'ANTICIPO_CLIENTE_APLICADO' ||
			tipo === 'ANTICIPO_PROVEEDOR_APLICADO' ||
			tipo === 'ANTICIPO_CLIENTE_APLICACION_REVERSADA' ||
			tipo === 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA') &&
			(movimiento.montoFuncional === null || !movimiento.functionalCurrency)
				? CAUSA_VALORACION_NO_VERIFICABLE
				: undefined;

		const evento = buildAnticipoEvent({
			anticipoMovimientoId: movimiento.movimientoId,
			tipo,
			fecha: movimiento.createdAt,
			monto,
			moneda,
			montoFuncional: montoFuncional ?? 0,
			monedaFuncional,
			tasaCambio: movimiento.tasaAplicada === null ? undefined : Number(movimiento.tasaAplicada),
			fxEvidenceFingerprint: movimiento.fxEvidenceFingerprint ?? undefined,
			...(diferenciaFx === undefined ? {} : { diferenciaFx }),
			...(treasuryAccountType === undefined ? {} : { treasuryAccountType }),
		});

		candidatos.push({
			origenTipo: evento.origen.tipo,
			origenId: evento.origen.id,
			fecha: evento.fecha,
			evento,
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
	const manifestEvidence = buildReplayManifestEvidence(candidatos.map((candidato) => ({
		tipo: candidato.evento.tipo,
		origenTipo: candidato.origenTipo,
	})), [...executedQueryIds]);
	if (!manifestEvidence.complete) {
		throw new Error(
			`REPLAY_SOURCE_MANIFEST_INCOMPLETE:${manifestEvidence.unclassifiedCount}`,
		);
	}
	return candidatos;
}
