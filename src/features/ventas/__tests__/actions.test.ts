/**
 * @description Tests unitarios para Server Actions de ventas.
 * TDD: RED → GREEN → REFACTOR.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/fifo-allocation", () => ({
	allocateFifoForSale: vi.fn(),
	getCostoFifoVenta: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
	AuditLogService: { logStrict: vi.fn() },
}));

const { mockTx } = vi.hoisted(() => {
	const mockTx = {
		$queryRaw: vi.fn(),
		serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		venta: {
			create: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		factura: { update: vi.fn(), updateMany: vi.fn() },
		devolucionVenta: { count: vi.fn().mockResolvedValue(0) },
		cuentaPorCobrar: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
		reconciliacionVenta: { deleteMany: vi.fn() },
		cuentaBancaria: { updateMany: vi.fn(), findFirst: vi.fn() },
		auditLog: { create: vi.fn() },
		purchaseAllocation: { deleteMany: vi.fn() },
		stockUbicacion: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		stockMoveLine: {
			create: vi.fn().mockResolvedValue({ id: "move-1" }),
			upsert: vi.fn().mockResolvedValue({ id: "move-1" }),
			findMany: vi.fn().mockResolvedValue([]),
			count: vi.fn(),
			aggregate: vi.fn(),
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
		producto: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
		cliente: { findFirst: vi.fn() },
		turnoPuntoVenta: { findFirst: vi.fn(), create: vi.fn() },
		puntoDeVenta: { findFirst: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import { AuditLogService } from "@/lib/services/audit-log-service";
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
			producto: { id: "prod-1", almacenId: "alm-1", tenantId: "tenant-test", precioCosto: 400 },
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

		beforeEach(() => {
			// Resolución server-side de precios (LP-0): PV sin lista, sin cliente,
			// producto con precio base 500 (coincide con los precioUnitario de los tests).
			vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({
				pvId: "pv-1",
				listaPrecioId: null,
			} as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);
			vi.mocked(prisma.producto.findMany).mockResolvedValue([
				{ id: "prod-1", nombre: "Producto", precioVenta: 500, precios: [] },
			] as any);
		});

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
			precioCosto: 400,
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
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					eventoKey: expect.objectContaining({
						tipoOrigen: "VENTA",
						origenId: "venta-1",
						secuencia: "ITEM-0",
					}),
				},
				create: expect.objectContaining({
					tenantId: "tenant-test",
					productoId: "prod-1",
					cantidad: -2,
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
			precioCosto: 400,
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
			precioCosto: 400,
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

		it("anula factura y conserva el historial financiero de la CxC dentro de la misma transacción", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue({
				...mockVenta,
				factura: { idFactura: "factura-1" },
			} as any);
			mockTx.venta.findUnique.mockResolvedValue({
				...mockVenta,
				factura: { idFactura: "factura-1" },
			});
			mockTx.cuentaPorCobrar.findMany.mockResolvedValue([{
				id: "cxc-1",
				montoDeuda: 1000,
				montoPagado: 250,
				idTransferencia: "transfer-1",
				estado: "PARCIAL",
			}]);

			const result = await anularVentaAction({ ventaId: "venta-1" });

			expect(result.success).toBe(true);
			expect(mockTx.factura.update).toHaveBeenCalledWith({
				where: { idFactura: "factura-1" },
				data: { estado: "ANULADA" },
			});
			expect(mockTx.cuentaPorCobrar.findMany).toHaveBeenCalledWith({
				where: {
					tenantId: "tenant-test",
					OR: [{ facturaId: "venta-1" }, { facturaId: "factura-1" }],
				},
				select: { id: true },
			});
			expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
				where: { tenantId: "tenant-test", id: { in: ["cxc-1"] } },
				data: { estado: "ANULADA" },
			});
			expect(mockTx.cuentaPorCobrar.deleteMany).not.toHaveBeenCalled();
		});

		it("registra auditoría durable de la reversión dentro de la transacción", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.venta.findUnique).mockResolvedValue(mockVenta);
			mockTx.venta.findUnique.mockResolvedValue(mockVenta);

			const result = await anularVentaAction({ ventaId: "venta-1", motivo: "Venta duplicada" });

			expect(result.success).toBe(true);
			expect(AuditLogService.logStrict).toHaveBeenCalledWith(
				expect.objectContaining({
					accion: "EXECUTE",
					entidad: "VENTA",
					entidadId: "venta-1",
					usuarioId: "user-1",
					detalles: expect.objectContaining({
						motivo: "Venta duplicada",
						reconciliacionesRevertidas: 0,
					}),
				}),
				expect.objectContaining({ auditLog: mockTx.auditLog }),
			);
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
		// La anulación compensa con el costo histórico del kardex (800), no el actual (400)
		expect(mockTx.stockMoveLine.findMany).toHaveBeenCalledWith({
			where: { tenantId: "tenant-test", tipoOrigen: "VENTA", origenId: "venta-1" },
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});
	});

	it("anula con costo histórico del kardex, no con el precio actual", async () => {
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
		// El movimiento original de venta tenía costo 900; el precioCosto actual del producto es 400
		mockTx.stockMoveLine.findMany.mockResolvedValue([
			{
				id: "m-venta-1",
				productoId: "prod-1",
				tipoUbicacion: "punto_venta",
				ubicacionId: "pv-1",
				cantidad: -2,
				costoUnitario: 900,
				secuencia: "ITEM-0",
				createdAt: new Date("2026-01-01"),
			},
		] as any);

		const result = await anularVentaAction({ ventaId: "venta-1" });

		expect(result.success).toBe(true);
		const compensacion = mockTx.stockMoveLine.upsert.mock.calls.find(
			(c: any) => c[0].where.eventoKey.secuencia === "REV-ITEM-0",
		);
		expect(compensacion).toBeDefined();
		expect(compensacion![0].create.cantidad).toBe(2);
		expect(compensacion![0].create.costoUnitario).toBe(900);
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

describe("permisos granulares en mutaciones de ventas (PG-05)", () => {
	// Rol custom "Cajero": registra ventas pero no las anula ni edita.
	const cajeroUser: AuthenticatedUser = {
		userId: "user-cajero",
		name: "Cajero",
		email: "cajero@test.com",
		role: "regularUser",
		isActive: true,
		tenantId: "tenant-test",
		tenantRole: "dependiente",
		planFeatures: { "ventas-pos": true },
		permissions: new Set(["ventas.venta.registrar"]),
	};

	const usuarioSinVentas: AuthenticatedUser = {
		userId: "user-sin-ventas",
		name: "Sin Ventas",
		email: "sinventas@test.com",
		role: "regularUser",
		isActive: true,
		tenantId: "tenant-test",
		tenantRole: "dependiente",
		planFeatures: { "ventas-pos": true },
		permissions: new Set<string>(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rechaza anular ventas para un rol custom sin ventas.venta.anular (FORBIDDEN)", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(cajeroUser);

		const result = await anularVentaAction({ ventaId: "venta-1" });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error!.code).toBe("FORBIDDEN");
		}
		// El guard corre antes de cualquier acceso a datos de la venta.
		expect(prisma.venta.findUnique).not.toHaveBeenCalled();
	});

	it("rechaza crear ventas para un rol sin ventas.venta.registrar (FORBIDDEN)", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(usuarioSinVentas);

		const result = await createVentaAction({
			puntoDeVentaId: "pv-1",
			items: [{ productoId: "prod-1", cantidad: 2, precioUnitario: 500 }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error!.code).toBe("FORBIDDEN");
		}
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});
});
