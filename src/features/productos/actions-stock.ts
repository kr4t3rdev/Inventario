"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { stockUbicacionQuerySchema } from "./schemas";
import type { StockUbicacionQuery } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
// ─── Select reutilizable para stock por ubicación ──────────

const PRODUCTO_CON_STOCK_SELECT = {
	id: true,
	nombre: true,
	descripcion: true,
	codigoInterno: true,
	codigoNegocio: true,
	proveedorCodigo: true,
	idSeccionCodigo: true,
	especificoCodigo: true,
	surtidoCodigo: true,
	dcCodigo: true,
	fotos: true,
	precioCosto: true,
	precioVenta: true,
	stock: true,
	stockMinimo: true,
	categoriaId: true,
	subcategoriaId: true,
	unidadId: true,
	vendorId: true,
	almacenId: true,
	categoria: { select: { catId: true, nombre: true } },
	subcategoria: { select: { catId: true, nombre: true, parentId: true } },
	unidad: { select: { unidadId: true, nombre: true, simbolo: true } },
	vendor: { select: { vendorId: true, nombre: true } },
} as const;

/**
 * @description Obtiene productos con su stock en una ubicación específica
 *   (almacén o punto de venta).
 *
 * - Si includeZero es false: solo productos con stock > 0 en la ubicación.
 * - Si includeZero es true: todos los productos de la ubicación, con stock=0
 *   donde no haya registro en StockUbicacion.
 *
 * @param input - { ubicacionId, tipoUbicacion, includeZero? }
 * @returns Producto[] con campos stockUbicacion y stockTotal agregados
 */
export const getStockPorUbicacionAction = withAction(
	async (input: StockUbicacionQuery, user: AuthenticatedUser) => {
		const { ubicacionId, tipoUbicacion, includeZero } =
			stockUbicacionQuerySchema.parse(input);
		const tenantId = requireTenant(user);

		// ── Path 1: solo productos con stock ──
		if (!includeZero) {
			const registros = await prisma.stockUbicacion.findMany({
				where: {
					ubicacionId,
					tipoUbicacion,
					tenantId,
					cantidad: { gt: 0 },
				},
				include: {
					producto: { select: PRODUCTO_CON_STOCK_SELECT },
				},
			});

			return registros.map((r) => ({
				...r.producto,
				stockUbicacion: r.cantidad,
				stockTotal: r.producto.stock,
			}));
		}

		// ── Path 2: todos los productos con stock (incluye ceros) ──
		// Consulta base de productos filtrados por almacén si aplica
		const whereProductos: Record<string, unknown> = { tenantId };
		if (tipoUbicacion === "almacen") {
			whereProductos.almacenId = ubicacionId;
		}

		const [productosBase, registrosStock] = await Promise.all([
			prisma.producto.findMany({
				where: whereProductos,
				select: PRODUCTO_CON_STOCK_SELECT,
			}),
			prisma.stockUbicacion.findMany({
				where: { ubicacionId, tipoUbicacion, tenantId },
				select: { productoId: true, cantidad: true },
			}),
		]);

		const stockMap = new Map(
			registrosStock.map((r) => [r.productoId, r.cantidad]),
		);

		return productosBase.map((p) => ({
			...p,
			stockUbicacion: stockMap.get(p.id) ?? 0,
			stockTotal: p.stock,
		}));
	},
);

/**
 * Schema para bulk update de stock mínimo.
 */
const bulkUpdateSchema = z.object({
	updates: z
		.array(
			z.object({
				productoId: z.string().min(1),
				stockMinimo: z.number().int().min(0),
			}),
		)
		.min(1),
});

/**
 * @description Actualiza masivamente el stock mínimo de múltiples productos.
 *
 * Cada producto se actualiza de forma independiente; si uno falla, los demás
 * continúan. Retorna un resumen con conteo de éxitos y errores.
 *
 * @param input - { updates: { productoId, stockMinimo }[] }
 * @returns { updated, errors[], results[] }
 */
export const bulkUpdateStockMinimoAction = withAction(
	async (input: z.infer<typeof bulkUpdateSchema>, user: AuthenticatedUser) => {
		requireManagerRole(user, 'modificar el stock mínimo de productos');
		const { updates } = bulkUpdateSchema.parse(input);
		requireTenant(user);

		const results: Array<{ productoId: string; success: boolean }> = [];
		const errors: Array<{ productoId: string; error: string }> = [];

		for (const update of updates) {
			try {
				await prisma.producto.update({
					where: { id: update.productoId },
					data: { stockMinimo: update.stockMinimo },
				});
				results.push({ productoId: update.productoId, success: true });
			} catch {
				errors.push({
					productoId: update.productoId,
					error: "Error al actualizar",
				});
				results.push({ productoId: update.productoId, success: false });
			}
		}

		revalidatePath("/busy/products");
		return {
			updated: results.filter((r) => r.success).length,
			errors,
			results,
		};
	},
);

/**
 * @description Obtiene el historial de restock paginado de un producto.
 *
 * @param input - { productoId, page?, limit?, sortBy?, sortOrder? }
 * @returns Historial paginado con resumen estadístico
 */
export const getRestockHistoryAction = withAction(
	async (
		input: RestockHistoryQueryInput,
		user: AuthenticatedUser,
	): Promise<RestockHistoryResponse> => {
		requireTenant(user);
		const {
			productoId,
			page = 1,
			limit = 15,
			sortBy = "fecha",
			sortOrder = "desc",
		} = input;

		const tenantId = (user as { tenantId: string }).tenantId;
		const skip = (page - 1) * limit;

		// Obtener todos los gastos de compra del producto ordenados por fecha
		// para calcular correctamente el precio anterior de cada registro
		const [allRecords, rawHistory, totalItems, summary, costHistory] =
			await Promise.all([
				// Todos los registros sin paginar (para calcular precioCostoAnterior)
				prisma.gastoCompra.findMany({
					where: { productoId, tenantId },
					orderBy: { createdAt: "asc" },
					select: {
						gastoCompraId: true,
						precioUnitario: true,
						createdAt: true,
					},
				}),
				// Registros paginados para la respuesta
				prisma.gastoCompra.findMany({
					where: { productoId, tenantId },
					orderBy: { [sortBy === "fecha" ? "createdAt" : sortBy]: sortOrder },
					skip,
					take: limit,
					include: {
						producto: {
							select: {
								id: true,
								nombre: true,
								precioCosto: true,
								precioVenta: true,
							},
						},
						vendor: { select: { nombre: true, contacto: true } },
					},
				}),
				prisma.gastoCompra.count({
					where: { productoId, tenantId },
				}),
				prisma.gastoCompra.aggregate({
					where: { productoId, tenantId },
					_count: { productoId: true },
					_sum: { cantidad: true, total: true },
				}),
				// Historial de cambios de precio para detectar priceChanges
				prisma.productoCostHistory.findMany({
					where: { productoId },
					orderBy: { changedAt: "asc" },
					select: {
						reason: true,
						changedAt: true,
						oldPrecioCosto: true,
						newPrecioCosto: true,
					},
				}),
			]);

		// Construir mapa de precios anteriores (precio del registro previo)
		const precioAnteriorMap = new Map<string, number>();
		for (let i = 1; i < allRecords.length; i++) {
			precioAnteriorMap.set(
				allRecords[i].gastoCompraId,
				allRecords[i - 1].precioUnitario,
			);
		}

		// Contar cambios de precio reales en ProductoCostHistory
		const cambioPreciosCount = costHistory.length;

		const history: RestockHistoryItem[] = rawHistory.map((record) => {
			const precioCostoAnterior =
				precioAnteriorMap.get(record.gastoCompraId) ?? 0;
			const precioCambio =
				precioCostoAnterior !== 0 &&
				record.precioUnitario !== precioCostoAnterior;

			// Determinar tipo de operación según si hubo cambio de precio
			let tipoOperacion: RestockHistoryItem["tipoOperacion"] =
				"restock_same_prices";
			if (precioCambio) {
				tipoOperacion = "restock_price_change";
			}

			return {
				id: record.gastoCompraId,
				fecha: record.createdAt.toISOString(),
				cantidad: record.cantidad,
				precioCostoAnterior,
				precioCostoNuevo: record.precioUnitario,
				precioVentaAnterior: record.producto?.precioVenta ?? 0,
				precioVentaNuevo: record.producto?.precioVenta ?? 0,
				totalCompra: record.total,
				descripcion: record.descripcion,
				tipoOperacion,
				vendor: {
					nombre: record.vendor?.nombre ?? "Desconocido",
					contacto: record.vendor?.contacto ?? null,
				},
			};
		});

		const totalPages = Math.ceil(totalItems / limit);
		const totalRestocks = summary._count.productoId || 0;
		const totalQuantityAdded = summary._sum.cantidad || 0;
		const totalCostSpent = summary._sum.total || 0;

		return {
			history,
			pagination: {
				currentPage: page,
				totalPages,
				totalItems,
				itemsPerPage: limit,
				hasNextPage: page < totalPages,
				hasPreviousPage: page > 1,
			},
			summary: {
				totalRestocks,
				totalQuantityAdded,
				totalCostSpent,
				averageCostPerRestock:
					totalRestocks > 0 ? Math.round(totalCostSpent / totalRestocks) : 0,
				priceChanges: cambioPreciosCount,
			},
		};
	},
);

