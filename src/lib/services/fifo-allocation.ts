/**
 * @description Servicio de asignación FIFO (First In, First Out) para inventario.
 *
 *   Vincula cada unidad vendida (VentaItem) con su compra de origen
 *   (CompraDocumentoItem) según la política FIFO: las unidades más
 *   antiguas en stock se venden primero.
 *
 * @module lib/services/fifo-allocation
 */

import { Prisma } from "@/generated/prisma";
import { exchangeRateProvider } from "@/features/contabilidad/services/exchange-rate-provider";
import { buildAppliedFxEvidence } from "@/features/contabilidad/domain/fx-evidence";

// ─── Tipos ────────────────────────────────────────────────────

export interface AllocateFifoParams {
	tenantId: string;
	ventaItemId: string;
	productoId: string;
	cantidad: number;
}

/**
 * @description Costo FIFO de una venta valorado en la moneda funcional.
 *
 * `montoFuncional` es null cuando alguna fuente del costo no tiene tasa
 * publicada vigente: el costo no se estima con una tasa inferida.
 */
export interface CostoFifoValorado {
	/** Costo total devengado en moneda funcional; null si falta alguna tasa. */
	montoFuncional: number | null;
	/** Moneda funcional del tenant; null si no tiene política contable. */
	monedaFuncional: string | null;
	/** Unidades asignadas a la venta. */
	cantidad: number;
	/** Fuentes del costo sin tasa publicada vigente. */
	fuentesSinTasa: string[];
}

/** Fuente de costo FIFO: la porción de costo y la moneda/fecha que la valoran. */
export interface FuenteCostoFifo {
	/** Moneda en la que está expresado el costo de la porción. */
	moneda: string;
	/** Fecha de la fuente (la de la compra o del lote). */
	fecha: Date;
	/** Costo total de la porción, en la moneda de la fuente. */
	costo: number;
	/** Unidades que compone la porción. */
	cantidad: number;
	/** Valor funcional ya capturado, si la fuente tiene snapshot FX verificable. */
	montoFuncional?: number;
	/**
	 * `false` cuando la porción se apoya en una recepción sin factura trazada.
	 * Su costo es una estimación operativa: repone inventario, pero no es
	 * acreditable en el libro formal (falla cerrado en modo `enforce`).
	 */
	verificable?: boolean;
}

interface FifoRateContext {
	functionalCurrency: string;
	rate: number | null;
	rateDate: Date | null;
	rateId: string | null;
}

interface FifoSnapshotFields {
	fifoMonedaFuncional: string;
	fifoCostoFuncional: number;
	fifoTasaCambio: number | null;
	fifoFechaTasa: Date | null;
	fifoEvidenciaFx: string;
}

interface ValidatedFifoSnapshot extends FifoSnapshotFields {
	amountFunctional: number;
	rate: number | null;
	rateDate: Date | null;
	rateId: string | null;
}

interface ReceiptInvoiceSourceIdentity {
	id: string;
	tenantId: string;
	compraDocumentoItemId: string;
	recepcionItemId: string;
	cantidad: number;
	costoUnitarioSnapshot: number | null;
	fifoMonedaOrigen: string | null;
	fifoFechaFuente: Date | null;
	compraDocumentoItem: {
		compraDocumentoItemId: string;
		tenantId: string;
		productoId: string;
		compraDocumento: {
			tenantId: string;
			ordenCompraId: string | null;
			estado: string;
			deletedAt: Date | null;
			moneda: string;
			fechaCompra: Date;
		};
	};
}

interface ReceiptSourceIdentity {
	id: string;
	tenantId: string;
	productoId: string;
	ordenItem: { tenantId: string; ordenId: string; productoId: string };
}

const FIFO_EVIDENCE_SOURCE = "fifo-allocation";

/**
 * @description Valida la cadena de procedencia factura → línea → recepción → orden.
 *
 * La factura **anulada** no invalida la procedencia ya consumida: anular un
 * documento libera las unidades facturadas, pero no borra el hecho de que
 * esas unidades se vendieron contra esa línea. Solo la factura eliminada
 * (`deletedAt`) deja de ser una fuente verificable.
 *
 * @param {ReceiptInvoiceSourceIdentity} source - Capa de factura persistida.
 * @param {ReceiptSourceIdentity} receipt - Recepción física de la unidad.
 * @param {string} tenantId - Tenant propietario de la cadena.
 * @returns {boolean} True si la cadena es coherente y verificable.
 */
function isCurrentReceiptInvoiceSource(
	source: ReceiptInvoiceSourceIdentity,
	receipt: ReceiptSourceIdentity,
	tenantId: string,
): boolean {
	const line = source.compraDocumentoItem;
	const invoice = line.compraDocumento;
	return source.tenantId === tenantId && receipt.tenantId === tenantId &&
		source.recepcionItemId === receipt.id &&
		line.tenantId === tenantId && invoice.tenantId === tenantId &&
		line.compraDocumentoItemId === source.compraDocumentoItemId &&
		invoice.deletedAt === null &&
		invoice.ordenCompraId === receipt.ordenItem.ordenId &&
		line.productoId === receipt.productoId && receipt.productoId === receipt.ordenItem.productoId &&
		source.fifoMonedaOrigen?.trim().toUpperCase() === invoice.moneda.trim().toUpperCase() &&
		source.fifoFechaFuente?.getTime() === invoice.fechaCompra.getTime();
}

/**
 * @description Resolves the tenant currency and historical rate for a purchase source.
 * @param {Prisma.TransactionClient} tx - Sale transaction client.
 * @param {string} tenantId - Tenant that owns the allocation.
 * @param {string} sourceCurrency - Currency recorded by the purchase document.
 * @param {Date} sourceDate - Purchase date used as the rate cutoff.
 * @returns {Promise<FifoRateContext | null>} Provenance context or null when incomplete.
 */
async function resolveFifoRateContext(
	tx: Prisma.TransactionClient,
	tenantId: string,
	sourceCurrency: string,
	sourceDate: Date,
): Promise<FifoRateContext | null> {
	const functionalCurrency = await monedaFuncionalDelTenant(tx, tenantId);
	if (!functionalCurrency || !sourceCurrency || !Number.isFinite(sourceDate.getTime())) return null;
	if (functionalCurrency === sourceCurrency) {
		return { functionalCurrency, rate: null, rateDate: null, rateId: null };
	}
	const rate = await exchangeRateProvider.getRateAsOf({
		sourceCurrency,
		targetCurrency: functionalCurrency,
		boundaryAt: sourceDate,
		client: tx,
	});
	if (!rate || !Number.isFinite(rate.tasa) || rate.tasa <= 0 || rate.fechaVigencia > sourceDate) return null;
	return {
		functionalCurrency,
		rate: rate.tasa,
		rateDate: rate.fechaVigencia,
		rateId: rate.tasaId,
	};
}

/**
 * @description Builds canonical evidence and persisted fields for one allocation balance.
 * @param {object} input - Source amount/currency and its captured functional rate context.
 * @returns {FifoSnapshotFields | null} Complete snapshot or null when it cannot be verified.
 */
function buildFifoSnapshot(input: {
	amount: number;
	sourceCurrency: string;
	context: FifoRateContext;
	functionalAmount?: number;
	source?: string;
}): FifoSnapshotFields | null {
	const { amount, sourceCurrency, context } = input;
	if (!Number.isFinite(amount) || amount <= 0) return null;
	const sameCurrency = sourceCurrency === context.functionalCurrency;
	if (!sameCurrency && (context.rate === null || context.rateDate === null)) return null;
	const rawConvertedAmount = input.functionalAmount ??
		(sameCurrency ? amount : amount * (context.rate as number));
	if (!Number.isFinite(rawConvertedAmount) || rawConvertedAmount <= 0) return null;
	try {
		const evidence = buildAppliedFxEvidence({
			originalAmount: amount,
			originalCurrency: sourceCurrency,
			functionalCurrency: context.functionalCurrency,
			exchangeRate: context.rate ?? 1,
			convertedAmount: rawConvertedAmount,
			rateEffectiveAt: context.rateDate,
			fxCatalogRateId: context.rateId,
			source: input.source ?? FIFO_EVIDENCE_SOURCE,
		});
		return {
			fifoMonedaFuncional: context.functionalCurrency,
			fifoCostoFuncional: roundFifoAmount(rawConvertedAmount),
			fifoTasaCambio: context.rate,
			fifoFechaTasa: context.rateDate,
			fifoEvidenciaFx: JSON.stringify({
				...evidence,
				rawConvertedAmount,
				rawExchangeRate: context.rate,
			}),
		};
	} catch {
		return null;
	}
}

/**
 * @description Validates the complete persisted FIFO snapshot against its canonical fingerprint.
 * @param {object} allocation - Persisted quantity, unit cost, and valuation evidence.
 * @param {string} functionalCurrency - Current tenant functional currency.
 * @returns {ValidatedFifoSnapshot | null} Verified snapshot or null for incomplete/tampered data.
 */
function validateFifoSnapshot(allocation: {
	cantidad: number;
	costoUnitarioSnapshot: number | null;
	fifoMonedaOrigen: string | null;
	fifoFechaFuente: Date | null;
	fifoMonedaFuncional: string | null;
	fifoCostoFuncional: Prisma.Decimal | number | null;
	fifoTasaCambio: Prisma.Decimal | number | null;
	fifoFechaTasa: Date | null;
	fifoEvidenciaFx: string | null;
}, functionalCurrency: string, evidenceSource = FIFO_EVIDENCE_SOURCE): ValidatedFifoSnapshot | null {
	if (allocation.costoUnitarioSnapshot == null || !allocation.fifoMonedaOrigen?.trim() ||
		!allocation.fifoFechaFuente || !allocation.fifoMonedaFuncional?.trim() ||
		allocation.fifoCostoFuncional == null || !allocation.fifoEvidenciaFx ||
		allocation.fifoMonedaFuncional.trim().toUpperCase() !== functionalCurrency) return null;
	const originalAmount = allocation.costoUnitarioSnapshot * allocation.cantidad;
	if (!Number.isFinite(originalAmount) || originalAmount <= 0) return null;
	try {
		const evidence = JSON.parse(allocation.fifoEvidenciaFx) as Record<string, unknown>;
		const rawConvertedAmount = evidence.rawConvertedAmount;
		const rawExchangeRate = evidence.rawExchangeRate;
		if (typeof rawConvertedAmount !== 'number' || !Number.isFinite(rawConvertedAmount) ||
			(rawExchangeRate !== null && (typeof rawExchangeRate !== 'number' || !Number.isFinite(rawExchangeRate)))) return null;
		const sourceCurrency = allocation.fifoMonedaOrigen.trim().toUpperCase();
		const sameCurrency = sourceCurrency === functionalCurrency;
		const rate = sameCurrency ? null : rawExchangeRate as number;
		const rateDate = sameCurrency || typeof evidence.rateEffectiveAt !== 'string' || !evidence.rateEffectiveAt
			? null : new Date(evidence.rateEffectiveAt);
		const rateId = typeof evidence.fxCatalogRateId === 'string' ? evidence.fxCatalogRateId : null;
		const expected = buildAppliedFxEvidence({
			originalAmount,
			originalCurrency: sourceCurrency,
			functionalCurrency,
			exchangeRate: rate ?? 1,
			convertedAmount: rawConvertedAmount,
			rateEffectiveAt: rateDate,
			fxCatalogRateId: rateId,
			source: evidenceSource,
		});
		const evidenceKeys = Object.keys(evidence).sort();
		const canonicalKeys = [...Object.keys(expected), 'rawConvertedAmount', 'rawExchangeRate'].sort();
		if (evidenceKeys.length !== canonicalKeys.length ||
			evidenceKeys.some((key, index) => key !== canonicalKeys[index]) ||
			evidence.rawExchangeRate !== rate) return null;
		if ((!sameCurrency && (rate === null || rate <= 0 || !rateDate || Number.isNaN(rateDate.getTime()) ||
			!allocation.fifoFechaTasa || allocation.fifoFechaTasa.getTime() !== rateDate.getTime() ||
			rateDate > allocation.fifoFechaFuente)) ||
			(sameCurrency && (rate !== null || allocation.fifoTasaCambio !== null || allocation.fifoFechaTasa !== null))) return null;
		if (roundFifoAmount(rawConvertedAmount) !== Number(allocation.fifoCostoFuncional) ||
			(rate !== null && roundFifoRate(rate) !== Number(allocation.fifoTasaCambio))) return null;
		if (Object.entries(expected).some(([key, value]) => evidence[key] !== value)) return null;
		return {
			fifoMonedaFuncional: functionalCurrency,
			fifoCostoFuncional: Number(allocation.fifoCostoFuncional),
			fifoTasaCambio: allocation.fifoTasaCambio === null ? null : Number(allocation.fifoTasaCambio),
			fifoFechaTasa: allocation.fifoFechaTasa,
			fifoEvidenciaFx: allocation.fifoEvidenciaFx,
			amountFunctional: Number(allocation.fifoCostoFuncional),
			rate,
			rateDate,
			rateId,
		};
	} catch {
		return null;
	}
}

/**
 * @description Rounds a captured functional amount using the database's four-decimal scale.
 * @param {number} amount - Functional amount to round.
 * @returns {number} Half-up rounded amount.
 */
function roundFifoAmount(amount: number): number {
	return new Prisma.Decimal(amount).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * @description Rounds a captured exchange rate using the database's ten-decimal scale.
 * @param {number} rate - Exchange rate to round.
 * @returns {number} Half-up rounded rate.
 */
function roundFifoRate(rate: number): number {
	return new Prisma.Decimal(rate).toDecimalPlaces(10, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

// ─── FIFO: Asignación individual ───────────────────────────────

/**
 * @description Asigna unidades vendidas a compras usando FIFO.
 *
 *   Dado un VentaItem (producto + cantidad vendida), busca todas
 *   las compras (CompraDocumentoItem) del mismo producto ordenadas
 *   por fecha ASC (más antiguas primero) y asigna la cantidad
 *   vendida a las compras con stock disponible.
 *
 *   Si no hay suficiente stock disponible en ninguna compra, la
 *   función completa la asignación con lo disponible. No lanza
 *   error por desabastecimiento — el control de stock ya se hizo
 *   antes en la transacción.
 *
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {AllocateFifoParams} params - Parámetros de asignación.
 * @returns {Promise<void>}
 */
export async function allocateFifoForVentaItem(
	tx: Prisma.TransactionClient,
	params: AllocateFifoParams,
): Promise<void> {
	const { tenantId, ventaItemId, productoId, cantidad } = params;

	if (cantidad <= 0) return;

	// 1. Obtener CompraDocumentoItem del producto ordenadas por fecha ASC.
	// Las compras anuladas devolvieron su stock: no pueden alimentar el FIFO.
	const purchaseItems = await tx.compraDocumentoItem.findMany({
		where: {
			productoId,
			compraDocumento: {
				tenantId,
				deletedAt: null,
				estado: { not: "ANULADA" },
			},
		},
		orderBy: { createdAt: "asc" },
		select: {
			compraDocumentoItemId: true,
			cantidad: true,
			precioUnitario: true,
			createdAt: true,
			compraDocumento: { select: { ordenCompraId: true, moneda: true, fechaCompra: true } },
		},
	});
	const purchaseItemIds = purchaseItems.map((item) => item.compraDocumentoItemId);
	const [directLots, receiptItems] = await Promise.all([
		purchaseItemIds.length > 0
			? tx.lote.findMany({
					where: {
						tenantId,
						productoId,
						compraItemId: { in: purchaseItemIds },
						cantidadDisponible: { gt: 0 },
					},
					select: {
						id: true,
						compraItemId: true,
						cantidadDisponible: true,
						fechaVencimiento: true,
						createdAt: true,
					},
				})
			: Promise.resolve([]),
		tx.recepcionItem.findMany({
			where: {
				tenantId,
				productoId,
				lotes: { some: {} },
			},
			orderBy: [{ recepcion: { fecha: "asc" } }, { id: "asc" }],
			select: {
				id: true,
				cantidad: true,
				ordenItemId: true,
				ordenItem: {
					select: {
						id: true,
						ordenId: true,
						precioUnitario: true,
					},
				},
				recepcion: { select: { fecha: true } },
				lotes: {
					select: {
						id: true,
						cantidadDisponible: true,
						fechaVencimiento: true,
						createdAt: true,
					},
				},
			},
		}),
	]);
	const lots = [...directLots];
	const lotsByPurchaseItem = new Map<string, typeof lots>();
	for (const lot of directLots) {
		if (!lot.compraItemId) continue;
		const itemLots = lotsByPurchaseItem.get(lot.compraItemId) ?? [];
		itemLots.push(lot);
		lotsByPurchaseItem.set(lot.compraItemId, itemLots);
	}
	const receiptLots = receiptItems.flatMap((receiptItem) => receiptItem.lotes);
	lots.push(...receiptLots.map((lot) => ({ ...lot, compraItemId: null })));
	const compareLots = (
		a: { id: string; fechaVencimiento: Date | null; createdAt: Date },
		b: { id: string; fechaVencimiento: Date | null; createdAt: Date },
	): number => {
		if (a.fechaVencimiento === null && b.fechaVencimiento !== null) return 1;
		if (a.fechaVencimiento !== null && b.fechaVencimiento === null) return -1;
		if (a.fechaVencimiento && b.fechaVencimiento) {
			const expirationOrder = a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime();
			if (expirationOrder !== 0) return expirationOrder;
		}
		const fifoOrder = a.createdAt.getTime() - b.createdAt.getTime();
		return fifoOrder || a.id.localeCompare(b.id);
	};
	for (const itemLots of lotsByPurchaseItem.values()) {
		itemLots.sort((a, b) => {
			return compareLots(a, b);
		});
	}
	const receiptLotsByOrderItem = new Map<string, Array<{
		recepcionItemId: string;
		cantidadDisponible: number;
		fechaRecepcion: Date;
		costoUnitarioEstimado: number;
		lot: (typeof receiptLots)[number];
	}>>();
	const receiptOrderProducts = new Set<string>();
	for (const receiptItem of receiptItems) {
		const key = `${receiptItem.ordenItem.ordenId}:${productoId}`;
		receiptOrderProducts.add(key);
		const sourceLots = receiptLotsByOrderItem.get(receiptItem.ordenItemId) ?? [];
		for (const lot of receiptItem.lotes) {
			sourceLots.push({
				recepcionItemId: receiptItem.id,
				cantidadDisponible: Math.min(receiptItem.cantidad, lot.cantidadDisponible),
				fechaRecepcion: receiptItem.recepcion.fecha,
				// Las unidades aún no facturadas se estiman con el precio acordado
				// en la orden de compra: es el costo operativo de reposición.
				costoUnitarioEstimado: receiptItem.ordenItem.precioUnitario,
				lot,
			});
		}
		receiptLotsByOrderItem.set(receiptItem.ordenItemId, sourceLots);
	}
	for (const sourceLots of receiptLotsByOrderItem.values()) {
		sourceLots.sort((a, b) => compareLots(a.lot, b.lot));
	}

	// 2. Obtener asignaciones previas para calcular disponible
	const previousAllocations = purchaseItemIds.length > 0
		? await tx.purchaseAllocation.groupBy({
				by: ["compraDocumentoItemId"],
				where: { compraDocumentoItemId: { in: purchaseItemIds } },
				_sum: { cantidad: true },
			})
		: [];

	const allocatedMap = new Map<string, number>();
	for (const alloc of previousAllocations) {
		if (alloc.compraDocumentoItemId) {
			allocatedMap.set(alloc.compraDocumentoItemId, alloc._sum.cantidad ?? 0);
		}
	}
	const receiptItemIds = receiptItems.map((item) => item.id);
	const previousReceiptAllocations = receiptItemIds.length > 0
		? await tx.purchaseAllocation.groupBy({
				by: ["recepcionItemId"],
				where: { tenantId, recepcionItemId: { in: receiptItemIds } },
				_sum: { cantidad: true },
			})
		: [];
	const allocatedByReceiptItem = new Map<string, number>();
	for (const alloc of previousReceiptAllocations) {
		if (alloc.recepcionItemId) {
			allocatedByReceiptItem.set(alloc.recepcionItemId, alloc._sum.cantidad ?? 0);
		}
	}
	const receiptInvoiceLayers = receiptItemIds.length > 0
		? await tx.purchaseReceiptInvoiceAllocation.findMany({
				where: {
					tenantId,
					recepcionItemId: { in: receiptItemIds },
					compraDocumentoItem: {
						compraDocumento: { estado: { not: "ANULADA" }, deletedAt: null },
					},
				},
				orderBy: [{ fifoFechaFuente: "asc" }, { createdAt: "asc" }, { id: "asc" }],
				select: {
					id: true, tenantId: true, compraDocumentoItemId: true, recepcionItemId: true,
					cantidad: true, costoUnitarioSnapshot: true, fifoMonedaOrigen: true,
					fifoFechaFuente: true, fifoMonedaFuncional: true, fifoCostoFuncional: true,
					fifoTasaCambio: true, fifoFechaTasa: true, fifoEvidenciaFx: true, createdAt: true,
				},
			})
		: [];
	const layersByReceipt = new Map<string, typeof receiptInvoiceLayers>();
	for (const layer of receiptInvoiceLayers) {
		const layers = layersByReceipt.get(layer.recepcionItemId) ?? [];
		layers.push(layer);
		layersByReceipt.set(layer.recepcionItemId, layers);
	}
	const previousReceiptInvoiceAllocations = receiptInvoiceLayers.length > 0
		? await tx.purchaseAllocation.groupBy({
				by: ["purchaseReceiptInvoiceAllocationId"],
				where: {
					tenantId,
					purchaseReceiptInvoiceAllocationId: { in: receiptInvoiceLayers.map((layer) => layer.id) },
				},
				_sum: { cantidad: true, fifoCostoFuncional: true },
			})
		: [];
	const allocatedByInvoiceLayer = new Map<string, { quantity: number; functionalAmount: number }>();
	for (const alloc of previousReceiptInvoiceAllocations) {
		if (!alloc.purchaseReceiptInvoiceAllocationId) continue;
		allocatedByInvoiceLayer.set(alloc.purchaseReceiptInvoiceAllocationId, {
			quantity: alloc._sum.cantidad ?? 0,
			functionalAmount: Number(alloc._sum.fifoCostoFuncional ?? 0),
		});
	}
	const allocatedByLot = new Map<string, number>();
	if (lots.length > 0) {
		const previousLotAllocations = await tx.purchaseAllocation.groupBy({
			by: ["loteId"],
			where: { tenantId, loteId: { in: lots.map((lot) => lot.id) } },
			_sum: { cantidad: true },
		});
		for (const alloc of previousLotAllocations) {
			if (alloc.loteId) allocatedByLot.set(alloc.loteId, alloc._sum.cantidad ?? 0);
		}
	}

	// 3. Construir fuentes físicas FIFO. Los items de una OC con recepciones
	// trazadas no duplican stock: su fuente física son los lotes recibidos.
	type AllocationSource =
		| { kind: "purchase"; date: Date; item: (typeof purchaseItems)[number] }
		| {
				kind: "receipt";
				date: Date;
				receiptLots: Array<{
					recepcionItemId: string;
					cantidadDisponible: number;
					fechaRecepcion: Date;
					costoUnitarioEstimado: number;
					lot: (typeof receiptLots)[number];
				}>;
			};
	const sources: AllocationSource[] = [];
	for (const item of purchaseItems) {
		const orderId = item.compraDocumento?.ordenCompraId;
		if (orderId && receiptOrderProducts.has(`${orderId}:${productoId}`)) continue;
		sources.push({ kind: "purchase", date: item.createdAt ?? new Date(0), item });
	}
	for (const [orderItemId, sourceLots] of receiptLotsByOrderItem) {
		const date = sourceLots.reduce(
			(earliest, entry) => entry.fechaRecepcion < earliest ? entry.fechaRecepcion : earliest,
			sourceLots[0].fechaRecepcion,
		);
		sources.push({ kind: "receipt", date, receiptLots: sourceLots });
	}
	sources.sort((a, b) => a.date.getTime() - b.date.getTime());

	// 4. Asignar FIFO y FEFO dentro de la fuente física.
	let remaining = cantidad;
	const allocations: Array<{
		tenantId: string;
		compraDocumentoItemId: string | null;
		recepcionItemId?: string;
		ventaItemId: string;
		loteId?: string;
		costoUnitarioSnapshot?: number;
		fifoMonedaOrigen?: string;
		fifoFechaFuente?: Date;
		fifoMonedaFuncional?: string;
		fifoCostoFuncional?: number;
		fifoTasaCambio?: number | null;
		fifoFechaTasa?: Date | null;
		fifoEvidenciaFx?: string;
		purchaseReceiptInvoiceAllocationId?: string;
		cantidad: number;
	}> = [];
	const allocatedInThisCallByLot = new Map<string, number>();
	const allocatedInThisCallByReceiptItem = new Map<string, number>();
	const allocatedInThisCallByInvoiceLayer = new Map<string, { quantity: number; functionalAmount: number }>();

	for (const source of sources) {
		if (remaining <= 0) break;
		if (source.kind === "purchase") {
			const item = source.item;
			const moneda = item.compraDocumento?.moneda?.trim().toUpperCase();
			const fechaFuente = item.compraDocumento?.fechaCompra;
			const evidenciaOrigen = moneda && fechaFuente && Number.isFinite(fechaFuente.getTime()) &&
				Number.isSafeInteger(item.precioUnitario) && item.precioUnitario >= 0
				? { costoUnitarioSnapshot: item.precioUnitario, fifoMonedaOrigen: moneda, fifoFechaFuente: fechaFuente }
				: {};
			const available = Math.max(0, item.cantidad - (allocatedMap.get(item.compraDocumentoItemId) ?? 0));
			if (available <= 0) continue;
			const rateContext = moneda && fechaFuente && evidenciaOrigen.costoUnitarioSnapshot !== undefined
				? await resolveFifoRateContext(tx, tenantId, moneda, fechaFuente)
				: null;
			const snapshotFor = (quantity: number) => rateContext && moneda
				? buildFifoSnapshot({ amount: item.precioUnitario * quantity,
					sourceCurrency: moneda, context: rateContext }) ?? undefined
				: undefined;
			const itemLots = lotsByPurchaseItem.get(item.compraDocumentoItemId);
			if (itemLots?.length) {
				let itemRemaining = available;
				for (const lot of itemLots) {
					if (remaining <= 0 || itemRemaining <= 0) break;
					const lotAvailable = Math.max(0, lot.cantidadDisponible - (allocatedByLot.get(lot.id) ?? 0));
					if (lotAvailable <= 0) continue;
					const toAllocate = Math.min(remaining, itemRemaining, lotAvailable);
					allocations.push({
						tenantId,
						compraDocumentoItemId: item.compraDocumentoItemId,
						ventaItemId,
						loteId: lot.id,
						...evidenciaOrigen,
						...snapshotFor(toAllocate),
						cantidad: toAllocate,
					});
					remaining -= toAllocate;
					itemRemaining -= toAllocate;
				}
				continue;
			}
			const toAllocate = Math.min(remaining, available);
			allocations.push({
				tenantId,
				compraDocumentoItemId: item.compraDocumentoItemId,
				ventaItemId,
				...evidenciaOrigen,
				...snapshotFor(toAllocate),
				cantidad: toAllocate,
			});
			remaining -= toAllocate;
			continue;
		}

		for (const entry of source.receiptLots) {
			const receiptAvailable = Math.max(
				0,
				entry.cantidadDisponible -
					(allocatedByReceiptItem.get(entry.recepcionItemId) ?? 0) -
					(allocatedInThisCallByReceiptItem.get(entry.recepcionItemId) ?? 0),
			);
			const lotAvailable = Math.max(
				0,
				entry.lot.cantidadDisponible -
					(allocatedByLot.get(entry.lot.id) ?? 0) -
					(allocatedInThisCallByLot.get(entry.lot.id) ?? 0),
			);
			const available = Math.min(receiptAvailable, lotAvailable);
			if (available <= 0) continue;
			const toAllocate = Math.min(remaining, available);
			let unassigned = toAllocate;
			for (const layer of layersByReceipt.get(entry.recepcionItemId) ?? []) {
				if (unassigned <= 0) break;
				const wasAllocated = allocatedByInvoiceLayer.get(layer.id) ?? { quantity: 0, functionalAmount: 0 };
				const allocatedNow = allocatedInThisCallByInvoiceLayer.get(layer.id) ?? {
					quantity: 0, functionalAmount: 0,
				};
				const layerQuantityAvailable = Math.max(0,
					layer.cantidad - wasAllocated.quantity - allocatedNow.quantity);
				if (layerQuantityAvailable <= 0) continue;
				const layerQuantity = Math.min(unassigned, layerQuantityAvailable);
				const layerFunctionalAmount = Number(layer.fifoCostoFuncional ?? 0);
				const remainingFunctionalAmount = Math.max(0,
					layerFunctionalAmount - wasAllocated.functionalAmount - allocatedNow.functionalAmount);
				const remainingLayerQuantity = layer.cantidad - wasAllocated.quantity - allocatedNow.quantity;
				const functionalAmount = layerQuantity === remainingLayerQuantity
					? remainingFunctionalAmount
					: roundFifoAmount(remainingFunctionalAmount * layerQuantity / remainingLayerQuantity);
				const functionalCurrency = layer.fifoMonedaFuncional?.trim().toUpperCase();
				const sourceSnapshot = functionalCurrency
					? validateFifoSnapshot(layer, functionalCurrency, "purchase-receipt-invoice-allocation")
					: null;
				const snapshot = sourceSnapshot && layer.costoUnitarioSnapshot != null && layer.fifoMonedaOrigen
					? buildFifoSnapshot({
						amount: layer.costoUnitarioSnapshot * layerQuantity,
						sourceCurrency: layer.fifoMonedaOrigen.trim().toUpperCase(),
						context: {
							functionalCurrency: sourceSnapshot.fifoMonedaFuncional,
							rate: sourceSnapshot.rate,
							rateDate: sourceSnapshot.rateDate,
							rateId: sourceSnapshot.rateId,
						},
						functionalAmount,
					})
					: null;
				allocations.push({
					tenantId,
					compraDocumentoItemId: null,
					recepcionItemId: entry.recepcionItemId,
					purchaseReceiptInvoiceAllocationId: layer.id,
					ventaItemId,
					loteId: entry.lot.id,
					...(layer.costoUnitarioSnapshot == null ? {} : {
						costoUnitarioSnapshot: layer.costoUnitarioSnapshot,
						fifoMonedaOrigen: layer.fifoMonedaOrigen ?? undefined,
						fifoFechaFuente: layer.fifoFechaFuente ?? undefined,
					}),
					...(snapshot ?? {}),
					cantidad: layerQuantity,
				});
				allocatedInThisCallByInvoiceLayer.set(layer.id, {
					quantity: allocatedNow.quantity + layerQuantity,
					functionalAmount: allocatedNow.functionalAmount + (snapshot?.fifoCostoFuncional ?? 0),
				});
				unassigned -= layerQuantity;
			}
			if (unassigned > 0) {
				// Unidades recibidas que ninguna factura activa respalda: la
				// asignación conserva un costo estimado (precio de la OC) para la
				// reposición operativa, pero queda sin capa de procedencia y por
				// tanto no es acreditable en el libro formal.
				allocations.push({
					tenantId,
					compraDocumentoItemId: null,
					recepcionItemId: entry.recepcionItemId,
					ventaItemId,
					loteId: entry.lot.id,
					costoUnitarioSnapshot: entry.costoUnitarioEstimado,
					cantidad: unassigned,
				});
			}
			remaining -= toAllocate;
			allocatedInThisCallByLot.set(entry.lot.id, (allocatedInThisCallByLot.get(entry.lot.id) ?? 0) + toAllocate);
			allocatedInThisCallByReceiptItem.set(
				entry.recepcionItemId,
				(allocatedInThisCallByReceiptItem.get(entry.recepcionItemId) ?? 0) + toAllocate,
			);
		}
	}

	// 4. Crear registros de asignación
	if (allocations.length > 0) {
		await tx.purchaseAllocation.createMany({ data: allocations });
	}
}

// ─── Helper: Stock disponible de un item de compra ─────────────

/**
 * @description Retorna el stock disponible de un item de compra.
 *
 *   El stock disponible se calcula como:
 *   `cantidadOriginal - SUM(PurchaseAllocation.cantidad)`
 *
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {string} compraDocumentoItemId - ID del item de compra.
 * @returns {Promise<number>} Stock disponible (nunca negativo).
 */
export async function getAvailableStock(
	tx: Prisma.TransactionClient,
	compraDocumentoItemId: string,
): Promise<number> {
	const [compraItem, allocatedResult] = await Promise.all([
		tx.compraDocumentoItem.findUnique({
			where: { compraDocumentoItemId },
			select: { cantidad: true, compraDocumento: { select: { estado: true, deletedAt: true } } },
		}),
		tx.purchaseAllocation.aggregate({
			where: { compraDocumentoItemId },
			_sum: { cantidad: true },
		}),
	]);

	if (!compraItem) return 0;
	// Una compra anulada o eliminada ya no tiene stock disponible para asignar.
	if (compraItem.compraDocumento?.deletedAt || compraItem.compraDocumento?.estado === "ANULADA") return 0;

	const originalCantidad = compraItem.cantidad;
	const allocated = allocatedResult._sum.cantidad ?? 0;

	return Math.max(0, originalCantidad - allocated);
}

// ─── FIFO: Procesar venta completa ─────────────────────────────

/**
 * @description Procesa todos los VentaItem de una venta con asignación FIFO.
 *
 *   Itera cada VentaItem de la venta y ejecuta
 *   `allocateFifoForVentaItem` por cada uno. Si algún item falla,
 *   la excepción se propaga y la transacción externa debe hacer
 *   rollback.
 *
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {string} tenantId - ID del tenant.
 * @param {string} ventaId - ID de la venta.
 * @returns {Promise<void>}
 */
export async function allocateFifoForSale(
	tx: Prisma.TransactionClient,
	tenantId: string,
	ventaId: string,
): Promise<void> {
	const ventaItems = await tx.ventaItem.findMany({
		where: { ventaId },
		select: { id: true, productoId: true, cantidad: true },
	});

	for (const item of ventaItems) {
		await allocateFifoForVentaItem(tx, {
			tenantId,
			ventaItemId: item.id,
			productoId: item.productoId,
			cantidad: item.cantidad,
		});
	}
}

/**
 * @description Valora en la moneda funcional el costo FIFO asignado a una
 * venta, tomando el costo real de cada fuente (lote de compra o recepción).
 *
 * Cada porción se valora con la tasa publicada vigente en la fecha de su
 * fuente; las fuentes en moneda distinta de la funcional sin tasa vigente
 * dejan el costo funcional sin completar, en lugar de estimarlo con una tasa
 * inferida.
 *
 * @param {Prisma.TransactionClient} tx - Cliente transaccional del writer.
 * @param {string} tenantId - Tenant propietario de la venta y sus compras.
 * @param {string} ventaId - Venta cuyo costo FIFO se valora.
 * @returns {Promise<CostoFifoValorado | null>} Costo valorado, o null si la
 * venta no tiene asignaciones FIFO.
 */
export async function getCostoFifoVentaValorado(
	tx: Prisma.TransactionClient,
	tenantId: string,
	ventaId: string,
): Promise<CostoFifoValorado | null> {
	const asignaciones = await tx.purchaseAllocation.findMany({
		where: { tenantId, ventaItem: { ventaId } },
		select: {
			tenantId: true,
			recepcionItemId: true,
			purchaseReceiptInvoiceAllocationId: true,
			cantidad: true,
			costoUnitarioSnapshot: true,
			fifoMonedaOrigen: true,
			fifoFechaFuente: true,
			fifoMonedaFuncional: true,
			fifoCostoFuncional: true,
			fifoTasaCambio: true,
			fifoFechaTasa: true,
			fifoEvidenciaFx: true,
			compraDocumentoItem: {
				select: {
					precioUnitario: true,
					compraDocumento: { select: { moneda: true, fechaCompra: true } },
				},
			},
			purchaseReceiptInvoiceAllocation: {
				select: {
					id: true, tenantId: true, compraDocumentoItemId: true, recepcionItemId: true,
					cantidad: true, costoUnitarioSnapshot: true, fifoMonedaOrigen: true,
					fifoFechaFuente: true, fifoMonedaFuncional: true, fifoCostoFuncional: true,
					fifoTasaCambio: true, fifoFechaTasa: true, fifoEvidenciaFx: true,
					compraDocumentoItem: {
						select: {
							compraDocumentoItemId: true, tenantId: true, productoId: true,
							compraDocumento: { select: {
								tenantId: true, ordenCompraId: true, estado: true, deletedAt: true,
								moneda: true, fechaCompra: true,
							} },
						},
					},
				},
			},
			recepcionItem: {
				select: {
					id: true, tenantId: true, productoId: true,
					ordenItem: { select: { tenantId: true, ordenId: true, productoId: true } },
				},
			},
		},
	});
	if (asignaciones.length === 0) return null;
	const monedaFuncional = await monedaFuncionalDelTenant(tx, tenantId);

	// Solo las filas legacy sin snapshot completo consultan la tasa histórica al leer.
	const fuentes = new Map<string, FuenteCostoFifo>();
	let cantidadTotal = 0;
	let costoCapturado = new Prisma.Decimal(0);
	let fuenteNoVerificable = false;
	for (const asignacion of asignaciones) {
		const cantidad = asignacion.cantidad;
		if (!Number.isSafeInteger(cantidad) || cantidad <= 0) { fuenteNoVerificable = true; continue; }
		cantidadTotal += cantidad;
		const hasReceiptSource = asignacion.recepcionItemId != null;
		const hasInvoiceLayer = asignacion.purchaseReceiptInvoiceAllocationId != null;
		if (hasReceiptSource !== hasInvoiceLayer) {
			// Recepción sin factura trazada (fuente estimada) o capa sin
			// recepción: el costo no es acreditable en el libro formal.
			fuenteNoVerificable = true;
			continue;
		}
		if (hasReceiptSource && hasInvoiceLayer) {
			const source = asignacion.purchaseReceiptInvoiceAllocation;
			const receipt = asignacion.recepcionItem;
			if (!source || !receipt || source.id !== asignacion.purchaseReceiptInvoiceAllocationId ||
				!isCurrentReceiptInvoiceSource(source, receipt, tenantId) ||
				source.cantidad < cantidad || source.costoUnitarioSnapshot == null || !source.fifoMonedaOrigen ||
				!source.fifoFechaFuente || !monedaFuncional) {
				fuenteNoVerificable = true;
				continue;
			}
			const linkedSnapshot = validateFifoSnapshot(
				source,
				monedaFuncional,
				"purchase-receipt-invoice-allocation",
			);
			if (!linkedSnapshot || asignacion.costoUnitarioSnapshot !== source.costoUnitarioSnapshot ||
				asignacion.fifoMonedaOrigen?.trim().toUpperCase() !== source.fifoMonedaOrigen.trim().toUpperCase() ||
				asignacion.fifoFechaFuente?.getTime() !== source.fifoFechaFuente.getTime() ||
				!asignacion.fifoEvidenciaFx) {
				fuenteNoVerificable = true;
				continue;
			}
		}
		const tieneSnapshotOrigen = asignacion.costoUnitarioSnapshot != null ||
			asignacion.fifoMonedaOrigen != null || asignacion.fifoFechaFuente != null;
		const tieneSnapshotFx = asignacion.fifoMonedaFuncional != null ||
			asignacion.fifoCostoFuncional != null || asignacion.fifoTasaCambio != null ||
			asignacion.fifoFechaTasa != null || asignacion.fifoEvidenciaFx != null;
		if (tieneSnapshotOrigen && (asignacion.costoUnitarioSnapshot == null ||
			!asignacion.fifoMonedaOrigen?.trim() || !asignacion.fifoFechaFuente ||
			!Number.isFinite(asignacion.fifoFechaFuente.getTime()))) {
			fuenteNoVerificable = true;
			continue;
		}
		if (tieneSnapshotFx && (!tieneSnapshotOrigen || !asignacion.fifoEvidenciaFx)) {
			fuenteNoVerificable = true;
			continue;
		}
		if (tieneSnapshotFx) {
			const snapshot = monedaFuncional
				? validateFifoSnapshot(asignacion, monedaFuncional)
				: null;
			if (!snapshot) { fuenteNoVerificable = true; continue; }
			costoCapturado = costoCapturado.add(snapshot.amountFunctional);
			continue;
		}
		const costoUnitario =
			asignacion.costoUnitarioSnapshot ?? asignacion.compraDocumentoItem?.precioUnitario ?? null;
		if (costoUnitario == null || !Number.isFinite(costoUnitario) || costoUnitario < 0) {
			fuenteNoVerificable = true; continue;
		}
		const compra = asignacion.compraDocumentoItem?.compraDocumento ?? null;
		const moneda = tieneSnapshotOrigen
			? asignacion.fifoMonedaOrigen!.trim().toUpperCase()
			: compra?.moneda?.trim().toUpperCase();
		const fecha = tieneSnapshotOrigen ? asignacion.fifoFechaFuente : compra?.fechaCompra;
		if (!moneda || !fecha || !Number.isFinite(fecha.getTime())) { fuenteNoVerificable = true; continue; }
		const clave = `${moneda}|${fecha.toISOString()}`;
		const fuente = fuentes.get(clave) ?? { moneda, fecha, costo: 0, cantidad: 0 };
		fuente.costo += costoUnitario * cantidad;
		fuente.cantidad += cantidad;
		fuentes.set(clave, fuente);
	}
	if (fuenteNoVerificable) {
		return { montoFuncional: null, monedaFuncional: await monedaFuncionalDelTenant(tx, tenantId),
			cantidad: cantidadTotal, fuentesSinTasa: ['PROCEDENCIA_FIFO_NO_VERIFICABLE'] };
	}
	if (cantidadTotal === 0) {
		return { montoFuncional: 0, monedaFuncional, cantidad: 0, fuentesSinTasa: [] };
	}
	const legacy = fuentes.size > 0
		? await valorarCostoFifoFuentes(tx, tenantId, [...fuentes.values()])
		: null;
	if (legacy && legacy.montoFuncional === null) return { ...legacy, cantidad: cantidadTotal };
	if (!monedaFuncional) {
		return { montoFuncional: null, monedaFuncional: null, cantidad: cantidadTotal,
			fuentesSinTasa: ['MONEDA_FUNCIONAL_NO_VERIFICABLE'] };
	}
	const total = costoCapturado.add(legacy?.montoFuncional ?? 0)
		.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
	return { montoFuncional: total.toNumber(), monedaFuncional, cantidad: cantidadTotal,
		fuentesSinTasa: legacy?.fuentesSinTasa ?? [] };
}

/**
 * @description Valoración en moneda funcional de un conjunto de fuentes de costo
 * FIFO. Cada fuente se convierte con la tasa publicada vigente en su fecha; una
 * fuente sin tasa deja el importe funcional sin completar en lugar de estimarlo.
 *
 * Una fuente marcada como no verificable (porción estimada sobre una recepción
 * sin factura trazada) deja el importe funcional sin completar con la causa
 * `PROCEDENCIA_FIFO_NO_VERIFICABLE`: el costo estimado nunca llega al libro.
 *
 * @param {Prisma.TransactionClient} tx - Cliente transaccional del writer.
 * @param {string} tenantId - Tenant propietario de las fuentes.
 * @param {FuenteCostoFifo[]} fuentes - Fuentes de costo a valorar.
 * @returns {Promise<CostoFifoValorado>} Costo valorado en moneda funcional.
 */
export async function valorarCostoFifoFuentes(
	tx: Prisma.TransactionClient,
	tenantId: string,
	fuentes: FuenteCostoFifo[],
): Promise<CostoFifoValorado> {
	const monedaFuncional = await monedaFuncionalDelTenant(tx, tenantId);
	const fuentesSinTasa: string[] = [];
	let montoFuncional = 0;
	let cantidadTotal = 0;
	for (const fuente of fuentes) {
		cantidadTotal += fuente.cantidad;
		if (fuente.verificable === false) {
			// Fuente estimada (recepción sin factura trazada): su costo repone
			// inventario, pero no puede acreditarse en el libro formal.
			fuentesSinTasa.push('PROCEDENCIA_FIFO_NO_VERIFICABLE');
			continue;
		}
		if (!monedaFuncional) {
			fuentesSinTasa.push(`${fuente.moneda}@${fuente.fecha.toISOString()}`);
			continue;
		}
		if (fuente.montoFuncional !== undefined) {
			if (!Number.isFinite(fuente.montoFuncional) || fuente.montoFuncional < 0) {
				fuentesSinTasa.push('PROCEDENCIA_FIFO_NO_VERIFICABLE');
				continue;
			}
			montoFuncional += fuente.montoFuncional;
			continue;
		}
		if (fuente.moneda === monedaFuncional) {
			montoFuncional += fuente.costo;
			continue;
		}
		const tasa = await exchangeRateProvider.getRateAsOf({
			sourceCurrency: fuente.moneda,
			targetCurrency: monedaFuncional,
			boundaryAt: fuente.fecha,
			client: tx,
		});
		if (!tasa || !Number.isFinite(tasa.tasa) || tasa.tasa <= 0) {
			fuentesSinTasa.push(`${fuente.moneda}@${fuente.fecha.toISOString()}`);
			continue;
		}
		montoFuncional += fuente.costo * tasa.tasa;
	}

	return {
		montoFuncional: fuentesSinTasa.length > 0 ? null : redondearEscalaFuncional(montoFuncional),
		monedaFuncional,
		cantidad: cantidadTotal,
		fuentesSinTasa,
	};
}

/**
 * @description Lee la moneda funcional declarada en la política contable del tenant.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional del writer.
 * @param {string} tenantId - Tenant consultando su política.
 * @returns {Promise<string | null>} Moneda funcional o null si no hay política.
 */
async function monedaFuncionalDelTenant(
	tx: Prisma.TransactionClient,
	tenantId: string,
): Promise<string | null> {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	return policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
}

/**
 * @description Redondea un importe a la escala de la contabilidad funcional.
 * @param {number} valor - Importe a ajustar.
 * @returns {number} Importe con cuatro decimales.
 */
function redondearEscalaFuncional(valor: number): number {
	return Math.round(valor * 10000) / 10000;
}

/**
 * @description Reversa parcial FIFO de una línea de venta (DNC): recorre las
 * allocations del VentaItem en orden de compra ASC (los lotes más antiguos
 * primero), descuenta la cantidad devuelta y devuelve el costo restaurado.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional.
 * @param {object} params - tenantId, ventaItemId y cantidad a restaurar.
 * @returns {Promise<{ restaurado: number; costoTotal: number; fuentes: FuenteCostoFifo[] }>}
 * Cantidad restaurada, costo total acumulado (ponderado por lote) y las
 * fuentes de costo restituidas para su valoración en moneda funcional.
 */
export async function restaurarAllocacionesFifo(
	tx: Prisma.TransactionClient,
	params: { tenantId: string; ventaItemId: string; cantidad: number },
): Promise<{ restaurado: number; costoTotal: number; fuentes: FuenteCostoFifo[] }> {
	const { tenantId, ventaItemId, cantidad } = params;
	if (cantidad <= 0) return { restaurado: 0, costoTotal: 0, fuentes: [] };

	const allocations = await tx.purchaseAllocation.findMany({
		where: { tenantId, ventaItemId },
		select: {
			id: true,
			recepcionItemId: true,
			purchaseReceiptInvoiceAllocationId: true,
			cantidad: true,
			costoUnitarioSnapshot: true,
			fifoMonedaOrigen: true,
			fifoFechaFuente: true,
			fifoMonedaFuncional: true,
			fifoCostoFuncional: true,
			fifoTasaCambio: true,
			fifoFechaTasa: true,
			fifoEvidenciaFx: true,
			compraDocumentoItem: {
				select: {
					createdAt: true,
					precioUnitario: true,
					compraDocumento: { select: { moneda: true, fechaCompra: true } },
				},
			},
			recepcionItem: {
				select: {
					id: true, tenantId: true, productoId: true,
					recepcion: { select: { fecha: true } },
					ordenItem: { select: {
						createdAt: true, precioUnitario: true,
						tenantId: true, ordenId: true, productoId: true,
					} },
				},
			},
			purchaseReceiptInvoiceAllocation: {
				select: {
					id: true, tenantId: true, compraDocumentoItemId: true, recepcionItemId: true,
					cantidad: true, costoUnitarioSnapshot: true, fifoMonedaOrigen: true,
					fifoFechaFuente: true, fifoMonedaFuncional: true, fifoCostoFuncional: true,
					fifoTasaCambio: true, fifoFechaTasa: true, fifoEvidenciaFx: true,
					compraDocumentoItem: {
						select: {
							compraDocumentoItemId: true, tenantId: true, productoId: true,
							compraDocumento: { select: {
								tenantId: true, ordenCompraId: true, estado: true, deletedAt: true,
								moneda: true, fechaCompra: true,
							} },
						},
					},
				},
			},
		},
	});

	// Orden FIFO: las unidades vuelven al lote más antiguo primero.
	allocations.sort(
		(a, b) => allocationSourceDate(a).getTime() - allocationSourceDate(b).getTime(),
	);

	// Verifica todas las filas afectadas antes de hacer cualquier escritura. Una
	// fuente inválida posterior no debe dejar borrados parciales en esta transacción.
	const verifiedSnapshots = new Map<string, ValidatedFifoSnapshot>();
	// Asignaciones cuya recepción no tiene factura trazada: son fuentes
	// estimadas. Reponen inventario (no invalidan la devolución operativa),
	// pero su costo no es acreditable en el libro formal.
	const estimaciones = new Set<string>();
	let remainingToValidate = cantidad;
	let functionalCurrency: string | null | undefined;
	for (const alloc of allocations) {
		if (remainingToValidate <= 0) break;
		if (!Number.isFinite(alloc.cantidad) || alloc.cantidad <= 0) {
			throw new Error('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		}
		const hasReceiptSource = alloc.recepcionItemId != null || alloc.recepcionItem != null;
		const hasInvoiceLayer = alloc.purchaseReceiptInvoiceAllocationId != null;
		if (hasInvoiceLayer && !hasReceiptSource) {
			// La capa de factura siempre referencia una recepción: sin ella la
			// fila es inconsistente y no se puede restaurar.
			throw new Error('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		}
		if (hasReceiptSource && !hasInvoiceLayer) {
			estimaciones.add(alloc.id);
			remainingToValidate -= Math.min(remainingToValidate, alloc.cantidad);
			continue;
		}
		if (hasReceiptSource && hasInvoiceLayer) {
			const source = alloc.purchaseReceiptInvoiceAllocation;
			const receipt = alloc.recepcionItem;
			if (!source || !receipt || source.id !== alloc.purchaseReceiptInvoiceAllocationId ||
				!isCurrentReceiptInvoiceSource(source, receipt, tenantId) ||
				source.cantidad < alloc.cantidad || !source.fifoMonedaFuncional) {
				throw new Error('PROCEDENCIA_FIFO_NO_VERIFICABLE');
			}
			functionalCurrency ??= await monedaFuncionalDelTenant(tx, tenantId);
			if (!functionalCurrency || !validateFifoSnapshot(
				source,
				functionalCurrency,
				'purchase-receipt-invoice-allocation',
			) || alloc.costoUnitarioSnapshot !== source.costoUnitarioSnapshot ||
				alloc.fifoMonedaOrigen?.trim().toUpperCase() !== source.fifoMonedaOrigen?.trim().toUpperCase() ||
				alloc.fifoFechaFuente?.getTime() !== source.fifoFechaFuente?.getTime()) {
				throw new Error('PROCEDENCIA_FIFO_NO_VERIFICABLE');
			}
		}
		const hasSourceSnapshot = alloc.costoUnitarioSnapshot != null ||
			alloc.fifoMonedaOrigen != null || alloc.fifoFechaFuente != null;
		const hasFxSnapshot = alloc.fifoMonedaFuncional != null ||
			alloc.fifoCostoFuncional != null || alloc.fifoTasaCambio != null ||
			alloc.fifoFechaTasa != null || alloc.fifoEvidenciaFx != null;
		if (hasSourceSnapshot && (alloc.costoUnitarioSnapshot == null ||
			!alloc.fifoMonedaOrigen?.trim() || !alloc.fifoFechaFuente ||
			!Number.isFinite(alloc.fifoFechaFuente.getTime()))) {
			throw new Error('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		}
		if (hasFxSnapshot) {
			if (!hasSourceSnapshot || !alloc.fifoEvidenciaFx) {
				throw new Error('PROCEDENCIA_FIFO_NO_VERIFICABLE');
			}
			functionalCurrency ??= await monedaFuncionalDelTenant(tx, tenantId);
			const snapshot = functionalCurrency
				? validateFifoSnapshot(alloc, functionalCurrency)
				: null;
			if (!snapshot) throw new Error('PROCEDENCIA_FIFO_NO_VERIFICABLE');
			verifiedSnapshots.set(alloc.id, snapshot);
		}
		remainingToValidate -= Math.min(remainingToValidate, alloc.cantidad);
	}

	let restante = cantidad;
	let restaurado = 0;
	let costoTotal = 0;
	// Una fuente por moneda y fecha: la porción restituida conserva la moneda y
	// la fecha con las que se valorado su costo, para que la reposición de
	// inventario use la misma evidencia que el devengo original.
	const fuentes = new Map<string, FuenteCostoFifo>();
	for (const alloc of allocations) {
		if (restante <= 0) break;
		const esEstimada = estimaciones.has(alloc.id);
		const tieneSnapshotOrigen = !esEstimada && (alloc.costoUnitarioSnapshot != null ||
			alloc.fifoMonedaOrigen != null || alloc.fifoFechaFuente != null);
		const snapshot = verifiedSnapshots.get(alloc.id) ?? null;
		const devolver = Math.min(restante, alloc.cantidad);
		const cantidadRestante = alloc.cantidad - devolver;
		const costoUnitario = alloc.costoUnitarioSnapshot ??
			alloc.compraDocumentoItem?.precioUnitario ??
			alloc.recepcionItem?.ordenItem.precioUnitario ?? 0;
		const montoFuncionalDevuelto = snapshot
			? devolver >= alloc.cantidad
				? snapshot.amountFunctional
				: roundFifoAmount(snapshot.amountFunctional * devolver / alloc.cantidad)
			: undefined;
		const snapshotRestante = snapshot && cantidadRestante > 0
			? buildFifoSnapshot({
				amount: costoUnitario * cantidadRestante,
				sourceCurrency: alloc.fifoMonedaOrigen!.trim().toUpperCase(),
				context: {
					functionalCurrency: snapshot.fifoMonedaFuncional,
					rate: snapshot.rate,
					rateDate: snapshot.rateDate,
					rateId: snapshot.rateId,
				},
				functionalAmount: snapshot.amountFunctional - (montoFuncionalDevuelto ?? 0),
			})
			: null;
		if (snapshot && cantidadRestante > 0 && !snapshotRestante) {
			throw new Error('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		}
		if (devolver >= alloc.cantidad) {
			await tx.purchaseAllocation.delete({ where: { id: alloc.id } });
		} else {
			await tx.purchaseAllocation.update({
				where: { id: alloc.id },
				data: {
					cantidad: cantidadRestante,
					...(snapshotRestante ?? {}),
				},
			});
		}
		costoTotal += devolver * costoUnitario;
		restaurado += devolver;
		restante -= devolver;

		const compra = alloc.compraDocumentoItem?.compraDocumento ?? null;
		// Una fuente estimada no tiene factura que le dé moneda y fecha propias:
		// se identifica con la fecha real de recepción y queda marcada como no
		// verificable, de modo que nunca se valorice contra una tasa.
		const moneda = esEstimada
			? compra?.moneda?.trim().toUpperCase() || 'CUP'
			: tieneSnapshotOrigen
				? alloc.fifoMonedaOrigen!.trim().toUpperCase()
				: compra?.moneda?.trim().toUpperCase() || 'CUP';
		const fecha = esEstimada
			? alloc.recepcionItem?.recepcion.fecha ?? alloc.recepcionItem?.ordenItem.createdAt ?? new Date(0)
			: tieneSnapshotOrigen
				? alloc.fifoFechaFuente!
				: compra?.fechaCompra ?? new Date(0);
		const clave = `${moneda}|${fecha.toISOString()}|${snapshot ? 'captured' : esEstimada ? 'estimada' : tieneSnapshotOrigen ? 'source' : 'legacy'}`;
		const fuente = fuentes.get(clave) ?? {
			moneda,
			fecha,
			costo: 0,
			cantidad: 0,
			...(snapshot ? { montoFuncional: 0 } : {}),
			...(esEstimada ? { verificable: false } : {}),
		};
		fuente.costo += devolver * costoUnitario;
		fuente.cantidad += devolver;
		if (snapshot && montoFuncionalDevuelto !== undefined) {
			fuente.montoFuncional = (fuente.montoFuncional ?? 0) + montoFuncionalDevuelto;
		}
		fuentes.set(clave, fuente);
	}

	return { restaurado, costoTotal, fuentes: [...fuentes.values()] };
}

/**
 * @description Resuelve la fecha FIFO de una asignación de compra o recepción.
 * @param {object} allocation - Asignación con su origen físico o financiero.
 * @returns {Date} Fecha de entrada del origen.
 */
function allocationSourceDate(allocation: {
	compraDocumentoItem: { createdAt: Date } | null;
	recepcionItem: {
		recepcion: { fecha: Date };
		ordenItem: { createdAt: Date };
	} | null;
}): Date {
	return allocation.compraDocumentoItem?.createdAt ??
		allocation.recepcionItem?.recepcion.fecha ??
		allocation.recepcionItem?.ordenItem.createdAt ??
		new Date(0);
}
