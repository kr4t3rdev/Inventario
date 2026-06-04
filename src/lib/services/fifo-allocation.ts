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

// ─── Tipos ────────────────────────────────────────────────────

export interface AllocateFifoParams {
	tenantId: string;
	ventaItemId: string;
	productoId: string;
	cantidad: number;
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

	// 1. Obtener CompraDocumentoItem del producto ordenadas por fecha ASC
	const purchaseItems = await tx.compraDocumentoItem.findMany({
		where: {
			productoId,
			compraDocumento: {
				tenantId,
				deletedAt: null,
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
			select: { cantidad: true },
		}),
		tx.purchaseAllocation.aggregate({
			where: { compraDocumentoItemId },
			_sum: { cantidad: true },
		}),
	]);

	if (!compraItem) return 0;

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
