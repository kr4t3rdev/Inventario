import prisma from "@/lib/prisma";
import type { PrecioFuente } from "@/lib/types/pricing";
import { resolvePrecioVenta } from "@/features/ventas/services/precio-venta-resolver";
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
	/**
	 * Lista marcada `esDefault` del tenant (solo en puntos de venta). Permite
	 * que la UI resuelva la misma cadena cliente > PV > default > base que
	 * valida el servidor (LP-1.2/LP-1.3).
	 */
	listaPrecioDefaultId: string | null;
	/**
	 * Precios por lista relevantes al contexto (lista del PV + lista del
	 * cliente cuando se pasa clienteId + lista default del tenant). Permite
	 * que la UI aplique la cadena del resolver compartido.
	 */
	precios: Array<{ listaPrecioId: string; precio: number }>;
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
 * @param clienteId - Opcional; en puntos de venta incluye también los precios
 *   de la lista del cliente y de la lista default del tenant para que la UI
 *   pueda aplicar la cadena completa cliente > PV > default > base (LP-0/LP-1.2).
 * @returns Lista de productos con stock > 0 en la ubicación
 * @throws {ServerActionError} si la ubicación no existe o hay error de base de datos
 */
export async function getProductosPorUbicacion(
	ubicacionId: string,
	clienteId?: string,
): Promise<ProductoConStock[]> {
	const context = await getAuthenticatedContext();

	// Fail-closed: sin tenant en el contexto no se expone nada (LP-0/review).
	if (!context.tenantId) {
		throw new ServerActionError(
			"getProductosPorUbicacion",
			"GET",
			403,
			"Se requiere una empresa activa para consultar los productos",
		);
	}
	const tenantId = context.tenantId;

	// Verificar si la ubicación existe y determinar el tipo
	let isPuntoVenta = false;
	let listaPrecioId: string | null = null;

	const puntoVenta = await prisma.puntoDeVenta.findFirst({
		where: { pvId: ubicacionId, tenantId },
		select: { pvId: true, listaPrecioId: true },
	});

	if (puntoVenta) {
		isPuntoVenta = true;
		listaPrecioId = puntoVenta.listaPrecioId ?? null;
	} else {
		const almacen = await prisma.almacen.findFirst({
			where: { almacenId: ubicacionId, tenantId },
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
		where: { tenantId },
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
	// Entradas completas por lista relevante (PV + cliente + default) para el payload.
	const preciosPorProductoMap = new Map<
		string,
		Array<{ listaPrecioId: string; precio: number }>
	>();
	let clienteListaId: string | null = null;
	// Lista marcada como default del tenant: fallback intermedio (H3/LP-1.2).
	// Solo participa en el contexto de punto de venta, donde se venden.
	let listaDefaultId: string | null = null;

	if (isPuntoVenta) {
		const listaDefault = await prisma.listaPrecio.findFirst({
			where: { tenantId, esDefault: true },
			select: { id: true },
		});
		listaDefaultId = listaDefault?.id ?? null;
	}

	if (isPuntoVenta && clienteId) {
		const cliente = await prisma.cliente.findFirst({
			where: { clienteId, tenantId },
			select: { listaPrecioId: true },
		});
		clienteListaId = cliente?.listaPrecioId ?? null;
	}

	const listasRelevantes = [listaPrecioId, clienteListaId, listaDefaultId].filter(
		(id): id is string => id !== null,
	);

	if (isPuntoVenta && listasRelevantes.length > 0 && productos.length > 0) {
		const preciosPorLista = await prisma.precioProducto.findMany({
			where: {
				listaPrecioId: { in: listasRelevantes },
				productoId: { in: productos.map((p) => p.id) },
			},
			select: { productoId: true, listaPrecioId: true, precio: true },
		});

		for (const pl of preciosPorLista) {
			const entradas = preciosPorProductoMap.get(pl.productoId) ?? [];
			entradas.push({ listaPrecioId: pl.listaPrecioId, precio: Number(pl.precio) });
			preciosPorProductoMap.set(pl.productoId, entradas);
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

		const stockEnUbicacion = stockReg !== undefined ? stockReg.cantidad : 0;

		// Misma cadena server-side que valida la venta: PV > default > base
		// (la lista del cliente la aplica la UI con el resolver compartido).
		const { precio, fuente } = resolvePrecioVenta({
			precioBase: Number(producto.precioVenta),
			precios: preciosPorProductoMap.get(producto.id) ?? [],
			pvListaId: listaPrecioId,
			clienteListaId: null,
			defaultListaId: listaDefaultId,
		});
		const precioVentaResuelto = precio;
		const precioFuente: PrecioFuente = fuente === "BASE" ? "BASE" : "LISTA";

		return {
			...producto,
			stockEnUbicacion,
			precioVentaResuelto,
			precioFuente,
			listaPrecioIdAplicada: listaPrecioId,
			listaPrecioDefaultId: listaDefaultId,
			precios: preciosPorProductoMap.get(producto.id) ?? [],
		};
	});

	// Filtrar solo productos con stock
	// @ts-expect-error — spread de producto incluye campos no declarados en ProductoConStock
	return productosConStock.filter((p) => p.stockEnUbicacion > 0);
}
