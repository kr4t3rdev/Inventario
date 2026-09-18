/**
 * @description Tests de la anulación de compras (B-02.2).
 * Una compra anulada: revierte stock y kardex (solo las no ligadas a OC),
 * elimina la CxP sin pagos, marca el gasto como eliminado lógicamente y queda
 * visible con estado ANULADA. Las compras anuladas no alimentan el FIFO ni el
 * disponible para facturar contra la OC.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/stock-ubicacion-service", () => ({
	upsertStockUbicacion: vi.fn(),
}));

const mockTx = {
	compraDocumento: {
		findFirst: vi.fn(),
		update: vi.fn(),
		updateMany: vi.fn().mockResolvedValue({ count: 1 }),
	},
	compraDocumentoItem: { create: vi.fn() },
	gastoCompra: { update: vi.fn() },
	cuentaPorPagar: { delete: vi.fn() },
	stockMoveLine: { upsert: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
	prisma: {
		compraDocumento: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		anticipoMovimiento: { findFirst: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service";
import { anularCompraProductoAction } from "@/features/compras-productos/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

const mockUser: AuthenticatedUser = {
	userId: "user-1",
	name: "Test",
	email: "test@test.com",
	role: "admin",
	isActive: true,
	tenantId: "tenant-test",
	tenantRole: "admin",
};

const compraBase = {
	compraDocumentoId: "cd-1",
	tenantId: "tenant-test",
	formaPago: "PAGO_COMPLETO",
	estado: "PAGADA",
	total: 4000,
	moneda: "CUP",
	ordenCompraId: null,
	gastoCompraId: "gc-1",
	cuentaPorPagarId: null,
	deletedAt: null,
	items: [
		{
			compraDocumentoItemId: "item-1",
			productoId: "prod-1",
			cantidad: 10,
			precioUnitario: 400,
			producto: { id: "prod-1", almacenId: "alm-1", nombre: "Producto" },
		},
	],
	cuentaPorPagar: null,
	gastoCompra: { gastoCompraId: "gc-1", reconciliaciones: [] },
};

describe("anularCompraProductoAction (B-02.2)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Re-establecer tras clearAllMocks: el caso concurrente pisa este mock.
		mockTx.compraDocumento.updateMany.mockResolvedValue({ count: 1 });
		mockTx.compraDocumento.update.mockResolvedValue({});
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue(compraBase as never);
		vi.mocked(prisma.anticipoMovimiento.findFirst).mockResolvedValue(null as never);
	});

	it("revierte stock y kardex, marca gasto como eliminado y deja ANULADA", async () => {
		const result = await anularCompraProductoAction({ id: "cd-1" });

		expect(result.success).toBe(true);
		// Stock revertido con delta negativo sobre el mismo almacén de la compra.
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				productoId: "prod-1",
				ubicacionId: "alm-1",
				modo: "increment",
				delta: -10,
			}),
		);
		// Kardex con secuencia de anulación identificable.
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					eventoKey: expect.objectContaining({
						tipoOrigen: "AJUSTE",
						origenId: "cd-1",
						secuencia: "ANULACION-ITEM-0",
					}),
				},
				create: expect.objectContaining({ cantidad: -10 }),
			}),
		);
		// El gasto queda con borrado lógico (auditable) y la compra se desvincula.
		expect(mockTx.gastoCompra.update).toHaveBeenCalledWith({
			where: { gastoCompraId: "gc-1" },
			data: { deletedAt: expect.any(Date) },
		});
		// Marcado CAS dentro de la transacción: solo una anulación concurrente gana.
		expect(mockTx.compraDocumento.updateMany).toHaveBeenCalledWith({
			where: {
				compraDocumentoId: "cd-1",
				tenantId: "tenant-test",
				deletedAt: null,
				estado: { not: "ANULADA" },
			},
			data: expect.objectContaining({
				estado: "ANULADA",
				gastoCompraId: null,
				cuentaPorPagarId: null,
				updatedById: "user-1",
			}),
		});
	});

	it("una segunda anulación concurrente se rechaza sin revertir stock dos veces", async () => {
		mockTx.compraDocumento.updateMany.mockResolvedValue({ count: 0 });

		const result = await anularCompraProductoAction({ id: "cd-1" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("VALIDATION_ERROR");
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
		expect(mockTx.gastoCompra.update).not.toHaveBeenCalled();
	});

	it("rechaza si la compra ya está anulada", async () => {
		vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
			...compraBase,
			estado: "ANULADA",
		} as never);

		const result = await anularCompraProductoAction({ id: "cd-1" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("VALIDATION_ERROR");
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
	});

	it("rechaza si la CxP tiene pagos: anular borraría evidencia de deuda cobrada", async () => {
		vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
			...compraBase,
			cuentaPorPagarId: "cxp-1",
			cuentaPorPagar: {
				cuentaPorPagarId: "cxp-1",
				montoPagado: 100,
				pagos: [{ pagoId: "p-1" }],
				reconciliaciones: [],
			},
		} as never);

		const result = await anularCompraProductoAction({ id: "cd-1" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("CXP_HAS_PAYMENTS");
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
		// El CAS dentro de la transacción se revierte con el rollback: nada persiste.
		expect(mockTx.gastoCompra.update).not.toHaveBeenCalled();
	});

	it("rechaza si tiene anticipo aplicado", async () => {
		vi.mocked(prisma.anticipoMovimiento.findFirst).mockResolvedValue({
			movimientoId: "mov-1",
		} as never);

		const result = await anularCompraProductoAction({ id: "cd-1" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("HAS_IMPACT");
	});

	it("elimina la CxP sin pagos y continúa la anulación", async () => {
		vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
			...compraBase,
			formaPago: "PAGO_PARCIAL",
			estado: "PENDIENTE",
			cuentaPorPagarId: "cxp-1",
			cuentaPorPagar: {
				cuentaPorPagarId: "cxp-1",
				montoPagado: 0,
				pagos: [],
				reconciliaciones: [],
			},
		} as never);

		const result = await anularCompraProductoAction({ id: "cd-1" });

		expect(result.success).toBe(true);
		expect(mockTx.cuentaPorPagar.delete).toHaveBeenCalledWith({
			where: { cuentaPorPagarId: "cxp-1" },
		});
	});

	it("compra ligada a orden de compra no toca stock (lo movió la recepción)", async () => {
		vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
			...compraBase,
			ordenCompraId: "oc-1",
		} as never);

		const result = await anularCompraProductoAction({ id: "cd-1" });

		expect(result.success).toBe(true);
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
		expect(mockTx.stockMoveLine.upsert).not.toHaveBeenCalled();
		// Pero sí revierte lo contable y marca el documento (CAS).
		expect(mockTx.compraDocumento.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ estado: "ANULADA" }),
			}),
		);
	});

	it("compra inexistente devuelve NOT_FOUND", async () => {
		vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue(null as never);

		const result = await anularCompraProductoAction({ id: "cd-x" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
	});

	it("una compra anulada (ya revertida) sí puede eliminarse", async () => {
		vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
			compraDocumentoId: "cd-1",
			tenantId: "tenant-test",
			estado: "ANULADA",
			gastoCompraId: null,
			cuentaPorPagarId: null,
			cuentaPorPagar: null,
			items: [{ compraDocumentoItemId: "item-1" }],
			deletedAt: null,
		} as never);
		vi.mocked(prisma.compraDocumento.updateMany).mockResolvedValue({ count: 1 } as never);

		const { deleteCompraProductoAction } = await import("@/features/compras-productos/actions");
		const result = await deleteCompraProductoAction("cd-1");

		expect(result.success).toBe(true);
		expect(prisma.compraDocumento.updateMany).toHaveBeenCalledWith({
			where: { compraDocumentoId: "cd-1", tenantId: "tenant-test", deletedAt: null },
			data: { deletedAt: expect.any(Date) },
		});
	});
});
