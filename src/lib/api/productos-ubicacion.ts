import prisma from "@/lib/prisma";
import type { PrecioFuente } from "@/lib/types/pricing";
import { getAuthenticatedContext } from "@/lib/api/client";
import { ServerActionError } from "@/lib/api/errors";
import { getStockPorUbicacionBatch } from "@/lib/services/stock-ubicacion-queries";

export interface ProductoConStock {
	id: string;
	nombre: string;
	descripcion: string | null;
	precioCosto: number;
	precioVenta: number;
	precioVentaResuelto: number;
	precioFuente: "LISTA" | "BASE";
	listaPrecioIdAplicada: string | null;
	stock: number;
	stockEnUbicacion: number;
	fotos: string[];
	categoriaId: string;
	unidadId: string;
	vendorId: string;
	codigoBarras?: string;
	createdAt: string;
	updatedAt: string;
	categoria?: {
		catId: string;
		nombre: string;
	};
	unidad?: {
		unidadId: string;
		nombre: string;
		simbolo: string;
	};
	vendor?: {
		vendorId: string;
		nombre: string;
	};
}

/**
 * @description Obtiene productos con stock disponible en una ubicación específica
 * (punto de venta o almacén). Replica la lógica del endpoint GET /api/productos/por-ubicacion/:id
 * pero utilizando Prisma directamente desde la Server Action.
 *
 * @param ubicacionId - ID del punto de venta o almacén
 * @returns Lista de productos con stock > 0 en la ubicación
 * @throws {ServerActionError} si la ubicación no existe o hay error de base de datos
 */
export async function getProductosPorUbicacion(
	ubicacionId: string,
): Promise<ProductoConStock[]> {
	await getAuthenticatedContext();

	// Verificar si la ubicación existe y determinar el tipo
	let isPuntoVenta = false;
	let listaPrecioId: string | null = null;

	const puntoVenta = await prisma.puntoDeVenta.findUnique({
		where: { pvId: ubicacionId },
		select: { pvId: true, listaPrecioId: true },
	});

	if (puntoVenta) {
		isPuntoVenta = true;
		listaPrecioId = puntoVenta.listaPrecioId ?? null;
	} else {
		const almacen = await prisma.almacen.findUnique({
			where: { almacenId: ubicacionId },
		});
		if (!almacen) {
			throw new ServerActionError(
				"getProductosPorUbicacion",
				"GET",
				404,
				"Ubicación no encontrada",
			);
		}
	}

	// Obtener todos los productos con sus relaciones
	const productos = await prisma.producto.findMany({
		select: {
			id: true,
			nombre: true,
			descripcion: true,
			precioCosto: true,
			precioVenta: true,
			stock: true,
			fotos: true,
			categoriaId: true,
			unidadId: true,
			vendorId: true,
			createdAt: true,
			updatedAt: true,
			categoria: true,
			unidad: true,
			vendor: true,
		},
	});

	// Precios por lista de precios (solo para punto de venta)
	const preciosPorListaMap = new Map<string, number>();
	if (isPuntoVenta && listaPrecioId && productos.length > 0) {
		const preciosPorLista = await prisma.precioProducto.findMany({
			where: {
				listaPrecioId,
				productoId: { in: productos.map((p) => p.id) },
			},
			select: { productoId: true, precio: true },
		});

		for (const pl of preciosPorLista) {
			preciosPorListaMap.set(pl.productoId, Number(pl.precio));
		}
	}

	// ── Calcular stock por ubicación usando helper unificado ──
	const tipo = isPuntoVenta ? "punto_venta" : ("almacen" as const);
	const productIds = productos.map((p) => p.id);

	const stockMap = await getStockPorUbicacionBatch(prisma as any, {
		productoIds: productIds,
		tipoUbicacion: tipo,
		ubicacionId,
	});

	const productosConStock = productos.map((producto) => {
		const stockReg = stockMap.get(producto.id);

		if (stockReg === undefined && producto.stock > 0) {
			throw new ServerActionError(
				"getProductosPorUbicacion",
				"GET",
				500,
				`Inconsistencia de stock: producto ${producto.id} (${producto.nombre}) tiene stock=${producto.stock} pero no tiene registro en StockUbicacion para ${tipo} ${ubicacionId}. Ejecute la reconciliación (prisma/scripts/reconcile-stock-ubicacion.ts --fix).`,
			);
		}

		const stockEnUbicacion = stockReg !== undefined ? stockReg.cantidad : 0;

		const precioLista = preciosPorListaMap.get(producto.id);
		const precioVentaResuelto = precioLista ?? Number(producto.precioVenta);
		const precioFuente: PrecioFuente =
			precioLista !== undefined ? "LISTA" : "BASE";

		return {
			...producto,
			stockEnUbicacion,
			precioVentaResuelto,
			precioFuente,
			listaPrecioIdAplicada: listaPrecioId,
		};
	});

	// Filtrar solo productos con stock
	// @ts-expect-error — spread de producto incluye campos no declarados en ProductoConStock
	return productosConStock.filter((p) => p.stockEnUbicacion > 0);
}
