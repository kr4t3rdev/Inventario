/**
 * @description Verificador de stock bajo y sin stock.
 *
 * Usa el campo `stockMinimo` de cada producto en lugar de un threshold fijo.
 * Soporta ejecución por tenant o global.
 * Crea notificaciones batch para evitar N+1 queries.
 *
 * @module lib/verificar-stock
 */

import { prisma } from "@/lib/prisma";

export interface VerificarStockResult {
	productosStockBajo: number;
	productosSinStock: number;
	notificacionesCreadas: number;
	errores: string[];
}

/**
 * @description Verifica stock bajo y sin stock para uno o todos los tenants.
 *
 * @param {Object} opts - Opciones de verificación
 * @param {string} [opts.tenantId] - Tenant específico (opcional, si se omite verifica todos)
 * @param {boolean} [opts.dryRun] - Si es true, no crea notificaciones, solo retorna conteo
 * @returns {Promise<VerificarStockResult>} Resultado de la verificación
 */
export async function verificarStockBajo(
	opts: { tenantId?: string; dryRun?: boolean } = {},
): Promise<VerificarStockResult> {
	const { tenantId, dryRun = false } = opts;

	const result: VerificarStockResult = {
		productosStockBajo: 0,
		productosSinStock: 0,
		notificacionesCreadas: 0,
		errores: [],
	};

	console.log(
		`[verificar-stock] Iniciando verificación${tenantId ? ` para tenant ${tenantId}` : " (todos los tenants)"}...`,
	);

	try {
		// ── Productos con stock bajo (stock > 0, stock <= stockMinimo) ──
		const whereStockBajo: Record<string, unknown> = {
			stock: { gt: 0 },
			stockMinimo: { gt: 0 },
		};
		if (tenantId) whereStockBajo.tenantId = tenantId;

		const productosStockBajo = await prisma.producto.findMany({
			where: {
				...whereStockBajo,
				// stock <= stockMinimo
			},
			select: {
				id: true,
				nombre: true,
				stock: true,
				stockMinimo: true,
				tenantId: true,
				almacen: { select: { nombre: true } },
			},
		});

		// Filtrar en memoria: stock <= stockMinimo (no podemos hacer esto directo en Prisma sin raw)
		const productosBajoStock = productosStockBajo.filter(
			(p) => p.stock <= p.stockMinimo,
		);

		// ── Productos sin stock ──
		const whereSinStock: Record<string, unknown> = { stock: 0 };
		if (tenantId) whereSinStock.tenantId = tenantId;

		const productoSinStock = await prisma.producto.findMany({
			where: whereSinStock,
			select: { id: true, nombre: true, tenantId: true },
		});

		result.productosStockBajo = productosBajoStock.length;
		result.productosSinStock = productoSinStock.length;

		console.log(
			`[verificar-stock] Encontrados: ${productosBajoStock.length} con stock bajo, ${productoSinStock.length} sin stock`,
		);

		if (dryRun) return result;

		// ── Obtener usuarios activos ──
		const usuarios = await prisma.user.findMany({
			where: { isActive: true },
			select: { userId: true, tenantId: true },
		});

		const now = new Date();
		const hace24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		// ── Stock bajo: crear notificaciones batch ──
		for (const producto of productosBajoStock) {
			try {
				// Verificar si ya existe notificación reciente para este producto
				const notifExistente = await prisma.notification.findFirst({
					where: {
						type: "stock_bajo",
						message: { contains: producto.nombre },
						createdAt: { gte: hace24h },
					},
				});

				if (notifExistente) continue;

				const almacenNombre = producto.almacen?.nombre ?? "N/A";

				// Crear notificaciones para todos los usuarios del mismo tenant
				const usuariosDelTenant = tenantId
					? usuarios
					: usuarios.filter((u) => u.tenantId === producto.tenantId);

				if (usuariosDelTenant.length === 0) continue;

				await prisma.notification.createMany({
					data: usuariosDelTenant.map((u) => ({
						title: "Stock Bajo",
						message: `El producto "${producto.nombre}" tiene stock bajo (${producto.stock} de ${producto.stockMinimo} mínimo) - Almacén: ${almacenNombre}`,
						link: "/busy/products",
						type: "stock_bajo",
						prioridad: "media",
						userId: u.userId,
					})),
				});

				result.notificacionesCreadas += usuariosDelTenant.length;
				console.log(
					`[verificar-stock] Notificaciones creadas para stock bajo: ${producto.nombre}`,
				);
			} catch (err) {
				const msg = `Error notificando stock bajo para ${producto.nombre}: ${err}`;
				console.error(msg);
				result.errores.push(msg);
			}
		}

		// ── Sin stock: crear notificaciones batch ──
		for (const producto of productoSinStock) {
			try {
				const notifExistente = await prisma.notification.findFirst({
					where: {
						type: "sin_stock",
						message: { contains: producto.nombre },
						createdAt: { gte: hace24h },
					},
				});

				if (notifExistente) continue;

				const usuariosDelTenant = tenantId
					? usuarios
					: usuarios.filter((u) => u.tenantId === producto.tenantId);

				if (usuariosDelTenant.length === 0) continue;

				await prisma.notification.createMany({
					data: usuariosDelTenant.map((u) => ({
						title: "Sin Stock",
						message: `El producto "${producto.nombre}" está agotado`,
						link: "/busy/products",
						type: "sin_stock",
						prioridad: "alta",
						userId: u.userId,
					})),
				});

				result.notificacionesCreadas += usuariosDelTenant.length;
				console.log(
					`[verificar-stock] Notificaciones creadas para sin stock: ${producto.nombre}`,
				);
			} catch (err) {
				const msg = `Error notificando sin stock para ${producto.nombre}: ${err}`;
				console.error(msg);
				result.errores.push(msg);
			}
		}

		console.log(
			`[verificar-stock] Verificación completada. ${result.productosStockBajo} bajo stock, ${result.productosSinStock} sin stock, ${result.notificacionesCreadas} notificaciones.`,
		);

		return result;
	} catch (error) {
		const msg = `Error verificando stock: ${error}`;
		console.error(msg);
		result.errores.push(msg);
		return result;
	}
}

// ── Ejecución directa (solo si se corre como script) ──
const isMainModule = process.argv[1]?.includes("verificar-stock");
if (isMainModule) {
	verificarStockBajo()
		.then((r) => {
			console.log(
				`Finalizado: ${r.productosStockBajo} bajo stock, ${r.productosSinStock} sin stock, ${r.notificacionesCreadas} notificaciones`,
			);
			if (r.errores.length > 0) {
				console.error(`${r.errores.length} errores:`);
				r.errores.forEach((e) => console.error(`  - ${e}`));
			}
			process.exit(r.errores.length > 0 ? 1 : 0);
		})
		.catch((e) => {
			console.error("Error fatal:", e);
			process.exit(1);
		});
}
