/**
 * @description Tests unitarios para Server Actions de compras de servicios.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/anticipos-workflow", () => ({
	applyAnticipoAllocations: vi.fn(),
}));
vi.mock("@/features/gastosDE/reversal", () => ({
	reverseExpenseEffects: vi.fn(),
}));

const mockTx = {
	compraServicio: {
		create: vi.fn(),
		findUnique: vi.fn(),
		updateMany: vi.fn(),
		deleteMany: vi.fn(),
	},
	tipoPago: { findFirst: vi.fn() },
	cuentaBancaria: { findFirst: vi.fn() },
	anticipo: { findUnique: vi.fn() },
	reconciliacionGasto: {
		create: vi.fn(),
		findMany: vi.fn(),
		findFirst: vi.fn(),
	},
	$queryRaw: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
	prisma: {
		compraServicio: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		servicios: { findUnique: vi.fn(), findFirst: vi.fn() },
		vendor: { findUnique: vi.fn(), findFirst: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import { applyAnticipoAllocations } from "@/lib/services/anticipos-workflow";
import {
	getComprasServiciosAction,
	getCompraServicioByIdAction,
	createCompraServicioAction,
	updateCompraServicioAction,
	deleteCompraServicioAction,
} from "@/features/compras-servicios/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

const mockUser: AuthenticatedUser = {
	userId: "user-1",
	name: "Test",
	email: "test@test.com",
	role: "admin",
	isActive: true,
	tenantId: "tenant-test",
	tenantRole: "manager",
};

const mockServicio = {
	servicioId: "sv-1",
	nombre: "Servicio Test",
	moneda: "CUP",
};

const mockCompraRow = {
	compraServicioId: "cs-1",
	tenantId: "tenant-test",
	servicioId: "sv-1",
	proveedorId: null,
	numeroFactura: null,
	costoUnitario: 1000,
	cantidad: 2,
	total: 2000,
	moneda: "CUP",
	formaPago: "PAGO_COMPLETO",
	estado: "PAGADA",
	descripcion: null,
	fechaServicio: new Date(),
	fechaVencimiento: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	servicio: mockServicio,
	proveedor: null,
};

describe("ComprasServicios Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
	});

	describe("getComprasServiciosAction", () => {
		it("retorna lista del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraServicio.findMany).mockResolvedValue([
				mockCompraRow,
			]);
			const result = await getComprasServiciosAction();
			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
		});
	});

	describe("getCompraServicioByIdAction", () => {
		it("retorna compra por ID", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue(
				mockCompraRow,
			);
			const result = await getCompraServicioByIdAction("cs-1");
			expect(result.success).toBe(true);
		});

		it("retorna NOT_FOUND si no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue(null);
			const result = await getCompraServicioByIdAction("cs-noexiste");
			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
		});
	});

	describe("createCompraServicioAction", () => {
		const validInput = {
			servicioId: "sv-1",
			costoUnitario: 1000,
			cantidad: 2,
			formaPago: "PAGO_COMPLETO" as const,
			estado: "PAGADA" as const,
		};

		it("crea compra de servicio exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue(
				mockServicio as any,
			);
			mockTx.compraServicio.create.mockResolvedValue(mockCompraRow);

			const result = await createCompraServicioAction(validInput);

			expect(result.success).toBe(true);
			expect(prisma.servicios.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						servicioId: "sv-1",
						tenantId: "tenant-test",
					}),
				}),
			);
			expect(mockTx.compraServicio.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						moneda: "CUP",
					}),
				}),
			);
		});

		it("retorna error si el servicio no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue(null);

			const result = await createCompraServicioAction(validInput);

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("Servicio no encontrado");
		});

		it("rechaza servicio de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue(null);

			const result = await createCompraServicioAction({
				...validInput,
				servicioId: "sv-otro-tenant",
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
		});

		it("rechaza proveedor de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue(
				mockServicio as any,
			);
			vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null);

			const result = await createCompraServicioAction({
				...validInput,
				proveedorId: "vendor-otro-tenant",
			});

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("Proveedor no encontrado");
		});
	});

	describe("updateCompraServicioAction", () => {
		it("actualiza compra exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue(
				mockCompraRow,
			);
			vi.mocked(prisma.compraServicio.update).mockResolvedValue(mockCompraRow);

			const result = await updateCompraServicioAction({
				compraServicioId: "cs-1",
				numeroFactura: "F001",
			});

			expect(result.success).toBe(true);
		});

		it("recalcula el total al cambiar cantidad o costo", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue(
				mockCompraRow,
			);
			vi.mocked(prisma.compraServicio.update).mockResolvedValue(mockCompraRow);

			const result = await updateCompraServicioAction({
				compraServicioId: "cs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(true);
			// mockCompraRow tiene costoUnitario 1000 → total 3000
			expect(prisma.compraServicio.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ cantidad: 3, total: 3000 }),
				}),
			);
		});

		it("retorna NOT_FOUND si no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue(null);

			const result = await updateCompraServicioAction({
				compraServicioId: "cs-noexiste",
				numeroFactura: "F001",
			});

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("no encontrado");
		});
	});

	describe("deleteCompraServicioAction", () => {
		it("elimina compra vía transacción con claim de estado ELIMINANDO", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			mockTx.compraServicio.findUnique.mockResolvedValue({
				compraServicioId: "cs-1",
				tenantId: "tenant-test",
			});
			mockTx.compraServicio.updateMany.mockResolvedValue({ count: 1 });
			mockTx.compraServicio.deleteMany.mockResolvedValue({ count: 1 });
			mockTx.reconciliacionGasto.findMany.mockResolvedValue([]);
			mockTx.reconciliacionGasto.findFirst.mockResolvedValue(undefined);

			const result = await deleteCompraServicioAction("cs-1");

			expect(result.success).toBe(true);
			expect(mockTx.compraServicio.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ estado: "ELIMINANDO" }),
				}),
			);
			expect(mockTx.compraServicio.deleteMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ compraServicioId: "cs-1" }),
				}),
			);
		});
	});

	describe("autorización", () => {
		it("getComprasServiciosAction requiere feature del plan", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "user" as any,
				planFeatures: {},
			} as any);
			vi.mocked(prisma.compraServicio.findMany).mockResolvedValue([]);

			const result = await getComprasServiciosAction();

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("FEATURE_NOT_AVAILABLE");
		});

		it("createCompraServicioAction requiere rol manager", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				tenantRole: "dependiente",
			});

			const result = await createCompraServicioAction({
				servicioId: "sv-1",
				costoUnitario: 1000,
				cantidad: 1,
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("FORBIDDEN");
		});

		it("deleteCompraServicioAction requiere rol manager", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				tenantRole: "dependiente",
			});

			const result = await deleteCompraServicioAction("cs-1");

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("FORBIDDEN");
		});
	});

	describe("auth requerido", () => {
		it("retorna AUTH_REQUIRED si no hay usuario", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);
			const result = await getComprasServiciosAction();
			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("AUTH_REQUIRED");
		});
	});
});
