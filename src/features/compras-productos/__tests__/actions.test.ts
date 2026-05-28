/**
 * @description Tests unitarios para Server Actions de compras de productos.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/inventory-cost-utils", () => ({
	calcularPrecioCostoCompra: vi.fn(),
}));
vi.mock("@/lib/services/pago-gastos-workflow", () => ({
	applyPagoGastoWorkflow: vi.fn(),
}));
vi.mock("@/lib/services/anticipos-workflow", () => ({
	applyAnticipoAllocations: vi.fn(),
}));
vi.mock("@/lib/services/stock-ubicacion-service", () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock("@/lib/services/anticipos-guards", () => ({
	hasUnrevertedAnticipoExecution: vi.fn(),
}));

const mockTx = {
	compraDocumento: { create: vi.fn(), update: vi.fn() },
	producto: { update: vi.fn() },
	gastoCompra: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
	prisma: {
		compraDocumento: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
			count: vi.fn(),
		},
		vendor: { findFirst: vi.fn() },
		producto: { findFirst: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import { calcularPrecioCostoCompra } from "@/lib/inventory-cost-utils";
import {
	getComprasProductosAction,
	getCompraProductoByIdAction,
	createCompraProductoAction,
	updateCompraProductoAction,
	deleteCompraProductoAction,
} from "@/features/compras-productos/actions";
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

describe("ComprasProductos Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getComprasProductosAction", () => {
		it("retorna lista paginada", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([]);
			vi.mocked(prisma.compraDocumento.count).mockResolvedValue(0);
			const result = await getComprasProductosAction({ page: 1, limit: 20 });
			expect(result.success).toBe(true);
		});
	});

	describe("getCompraProductoByIdAction", () => {
		it("retorna compra por ID", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
				compraDocumentoId: "cd-1",
			} as any);
			const result = await getCompraProductoByIdAction("cd-1");
			expect(result.success).toBe(true);
		});
	});

	describe("createCompraProductoAction", () => {
		it("crea compra exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.vendor.findFirst).mockResolvedValue({
				vendorId: "ven-1",
				nombre: "Proveedor",
			});
			vi.mocked(prisma.producto.findFirst).mockResolvedValue({
				id: "prod-1",
				stock: 10,
				precioCosto: 500,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			});
			mockTx.compraDocumento.create.mockResolvedValue({
				compraDocumentoId: "cd-1",
			});
			mockTx.gastoCompra.create.mockResolvedValue({ gastoCompraId: "gc-1" });
			mockTx.compraDocumento.update.mockResolvedValue({} as any);
			vi.mocked(calcularPrecioCostoCompra).mockReturnValue(450);

			const result = await createCompraProductoAction({
				proveedorId: "ven-1",
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				items: [{ productoId: "prod-1", precioCosto: 400, cantidad: 10 }],
			});

			expect(result.success).toBe(true);
		});

		it("rechaza si proveedor no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null);

			const result = await createCompraProductoAction({
				proveedorId: "ven-noexiste",
				formaPago: "PAGO_PARCIAL",
				estado: "PENDIENTE",
				items: [{ productoId: "prod-1", precioCosto: 400, cantidad: 5 }],
			});

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("Proveedor no encontrado");
		});
	});

	describe("updateCompraProductoAction", () => {
		it("actualiza compra exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
				compraDocumentoId: "cd-1",
			});
			vi.mocked(prisma.compraDocumento.update).mockResolvedValue({} as any);

			const result = await updateCompraProductoAction({
				compraDocumentoId: "cd-1",
				estado: "PAGADA",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("deleteCompraProductoAction", () => {
		it("soft-delete compra exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
				compraDocumentoId: "cd-1",
			});
			vi.mocked(prisma.compraDocumento.update).mockResolvedValue({} as any);

			const result = await deleteCompraProductoAction("cd-1");
			expect(result.success).toBe(true);
		});
	});

	describe("auth requerido", () => {
		it("retorna AUTH_REQUIRED", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);
			const result = await getComprasProductosAction();
			expect(result.success).toBe(false);
		});
	});
});
