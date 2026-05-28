/**
 * @description Tests unitarios para Server Actions de ventas.
 * TDD: RED → GREEN → REFACTOR.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		venta: { create: vi.fn() },
	};
	return { mockTx };
});

vi.mock("@/lib/prisma", () => ({
	prisma: {
		venta: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
		},
		ventaItem: { create: vi.fn() },
		producto: { findUnique: vi.fn(), update: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import {
	getVentasAction,
	createVentaAction,
	anularVentaAction,
} from "@/features/ventas/actions";
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

const mockVenta = {
	ventaId: "venta-1",
	tenantId: "tenant-test",
	productoId: null,
	cantidad: 0,
	puntoDeVentaId: "pv-1",
	total: 1000,
	descuento: 0,
	clienteId: null,
	empleadoId: null,
	observaciones: null,
	esVentaUnica: true,
	ofertaId: null,
	ventaPadreId: null,
	ordenId: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("Ventas Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getVentasAction", () => {
		it("retorna ventas del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findMany).mockResolvedValue([mockVenta]);

			const result = await getVentasAction();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(prisma.venta.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ tenantId: "tenant-test" }),
				}),
			);
		});
	});

	describe("createVentaAction", () => {
		const validInput = {
			puntoDeVentaId: "pv-1",
			items: [{ productoId: "prod-1", cantidad: 2, precioUnitario: 500 }],
		};

		it("crea venta con items exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			const mockSerie = { serieId: "s-1", prefijo: "FV", consecutivo: 5 };
			mockTx.serieFacturacion.findFirst.mockResolvedValue(mockSerie);
			mockTx.serieFacturacion.update.mockResolvedValue({
				...mockSerie,
				consecutivo: 6,
			});
			mockTx.venta.create.mockResolvedValue(mockVenta);

			const result = await createVentaAction(validInput);

			expect(result.success).toBe(true);
			expect(mockTx.venta.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						tenantId: "tenant-test",
						puntoDeVentaId: "pv-1",
					}),
				}),
			);
		});

		it("retorna error si no tiene items", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

			const result = await createVentaAction({
				puntoDeVentaId: "pv-1",
				items: [],
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBeDefined();
		});
	});

	describe("anularVentaAction", () => {
		it("anula venta existente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue(mockVenta);
			vi.mocked(prisma.venta.delete).mockResolvedValue(mockVenta);

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(true);
		});

		it("retorna error si la venta no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue(null);

			const result = await anularVentaAction({ ventaId: "no-existe" });

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("no encontrada");
		});
	});
});
