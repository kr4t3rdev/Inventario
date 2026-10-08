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
import { buildAppliedFxEvidence } from "@/features/contabilidad/domain/fx-evidence";
import { ActionError } from "@/lib/server-actions";

export interface CostoFifoValorado {
	montoFuncional: Prisma.Decimal;
	monedaFuncional: string;
	cantidadValorada: number;
}

export interface SeleccionCostoFifo {
	ventaItemId: string;
	cantidad: number;
}

// ─── Tipos ────────────────────────────────────────────────────

export interface AllocateFifoParams {
	tenantId: string;
	ventaItemId: string;
	productoId: string;
	cantidad: number;
}

/**
 * @description Valora en la moneda funcional el costo FIFO a partir del snapshot
 * monetario de cada documento de compra asignado a la venta. Las fuentes sin FX
 * verificable no se convierten usando una tasa inferida.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional activo.
 * @param {string} tenantId - Tenant propietario de la venta y compras.
 * @param {string} ventaId - Venta que se costea.
 * @param {SeleccionCostoFifo} [seleccion] - Porción FIFO concreta restaurada en una devolución.
 * @returns {Promise<CostoFifoValorado | null>} Costo funcional, o null sin asignaciones.
 */
export async function getCostoFifoVentaValorado(
	tx: Prisma.TransactionClient,
	tenantId: string,
	ventaId: string,
	seleccion?: SeleccionCostoFifo,
): Promise<CostoFifoValorado | null> {
	if (seleccion && (!Number.isSafeInteger(seleccion.cantidad) || seleccion.cantidad <= 0)) {
		throw new ActionError('La cantidad del costo FIFO no es válida', 'FX_INSUFICIENTE');
	}
	const asignaciones = await tx.purchaseAllocation.findMany({
		where: {
			tenantId,
			ventaItem: {
				ventaId,
				...(seleccion ? { id: seleccion.ventaItemId } : {}),
			},
		},
		select: {
			tenantId: true,
			cantidad: true,
			compraDocumentoItem: {
				select: {
					createdAt: true,
					precioUnitario: true,
					compraDocumento: {
						select: {
							compraDocumentoId: true,
							tenantId: true,
							total: true,
							moneda: true,
							tasaCambio: true,
							montoConvertido: true,
							functionalCurrency: true,
							rateEffectiveAt: true,
							fxProvenanceKind: true,
							fxProvenanceSource: true,
							fxCatalogRateId: true,
							fxEvidenceFingerprint: true,
							fxEvidenceVersion: true,
						},
					},
				},
			},
		},
	});

	if (asignaciones.length === 0) return null;

	const cantidadesValoradas = new Map<string, number>();
	if (seleccion) {
		asignaciones.sort((a, b) =>
			a.compraDocumentoItem.createdAt.getTime() - b.compraDocumentoItem.createdAt.getTime(),
		);
		let pendiente = seleccion.cantidad;
		for (const [index, asignacion] of asignaciones.entries()) {
			if (pendiente <= 0) break;
			const cantidad = Math.min(pendiente, asignacion.cantidad);
			cantidadesValoradas.set(String(index), cantidad);
			pendiente -= cantidad;
		}
		if (cantidadesValoradas.size === 0) return null;
	}

	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase();
	if (!monedaFuncional) {
		throw new ActionError(
			'No hay moneda funcional para valorar el costo FIFO',
			'FX_INSUFICIENTE',
		);
	}

	let costoFuncional = new Prisma.Decimal(0);
	let cantidadValorada = 0;
	for (const [index, asignacion] of asignaciones.entries()) {
		const cantidad = seleccion
			? cantidadesValoradas.get(String(index)) ?? 0
			: asignacion.cantidad;
		if (cantidad <= 0) break;
		const compra = asignacion.compraDocumentoItem.compraDocumento;
		const monedaOriginal = compra.moneda.trim().toUpperCase();
		if (
			asignacion.tenantId !== tenantId ||
			compra.tenantId !== tenantId ||
			!Number.isSafeInteger(asignacion.cantidad) || asignacion.cantidad <= 0 ||
			!Number.isSafeInteger(asignacion.compraDocumentoItem.precioUnitario) ||
			asignacion.compraDocumentoItem.precioUnitario < 0 ||
			(compra.functionalCurrency &&
				compra.functionalCurrency.trim().toUpperCase() !== monedaFuncional)
		) {
			throw new ActionError(
				'La asignación FIFO no pertenece a una fuente monetaria verificable',
				'FX_INSUFICIENTE',
			);
		}

		const costoOriginal = new Prisma.Decimal(
			asignacion.compraDocumentoItem.precioUnitario,
		).mul(cantidad);
		cantidadValorada += cantidad;
		if (monedaOriginal === monedaFuncional) {
			costoFuncional = costoFuncional.add(costoOriginal);
			continue;
		}

		if (
			compra.tasaCambio == null || compra.montoConvertido == null ||
			!compra.functionalCurrency ||
			compra.functionalCurrency.trim().toUpperCase() !== monedaFuncional ||
			!compra.rateEffectiveAt || !compra.fxEvidenceFingerprint ||
			!compra.fxProvenanceSource || compra.fxEvidenceVersion !== 1 ||
			compra.fxProvenanceKind !== 'MANUAL_GOVERNED'
		) {
			throw new ActionError(
				'La compra de origen del costo FIFO no tiene evidencia FX completa',
				'FX_INSUFICIENTE',
			);
		}

		let evidencia: ReturnType<typeof buildAppliedFxEvidence>;
		try {
			evidencia = buildAppliedFxEvidence({
				originalAmount: compra.total,
				originalCurrency: monedaOriginal,
				functionalCurrency: monedaFuncional,
				exchangeRate: Number(compra.tasaCambio),
				convertedAmount: Number(compra.montoConvertido),
				rateEffectiveAt: compra.rateEffectiveAt,
				source: compra.fxProvenanceSource,
				fxCatalogRateId: compra.fxCatalogRateId,
			});
		} catch {
			throw new ActionError(
				'La evidencia FX de la compra de origen no es verificable',
				'FX_INSUFICIENTE',
			);
		}
		if (evidencia.fxEvidenceFingerprint !== compra.fxEvidenceFingerprint) {
			throw new ActionError(
				'La evidencia FX de la compra de origen fue alterada',
				'FX_INSUFICIENTE',
			);
		}

		const tasa = new Prisma.Decimal(compra.tasaCambio);
		if (
			!tasa.gt(0) ||
			!new Prisma.Decimal(compra.montoConvertido).eq(
				new Prisma.Decimal(compra.total).mul(tasa),
			)
		) {
			throw new ActionError(
				'La conversión persistida de la compra no coincide con su tasa',
				'FX_INSUFICIENTE',
			);
		}
		costoFuncional = costoFuncional.add(costoOriginal.mul(tasa));
	}

	if (
		!costoFuncional.isFinite() ||
		!costoFuncional.mul(10000).isInteger() ||
		!costoFuncional.abs().lt('10000000000000000')
	) {
		throw new ActionError(
			'El costo FIFO no es representable en la escala contable funcional',
			'FX_INSUFICIENTE',
		);
	}

	return { montoFuncional: costoFuncional, monedaFuncional, cantidadValorada };
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
		},
	});

	if (purchaseItems.length === 0) {
		// No hay compras registradas para este producto.
		// Puede ser un producto creado manualmente o compuesto.
		return;
	}

	// 2. Obtener asignaciones previas para calcular disponible
	const previousAllocations = await tx.purchaseAllocation.groupBy({
		by: ["compraDocumentoItemId"],
		where: {
			compraDocumentoItemId: {
				in: purchaseItems.map((p) => p.compraDocumentoItemId),
			},
		},
		_sum: { cantidad: true },
	});

	const allocatedMap = new Map<string, number>();
	for (const alloc of previousAllocations) {
		allocatedMap.set(alloc.compraDocumentoItemId, alloc._sum.cantidad ?? 0);
	}

	// 3. Asignar FIFO
	let remaining = cantidad;
	const allocations: Array<{
		tenantId: string;
		compraDocumentoItemId: string;
		ventaItemId: string;
		cantidad: number;
	}> = [];

	for (const item of purchaseItems) {
		if (remaining <= 0) break;

		const alreadyAllocated = allocatedMap.get(item.compraDocumentoItemId) ?? 0;
		const available = item.cantidad - alreadyAllocated;

		if (available <= 0) continue;

		const toAllocate = Math.min(remaining, available);
		allocations.push({
			tenantId,
			compraDocumentoItemId: item.compraDocumentoItemId,
			ventaItemId,
			cantidad: toAllocate,
		});

		remaining -= toAllocate;
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
 * @description Reversa parcial FIFO de una línea de venta (DNC): recorre las
 * allocations del VentaItem en orden de compra ASC (los lotes más antiguos
 * primero), descuenta la cantidad devuelta y devuelve el costo restaurado.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional.
 * @param {object} params - tenantId, ventaItemId y cantidad a restaurar.
 * @returns {Promise<{ restaurado: number; costoTotal: number }>} Cantidad
 * restaurada y costo total acumulado (ponderado por lote).
 */
export async function restaurarAllocacionesFifo(
	tx: Prisma.TransactionClient,
	params: { tenantId: string; ventaItemId: string; cantidad: number },
): Promise<{ restaurado: number; costoTotal: number }> {
	const { tenantId, ventaItemId, cantidad } = params;
	if (cantidad <= 0) return { restaurado: 0, costoTotal: 0 };

	const allocations = await tx.purchaseAllocation.findMany({
		where: { tenantId, ventaItemId },
		include: {
			compraDocumentoItem: {
				select: { createdAt: true, precioUnitario: true },
			},
		},
	});

	// Orden FIFO: las unidades vuelven al lote más antiguo primero.
	allocations.sort(
		(a, b) =>
			new Date(a.compraDocumentoItem.createdAt).getTime() -
			new Date(b.compraDocumentoItem.createdAt).getTime(),
	);

	let restante = cantidad;
	let restaurado = 0;
	let costoTotal = 0;
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
		costoTotal += devolver * alloc.compraDocumentoItem.precioUnitario;
		restaurado += devolver;
		restante -= devolver;
	}

	return { restaurado, costoTotal };
}
