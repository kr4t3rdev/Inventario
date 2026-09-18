/**
 * @description Server Actions para el reporte de Rentabilidad por Compra.
 *
 * @module features/reportes-financieros/actions-rentabilidad-compra
 */
"use server";

import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant } from "@/lib/services/tenant-scope";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ─── Select reutilizable ──────────────────────────────────

const COMPRA_SEARCH_SELECT = {
	compraDocumentoId: true,
	numeroFactura: true,
	total: true,
	estado: true,
	formaPago: true,
	fechaCompra: true,
	proveedor: { select: { vendorId: true, nombre: true } },
	items: {
		select: {
			producto: { select: { id: true, nombre: true } },
		},
	},
} as const;

// ─── Tipos ────────────────────────────────────────────────────

export interface ProductoAnalisis {
	productoId: string;
	productoNombre: string;
	cantidadComprada: number;
	costoUnitario: number;
	costTotal: number;
	unidadesVendidas: number;
	ingresos: number;
	costoVendido: number;
	ganancia: number;
	margen: number;
	stockRestante: number;
	stockRestantePct: number;
	diasPromedioVenta: number | null;
	velocidadVenta: number;
	tieneAllocations: boolean;
}

export interface ResumenAnalisis {
	totalComprado: number;
	totalVendido: number;
	gananciaTotal: number;
	costoTotalVendido: number;
	stockRestante: number;
	cantidadComprada: number;
	roi: number;
	margenPromedio: number;
}

export interface CompraResult {
	compraDocumentoId: string;
	numeroFactura: string;
	proveedorNombre: string | null;
	total: number;
	estado: string;
	formaPago: string;
	fechaCompra: string;
	itemsCount: number;
}

// ─── Search: Buscar compras para el selector ─────────────────

/**
 * @description Busca compras para el selector del reporte.
 *
 *   Retorna compras paginadas, filtrando opcionalmente por
 *   texto de búsqueda (proveedor, factura o producto).
 *
 * @param {object} params - Parámetros de búsqueda.
 * @param {string} [params.search] - Texto para filtrar.
 * @param {number} [params.page=1] - Página actual.
 * @param {number} [params.limit=20] - Items por página.
 * @returns {Promise<{ compras: CompraResult[]; pagination: { page: number; limit: number; total: number } }>}
 */
export const searchComprasAction = withAction(
	async (
		params: { search?: string; page?: number; limit?: number } = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'rentabilidad-compra', 'consultar rentabilidad por compra');
		const tenantId = requireTenant(user);
		const page = params.page ?? 1;
		const limit = params.limit ?? 20;
		const skip = (page - 1) * limit;

		const where: Record<string, unknown> = {
			tenantId,
			deletedAt: null,
			items: { some: {} }, // solo compras con al menos un item
		};

		if (params.search) {
			const search = params.search;
			where.OR = [
				{ numeroFactura: { contains: search, mode: "insensitive" } },
				{ proveedor: { nombre: { contains: search, mode: "insensitive" } } },
				{
					items: {
						some: {
							producto: { nombre: { contains: search, mode: "insensitive" } },
						},
					},
				},
			];
		}

		const [compras, total] = await Promise.all([
			prisma.compraDocumento.findMany({
				where,
				select: COMPRA_SEARCH_SELECT,
				orderBy: { fechaCompra: "desc" },
				skip,
				take: limit,
			}),
			prisma.compraDocumento.count({ where }),
		]);

		const mapped: CompraResult[] = compras.map((c) => ({
			compraDocumentoId: c.compraDocumentoId,
			numeroFactura: c.numeroFactura,
			proveedorNombre: c.proveedor?.nombre ?? null,
			total: c.total,
			estado: c.estado,
			formaPago: c.formaPago,
			fechaCompra: c.fechaCompra.toISOString(),
			itemsCount: c.items.length,
			productos: c.items
				.map((i) => i.producto?.nombre)
				.filter(Boolean) as string[],
		}));

		return {
			compras: mapped,
			pagination: { page, limit, total },
		};
	},
);

// ─── Análisis: Rentabilidad de una compra ───────────────────

/**
 * @description Obtiene el análisis de rentabilidad de una compra específica.
 *
 *   Para cada producto comprado, busca las asignaciones FIFO
 *   (PurchaseAllocation) y calcula:
 *   - Unidades vendidas y total de ingresos
 *   - Costo de venta (precioUnitario × unidades vendidas)
 *   - Ganancia neta y margen porcentual
 *   - Stock restante y porcentaje remanente
 *   - Días promedio para vender y velocidad de venta
 *
 * @param {string} compraId - ID del CompraDocumento.
 * @returns {Promise<{ compra: object; productos: ProductoAnalisis[]; resumen: ResumenAnalisis }>}
 */
export const getRentabilidadCompraAction = withAction(
	async (compraId: string, user: AuthenticatedUser) => {
		requireFeature(user, 'rentabilidad-compra', 'analizar rentabilidad');
		const tenantId = requireTenant(user);

		// 1. Obtener compra con items y productos
		const compra = await prisma.compraDocumento.findFirst({
			where: { compraDocumentoId: compraId, tenantId, deletedAt: null },
			select: {
				compraDocumentoId: true,
				numeroFactura: true,
				fechaCompra: true,
				total: true,
				estado: true,
				formaPago: true,
				proveedor: { select: { vendorId: true, nombre: true } },
				items: {
					select: {
						compraDocumentoItemId: true,
						productoId: true,
						cantidad: true,
						precioUnitario: true,
						totalLinea: true,
						producto: {
							select: {
								id: true,
								nombre: true,
							},
						},
					},
				},
			},
		});

		if (!compra) {
			throw new ActionError("Compra no encontrada", "NOT_FOUND");
		}

		const fechaCompra = compra.fechaCompra;

		// 2. Para cada item, obtener allocations + ventas
		const productos: ProductoAnalisis[] = await Promise.all(
			compra.items.map(async (item) => {
				// Obtener allocations con datos de venta
				const allocations = await prisma.purchaseAllocation.findMany({
					where: { compraDocumentoItemId: item.compraDocumentoItemId },
					select: {
						cantidad: true,
						ventaItem: {
							select: {
								precioUnitario: true,
								createdAt: true,
							},
						},
					},
				});

				const tieneAllocations = allocations.length > 0;
				const unidadesVendidas = allocations.reduce(
					(s, a) => s + a.cantidad,
					0,
				);
				const ingresos = allocations.reduce(
					(s, a) => s + a.cantidad * (a.ventaItem?.precioUnitario ?? 0),
					0,
				);
				const costoVendido = unidadesVendidas * item.precioUnitario;
				const ganancia = ingresos - costoVendido;
				const margen = ingresos > 0 ? (ganancia / ingresos) * 100 : 0;

				// Días promedio para vender
				const diasReales = allocations
					.filter((a) => a.ventaItem?.createdAt)
					.map((a) => {
						const diffMs =
							new Date(a.ventaItem!.createdAt).getTime() -
							new Date(fechaCompra).getTime();
						return diffMs / (1000 * 60 * 60 * 24);
					});

				const diasPromedioVenta =
					diasReales.length > 0
						? Math.round(
								(diasReales.reduce((s, d) => s + d, 0) / diasReales.length) *
									100,
							) / 100
						: null;

				// Velocidad de venta (unidades/día desde la compra)
				const diasDesdeCompra = Math.max(
					1,
					(Date.now() - new Date(fechaCompra).getTime()) /
						(1000 * 60 * 60 * 24),
				);
				const velocidadVenta =
					Math.round((unidadesVendidas / diasDesdeCompra) * 100) / 100;

				const stockRestante = Math.max(0, item.cantidad - unidadesVendidas);
				const stockRestantePct =
					item.cantidad > 0
						? Math.round((stockRestante / item.cantidad) * 100 * 100) / 100
						: 0;

				return {
					productoId: item.productoId,
					productoNombre: item.producto?.nombre ?? "Producto eliminado",
					cantidadComprada: item.cantidad,
					costoUnitario: item.precioUnitario,
					costTotal: item.totalLinea,
					unidadesVendidas,
					ingresos,
					costoVendido,
					ganancia,
					margen: Math.round(margen * 100) / 100,
					stockRestante,
					stockRestantePct,
					diasPromedioVenta,
					velocidadVenta,
					tieneAllocations,
				};
			}),
		);

		// 3. Calcular resumen general
		const totalComprado = compra.total;
		const totalVendido = productos.reduce((s, p) => s + p.ingresos, 0);
		const gananciaTotal = productos.reduce((s, p) => s + p.ganancia, 0);
		const costoTotalVendido = productos.reduce((s, p) => s + p.costoVendido, 0);
		const stockRestante = productos.reduce((s, p) => s + p.stockRestante, 0);
		const cantidadComprada = productos.reduce(
			(s, p) => s + p.cantidadComprada,
			0,
		);
		const roi =
			costoTotalVendido > 0
				? Math.round((gananciaTotal / costoTotalVendido) * 10000) / 100
				: 0;
		const margenPromedio =
			totalVendido > 0
				? Math.round((gananciaTotal / totalVendido) * 10000) / 100
				: 0;

		return {
			compra: {
				compraDocumentoId: compra.compraDocumentoId,
				numeroFactura: compra.numeroFactura,
				fechaCompra: compra.fechaCompra.toISOString(),
				total: compra.total,
				estado: compra.estado,
				formaPago: compra.formaPago,
				proveedor: compra.proveedor,
				cantidadProductos: productos.length,
			},
			productos,
			resumen: {
				totalComprado,
				totalVendido,
				gananciaTotal,
				costoTotalVendido,
				stockRestante,
				cantidadComprada,
				roi,
				margenPromedio,
			},
		};
	},
);
