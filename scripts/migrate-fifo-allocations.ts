/**
 * @description Script de migración one-time: asigna ventas existentes a compras
 *   usando FIFO (First In, First Out) y crea registros en PurchaseAllocation.
 *
 *   Procesa VentaItem en orden cronológico (más antiguos primero) para
 *   garantizar asignación FIFO correcta.
 *
 * Uso:
 *   pnpm exec tsx scripts/migrate-fifo-allocations.ts              # Normal
 *   pnpm exec tsx scripts/migrate-fifo-allocations.ts --dry-run     # Solo simular
 *   pnpm exec tsx scripts/migrate-fifo-allocations.ts --force       # Re-procesar todo
 *
 * @module scripts/migrate-fifo-allocations
 */

import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

const BATCH_SIZE = 500;
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");

interface Stats {
	totalVentaItems: number;
	processedItems: number;
	totalAllocations: number;
	noPurchases: number;
	errors: number;
}

/**
 * @description Obtiene el stock disponible de un item de compra (cantidad - asignaciones previas).
 */
async function getAvailableStock(
	compraDocumentoItemId: string,
): Promise<number> {
	const [compraItem, allocatedResult] = await Promise.all([
		prisma.compraDocumentoItem.findUnique({
			where: { compraDocumentoItemId },
			select: { cantidad: true },
		}),
		prisma.purchaseAllocation.aggregate({
			where: { compraDocumentoItemId },
			_sum: { cantidad: true },
		}),
	]);

	if (!compraItem) return 0;
	return Math.max(
		0,
		compraItem.cantidad - (allocatedResult._sum.cantidad ?? 0),
	);
}

/**
 * @description Procesa un VentaItem con asignación FIFO.
 */
async function processVentaItem(
	stats: Stats,
	item: {
		id: string;
		productoId: string;
		cantidad: number;
		venta: { tenantId: string };
	},
): Promise<number> {
	// Obtener compras del producto ordenadas por fecha ASC
	const purchaseItems = await prisma.compraDocumentoItem.findMany({
		where: {
			productoId: item.productoId,
			compraDocumento: {
				tenantId: item.venta.tenantId,
				deletedAt: null,
			},
		},
		orderBy: { createdAt: "asc" },
		select: { compraDocumentoItemId: true, cantidad: true },
	});

	if (purchaseItems.length === 0) {
		stats.noPurchases++;
		return 0;
	}

	let remaining = item.cantidad;
	const allocations: Array<{
		tenantId: string;
		compraDocumentoItemId: string;
		ventaItemId: string;
		cantidad: number;
	}> = [];

	for (const pi of purchaseItems) {
		if (remaining <= 0) break;

		const available = await getAvailableStock(pi.compraDocumentoItemId);
		if (available <= 0) continue;

		const toAllocate = Math.min(remaining, available);
		allocations.push({
			tenantId: item.venta.tenantId,
			compraDocumentoItemId: pi.compraDocumentoItemId,
			ventaItemId: item.id,
			cantidad: toAllocate,
		});

		remaining -= toAllocate;
	}

	if (allocations.length > 0) {
		if (!isDryRun) {
			await prisma.purchaseAllocation.createMany({ data: allocations });
		}
		return allocations.length;
	}

	return 0;
}

/**
 * @description Procesa todos los VentaItem en batches.
 */
async function migrate() {
	console.log("\n========================================");
	console.log("  FIFO Allocation Migration");
	console.log("========================================\n");

	if (isDryRun) {
		console.log("  🔍 DRY RUN — no se escribirán datos\n");
	}
	if (isForce) {
		console.log("  ⚠️  FORCE — se eliminarán allocations existentes\n");
	}

	// Si es force, limpiar allocations existentes
	if (isForce && !isDryRun) {
		console.log("  Eliminando PurchaseAllocations existentes...");
		const deleted = await prisma.purchaseAllocation.deleteMany({});
		console.log(`  → ${deleted.count} registros eliminados\n`);
	}

	// Obtener total de VentaItem para progreso
	const totalCount = await prisma.ventaItem.count();
	console.log(`  Total VentaItem a procesar: ${totalCount}\n`);

	const stats: Stats = {
		totalVentaItems: totalCount,
		processedItems: 0,
		totalAllocations: 0,
		noPurchases: 0,
		errors: 0,
	};

	let cursor: { id: string } | undefined;
	let batchNumber = 0;

	while (true) {
		batchNumber++;

		const batch = await prisma.ventaItem.findMany({
			take: BATCH_SIZE,
			orderBy: { createdAt: "asc" },
			...(cursor ? { cursor, skip: 1 } : {}),
			select: {
				id: true,
				productoId: true,
				cantidad: true,
				venta: { select: { tenantId: true } },
			},
		});

		if (batch.length === 0) break;

		let batchAllocations = 0;
		let batchErrors = 0;

		for (const item of batch) {
			try {
				const allocCount = await processVentaItem(stats, item);
				batchAllocations += allocCount;
				stats.processedItems++;
			} catch (err) {
				batchErrors++;
				stats.errors++;
				console.error(`  [ERROR] VentaItem ${item.id}:`, err);
			}
		}

		console.log(
			`  [Batch ${batchNumber}] ${batch.length} items → ${batchAllocations} allocations` +
				(batchErrors > 0 ? ` (${batchErrors} errores)` : ""),
		);

		// Actualizar cursor
		if (batch.length < BATCH_SIZE) break;
		cursor = { id: batch[batch.length - 1].id };
	}

	// Resumen
	console.log("\n========================================");
	console.log("  RESUMEN");
	console.log("========================================\n");
	console.log(`  Total VentaItem:       ${stats.totalVentaItems}`);
	console.log(`  Procesados:            ${stats.processedItems}`);
	console.log(`  Allocations creadas:   ${stats.totalAllocations}`);
	console.log(`  Sin compras:           ${stats.noPurchases}`);
	console.log(`  Errores:               ${stats.errors}`);
	console.log("");

	if (isDryRun) {
		console.log("  🔍 DRY RUN completado — no se escribieron datos\n");
	}
}

// ─── Ejecutar ──────────────────────────────────────────────────

migrate()
	.then(() => {
		console.log("  ✅ Migración completada\n");
		process.exit(0);
	})
	.catch((err) => {
		console.error("\n  ❌ Migración fallida:", err);
		process.exit(1);
	})
	.finally(() => {
		prisma.$disconnect();
	});
