/**
 * @description Tests de integridad de precios server-side en la creación de ventas (LP-0).
 * El servidor re-resuelve cada precioUnitario con la cadena cliente > PV > base;
 * las desviaciones se rechazan (PRICE_MISMATCH) salvo permiso ventas.precio.override,
 * que las acepta dejando rastro en auditoría.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/fifo-allocation", () => ({
	allocateFifoForSale: vi.fn(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
	AuditLogService: { logStrict: vi.fn() },
}));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		$queryRaw: vi.fn(),
		serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		venta: { create: vi.fn(), findUnique: vi.fn() },
		factura: { create: vi.fn(), update: vi.fn() },
		auditLog: { create: vi.fn() },
		stockUbicacion: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		stockMoveLine: {
			upsert: vi.fn().mockResolvedValue({ id: "move-1" }),
		},
		producto: {
			findUnique: vi.fn(),
			findUniqueOrThrow: vi.fn(),
		},
	};
	return { mockTx };
});

vi.mock("@/lib/prisma", () => ({
	prisma: {
		puntoDeVenta: { findFirst: vi.fn() },
		cliente: { findFirst: vi.fn() },
		producto: { findMany: vi.fn() },
		turnoPuntoVenta: { findFirst: vi.fn(), create: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import { AuditLogService } from "@/lib/services/audit-log-service";
import { createVentaAction } from "@/features/ventas/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

/** Cajero sin permiso de override: solo puede registrar ventas. */
const cajeroUser: AuthenticatedUser = {
	userId: "user-cajero",
	name: "Cajero",
	email: "cajero@test.com",
	role: "user",
	isActive: true,
	tenantId: "tenant-test",
	tenantRole: "dependiente",
	planFeatures: {
		"ventas-pos": true,
		"turnos-pos": true,
		facturacion: true,
		"ventas-factura": true,
	},
	permissions: new Set(["ventas.venta.registrar"]),
};

const managerUser: AuthenticatedUser = {
	...cajeroUser,
	userId: "user-manager",
	tenantRole: "manager",
	permissions: new Set(["ventas.venta.registrar", "ventas.precio.override"]),
};

const mockVenta = {
	ventaId: "venta-1",
	tenantId: "tenant-test",
	puntoDeVentaId: "pv-1",
	total: 0,
	cantidad: 0,
};

/**
 * @description Configura los mocks del camino feliz post-resolución
 *   (turno dado, stock disponible, kardex y FIFO mockeados).
 */
function mockHappyPath() {
	mockTx.venta.create.mockResolvedValue(mockVenta);
	mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
	mockTx.producto.findUnique.mockResolvedValue({
		id: "prod-1",
		nombre: "Producto",
		stock: 10,
		almacenId: "alm-1",
		tenantId: "tenant-test",
		precioCosto: 400,
	});
	mockTx.producto.findUniqueOrThrow.mockResolvedValue({ tenantId: "tenant-test" });
	mockTx.serieFacturacion.findFirst.mockResolvedValue({
		serieId: "s-1",
		prefijo: "FV",
		consecutivo: 5,
	});
	mockTx.serieFacturacion.update.mockResolvedValue({
		serieId: "s-1",
		prefijo: "FV",
		consecutivo: 6,
	});
	mockTx.factura.create.mockResolvedValue({ idFactura: "fact-1" });
}

beforeEach(() => {
	vi.clearAllMocks();
	// Defaults: PV sin lista, sin cliente, producto con precio base 500.
	vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
		pvId: "pv-1",
		listaPrecioId: null,
	} as any);
	vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);
	vi.mocked(prisma.producto.findMany).mockResolvedValue([
		{ id: "prod-1", nombre: "Producto", precioVenta: 500, precios: [] },
	] as any);
});

describe("integridad de precios en createVentaAction", () => {
	it("rechaza con PRICE_MISMATCH un precio manipulado si el usuario no tiene override", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(cajeroUser);

		const result = await createVentaAction({
			puntoDeVentaId: "pv-1",
			turnoId: "turno-1",
			items: [{ productoId: "prod-1", cantidad: 1, precioUnitario: 1 }],
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("PRICE_MISMATCH");
		expect(result.error?.message).toContain("Producto");
		expect(mockTx.venta.create).not.toHaveBeenCalled();
		expect(mockTx.stockUbicacion.upsert).not.toHaveBeenCalled();
	});

	it("acepta la venta sin ruido cuando el precio coincide con el resuelto", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(cajeroUser);
		mockHappyPath();

		const result = await createVentaAction({
			puntoDeVentaId: "pv-1",
			turnoId: "turno-1",
			items: [{ productoId: "prod-1", cantidad: 2, precioUnitario: 500 }],
		});

		expect(result.success).toBe(true);
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					items: {
						create: [
							expect.objectContaining({ precioUnitario: 500, total: 1000 }),
						],
					},
				}),
			}),
		);
		expect(AuditLogService.logStrict).not.toHaveBeenCalled();
	});

	it("con ventas.precio.override acepta el precio enviado y lo audita", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
		mockHappyPath();

		const result = await createVentaAction({
			puntoDeVentaId: "pv-1",
			turnoId: "turno-1",
			items: [{ productoId: "prod-1", cantidad: 1, precioUnitario: 450 }],
		});

		expect(result.success).toBe(true);
		expect(mockTx.venta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					items: {
						create: [expect.objectContaining({ precioUnitario: 450 })],
					},
				}),
			}),
		);
		expect(AuditLogService.logStrict).toHaveBeenCalledWith(
			expect.objectContaining({
				entidad: "VENTA",
				detalles: expect.objectContaining({
					tipo: "PRICE_OVERRIDE",
					items: [
						expect.objectContaining({
							productoId: "prod-1",
							precioEsperado: 500,
							precioAplicado: 450,
						}),
					],
				}),
			}),
			expect.anything(),
		);
	});

	it("exige el precio de la lista del cliente aunque el POS mande el del PV", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(cajeroUser);
		vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
			pvId: "pv-1",
			listaPrecioId: "lista-pv",
		} as any);
		vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
			clienteId: "cli-1",
			listaPrecioId: "lista-cliente",
		} as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue([
			{
				id: "prod-1",
				nombre: "Producto",
				precioVenta: 1000,
				precios: [
					{ listaPrecioId: "lista-pv", precio: 900 },
					{ listaPrecioId: "lista-cliente", precio: 800 },
				],
			},
		] as any);

		const result = await createVentaAction({
			puntoDeVentaId: "pv-1",
			turnoId: "turno-1",
			clienteId: "cli-1",
			items: [{ productoId: "prod-1", cantidad: 1, precioUnitario: 900 }],
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("PRICE_MISMATCH");
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it("exige el precio base cuando no hay listas aplicables", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(cajeroUser);

		const result = await createVentaAction({
			puntoDeVentaId: "pv-1",
			turnoId: "turno-1",
			items: [{ productoId: "prod-1", cantidad: 1, precioUnitario: 499 }],
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("PRICE_MISMATCH");
	});

	it("rechaza si el punto de venta no existe en el tenant", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(cajeroUser);
		vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(null);

		const result = await createVentaAction({
			puntoDeVentaId: "pv-otro-tenant",
			turnoId: "turno-1",
			items: [{ productoId: "prod-1", cantidad: 1, precioUnitario: 500 }],
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
		expect(mockTx.venta.create).not.toHaveBeenCalled();
	});

	it("rechaza si el producto no existe en el tenant", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(cajeroUser);
		vi.mocked(prisma.producto.findMany).mockResolvedValue([] as any);

		const result = await createVentaAction({
			puntoDeVentaId: "pv-1",
			turnoId: "turno-1",
			items: [{ productoId: "prod-1", cantidad: 1, precioUnitario: 500 }],
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
	});
});
