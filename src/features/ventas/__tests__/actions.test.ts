/**
 * @description Tests unitarios para Server Actions de ventas.
 * TDD: RED → GREEN → REFACTOR.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/fifo-allocation", () => ({
	allocateFifoForSale: vi.fn(),
}));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		venta: {
			create: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		factura: { update: vi.fn(), updateMany: vi.fn() },
		cuentaPorCobrar: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
		reconciliacionVenta: { deleteMany: vi.fn() },
		cuentaBancaria: { updateMany: vi.fn(), findFirst: vi.fn() },
		purchaseAllocation: { deleteMany: vi.fn() },
		stockUbicacion: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		producto: {
			update: vi.fn(),
			findUnique: vi.fn(),
			findUniqueOrThrow: vi.fn(),
		},
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
		turnoPuntoVenta: { findFirst: vi.fn(), create: vi.fn() },
		puntoDeVenta: { findFirst: vi.fn() },
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
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	items: [
		{
			id: "venta-item-1",
			productoId: "prod-1",
			cantidad: 2,
			producto: { id: "prod-1", almacenId: "alm-1", tenantId: "tenant-test" },
		},
	],
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
			mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidad: 10 });
			mockTx.producto.findUnique.mockResolvedValue({
				id: "prod-1",
				stock: 10,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			} as any);
			mockTx.producto.findUniqueOrThrow.mockResolvedValue({
				tenantId: "tenant-test",
			} as any);
			prisma.turnoPuntoVenta.findFirst.mockResolvedValue({
				id: "turno-1",
			} as any);

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
			expect(mockTx.producto.update).not.toHaveBeenCalled();
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

		it("valida stock contra StockUbicacion del punto de venta", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			const mockSerie = { serieId: "s-1", prefijo: "FV", consecutivo: 5 };
			mockTx.serieFacturacion.findFirst.mockResolvedValue(mockSerie);
			mockTx.serieFacturacion.update.mockResolvedValue({
				...mockSerie,
				consecutivo: 6,
			});
			mockTx.venta.create.mockResolvedValue(mockVenta);
			mockTx.producto.findUnique.mockResolvedValue({
				id: "prod-1",
				stock: 10,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			} as any);
			mockTx.producto.findUniqueOrThrow.mockResolvedValue({
				tenantId: "tenant-test",
			} as any);
			prisma.turnoPuntoVenta.findFirst.mockResolvedValue({
				id: "turno-1",
			} as any);

			// StockUbicacion del PV con cantidad suficiente
			mockTx.stockUbicacion.findUnique.mockResolvedValue({
				cantidad: 5,
			});

			const result = await createVentaAction({
				puntoDeVentaId: "pv-1",
				items: [{ productoId: "prod-1", cantidad: 3, precioUnitario: 500 }],
			});

			expect(result.success).toBe(true);

			// Verifica que consultó el StockUbicacion del PV, no otra ubicación
			expect(mockTx.stockUbicacion.findUnique).toHaveBeenCalledWith({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: "prod-1",
						tipoUbicacion: "punto_venta",
						ubicacionId: "pv-1",
					},
				},
				select: { cantidadDisponible: true },
			});
		});

		it("rechaza con STOCK_INSUFICIENTE si stock en PV es menor a lo solicitado", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			const mockSerie = { serieId: "s-1", prefijo: "FV", consecutivo: 5 };
			mockTx.serieFacturacion.findFirst.mockResolvedValue(mockSerie);
			mockTx.serieFacturacion.update.mockResolvedValue({
				...mockSerie,
				consecutivo: 6,
			});
			mockTx.venta.create.mockResolvedValue(mockVenta);
			mockTx.producto.findUnique.mockResolvedValue({
				id: "prod-1",
				stock: 10,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			} as any);
			mockTx.producto.findUniqueOrThrow.mockResolvedValue({
				tenantId: "tenant-test",
			} as any);
			prisma.turnoPuntoVenta.findFirst.mockResolvedValue({
				id: "turno-1",
			} as any);

			// StockUbicacion del PV con cantidadDisponible insuficiente
			mockTx.stockUbicacion.findUnique.mockResolvedValue({
				cantidadDisponible: 5,
			});

			const result = await createVentaAction({
				puntoDeVentaId: "pv-1",
				items: [{ productoId: "prod-1", cantidad: 10, precioUnitario: 500 }],
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("STOCK_INSUFICIENTE");
			// El mensaje debe mencionar la cantidad disponible
			expect(result.error!.message).toContain("5");
		});

		it("rechaza con STOCK_INCONSISTENTE si no existe StockUbicacion en el PV", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			const mockSerie = { serieId: "s-1", prefijo: "FV", consecutivo: 5 };
			mockTx.serieFacturacion.findFirst.mockResolvedValue(mockSerie);
			mockTx.serieFacturacion.update.mockResolvedValue({
				...mockSerie,
				consecutivo: 6,
			});
			mockTx.venta.create.mockResolvedValue(mockVenta);
			mockTx.producto.findUnique.mockResolvedValue({
				id: "prod-1",
				stock: 10,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			} as any);
			mockTx.producto.findUniqueOrThrow.mockResolvedValue({
				tenantId: "tenant-test",
			} as any);
			prisma.turnoPuntoVenta.findFirst.mockResolvedValue({
				id: "turno-1",
			} as any);

			// StockUbicacion no existe en PV (null)
			mockTx.stockUbicacion.findUnique.mockResolvedValue(null);

			const result = await createVentaAction({
				puntoDeVentaId: "pv-1",
				items: [{ productoId: "prod-1", cantidad: 2, precioUnitario: 500 }],
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("STOCK_INCONSISTENTE");
		});

		it("(FASE 3) valida contra cantidadDisponible en vez de cantidad", async () => {
			/**
			 * Fase 3: la validación usa cantidadDisponible (cantidad - cantidadReservada).
			 *
			 * Escenario: stock tiene cantidad=10, cantidadDisponible=3, se piden 5.
			 * cantidadDisponible (3) < solicitado (5) → STOCK_INSUFICIENTE.
			 */
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			const mockSerie = { serieId: "s-1", prefijo: "FV", consecutivo: 5 };
			mockTx.serieFacturacion.findFirst.mockResolvedValue(mockSerie);
			mockTx.serieFacturacion.update.mockResolvedValue({
				...mockSerie,
				consecutivo: 6,
			});
			mockTx.venta.create.mockResolvedValue(mockVenta);
			mockTx.producto.findUnique.mockResolvedValue({
				id: "prod-1",
				stock: 10,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			} as any);
			mockTx.producto.findUniqueOrThrow.mockResolvedValue({
				tenantId: "tenant-test",
			} as any);
			prisma.turnoPuntoVenta.findFirst.mockResolvedValue({
				id: "turno-1",
			} as any);

			// cantidad=10 pero cantidadDisponible=3 (7 reservados)
			mockTx.stockUbicacion.findUnique.mockResolvedValue({
				cantidad: 10,
				cantidadDisponible: 3,
			});

			const result = await createVentaAction({
				puntoDeVentaId: "pv-1",
				items: [{ productoId: "prod-1", cantidad: 5, precioUnitario: 500 }],
			});

			// EXPECTED: 5 > 3 (cantidadDisponible) → debe rechazar
			// Current: 5 <= 10 (cantidad) → aprueba
			// TODO: cambiar validación a cantidadDisponible en Fase 3
			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("STOCK_INSUFICIENTE");
			expect(result.error!.message).toContain("3");
		});

		it("descuenta stock de StockUbicacion solo del PV (no del almacén)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			const mockSerie = { serieId: "s-1", prefijo: "FV", consecutivo: 5 };
			mockTx.serieFacturacion.findFirst.mockResolvedValue(mockSerie);
			mockTx.serieFacturacion.update.mockResolvedValue({
				...mockSerie,
				consecutivo: 6,
			});
			mockTx.venta.create.mockResolvedValue(mockVenta);
			mockTx.stockUbicacion.findUnique.mockResolvedValue({
				cantidadDisponible: 10,
			});
			mockTx.producto.findUnique.mockResolvedValue({
				id: "prod-1",
				stock: 10,
				almacenId: "alm-1",
				tenantId: "tenant-test",
			} as any);
			mockTx.producto.findUniqueOrThrow.mockResolvedValue({
				tenantId: "tenant-test",
			} as any);
			prisma.turnoPuntoVenta.findFirst.mockResolvedValue({
				id: "turno-1",
			} as any);

			const result = await createVentaAction({
				puntoDeVentaId: "pv-1",
				items: [{ productoId: "prod-1", cantidad: 2, precioUnitario: 500 }],
			});

			expect(result.success).toBe(true);

			// Solo se descuenta del punto de venta (pv-1), no del almacén.
			expect(mockTx.stockUbicacion.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						productoId: "prod-1",
						tipoUbicacion: "punto_venta",
						ubicacionId: "pv-1",
						cantidad: { gte: 2 },
						cantidadDisponible: { gte: 2 },
					},
					data: {
						cantidad: { increment: -2 },
						cantidadDisponible: { increment: -2 },
					},
				}),
			);
		});
	});

	describe("anularVentaAction", () => {
		it.each([
			["turno cerrado", { turno: { estado: "CERRADO", arqueos: [] } }],
			["turno con arqueo", { turno: { estado: "ABIERTO", arqueos: [{ id: "arqueo-1" }] } }],
		] as const)("bloquea anulación con %s sin efectos parciales", async (_reason, financial) => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue({
				...mockVenta,
				...financial,
			} as any);

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error!.code).toBe("FINANCIAL_REVERSAL_REQUIRED");
			}
			expect(prisma.$transaction).not.toHaveBeenCalled();
			expect(mockTx.venta.updateMany).not.toHaveBeenCalled();
			expect(mockTx.stockUbicacion.updateMany).not.toHaveBeenCalled();
			expect(mockTx.stockUbicacion.upsert).not.toHaveBeenCalled();
		});

		it("anula factura y neutraliza CxC pendiente dentro de la misma transacción", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue({
				...mockVenta,
				factura: { idFactura: "factura-1" },
			} as any);
			mockTx.venta.findUnique.mockResolvedValue({
				...mockVenta,
				factura: { idFactura: "factura-1" },
			});
			mockTx.cuentaPorCobrar.findMany.mockResolvedValue([{ id: "cxc-1" }]);

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(true);
			expect(mockTx.factura.update).toHaveBeenCalledWith({
				where: { idFactura: "factura-1" },
				data: { estado: "ANULADA" },
			});
			expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
				where: { tenantId: "tenant-test", id: { in: ["cxc-1"] } },
				data: { montoDeuda: 0, montoPagado: 0, estado: "PAGADA", idTransferencia: null },
			});
		});

		it("revierte reconciliaciones por cuenta y moneda sin recalcular FX", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue({
				...mockVenta,
				reconciliaciones: [
					{ reconciliacionId: "rec-1", cuentaId: "bank-1", moneda: "USD", monto: 10, montoConvertido: 250 },
					{ reconciliacionId: "rec-2", cuentaId: "bank-1", moneda: "USD", monto: 5, montoConvertido: 125 },
				],
			} as any);
			mockTx.venta.findUnique.mockResolvedValue({
				...mockVenta,
				reconciliaciones: [
					{ reconciliacionId: "rec-1", cuentaId: "bank-1", moneda: "USD", monto: 10, montoConvertido: 250 },
					{ reconciliacionId: "rec-2", cuentaId: "bank-1", moneda: "USD", monto: 5, montoConvertido: 125 },
				],
			});
			mockTx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(true);
			expect(mockTx.cuentaBancaria.updateMany).toHaveBeenCalledWith({
				where: { cuentaId: "bank-1", tenantId: "tenant-test", saldo: { gte: 15 } },
				data: { saldo: { decrement: 15 } },
			});
			expect(mockTx.reconciliacionVenta.deleteMany).toHaveBeenCalledWith({
				where: { tenantId: "tenant-test", ventaId: "venta-1" },
			});
		});

		it("rechaza reversión si el saldo bancario es insuficiente y no deja efectos parciales", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue({
				...mockVenta,
				reconciliaciones: [{ reconciliacionId: "rec-1", cuentaId: "bank-1", moneda: "CUP", monto: 100 }],
			} as any);
			mockTx.venta.findUnique.mockResolvedValue({
				...mockVenta,
				reconciliaciones: [{ reconciliacionId: "rec-1", cuentaId: "bank-1", moneda: "CUP", monto: 100 }],
			});
			mockTx.cuentaBancaria.updateMany.mockResolvedValue({ count: 0 });

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(false);
			if (!result.success) expect(result.error!.code).toBe("SALDO_INSUFICIENTE");
			expect(mockTx.reconciliacionVenta.deleteMany).not.toHaveBeenCalled();
			// The claim happens first; the surrounding transaction rolls it back with the error.
			expect(mockTx.venta.updateMany).toHaveBeenCalled();
		});

		it("anula venta existente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue(mockVenta);
			mockTx.venta.findUnique.mockResolvedValue(mockVenta);
			vi.mocked(prisma.venta.delete).mockResolvedValue(mockVenta);
			mockTx.stockUbicacion.findUnique.mockResolvedValue({
				cantidad: 10,
				cantidadDisponible: 10,
			});
			mockTx.producto.findUniqueOrThrow.mockResolvedValue({
				tenantId: "tenant-test",
			} as any);

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(true);
			expect(prisma.$transaction).toHaveBeenCalledWith(
				expect.any(Function),
				{ isolationLevel: "Serializable" },
			);
			expect(mockTx.producto.update).not.toHaveBeenCalled();
			expect(mockTx.venta.updateMany).toHaveBeenCalledWith({
				where: {
					ventaId: "venta-1",
					tenantId: "tenant-test",
					deletedAt: null,
				},
				data: expect.objectContaining({ deletedAt: expect.any(Date) }),
			});
			expect(mockTx.purchaseAllocation.deleteMany).toHaveBeenCalledWith({
				where: {
					tenantId: "tenant-test",
					ventaItemId: { in: ["venta-item-1"] },
				},
			});
		});

		it("revalida el turno dentro de la transacción", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue(mockVenta);
			mockTx.venta.findUnique.mockResolvedValue({
				...mockVenta,
				turno: { estado: "CERRADO", arqueos: [] },
			});

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error!.code).toBe("FINANCIAL_REVERSAL_REQUIRED");
			}
			expect(mockTx.venta.updateMany).not.toHaveBeenCalled();
			expect(mockTx.stockUbicacion.upsert).not.toHaveBeenCalled();
		});

		it("no repite efectos si la reclamación transaccional detecta una anulación concurrente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue(mockVenta);
			mockTx.venta.findUnique.mockResolvedValue(mockVenta);
			mockTx.venta.updateMany.mockResolvedValueOnce({ count: 0 });

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("ya está anulada");
			expect(mockTx.stockUbicacion.updateMany).not.toHaveBeenCalled();
			expect(mockTx.stockUbicacion.upsert).not.toHaveBeenCalled();
			expect(mockTx.purchaseAllocation.deleteMany).not.toHaveBeenCalled();
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
