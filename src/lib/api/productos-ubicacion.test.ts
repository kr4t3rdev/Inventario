import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProductosPorUbicacion } from "./productos-ubicacion";
import type { ProductoConStock } from "@/lib/api/productos-ubicacion";

// Mocks
vi.mock("@/lib/api/client", () => ({
	getAuthenticatedContext: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	default: {
		puntoDeVenta: { findUnique: vi.fn() },
		almacen: { findUnique: vi.fn() },
		producto: { findMany: vi.fn() },
		precioProducto: { findMany: vi.fn() },
		cliente: { findFirst: vi.fn() },
		stockUbicacion: { findMany: vi.fn() },
		transferencia: { aggregate: vi.fn() },
		ventaItem: { aggregate: vi.fn() },
		venta: { aggregate: vi.fn() },
	},
}));

// Mock getStockPorUbicacionBatch internally calls stockUbicacion.findMany

import { getAuthenticatedContext } from "@/lib/api/client";
import prisma from "@/lib/prisma";
import { ServerActionError } from "./errors";

describe("getProductosPorUbicacion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: "user-1" });
	});

	it("should throw ServerActionError when location not found", async () => {
		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(null);
		vi.mocked(prisma.almacen.findUnique).mockResolvedValue(null);

		try {
			await getProductosPorUbicacion("invalid-id");
			expect.unreachable("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(ServerActionError);
			expect((error as ServerActionError).status).toBe(404);
		}
	});

	it("should return products for punto de venta using StockUbicacion when populated", async () => {
		const mockPV = { pvId: "pv-1", listaPrecioId: "lp-1" };
		const mockProducts = [
			{
				id: "prod-1",
				nombre: "Producto 1",
				descripcion: "Desc",
				precioCosto: 100,
				precioVenta: 150,
				stock: 10,
				fotos: [],
				categoriaId: "cat-1",
				unidadId: "und-1",
				vendorId: "v-1",
				createdAt: new Date(),
				updatedAt: new Date(),
				categoria: { catId: "cat-1", nombre: "Categoria" },
				unidad: { unidadId: "und-1", nombre: "Unidad", simbolo: "U" },
				vendor: { vendorId: "v-1", nombre: "Vendor" },
			},
		];

		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(mockPV as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any);
		vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([
			{ productoId: "prod-1", listaPrecioId: "lp-1", precio: 160 },
		] as any);
		// StockUbicacion materializada para el PV via batch query
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 12,
				cantidadReservada: 0,
				cantidadDisponible: 12,
			},
		] as any);

		const result = await getProductosPorUbicacion("pv-1");

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("prod-1");
		expect(result[0].stockEnUbicacion).toBe(12);
		expect(result[0].precioVentaResuelto).toBe(160);
		expect(result[0].precioFuente).toBe("LISTA");
	});

	it("retorna 0 en stockEnUbicacion cuando no existe StockUbicacion (stock=0)", async () => {
		const mockPV = { pvId: "pv-1", listaPrecioId: "lp-1" };
		const mockProducts = [
			{
				id: "prod-2",
				nombre: "Producto 2",
				descripcion: null,
				precioCosto: 50,
				precioVenta: 80,
				stock: 0,
				fotos: [],
				categoriaId: "cat-1",
				unidadId: "und-1",
				vendorId: "v-1",
				createdAt: new Date(),
				updatedAt: new Date(),
				categoria: { catId: "cat-1", nombre: "Cat" },
				unidad: { unidadId: "und-1", nombre: "Unidad", simbolo: "U" },
				vendor: null,
			},
		];

		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(mockPV as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any);
		vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([] as any);
		// StockUbicacion vacío (findMany returns []) → 0 (sin fallback dinámico)
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([]);

		const result = await getProductosPorUbicacion("pv-1");

		// Con stockEnUbicacion = 0, el producto es filtrado por > 0
		expect(result).toHaveLength(0);
	});

	it("should return products for almacen location with StockUbicacion", async () => {
		const mockAlmacen = { almacenId: "alm-1", nombre: "Almacen 1" };
		const mockProducts = [
			{
				id: "prod-1",
				nombre: "Producto 1",
				descripcion: null,
				precioCosto: 100,
				precioVenta: 150,
				stock: 50,
				fotos: [],
				categoriaId: "cat-1",
				unidadId: "und-1",
				vendorId: "v-1",
				createdAt: new Date(),
				updatedAt: new Date(),
				categoria: { catId: "cat-1", nombre: "Cat" },
				unidad: { unidadId: "und-1", nombre: "Unidad", simbolo: "U" },
				vendor: null,
			},
		];

		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(null);
		vi.mocked(prisma.almacen.findUnique).mockResolvedValue(mockAlmacen as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any);
		vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([] as any);
		// StockUbicacion poblado para el almacén
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 55,
				cantidadReservada: 0,
				cantidadDisponible: 55,
			},
		] as any);

		const result = await getProductosPorUbicacion("alm-1");

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("prod-1");
		expect(result[0].stockEnUbicacion).toBe(55);
		expect(result[0].precioFuente).toBe("BASE");
	});

	it("should return correct type ProductoConStock[]", async () => {
		const mockPV = { pvId: "pv-1", listaPrecioId: null };
		const mockProducts = [
			{
				id: "prod-1",
				nombre: "Test",
				descripcion: null,
				precioCosto: 50,
				precioVenta: 80,
				stock: 5,
				fotos: [],
				categoriaId: "cat-1",
				unidadId: "und-1",
				vendorId: "v-1",
				createdAt: new Date(),
				updatedAt: new Date(),
				categoria: null,
				unidad: null,
				vendor: null,
			},
		];

		// Mock StockUbicacion con datos para evitar caer en el fallback dinámico
		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(mockPV as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any);
		vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([]);
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 5,
				cantidadReservada: 0,
				cantidadDisponible: 5,
			},
		] as any);

		const result: ProductoConStock[] = await getProductosPorUbicacion("pv-1");
		expect(Array.isArray(result)).toBe(true);
	});

	it("filtra productos con stock>0 cuando no existe StockUbicacion (stockEnUbicacion=0)", async () => {
		const mockPV = { pvId: "pv-1", listaPrecioId: null };
		const mockProducts = [
			{
				id: "prod-3",
				nombre: "Producto 3",
				descripcion: null,
				precioCosto: 50,
				precioVenta: 80,
				stock: 10,
				fotos: [],
				categoriaId: "cat-1",
				unidadId: "und-1",
				vendorId: "v-1",
				createdAt: new Date(),
				updatedAt: new Date(),
				categoria: null,
				unidad: null,
				vendor: null,
			},
		];

		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(mockPV as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any);
		vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([]);
		// Sin StockUbicacion: el stock del producto no cuenta como stock en ubicación
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([]);

		const result = await getProductosPorUbicacion("pv-1");

		expect(result).toHaveLength(0);
	});

	it("con clienteId incluye en precios las entradas de la lista del PV y la del cliente", async () => {
		const mockPV = { pvId: "pv-1", listaPrecioId: "lp-pv" };
		const mockProducts = [
			{
				id: "prod-1",
				nombre: "Producto 1",
				descripcion: null,
				precioCosto: 100,
				precioVenta: 150,
				stock: 10,
				fotos: [],
				categoriaId: "cat-1",
				unidadId: "und-1",
				vendorId: "v-1",
				createdAt: new Date(),
				updatedAt: new Date(),
				categoria: null,
				unidad: null,
				vendor: null,
			},
		];

		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(mockPV as any);
		vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
			clienteId: "cli-1",
			listaPrecioId: "lp-cli",
		} as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any);
		vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([
			{ productoId: "prod-1", listaPrecioId: "lp-pv", precio: 160 },
			{ productoId: "prod-1", listaPrecioId: "lp-cli", precio: 140 },
		] as any);
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 12,
				cantidadReservada: 0,
				cantidadDisponible: 12,
			},
		] as any);

		const result = await getProductosPorUbicacion("pv-1", "cli-1");

		expect(result).toHaveLength(1);
		// precioVentaResuelto sigue saliendo de la lista del PV
		expect(result[0].precioVentaResuelto).toBe(160);
		// pero el array precios trae ambas listas para que la UI aplique la del cliente
		expect(result[0].precios).toEqual(
			expect.arrayContaining([
				{ listaPrecioId: "lp-pv", precio: 160 },
				{ listaPrecioId: "lp-cli", precio: 140 },
			]),
		);
		// El lookup del cliente va scoped al tenant del contexto
		expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ clienteId: "cli-1" }),
			}),
		);
	});

	it("sin clienteId el array precios solo trae entradas de la lista del PV", async () => {
		const mockPV = { pvId: "pv-1", listaPrecioId: "lp-1" };
		const mockProducts = [
			{
				id: "prod-1",
				nombre: "Producto 1",
				descripcion: null,
				precioCosto: 100,
				precioVenta: 150,
				stock: 10,
				fotos: [],
				categoriaId: "cat-1",
				unidadId: "und-1",
				vendorId: "v-1",
				createdAt: new Date(),
				updatedAt: new Date(),
				categoria: null,
				unidad: null,
				vendor: null,
			},
		];

		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(mockPV as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any);
		vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([
			{ productoId: "prod-1", listaPrecioId: "lp-1", precio: 160 },
		] as any);
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 12,
				cantidadReservada: 0,
				cantidadDisponible: 12,
			},
		] as any);

		const result = await getProductosPorUbicacion("pv-1");

		expect(result).toHaveLength(1);
		expect(result[0].precios).toEqual([{ listaPrecioId: "lp-1", precio: 160 }]);
		expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
	});

	it("en almacén no incluye precios ni consulta cliente aunque llegue clienteId", async () => {
		const mockAlmacen = { almacenId: "alm-1", nombre: "Almacen 1" };
		const mockProducts = [
			{
				id: "prod-1",
				nombre: "Producto 1",
				descripcion: null,
				precioCosto: 100,
				precioVenta: 150,
				stock: 50,
				fotos: [],
				categoriaId: "cat-1",
				unidadId: "und-1",
				vendorId: "v-1",
				createdAt: new Date(),
				updatedAt: new Date(),
				categoria: null,
				unidad: null,
				vendor: null,
			},
		];

		vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(null);
		vi.mocked(prisma.almacen.findUnique).mockResolvedValue(mockAlmacen as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any);
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 55,
				cantidadReservada: 0,
				cantidadDisponible: 55,
			},
		] as any);

		const result = await getProductosPorUbicacion("alm-1", "cli-1");

		expect(result).toHaveLength(1);
		expect(result[0].precios).toEqual([]);
		expect(prisma.precioProducto.findMany).not.toHaveBeenCalled();
		expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
	});
});
