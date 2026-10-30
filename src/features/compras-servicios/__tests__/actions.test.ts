/**
 * @description Tests unitarios para Server Actions de compras de servicios.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";
import { guardAccountingWriteInTransaction } from '@/features/contabilidad/services/period-close-write-guard';
vi.mock('@/features/contabilidad/services/period-close-write-guard', () => ({
  guardAccountingWriteInTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/anticipos-workflow", () => ({
	applyAnticipoAllocations: vi.fn(),
}));
vi.mock("@/features/gastosDE/reversal", () => ({
	reverseExpenseEffects: vi.fn(),
}));
vi.mock("@/features/contabilidad/services/exchange-rate-provider", () => ({
	exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

const mockTx = {
	compraServicio: {
		create: vi.fn(),
		findFirst: vi.fn(),
		findUnique: vi.fn(),
		update: vi.fn(),
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
	tenantAccountingPolicy: {
		findUnique: vi.fn(),
	},
	transaccionMoneda: { create: vi.fn() },
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
import { exchangeRateProvider } from "@/features/contabilidad/services/exchange-rate-provider";
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
		mockTx.compraServicio.findFirst.mockResolvedValue(mockCompraRow as never);
	});

	describe("getComprasServiciosAction", () => {
		it("retorna lista del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraServicio.findMany).mockResolvedValue([
				mockCompraRow,
			]);
			const result = await getComprasServiciosAction();
			expect(result.success).toBe(true);
			expect(expectActionSuccess(result).data).toHaveLength(1);
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
			expect(expectActionFailure(result).error!.code).toBe("NOT_FOUND");
		});
	});

	describe("createCompraServicioAction", () => {
		it("bloquea crear un costo pendiente como nueva CxP en plan Básico", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "manager",
				planFeatures: { servicios: true, "cuentas-pagar": false },
			} as AuthenticatedUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue(mockServicio as never);

			const result = await createCompraServicioAction({
				servicioId: "sv-1",
				costoUnitario: 100,
				cantidad: 1,
				formaPago: "PAGO_PARCIAL",
				estado: "PENDIENTE",
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("FEATURE_NOT_AVAILABLE");
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

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
			expect(expectActionFailure(result).error!.message).toContain("Servicio no encontrado");
		});

		it("rechaza servicio de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue(null);

			const result = await createCompraServicioAction({
				...validInput,
				servicioId: "sv-otro-tenant",
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("NOT_FOUND");
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
			expect(expectActionFailure(result).error!.message).toContain("Proveedor no encontrado");
		});
		it("etiqueta la reconciliación con la moneda del anticipo, no hardcodeada", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue(
				mockServicio as any,
			);
			mockTx.compraServicio.create.mockResolvedValue(mockCompraRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			// Anticipo de PAGO en USD: hoy el hardcode lo etiquetaría CUP
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "PAGO",
				moneda: "USD",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({
				cuentaId: "cb-1",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
				tasaId: "tasa-1",
				tasa: 24.5,
				fechaVigencia: new Date("2026-09-03"),
			});

			const result = await createCompraServicioAction({
				...validInput,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.reconciliacionGasto.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ moneda: "USD", estado: "PAGADA" }),
				}),
			);
		});

		it("compara anticipos en moneda funcional antes de marcar el servicio como pagado", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue({
				...mockServicio,
				moneda: "USD",
			} as any);
			mockTx.compraServicio.create.mockResolvedValue(mockCompraRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 500 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "PAGO",
				moneda: "CUP",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({
				cuentaId: "cb-1",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
				tasaId: "tasa-usd-cup",
				tasa: 25,
				fechaVigencia: new Date("2026-09-03"),
			});

			const result = await createCompraServicioAction({
				servicioId: "sv-1",
				costoUnitario: 100,
				cantidad: 1,
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				anticipos: [{ anticipoId: "a1", montoAplicado: 500 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.reconciliacionGasto.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ moneda: "CUP", estado: "PARCIAL" }),
				}),
			);
			expect(mockTx.compraServicio.updateMany).toHaveBeenCalledWith({
				where: { compraServicioId: "cs-1", tenantId: "tenant-test" },
				data: { estado: "PARCIAL" },
			});
			expect(result.data?.compraServicio.estado).toBe("PARCIAL");
		});

		it("valora el servicio extranjero con la tasa de su fecha de operación", async () => {
			const fechaServicio = new Date("2025-12-15T12:00:00.000Z");
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue({
				...mockServicio,
				moneda: "USD",
			} as any);
			mockTx.compraServicio.create.mockResolvedValue(mockCompraRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 2000 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "PAGO",
				moneda: "CUP",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({
				cuentaId: "cb-1",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
				tasaId: "usd-cup-historical",
				tasa: 20,
				fechaVigencia: fechaServicio,
			});

			const result = await createCompraServicioAction({
				servicioId: "sv-1",
				costoUnitario: 100,
				cantidad: 1,
				formaPago: "PAGO_COMPLETO",
				estado: "PAGADA",
				fechaServicio: fechaServicio.toISOString(),
				anticipos: [{ anticipoId: "a1", montoAplicado: 2000 }],
			});

			expect(result.success).toBe(true);
			expect(result.data?.compraServicio.estado).toBe("PAGADA");
			expect(mockTx.reconciliacionGasto.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ estado: "PAGADA", montoConvertido: 2000 }),
				}),
			);
			expect(exchangeRateProvider.getRateAsOf).toHaveBeenCalledWith(
				expect.objectContaining({ sourceCurrency: "USD", boundaryAt: fechaServicio }),
			);
		});

		it("escribe transaccionMoneda de espejo para anticipo extranjero", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findFirst).mockResolvedValue(
				mockServicio as any,
			);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.compraServicio.create.mockResolvedValue(mockCompraRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "PAGO",
				moneda: "USD",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({
				cuentaId: "cb-1",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
				tasaId: "tasa-1",
				tasa: 24.5,
				fechaVigencia: new Date("2026-09-03"),
			});

			const result = await createCompraServicioAction({
				...validInput,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.transaccionMoneda.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						tipoTransaccion: "servicio_egreso",
						referenciaId: mockCompraRow.compraServicioId,
						monedaId: "USD",
						montoOriginal: 100,
						tasaCambio: 24.5,
						montoConvertido: 2450,
					}),
				}),
			);
		});
	});

	describe("updateCompraServicioAction", () => {
		it("bloquea convertir una compra existente en saldo pendiente en Básico", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "manager",
				planFeatures: { servicios: true, "cuentas-pagar": false },
			} as AuthenticatedUser);

			const result = await updateCompraServicioAction({
				compraServicioId: "cs-1",
				formaPago: "PAGO_PARCIAL",
				estado: "PENDIENTE",
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("FEATURE_NOT_AVAILABLE");
			expect(prisma.compraServicio.findFirst).not.toHaveBeenCalled();
		});

		it("blocks increasing a legacy pending purchase amount without changing its payment fields", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "manager",
				planFeatures: { servicios: true, "cuentas-pagar": false },
			} as AuthenticatedUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue({
				...mockCompraRow,
				formaPago: "PAGO_PARCIAL",
				estado: "PENDIENTE",
			} as never);

			const result = await updateCompraServicioAction({
				compraServicioId: "cs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("FEATURE_NOT_AVAILABLE");
			expect(mockTx.compraServicio.update).not.toHaveBeenCalled();
		});

		it("blocks increasing an inherited partial advance liability in Basic", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "manager",
				planFeatures: { servicios: true, "cuentas-pagar": false },
			} as AuthenticatedUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue({
				...mockCompraRow,
				formaPago: "ANTICIPO_PAGO",
				estado: "PARCIAL",
			} as never);

			const result = await updateCompraServicioAction({
				compraServicioId: "cs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("FEATURE_NOT_AVAILABLE");
			expect(mockTx.compraServicio.update).not.toHaveBeenCalled();
		});

		it("rechecks liability state under lock before increasing a purchase", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "manager",
				planFeatures: { servicios: true, "cuentas-pagar": false },
			} as AuthenticatedUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue(mockCompraRow as never);
			mockTx.compraServicio.findFirst.mockResolvedValueOnce({
				...mockCompraRow,
				formaPago: "ANTICIPO_PAGO",
				estado: "PARCIAL",
			} as never);

			const result = await updateCompraServicioAction({
				compraServicioId: "cs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("FEATURE_NOT_AVAILABLE");
			expect(mockTx.compraServicio.update).not.toHaveBeenCalled();
			expect(guardAccountingWriteInTransaction.mock.invocationCallOrder[0])
				.toBeLessThan(mockTx.$queryRaw.mock.invocationCallOrder[0]);
		});

		it("actualiza compra exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.compraServicio.findFirst).mockResolvedValue(
				mockCompraRow,
			);
			mockTx.compraServicio.update.mockResolvedValue(mockCompraRow);

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
			mockTx.compraServicio.update.mockResolvedValue(mockCompraRow);

			const result = await updateCompraServicioAction({
				compraServicioId: "cs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(true);
			// mockCompraRow tiene costoUnitario 1000 → total 3000
			expect(mockTx.compraServicio.update).toHaveBeenCalledWith(
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
			expect(expectActionFailure(result).error!.message).toContain("no encontrado");
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
			expect(expectActionFailure(result).error!.code).toBe("FEATURE_NOT_AVAILABLE");
		});

		it("createCompraServicioAction requiere rol manager", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "regularUser",
				planFeatures: { servicios: true },
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
			expect(expectActionFailure(result).error!.code).toBe("FORBIDDEN");
		});

		it("deleteCompraServicioAction requiere rol manager", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "regularUser",
				planFeatures: { servicios: true },
				tenantRole: "dependiente",
			});

			const result = await deleteCompraServicioAction("cs-1");

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("FORBIDDEN");
		});
	});

	describe("auth requerido", () => {
		it("retorna AUTH_REQUIRED si no hay usuario", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);
			const result = await getComprasServiciosAction();
			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("AUTH_REQUIRED");
		});
	});
});
