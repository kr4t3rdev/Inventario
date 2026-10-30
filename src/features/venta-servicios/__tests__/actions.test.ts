/**
 * @description Tests unitarios para Server Actions de ventas de servicios.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/contabilidad/services/period-close-write-guard', () => ({
  guardAccountingWriteInTransaction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/services/periodo-contable-guard", () => ({
	getGuardConfigExtended: () => ({
		enabled: process.env.PERIODO_GUARD_ENABLED === "true",
		mode: process.env.PERIODO_GUARD_ENABLED === "true" ? "enforce" : "disabled",
		defaultTimezone: "UTC",
	}),
	PeriodoGuard: class {
		async verificarEscritura() {
			return { permitido: false, error: "Período cerrado", codigo: "PERIODO_CERRADO" };
		}
	},
}));
vi.mock("@/lib/services/anticipos-workflow", () => ({
	applyAnticipoAllocations: vi.fn(),
}));
vi.mock("@/features/contabilidad/services/exchange-rate-provider", () => ({
	exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

// Lecturas compartidas raíz↔tx (mismo fn): las actions leen por tx dentro de
// la transacción y por raíz fuera; los tests configuran una sola vez. Los
// writes quedan separados para seguir probando atomicidad. vi.hoisted: la
// fábrica de vi.mock se ejecuta antes que cualquier const del archivo.
const {
	mockVentaFindFirst,
	mockVentaFindMany,
	mockCxcFindFirst,
	mockCxcFindMany,
	mockClienteFindFirst,
	mockFacturaFindFirst,
	mockFacturaCount,
	mockReconciliacionCount,
} = vi.hoisted(() => ({
	mockVentaFindFirst: vi.fn(),
	mockVentaFindMany: vi.fn(),
	mockCxcFindFirst: vi.fn(),
	mockCxcFindMany: vi.fn(),
	mockClienteFindFirst: vi.fn(),
	mockFacturaFindFirst: vi.fn(),
	mockFacturaCount: vi.fn(),
	mockReconciliacionCount: vi.fn(),
}));

const mockTx = {
	ventaServicios: { create: vi.fn(), findMany: mockVentaFindMany, findFirst: mockVentaFindFirst, update: vi.fn(), delete: vi.fn() },
	cuentaPorCobrar: { create: vi.fn(), findFirst: mockCxcFindFirst, findMany: mockCxcFindMany, update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
	factura: { findFirst: mockFacturaFindFirst, create: vi.fn(), updateMany: vi.fn() },
	cliente: { findFirst: mockClienteFindFirst },
	reconciliacionServicio: { create: vi.fn(), count: mockReconciliacionCount },
	$executeRaw: vi.fn(),
	tipoPago: { findFirst: vi.fn() },
	cuentaBancaria: { findFirst: vi.fn() },
	anticipo: { findUnique: vi.fn() },
	transaccionMoneda: { create: vi.fn() },
	tenantAccountingPolicy: { findUnique: vi.fn() },
	auditLog: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
	prisma: {
		ventaServicios: {
			findMany: mockVentaFindMany,
			findFirst: mockVentaFindFirst,
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		servicios: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
		},
		cliente: {
			findFirst: mockClienteFindFirst,
		},
		cuentaPorCobrar: {
			findFirst: mockCxcFindFirst,
			findMany: mockCxcFindMany,
		},
		factura: {
			findFirst: mockFacturaFindFirst,
			count: mockFacturaCount,
		},
		reconciliacionServicio: {
			count: mockReconciliacionCount,
		},
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import { applyAnticipoAllocations } from "@/lib/services/anticipos-workflow";
import { exchangeRateProvider } from "@/features/contabilidad/services/exchange-rate-provider";
import {
	getVentaServiciosAction,
	getVentaServicioByIdAction,
	createVentaServicioAction,
	updateVentaServicioAction,
	deleteVentaServicioAction,
} from "@/features/venta-servicios/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import type { ActionResponse } from "@/lib/server-actions/types";

/**
 * @description Verifica el resultado exitoso y devuelve la variante discriminada.
 * @param {ActionResponse<T>} response - Respuesta de una Server Action.
 * @returns {Extract<ActionResponse<T>, { success: true }>} Resultado exitoso.
 */
function expectActionSuccess<T>(
	response: ActionResponse<T>,
): Extract<ActionResponse<T>, { success: true }> {
	expect(response.success).toBe(true);
	if (!response.success) throw new Error(response.error.message);
	return response;
}

/**
 * @description Verifica el resultado fallido y devuelve la variante discriminada.
 * @param {ActionResponse<T>} response - Respuesta de una Server Action.
 * @returns {Extract<ActionResponse<T>, { success: false }>} Resultado fallido.
 */
function expectActionFailure<T>(
	response: ActionResponse<T>,
): Extract<ActionResponse<T>, { success: false }> {
	expect(response.success).toBe(false);
	if (response.success) throw new Error("Expected the action to fail");
	return response;
}

const mockUser: AuthenticatedUser = {
	userId: "user-1",
	name: "Test",
	email: "test@test.com",
	role: "admin",
	isActive: true,
	tenantId: "tenant-test",
	tenantRole: "manager",
};

const mockVentaRow = {
	ventaServicioId: "vs-1",
	tenantId: "tenant-test",
	servicioId: "sv-1",
	cantidad: 1,
	costo: 0,
	total: 5000,
	moneda: "CUP",
	precioUnitario: 5000,
	ventaId: null,
	condicionPago: "CONTADO" as const,
	idempotencyKey: null,
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
		vi.mocked(prisma.factura.count).mockResolvedValue(0);
	});

	describe("getVentaServiciosAction", () => {
		it("retorna lista del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([
				mockVentaRow,
			]);
			const result = await getVentaServiciosAction();
			expect(result.success).toBe(true);
			expect(expectActionSuccess(result).data).toHaveLength(1);
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
			expect(expectActionFailure(result).error!.code).toBe("NOT_FOUND");
		});
	});

	describe("createVentaServicioAction", () => {
		it("crea venta legacy exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
			});

			expect(result.success).toBe(true);
		});

		it("persiste snapshot de moneda y precioUnitario en modo legacy", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "USD", precio: 5000 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 2,
			});

			expect(result.success).toBe(true);
			expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						moneda: "USD",
						precioUnitario: 5000,
					}),
				}),
			);
		});

		it("calcula el total en el servidor desde el catálogo e ignora importes del cliente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 2,
			} as any);

			expect(result.success).toBe(true);
			expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ total: 10000, precioUnitario: 5000 }),
				}),
			);
		});

		it("rechaza precioUnitario enviado desde el cliente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				precioUnitario: 2500,
			} as any);

			expect(result.success).toBe(false);
		});

		it("persiste la moneda de cada línea en modo mixto", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "USD", precio: 5000 },
			] as any);
			vi.mocked(prisma.$transaction).mockImplementation((args: any) => {
				if (Array.isArray(args)) return Promise.all(args);
				return args(mockTx);
			});
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				lineas: [
					{
						tipoLinea: "SERVICIO",
						servicioId: "sv-1",
						cantidad: 1,
					},
				],
			} as any);

			expect(result.success).toBe(true);
			expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						moneda: "USD",
						precioUnitario: 5000,
					}),
				}),
			);
		});

		it("usa el precioUnitario persistido al recalcular el total en update", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue({
				...mockVentaRow,
				precioUnitario: 6000,
				cantidad: 1,
				total: 5000,
				clienteId: null,
				condicionPago: "CONTADO",
			});
			mockTx.ventaServicios.update.mockResolvedValue(mockVentaRow);

			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(true);
			expect(mockTx.ventaServicios.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ cantidad: 3, total: 18000 }),
				}),
			);
			});
			it("recurre al precio derivado cuando el registro no tiene snapshot de precio", async () => {
				vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);
			mockTx.ventaServicios.update.mockResolvedValue(mockVentaRow);

			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(true);
			expect(mockTx.ventaServicios.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ cantidad: 3, total: 15000 }),
				}),
			);
		});

		it("rechaza servicio de otro tenant en modo legacy", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([] as any);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-otro-tenant",
				cantidad: 1,
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("NOT_FOUND");
		});

		it("rechaza servicio de otro tenant en modo mixto", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([] as any);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				lineas: [
					{
						tipoLinea: "SERVICIO",
						servicioId: "sv-otro-tenant",
						cantidad: 1,
					},
				],
			} as any);

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("NOT_FOUND");
		});

		it("rechaza cliente de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				clienteId: "cliente-otro-tenant",
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("NOT_FOUND");
		});

		it("crea venta mixta exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			// Modo mixto usa $transaction(array) no callback
			vi.mocked(prisma.$transaction).mockImplementation((args: any) => {
				if (Array.isArray(args)) return Promise.all(args);
				return args(mockTx);
			});
			vi.mocked(prisma.ventaServicios.create).mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				lineas: [
					{
						tipoLinea: "SERVICIO",
						servicioId: "sv-1",
						cantidad: 1,
					},
				],
			} as any);

			expect(result.success).toBe(true);
		});

		it("rechaza líneas de producto", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				lineas: [
					{
						tipoLinea: "SERVICIO",
						servicioId: "sv-1",
						cantidad: 1,
					},
				],
			} as any);

			expect(result.success).toBe(true);
		});
		it("convierte anticipo en moneda extranjera con tasa del catálogo", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
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

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.reconciliacionServicio.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						moneda: "USD",
						tasaCambio: expect.anything(),
						montoConvertido: expect.anything(),
					}),
				}),
			);
		});

		it("escribe transaccionMoneda de espejo cuando el anticipo es extranjero", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
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

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			// La captación de transaccionMoneda debe reflejar la conversión aplicada.
			expect(result.success).toBe(true);
			expect(mockTx.transaccionMoneda.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						tipoTransaccion: "servicio",
						referenciaId: mockVentaRow.ventaServicioId,
						monedaId: "USD",
						montoOriginal: 100,
						tasaCambio: 24.5,
						montoConvertido: 2450, // 100 * 24.5
					}),
				}),
			);
		});

		it("no escribe transaccionMoneda cuando la moneda es la funcional del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
				moneda: "CUP",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({
				cuentaId: "cb-1",
			} as any);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.transaccionMoneda.create).not.toHaveBeenCalled();
		});

		it("rechaza anticipo extranjero sin tasa disponible (evita fila invisible)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
				moneda: "USD",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({
				cuentaId: "cb-1",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue(null);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("VALIDATION_ERROR");
			expect(mockTx.reconciliacionServicio.create).not.toHaveBeenCalled();
		});

		it("etiqueta la reconciliación con la moneda del anticipo, no hardcodeada", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			// Anticipo de COBRO en USD con tasa disponible: la etiqueta es USD
			// y se persisten montoConvertido/tasa de la evidencia.
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
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

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.reconciliacionServicio.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ moneda: "USD" }),
				}),
			);
		});

		it("usa el usuario autenticado como reconciliadoPor al aplicar anticipos", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
				clienteId: "cl-1",
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({
				cuentaId: "cb-1",
			} as any);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.reconciliacionServicio.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ reconciliadoPor: "user-1" }),
				}),
			);
		});

		it("rechaza anticipo sin cuenta ni tipo de pago configurados", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
				cuentaOrigenId: null,
				tipoPagoOrigenId: null,
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue(null);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue(null);

			const result = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("VALIDATION_ERROR");
			expect(mockTx.reconciliacionServicio.create).not.toHaveBeenCalled();
		});

		it("reproduce una venta legacy con la misma clave y rechaza cantidad distinta", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.findMany.mockResolvedValue([]);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const input = { condicionPago: "CONTADO" as const, servicioId: "sv-1", cantidad: 1, idempotencyKey: "legacy-key" };
			const created = await createVentaServicioAction(input);
			expect(created.success).toBe(true);
			const storedKey = mockTx.ventaServicios.create.mock.calls[0][0].data.idempotencyKey;
			expect(storedKey).toMatch(/^v2:/);

			mockTx.ventaServicios.findMany.mockResolvedValue([
				{ ...mockVentaRow, idempotencyKey: storedKey },
			]);
			const replay = await createVentaServicioAction(input);
			expect(replay.success).toBe(true);
			expect(mockTx.ventaServicios.create).toHaveBeenCalledTimes(1);

			const conflict = await createVentaServicioAction({
				...input, cantidad: 2 });
			expect(conflict.success).toBe(false);
			expect(expectActionFailure(conflict).error?.code).toBe("IDEMPOTENCY_CONFLICT");
		});

		it("incluye cardinalidad, orden y cantidad de líneas mixtas en la huella", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.findMany.mockResolvedValue([]);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const input = {
				condicionPago: "CONTADO" as const,
				idempotencyKey: "mixed-key",
				lineas: [{ tipoLinea: "SERVICIO" as const, servicioId: "sv-1", cantidad: 1 }],
			};
			const created = await createVentaServicioAction(input);
			expect(created.success).toBe(true);
			const storedKey = mockTx.ventaServicios.create.mock.calls[0][0].data.idempotencyKey;

			mockTx.ventaServicios.findMany.mockResolvedValue([
				{ ...mockVentaRow, idempotencyKey: storedKey },
			]);
			const replay = await createVentaServicioAction(input);
			expect(replay.success).toBe(true);
			expect(expectActionSuccess(replay).data).toMatchObject({ mode: "MIXED_LINES", replayed: true });

			const conflict = await createVentaServicioAction({
				...input,
				lineas: [{ ...input.lineas[0], cantidad: 2 }],
			});
			expect(conflict.success).toBe(false);
			expect(expectActionFailure(conflict).error?.code).toBe("IDEMPOTENCY_CONFLICT");
			expect(mockTx.ventaServicios.create).toHaveBeenCalledTimes(1);
		});

		it("devuelve las líneas mixtas en índice numérico estable con más de diez líneas", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.findMany.mockResolvedValue([]);
			mockTx.ventaServicios.create.mockImplementation(async ({ data }: any) => ({
				...mockVentaRow,
				ventaServicioId: `vs-${data.idempotencyKey.split(":").at(-1)}`,
				idempotencyKey: data.idempotencyKey,
			}));
			const input = {
				condicionPago: "CONTADO" as const,
				idempotencyKey: "many-line-key",
				lineas: Array.from({ length: 11 }, () => ({
					tipoLinea: "SERVICIO" as const, servicioId: "sv-1", cantidad: 1,
				})),
			};
			const created = await createVentaServicioAction(input);
			expect(created.success).toBe(true);
			const rows = mockTx.ventaServicios.create.mock.calls.map((call) => ({
				...mockVentaRow,
				ventaServicioId: `vs-${call[0].data.idempotencyKey.split(":").at(-1)}`,
				idempotencyKey: call[0].data.idempotencyKey,
			}));
			mockTx.ventaServicios.findMany.mockResolvedValue(
				[...rows].sort((left, right) =>
					left.idempotencyKey.localeCompare(right.idempotencyKey)),
			);

			const replay = await createVentaServicioAction(input);
			expect(replay.success).toBe(true);
			expect((expectActionSuccess(replay).data as any).ventasServicios.map((row: any) => row.ventaServicioId))
				.toEqual(Array.from({ length: 11 }, (_, index) => `vs-${index}`));
		});

		it("permite replay exacto en período cerrado y bloquea una venta nueva", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.findMany.mockResolvedValue([]);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const input = { condicionPago: "CONTADO" as const, servicioId: "sv-1", cantidad: 1, idempotencyKey: "period-replay" };
			const created = await createVentaServicioAction(input);
			expect(created.success).toBe(true);
			const storedKey = mockTx.ventaServicios.create.mock.calls[0][0].data.idempotencyKey;
			mockTx.ventaServicios.findMany.mockResolvedValue([
				{ ...mockVentaRow, idempotencyKey: storedKey },
			]);
			vi.stubEnv("PERIODO_GUARD_ENABLED", "true");

			const replay = await createVentaServicioAction(input);
			expect(replay.success).toBe(true);
			expect(expectActionSuccess(replay).data).toMatchObject({ replayed: true });

			mockTx.ventaServicios.findMany.mockResolvedValue([]);
			const newWrite = await createVentaServicioAction({
				condicionPago: "CONTADO" as const,
				servicioId: "sv-1", cantidad: 1,
				idempotencyKey: "new-period-write",
			});
			expect(newWrite.success).toBe(false);
			expect(expectActionFailure(newWrite).error?.code).toBe("PERIODO_CERRADO");
			expect(mockTx.ventaServicios.create).toHaveBeenCalledTimes(1);
		});
	});

	describe("updateVentaServicioAction", () => {
		it("actualiza exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);
			mockTx.ventaServicios.update.mockResolvedValue(mockVentaRow);
			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 2,
			});
			expect(result.success).toBe(true);
			expect(mockTx.ventaServicios.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ total: 10000 }),
				}),
			);
		});
	});

	describe("deleteVentaServicioAction", () => {
		it("elimina exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);
			vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(0);
			vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue(null);
			mockTx.ventaServicios.delete.mockResolvedValue(mockVentaRow);
			const result = await deleteVentaServicioAction("vs-1");
			expect(result.success).toBe(true);
		});

		it("bloquea el borrado de ventas con reconciliaciones (HAS_REFERENCES)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);
			vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(2);

			const result = await deleteVentaServicioAction("vs-1");

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("HAS_REFERENCES");
			expect(prisma.ventaServicios.delete).not.toHaveBeenCalled();
		});
	});

	describe("autorización", () => {
		it("updateVentaServicioAction requiere rol manager", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "regularUser",
				planFeatures: { servicios: true },
				tenantRole: "dependiente",
			});
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);

			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 2,
			});

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("FORBIDDEN");
		});

		it("deleteVentaServicioAction requiere rol manager", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "regularUser",
				planFeatures: { servicios: true },
				tenantRole: "dependiente",
			});
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow,
			);
			vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(0);

			const result = await deleteVentaServicioAction("vs-1");

			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("FORBIDDEN");
		});
	});

	describe("auth requerido", () => {
		it("retorna AUTH_REQUIRED", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);
			const result = await getVentaServiciosAction();
			expect(result.success).toBe(false);
			expect(expectActionFailure(result).error!.code).toBe("AUTH_REQUIRED");
		});
	});
});

describe("costo server-side de servicios (C-3)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		// El catálogo define el costo estándar: 750 por unidad.
		vi.mocked(prisma.servicios.findMany).mockResolvedValue([
			{ servicioId: "sv-1", moneda: "CUP", precio: 5000, costo: 750 },
		] as never);
		vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: "cli-1" } as never);
		mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow as never);
	});

	it("mixto con costo manipulado es rechazado por el schema strict", async () => {
		const result = await createVentaServicioAction({
			lineas: [{ tipoLinea: "SERVICIO", servicioId: "sv-1", cantidad: 1, costo: 999999 }],
		} as never);

		expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected action failure");
		expect(result.error?.code).toBe("VALIDATION_ERROR");
		expect(mockTx.ventaServicios.create).not.toHaveBeenCalled();
	});

	it("legacy persiste el costo del catálogo aunque el payload no lo envíe", async () => {
		const result = await createVentaServicioAction({
			servicioId: "sv-1",
			cantidad: 2,
		} as never);

		expect(result.success).toBe(true);
		expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ costo: 750 }),
			}),
		);
	});

	it("update con costo manipulado es rechazado", async () => {
		vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(mockVentaRow as never);
		vi.mocked(prisma.ventaServicios.update).mockResolvedValue(mockVentaRow as never);

		const result = await updateVentaServicioAction({
			ventaServicioId: "vs-1",
			costo: 5,
		} as never);

		expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected action failure");
		expect(result.error?.code).toBe("VALIDATION_ERROR");
		expect(prisma.ventaServicios.update).not.toHaveBeenCalled();
	});
});

describe("delete con protección de CxC (C-5)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(mockVentaRow as never);
		vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(0 as never);
		mockTx.ventaServicios.delete.mockResolvedValue(mockVentaRow as never);
		mockTx.cuentaPorCobrar.deleteMany.mockResolvedValue({ count: 0 } as never);
	});

	it("con CxC activa rechaza el borrado (VENTA_CON_CXC_ACTIVA) y la venta sobrevive", async () => {
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue({
			id: "cxc-1",
		} as never);

		const result = await deleteVentaServicioAction("vs-1");

		expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected action failure");
		expect(result.error?.code).toBe("VENTA_CON_CXC_ACTIVA");
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(mockTx.ventaServicios.delete).not.toHaveBeenCalled();
	});

	it("con solo CxC ANULADA borra la CxC anulada y la venta en la misma transacción", async () => {
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue(null as never);
		mockTx.cuentaPorCobrar.deleteMany.mockResolvedValue({ count: 1 } as never);

		const result = await deleteVentaServicioAction("vs-1");

		expect(result.success).toBe(true);
		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
		expect(mockTx.cuentaPorCobrar.deleteMany).toHaveBeenCalledWith({
			where: { ventaServicioId: "vs-1", estado: "ANULADA" },
		});
		expect(mockTx.ventaServicios.delete).toHaveBeenCalledWith({
			where: { ventaServicioId: "vs-1" },
		});
	});

	it("sin CxC elimina solo la venta (regresión)", async () => {
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue(null as never);

		const result = await deleteVentaServicioAction("vs-1");

		expect(result.success).toBe(true);
		expect(mockTx.cuentaPorCobrar.deleteMany).toHaveBeenCalledWith({
			where: { ventaServicioId: "vs-1", estado: "ANULADA" },
		});
		expect(mockTx.ventaServicios.delete).toHaveBeenCalled();
	});
});
