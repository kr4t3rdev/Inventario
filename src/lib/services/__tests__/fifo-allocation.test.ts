/**
 * @description Tests unitarios para el servicio de asignación FIFO.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	allocateFifoForVentaItem,
	getAvailableStock,
	allocateFifoForSale,
} from "@/lib/services/fifo-allocation";

// ─── Mocks ──────────────────────────────────────────────────────

function createMockTx() {
	return {
		compraDocumentoItem: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
		},
		lote: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		purchaseAllocation: {
			groupBy: vi.fn(),
			aggregate: vi.fn(),
			createMany: vi.fn(),
			findMany: vi.fn(),
		},
		ventaItem: {
			findMany: vi.fn(),
		},
	};
}

// ─── Tests: allocateFifoForVentaItem ────────────────────────────

describe("allocateFifoForVentaItem", () => {
	let tx: ReturnType<typeof createMockTx>;

	beforeEach(() => {
		tx = createMockTx();
		tx.lote.findMany.mockResolvedValue([]);
	});

	it("prioriza el vencimiento más próximo dentro de FIFO y cruza al siguiente lote", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 10 },
		]);
		tx.lote.findMany.mockResolvedValue([
			{
				id: "lote-60-dias",
				compraItemId: "c1",
				cantidadDisponible: 5,
				fechaVencimiento: new Date("2027-03-01T00:00:00.000Z"),
			},
			{
				id: "lote-10-dias",
				compraItemId: "c1",
				cantidadDisponible: 5,
				fechaVencimiento: new Date("2027-01-10T00:00:00.000Z"),
			},
		]);
		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 6,
		});

		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledWith({
			data: [
				{
					tenantId: "t1",
					compraDocumentoItemId: "c1",
					ventaItemId: "v1",
					loteId: "lote-10-dias",
					cantidad: 5,
				},
				{
					tenantId: "t1",
					compraDocumentoItemId: "c1",
					ventaItemId: "v1",
					loteId: "lote-60-dias",
					cantidad: 1,
				},
			],
		});
	});

	it("ordena lotes sin vencimiento al final y conserva FIFO para fechas iguales", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 6 },
		]);
		tx.lote.findMany.mockResolvedValue([
			{
				id: "lote-nulo",
				compraItemId: "c1",
				cantidadDisponible: 2,
				fechaVencimiento: null,
				createdAt: new Date("2026-01-03T00:00:00.000Z"),
			},
			{
				id: "lote-mismo-vencimiento-reciente",
				compraItemId: "c1",
				cantidadDisponible: 2,
				fechaVencimiento: new Date("2027-02-01T00:00:00.000Z"),
				createdAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			{
				id: "lote-mismo-vencimiento-antiguo",
				compraItemId: "c1",
				cantidadDisponible: 2,
				fechaVencimiento: new Date("2027-02-01T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			},
		]);
		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 6,
		});

		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({ loteId: "lote-mismo-vencimiento-antiguo", cantidad: 2 }),
				expect.objectContaining({ loteId: "lote-mismo-vencimiento-reciente", cantidad: 2 }),
				expect.objectContaining({ loteId: "lote-nulo", cantidad: 2 }),
			],
		});
	});

	it("respeta la disponibilidad neta del lote y de la compra", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 10 },
		]);
		tx.lote.findMany.mockResolvedValue([
			{
				id: "lote-temprano-agotado",
				compraItemId: "c1",
				cantidadDisponible: 5,
				fechaVencimiento: new Date("2027-01-10T00:00:00.000Z"),
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			},
			{
				id: "lote-tardio-disponible",
				compraItemId: "c1",
				cantidadDisponible: 5,
				fechaVencimiento: new Date("2027-03-01T00:00:00.000Z"),
				createdAt: new Date("2026-01-02T00:00:00.000Z"),
			},
		]);
		tx.purchaseAllocation.groupBy
			.mockResolvedValueOnce([{ compraDocumentoItemId: "c1", _sum: { cantidad: 5 } }])
			.mockResolvedValueOnce([{ loteId: "lote-temprano-agotado", _sum: { cantidad: 5 } }]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 5,
		});

		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledWith({
			data: [{
				tenantId: "t1",
				compraDocumentoItemId: "c1",
				ventaItemId: "v1",
				loteId: "lote-tardio-disponible",
				cantidad: 5,
			}],
		});
	});

	it("excluye compras anuladas o eliminadas del pool FIFO (B-02.2)", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 100 },
		]);
		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 10,
		});

		expect(tx.compraDocumentoItem.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					compraDocumento: expect.objectContaining({
						tenantId: "t1",
						deletedAt: null,
						estado: { not: "ANULADA" },
					}),
				}),
			}),
		);
	});

	it("debe asignar a la compra más antigua cuando hay stock suficiente", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 100 },
		]);
		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 30,
		});

		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledWith({
			data: [
				{
					tenantId: "t1",
					compraDocumentoItemId: "c1",
					ventaItemId: "v1",
					cantidad: 30,
				},
			],
		});
	});

	it("debe cruzar a la siguiente compra cuando la primera se agota (FIFO cross)", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 100 },
			{ compraDocumentoItemId: "c2", cantidad: 100 },
		]);
		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 150,
		});

		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledWith({
			data: [
				{
					tenantId: "t1",
					compraDocumentoItemId: "c1",
					ventaItemId: "v1",
					cantidad: 100,
				},
				{
					tenantId: "t1",
					compraDocumentoItemId: "c2",
					ventaItemId: "v1",
					cantidad: 50,
				},
			],
		});
	});

	it("debe saltar compras ya agotadas y pasar a las siguientes", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 100 },
			{ compraDocumentoItemId: "c2", cantidad: 100 },
		]);
		// c1 ya tiene 100 asignados
		tx.purchaseAllocation.groupBy.mockResolvedValue([
			{ compraDocumentoItemId: "c1", _sum: { cantidad: 100 } },
		]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 50,
		});

		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledWith({
			data: [
				{
					tenantId: "t1",
					compraDocumentoItemId: "c2",
					ventaItemId: "v1",
					cantidad: 50,
				},
			],
		});
	});

	it("debe retornar sin crear allocations si cantidad es 0", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 100 },
		]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 0,
		});

		expect(tx.purchaseAllocation.createMany).not.toHaveBeenCalled();
	});

	it("debe retornar sin error si el producto no tiene compras", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 10,
		});

		expect(tx.purchaseAllocation.createMany).not.toHaveBeenCalled();
	});

	it("debe asignar con lo disponible aunque no alcance para toda la venta", async () => {
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "c1", cantidad: 50 },
		]);
		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForVentaItem(tx as any, {
			tenantId: "t1",
			ventaItemId: "v1",
			productoId: "p1",
			cantidad: 100,
		});

		// Solo asigna 50 (lo disponible)
		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledWith({
			data: [
				{
					tenantId: "t1",
					compraDocumentoItemId: "c1",
					ventaItemId: "v1",
					cantidad: 50,
				},
			],
		});
	});
});

// ─── Tests: getAvailableStock ────────────────────────────────────

describe("getAvailableStock", () => {
	let tx: ReturnType<typeof createMockTx>;

	beforeEach(() => {
		tx = createMockTx();
	});

	it("debe retornar cantidad - allocated", async () => {
		tx.compraDocumentoItem.findUnique.mockResolvedValue({ cantidad: 100 });
		tx.purchaseAllocation.aggregate.mockResolvedValue({
			_sum: { cantidad: 30 },
		});

		const result = await getAvailableStock(tx as any, "c1");

		expect(result).toBe(70);
	});

	it("debe retornar 0 si no existe el item de compra", async () => {
		tx.compraDocumentoItem.findUnique.mockResolvedValue(null);

		const result = await getAvailableStock(tx as any, "c1");

		expect(result).toBe(0);
	});

	it("debe retornar cantidad original si no hay allocations", async () => {
		tx.compraDocumentoItem.findUnique.mockResolvedValue({ cantidad: 50 });
		tx.purchaseAllocation.aggregate.mockResolvedValue({
			_sum: { cantidad: null },
		});

		const result = await getAvailableStock(tx as any, "c1");

		expect(result).toBe(50);
	});

	it("nunca debe retornar negativo", async () => {
		tx.compraDocumentoItem.findUnique.mockResolvedValue({ cantidad: 10 });
		tx.purchaseAllocation.aggregate.mockResolvedValue({
			_sum: { cantidad: 100 },
		});

		const result = await getAvailableStock(tx as any, "c1");

		expect(result).toBe(0);
	});
});

// ─── Tests: allocateFifoForSale ──────────────────────────────────

describe("allocateFifoForSale", () => {
	let tx: ReturnType<typeof createMockTx>;

	beforeEach(() => {
		tx = createMockTx();
	});

	it("debe procesar todos los VentaItem de una venta", async () => {
		// Mock findMany de venta items
		tx.ventaItem.findMany.mockResolvedValue([
			{ id: "vi1", productoId: "p1", cantidad: 30 },
			{ id: "vi2", productoId: "p2", cantidad: 20 },
		]);

		// Mock compras disponibles para cada producto
		tx.compraDocumentoItem.findMany
			.mockResolvedValueOnce([{ compraDocumentoItemId: "c1", cantidad: 100 }])
			.mockResolvedValueOnce([{ compraDocumentoItemId: "c2", cantidad: 50 }]);

		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForSale(tx as any, "t1", "venta1");

		// Debe haber llamado createMany dos veces (una por cada VentaItem)
		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledTimes(2);
	});

	it("asigna a FIFO la cantidad persistida en unidad stock aunque la venta tenga snapshot de empaque", async () => {
		tx.ventaItem.findMany.mockResolvedValue([
			{ id: "vi-box", productoId: "p-cereal", cantidad: 24 },
		]);
		tx.compraDocumentoItem.findMany.mockResolvedValue([
			{ compraDocumentoItemId: "compra-stock", cantidad: 30 },
		]);
		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForSale(tx as any, "t1", "venta-caja");

		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledWith({
			data: [{
				tenantId: "t1",
				compraDocumentoItemId: "compra-stock",
				ventaItemId: "vi-box",
				cantidad: 24,
			}],
		});
	});

	it("debe continuar aunque un producto no tenga compras", async () => {
		tx.ventaItem.findMany.mockResolvedValue([
			{ id: "vi1", productoId: "p1", cantidad: 10 },
			{ id: "vi2", productoId: "p2", cantidad: 5 },
		]);

		// p1 sin compras, p2 con compras
		tx.compraDocumentoItem.findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ compraDocumentoItemId: "c2", cantidad: 50 }]);

		tx.purchaseAllocation.groupBy.mockResolvedValue([]);

		await allocateFifoForSale(tx as any, "t1", "venta1");

		// Solo debe haber creado allocations para p2
		expect(tx.purchaseAllocation.createMany).toHaveBeenCalledTimes(1);
	});
});
