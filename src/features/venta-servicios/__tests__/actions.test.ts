/**
 * @description Tests unitarios para Server Actions de ventas de servicios.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/anticipos-workflow", () => ({
	applyAnticipoAllocations: vi.fn(),
}));

const mockTx = {
	ventaServicios: { create: vi.fn() },
	tipoPago: { findFirst: vi.fn() },
	cuentaBancaria: { findFirst: vi.fn() },
	anticipo: { findUnique: vi.fn() },
	reconciliacionServicio: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
	prisma: {
		ventaServicios: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		servicios: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
		},
		cliente: {
			findFirst: vi.fn(),
		},
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import {
	getVentaServiciosAction,
	getVentaServicioByIdAction,
	createVentaServicioAction,
	updateVentaServicioAction,
	deleteVentaServicioAction,
} from "@/features/venta-servicios/actions";
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

const mockVentaRow = {
	ventaServicioId: "vs-1",
	tenantId: "tenant-test",
	servicioId: "sv-1",
	cantidad: 1,
	costo: 0,
	total: 5000,
	observaciones: null,
	reconciliado: null,
	clienteId: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	servicio: { servicioId: "sv-1", nombre: "Servicio Test" },
	cliente: null,
};

describe("VentaServicios Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
	});

	describe("getVentaServiciosAction", () => {
		it("retorna lista del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([
				mockVentaRow,
			]);
			const result = await getVentaServiciosAction();
			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
		});
	});

	describe("getVentaServicioByIdAction", () => {
		it("retorna venta por ID", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);
			const result = await getVentaServicioByIdAction("vs-1");
			expect(result.success).toBe(true);
		});

		it("retorna NOT_FOUND si no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(null);
			const result = await getVentaServicioByIdAction("vs-noexiste");
			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
		});
	});

	describe("createVentaServicioAction", () => {
		it("crea venta legacy exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1" },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				total: 5000,
			});

			expect(result.success).toBe(true);
		});

		it("rechaza servicio de otro tenant en modo legacy", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([] as any);

			const result = await createVentaServicioAction({
				servicioId: "sv-otro-tenant",
				cantidad: 1,
				total: 5000,
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
		});

		it("rechaza servicio de otro tenant en modo mixto", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([] as any);

			const result = await createVentaServicioAction({
				lineas: [
					{
						tipoLinea: "SERVICIO",
						servicioId: "sv-otro-tenant",
						cantidad: 1,
						precioUnitario: 5000,
					},
				],
			} as any);

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
		});

		it("rechaza cliente de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1" },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				total: 5000,
				clienteId: "cliente-otro-tenant",
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
		});

		it("crea venta mixta exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1" },
			] as any);
			// Modo mixto usa $transaction(array) no callback
			vi.mocked(prisma.$transaction).mockImplementation((args: any) => {
				if (Array.isArray(args)) return Promise.all(args);
				return args(mockTx);
			});
			vi.mocked(prisma.ventaServicios.create).mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
				lineas: [
					{
						tipoLinea: "SERVICIO",
						servicioId: "sv-1",
						cantidad: 1,
						precioUnitario: 5000,
					},
				],
			} as any);

			expect(result.success).toBe(true);
		});

		it("rechaza líneas de producto", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

			const result = await createVentaServicioAction({
				lineas: [
					{
						tipoLinea: "PRODUCTO",
						productoId: "prod-1",
						cantidad: 1,
						precioUnitario: 1000,
					},
				],
			} as any);

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe(
				"PRODUCT_LINE_NOT_SUPPORTED_IN_THIS_ENDPOINT",
			);
		});
	});

	describe("updateVentaServicioAction", () => {
		it("actualiza exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);
			vi.mocked(prisma.ventaServicios.update).mockResolvedValue(mockVentaRow);
			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 2,
				total: 10000,
			});
			expect(result.success).toBe(true);
		});
	});

	describe("deleteVentaServicioAction", () => {
		it("elimina exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);
			vi.mocked(prisma.ventaServicios.delete).mockResolvedValue(mockVentaRow);
			const result = await deleteVentaServicioAction("vs-1");
			expect(result.success).toBe(true);
		});
	});

	describe("auth requerido", () => {
		it("retorna AUTH_REQUIRED", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);
			const result = await getVentaServiciosAction();
			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("AUTH_REQUIRED");
		});
	});
});
