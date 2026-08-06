import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = vi.hoisted(() => ({
	producto: {
		count: vi.fn(),
		findMany: vi.fn(),
	},
	almacen: {
		count: vi.fn(),
	},
	puntoDeVenta: {
		count: vi.fn(),
	},
	venta: {
		findMany: vi.fn(),
		groupBy: vi.fn(),
	},
	ventaItem: {
		findMany: vi.fn(),
	},
	ventaServicios: {
		findMany: vi.fn(),
	},
	merma: {
		findMany: vi.fn(),
	},
	gastosDE: {
		findMany: vi.fn(),
	},
	gastosServicios: {
		findMany: vi.fn(),
	},
	pagosalario: {
		findMany: vi.fn(),
	},
	empleado: {
		findMany: vi.fn(),
	},
	transferencia: {
		findMany: vi.fn(),
	},
	stockUbicacion: {
		findMany: vi.fn(),
	},
	categoria: {
		findMany: vi.fn(),
	},
	gastoCompra: {
		findMany: vi.fn(),
	},
	$transaction: vi.fn(),
}));

const mockUser = { tenantId: 'tenant-1' };

vi.mock("@/lib/auth-middleware", () => ({
	withAuthGet: (handler: any) => (request: any, context?: any) =>
		handler(request, context, mockUser),
}));

vi.mock("@/lib/prisma", () => ({
	default: mockPrisma,
	prisma: mockPrisma,
}));

import { invalidateDashboardStatsCache } from "@/features/dashboard/services/dashboard-stats-service";
import { GET } from "../stats/route";

describe("Dashboard Stats API - Minimum Stock Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		invalidateDashboardStatsCache();

		// Setup default mock responses
		mockPrisma.producto.count.mockResolvedValue(100);
		mockPrisma.almacen.count.mockResolvedValue(5);
		mockPrisma.puntoDeVenta.count.mockResolvedValue(3);
		mockPrisma.venta.findMany.mockResolvedValue([]);
		mockPrisma.venta.groupBy.mockResolvedValue([]);
		mockPrisma.ventaItem.findMany.mockResolvedValue([]);
		mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
		mockPrisma.merma.findMany.mockResolvedValue([]);
		mockPrisma.gastosDE.findMany.mockResolvedValue([]);
		mockPrisma.gastosServicios.findMany.mockResolvedValue([]);
		mockPrisma.pagosalario.findMany.mockResolvedValue([]);
		mockPrisma.empleado.findMany.mockResolvedValue([]);
		mockPrisma.transferencia.findMany.mockResolvedValue([]);
		mockPrisma.stockUbicacion.findMany.mockResolvedValue([]);
		mockPrisma.categoria.findMany.mockResolvedValue([]);
		mockPrisma.producto.findMany.mockResolvedValue([]);
		mockPrisma.gastoCompra.findMany.mockResolvedValue([]);
	});

	it("should calculate low stock using hybrid logic with custom minimums", async () => {
		const mockProductos = [
			{
				id: "prod1",
				nombre: "Producto A",
				stock: 5,
				stockMinimo: 10,
				categoria: { nombre: "Categoria 1" },
				unidad: { simbolo: "pcs" },
			},
			{
				id: "prod2",
				nombre: "Producto B",
				stock: 15,
				stockMinimo: 20,
				categoria: { nombre: "Categoria 2" },
				unidad: { simbolo: "kg" },
			},
			{
				id: "prod3",
				nombre: "Producto C",
				stock: 25,
				stockMinimo: 20,
				categoria: { nombre: "Categoria 3" },
				unidad: { simbolo: "L" },
			},
		];

		// Mock the multiple calls for general, top, and low-stock products
		mockPrisma.producto.findMany
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos);

		// El stock viene de StockUbicacion (fuente de verdad)
		mockPrisma.stockUbicacion.findMany.mockResolvedValue([
			{
				productoId: "prod1",
				cantidad: 5,
				producto: { id: "prod1", nombre: "Producto A", precioCosto: 10, categoria: { nombre: "Categoria 1" } },
			},
			{
				productoId: "prod2",
				cantidad: 15,
				producto: { id: "prod2", nombre: "Producto B", precioCosto: 10, categoria: { nombre: "Categoria 2" } },
			},
			{
				productoId: "prod3",
				cantidad: 25,
				producto: { id: "prod3", nombre: "Producto C", precioCosto: 10, categoria: { nombre: "Categoria 3" } },
			},
		] as any);

		const request = new NextRequest(
			"http://localhost:3000/api/dashboard/stats",
		);
		const response = await GET(request);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.productosStockBajo).toBeDefined();
		expect(Array.isArray(data.productosStockBajo)).toBe(true);

		// Should include products with stock below their custom minimum
		const lowStockProducts = data.productosStockBajo;
		expect(lowStockProducts.length).toBeGreaterThan(0);

		// Producto A should be in low stock (5 < 10)
		const prodA = lowStockProducts.find((p: any) => p.nombre === "Producto A");
		expect(prodA).toBeDefined();
		expect(prodA.stockTotal).toBe(5);
		expect(prodA.stockMinimo).toBe(10);
		expect(prodA.umbralUsado).toBe(10);
		expect(prodA.diferencia).toBe(5);

		// Producto B should be in low stock (15 < 20)
		const prodB = lowStockProducts.find((p: any) => p.nombre === "Producto B");
		expect(prodB).toBeDefined();
		expect(prodB.stockTotal).toBe(15);
		expect(prodB.stockMinimo).toBe(20);
		expect(prodB.umbralUsado).toBe(20);

		// Producto C should NOT be in low stock (25 >= 20)
		const prodC = lowStockProducts.find((p: any) => p.nombre === "Producto C");
		expect(prodC).toBeUndefined();
	});

	it("should use default threshold for products with stockMinimo = 0", async () => {
		const mockProductos = [
			{
				id: "prod1",
				nombre: "Producto A",
				stock: 5,
				stockMinimo: 0, // No custom minimum set
				categoria: { nombre: "Categoria 1" },
				unidad: { simbolo: "pcs" },
			},
			{
				id: "prod2",
				nombre: "Producto B",
				stock: 15,
				stockMinimo: 0, // No custom minimum set
				categoria: { nombre: "Categoria 2" },
				unidad: { simbolo: "kg" },
			},
		];

		mockPrisma.producto.findMany
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos);

		// El stock viene de StockUbicacion (fuente de verdad)
		mockPrisma.stockUbicacion.findMany.mockResolvedValue([
			{
				productoId: "prod1",
				cantidad: 5,
				producto: { id: "prod1", nombre: "Producto A", precioCosto: 10, categoria: { nombre: "Categoria 1" } },
			},
			{
				productoId: "prod2",
				cantidad: 15,
				producto: { id: "prod2", nombre: "Producto B", precioCosto: 10, categoria: { nombre: "Categoria 2" } },
			},
		] as any);

		const request = new NextRequest(
			"http://localhost:3000/api/dashboard/stats",
		);
		const response = await GET(request);
		const data = await response.json();

		expect(response.status).toBe(200);

		const lowStockProducts = data.productosStockBajo;

		// Producto A should be in low stock (5 < 10 default)
		const prodA = lowStockProducts.find((p: any) => p.nombre === "Producto A");
		expect(prodA).toBeDefined();
		expect(prodA.stockTotal).toBe(5);
		expect(prodA.stockMinimo).toBe(0);
		expect(prodA.umbralUsado).toBe(10); // Default threshold

		// Producto B should NOT be in low stock (15 >= 10 default)
		const prodB = lowStockProducts.find((p: any) => p.nombre === "Producto B");
		expect(prodB).toBeUndefined();
	});

	it("should aggregate stock across multiple product instances", async () => {
		const mockProductos = [
			{
				id: "prod1a",
				nombre: "Producto A",
				stock: 3,
				stockMinimo: 15,
				categoria: { nombre: "Categoria 1" },
				unidad: { simbolo: "pcs" },
			},
			{
				id: "prod1b",
				nombre: "Producto A", // Same product, different instance
				stock: 7,
				stockMinimo: 12, // Different minimum
				categoria: { nombre: "Categoria 1" },
				unidad: { simbolo: "pcs" },
			},
		];

		mockPrisma.producto.findMany
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos);

		// El stock viene de StockUbicacion (fuente de verdad) — se agrega 3 + 7 = 10
		mockPrisma.stockUbicacion.findMany.mockResolvedValue([
			{
				productoId: "prod1a",
				cantidad: 3,
				producto: { id: "prod1a", nombre: "Producto A", precioCosto: 10, categoria: { nombre: "Categoria 1" } },
			},
			{
				productoId: "prod1b",
				cantidad: 7,
				producto: { id: "prod1b", nombre: "Producto A", precioCosto: 10, categoria: { nombre: "Categoria 1" } },
			},
		] as any);

		const request = new NextRequest(
			"http://localhost:3000/api/dashboard/stats",
		);
		const response = await GET(request);
		const data = await response.json();

		expect(response.status).toBe(200);

		const lowStockProducts = data.productosStockBajo;
		const prodA = lowStockProducts.find((p: any) => p.nombre === "Producto A");

		expect(prodA).toBeDefined();
		expect(prodA.stockTotal).toBe(10); // 3 + 7 aggregated
		expect(prodA.stockMinimo).toBe(12); // Minimum of 15 and 12
		expect(prodA.umbralUsado).toBe(12);
	});

	it("should filter by location when ubicacionId and tipoUbicacion are provided", async () => {
		const mockProductos = [
			{
				id: "prod1",
				nombre: "Producto A",
				stock: 5,
				stockMinimo: 10,
				almacenId: "almacen1",
				categoria: { nombre: "Categoria 1" },
				unidad: { simbolo: "pcs" },
			},
		];

		mockPrisma.producto.findMany
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos);

		const request = new NextRequest(
			"http://localhost:3000/api/dashboard/stats?ubicacionId=almacen1&tipoUbicacion=almacen",
		);
		const response = await GET(request);

		expect(response.status).toBe(200);

		// Verify that findMany was called with location filter
		expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { tenantId: "tenant-1", almacenId: "almacen1" },
			}),
		);
	});

	it("should handle empty product list gracefully", async () => {
		mockPrisma.producto.findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const request = new NextRequest(
			"http://localhost:3000/api/dashboard/stats",
		);
		const response = await GET(request);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.productosStockBajo).toEqual([]);
		expect(data.valorTotalInventario).toBe(0);
	});

	it("should limit low stock products to 5 items", async () => {
		const mockProductos = Array.from({ length: 10 }, (_, i) => ({
			id: `prod${i}`,
			nombre: `Producto ${i}`,
			stock: 1, // All have very low stock
			stockMinimo: 10,
			categoria: { nombre: `Categoria ${i}` },
			unidad: { simbolo: "pcs" },
		}));

		mockPrisma.producto.findMany
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos);

		const request = new NextRequest(
			"http://localhost:3000/api/dashboard/stats",
		);
		const response = await GET(request);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.productosStockBajo).toHaveLength(5); // Limited to 5
	});

	it("should sort low stock products by stock total ascending", async () => {
		const mockProductos = [
			{
				id: "prod1",
				nombre: "Producto A",
				stock: 8,
				stockMinimo: 10,
				categoria: { nombre: "Categoria 1" },
				unidad: { simbolo: "pcs" },
			},
			{
				id: "prod2",
				nombre: "Producto B",
				stock: 3,
				stockMinimo: 10,
				categoria: { nombre: "Categoria 2" },
				unidad: { simbolo: "pcs" },
			},
			{
				id: "prod3",
				nombre: "Producto C",
				stock: 5,
				stockMinimo: 10,
				categoria: { nombre: "Categoria 3" },
				unidad: { simbolo: "pcs" },
			},
		];

		mockPrisma.producto.findMany
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos)
			.mockResolvedValueOnce(mockProductos);

		// El stock viene de StockUbicacion (fuente de verdad)
		mockPrisma.stockUbicacion.findMany.mockResolvedValue([
			{
				productoId: "prod1",
				cantidad: 8,
				producto: { id: "prod1", nombre: "Producto A", precioCosto: 10, categoria: { nombre: "Categoria 1" } },
			},
			{
				productoId: "prod2",
				cantidad: 3,
				producto: { id: "prod2", nombre: "Producto B", precioCosto: 10, categoria: { nombre: "Categoria 2" } },
			},
			{
				productoId: "prod3",
				cantidad: 5,
				producto: { id: "prod3", nombre: "Producto C", precioCosto: 10, categoria: { nombre: "Categoria 3" } },
			},
		] as any);

		const request = new NextRequest(
			"http://localhost:3000/api/dashboard/stats",
		);
		const response = await GET(request);
		const data = await response.json();

		expect(response.status).toBe(200);

		const lowStockProducts = data.productosStockBajo;
		expect(lowStockProducts).toHaveLength(3);

		// Should be sorted by stock ascending: B(3), C(5), A(8)
		expect(lowStockProducts[0].stockTotal).toBe(3);
		expect(lowStockProducts[1].stockTotal).toBe(5);
		expect(lowStockProducts[2].stockTotal).toBe(8);
	});

	it("should handle database errors gracefully", async () => {
		mockPrisma.producto.count.mockRejectedValue(
			new Error("Database connection failed"),
		);

		const request = new NextRequest(
			"http://localhost:3000/api/dashboard/stats",
		);
		const response = await GET(request);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBe("Error al obtener estadísticas");
	});
});
