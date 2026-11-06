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
}

/**
 * @description Calcula el costo unitario actual de una línea recibida,
 * combinando el costo facturado y el costo acordado para unidades pendientes.
 * @param {object} item - Línea recibida con importes facturados y costo OC.
 * @returns {number} Costo unitario estimado o conciliado, en la unidad mínima.
 */
function costoUnitarioRecepcion(item: {
	cantidad: number;
	cantidadFacturada: number;
	montoFacturado: number;
	ordenItem: { precioUnitario: number };
}): number {
	if (item.cantidad <= 0) return item.ordenItem.precioUnitario;
	const cantidadFacturada = item.cantidadFacturada ?? 0;
	const montoFacturado = item.montoFacturado ?? 0;
	const montoPendiente = (item.cantidad - cantidadFacturada) * item.ordenItem.precioUnitario;
	return Math.round((montoFacturado + montoPendiente) / item.cantidad);
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
			createdAt: true,
			compraDocumento: { select: { ordenCompraId: true } },
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
				cantidadFacturada: true,
				montoFacturado: true,
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
		costoUnitario: number;
		fechaRecepcion: Date;
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
				costoUnitario: costoUnitarioRecepcion(receiptItem),
				fechaRecepcion: receiptItem.recepcion.fecha,
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
					costoUnitario: number;
					fechaRecepcion: Date;
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
		cantidad: number;
	}> = [];
	const allocatedInThisCallByLot = new Map<string, number>();
	const allocatedInThisCallByReceiptItem = new Map<string, number>();

	for (const source of sources) {
		if (remaining <= 0) break;
		if (source.kind === "purchase") {
			const item = source.item;
			const available = Math.max(0, item.cantidad - (allocatedMap.get(item.compraDocumentoItemId) ?? 0));
			if (available <= 0) continue;
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
			allocations.push({
				tenantId,
				compraDocumentoItemId: null,
				recepcionItemId: entry.recepcionItemId,
				ventaItemId,
				loteId: entry.lot.id,
				costoUnitarioSnapshot: entry.costoUnitario,
				cantidad: toAllocate,
			});
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
			cantidad: true,
			costoUnitarioSnapshot: true,
			compraDocumentoItem: {
				select: {
					precioUnitario: true,
					compraDocumento: { select: { moneda: true, fechaCompra: true } },
				},
			},
		},
	});
	if (asignaciones.length === 0) return null;

	// Una fuente por moneda y fecha: las porciones de la misma fuente comparten
	// la tasa publicada vigente en su fecha.
	const fuentes = new Map<string, FuenteCostoFifo>();
	let cantidadTotal = 0;
	for (const asignacion of asignaciones) {
		const cantidad = asignacion.cantidad;
		if (!Number.isSafeInteger(cantidad) || cantidad <= 0) continue;
		const costoUnitario =
			asignacion.costoUnitarioSnapshot ?? asignacion.compraDocumentoItem?.precioUnitario ?? null;
		if (costoUnitario == null || !Number.isFinite(costoUnitario) || costoUnitario < 0) continue;
		const compra = asignacion.compraDocumentoItem?.compraDocumento ?? null;
		const moneda = compra?.moneda?.trim().toUpperCase() || "CUP";
		const fecha = compra?.fechaCompra ?? new Date(0);
		const clave = `${moneda}|${fecha.toISOString()}`;
		const fuente = fuentes.get(clave) ?? { moneda, fecha, costo: 0, cantidad: 0 };
		fuente.costo += costoUnitario * cantidad;
		fuente.cantidad += cantidad;
		fuentes.set(clave, fuente);
		cantidadTotal += cantidad;
	}
	if (cantidadTotal === 0) {
		return { montoFuncional: 0, monedaFuncional: await monedaFuncionalDelTenant(tx, tenantId), cantidad: 0, fuentesSinTasa: [] };
	}

	return valorarCostoFifoFuentes(tx, tenantId, [...fuentes.values()]);
}

/**
 * @description Valoración en moneda funcional de un conjunto de fuentes de costo
 * FIFO. Cada fuente se convierte con la tasa publicada vigente en su fecha; una
 * fuente sin tasa deja el importe funcional sin completar en lugar de estimarlo.
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
		if (!monedaFuncional) {
			fuentesSinTasa.push(`${fuente.moneda}@${fuente.fecha.toISOString()}`);
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
			cantidad: true,
			costoUnitarioSnapshot: true,
			compraDocumentoItem: {
				select: {
					createdAt: true,
					precioUnitario: true,
					compraDocumento: { select: { moneda: true, fechaCompra: true } },
				},
			},
			recepcionItem: {
				select: {
					recepcion: { select: { fecha: true } },
					ordenItem: { select: { createdAt: true, precioUnitario: true } },
				},
			},
		},
	});

	// Orden FIFO: las unidades vuelven al lote más antiguo primero.
	allocations.sort(
		(a, b) => allocationSourceDate(a).getTime() - allocationSourceDate(b).getTime(),
	);

	let restante = cantidad;
	let restaurado = 0;
	let costoTotal = 0;
	// Una fuente por moneda y fecha: la porción restituida conserva la moneda y
	// la fecha con las que se valorado su costo, para que la reposición de
	// inventario use la misma evidencia que el devengo original.
	const fuentes = new Map<string, FuenteCostoFifo>();
	for (const alloc of allocations) {
		if (restante <= 0) break;
		const devolver = Math.min(restante, alloc.cantidad);
		if (devolver >= alloc.cantidad) {
			await tx.purchaseAllocation.delete({ where: { id: alloc.id } });
		} else {
			await tx.purchaseAllocation.update({
				where: { id: alloc.id },
				data: { cantidad: alloc.cantidad - devolver },
			});
		}
		const costoUnitario = alloc.costoUnitarioSnapshot ??
			alloc.compraDocumentoItem?.precioUnitario ??
			alloc.recepcionItem?.ordenItem.precioUnitario ?? 0;
		costoTotal += devolver * costoUnitario;
		restaurado += devolver;
		restante -= devolver;

		const compra = alloc.compraDocumentoItem?.compraDocumento ?? null;
		const moneda = compra?.moneda?.trim().toUpperCase() || "CUP";
		const fecha = compra?.fechaCompra ?? new Date(0);
		const clave = `${moneda}|${fecha.toISOString()}`;
		const fuente = fuentes.get(clave) ?? { moneda, fecha, costo: 0, cantidad: 0 };
		fuente.costo += devolver * costoUnitario;
		fuente.cantidad += devolver;
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
