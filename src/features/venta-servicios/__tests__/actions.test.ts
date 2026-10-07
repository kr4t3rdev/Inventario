/**
 * @description Tests unitarios para Server Actions de ventas de servicios.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions/types';

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/anticipos-workflow", () => ({
	applyAnticipoAllocations: vi.fn(),
}));
vi.mock("@/features/contabilidad/services/exchange-rate-provider", () => ({
	exchangeRateProvider: { getRateAsOf: vi.fn(), getRateAsOfExact: vi.fn() },
}));

const postEventoMock = vi.hoisted(() => vi.fn());
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	postEvento: postEventoMock,
}));

const mockTx = {
	$queryRaw: vi.fn().mockResolvedValue([]),
	ventaServicios: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
	cuentaPorCobrar: { create: vi.fn(), findMany: vi.fn(),
		updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
	cliente: { findFirst: vi.fn() },
	tipoPago: { findFirst: vi.fn() },
	cuentaBancaria: { findFirst: vi.fn() },
	anticipo: { findUnique: vi.fn() },
	reconciliacionServicio: { create: vi.fn().mockResolvedValue({ reconciliacionId: 'rec-serv-mock' }) },
	transaccionMoneda: { create: vi.fn() },
	tenantAccountingPolicy: { findUnique: vi.fn() },
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
		cuentaPorCobrar: {
			create: vi.fn(),
			// Barrera CXC_VINCULADA de updateVentaServicioAction: sin CxC vinculada
			// por defecto conserva el comportamiento previo de las pruebas.
			findFirst: vi.fn().mockResolvedValue(null),
		},
		reconciliacionServicio: {
			count: vi.fn(),
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
		mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'c-1', limiteCredito: null });
		vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cl-1' } as never);
		mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
		mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-1' });
		mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		vi.mocked(exchangeRateProvider.getRateAsOfExact).mockResolvedValue({
			tasaId: 'rate-1', tasa: new Prisma.Decimal('24.5'),
			fechaVigencia: new Date('2026-09-03'),
		});
	});

	describe("getVentaServiciosAction", () => {
		it("retorna lista del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([
				mockVentaRow,
			] as never);
			const result = await getVentaServiciosAction();
			expect(result.success).toBe(true);
			if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
			expect(result.data).toHaveLength(1);
		});
	});

	describe("getVentaServicioByIdAction", () => {
		it("retorna venta por ID", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow as never,
			);
			const result = await getVentaServicioByIdAction("vs-1");
			expect(result.success).toBe(true);
		});

		it("retorna NOT_FOUND si no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(null);
			const result = await getVentaServicioByIdAction("vs-noexiste");
			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("NOT_FOUND");
		});
	});

	describe("createVentaServicioAction", () => {
		it("acepta y persiste idempotencyKey en legacy", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([] as any);
			vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(mockTx));
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue({
				...mockVentaRow,
				idempotencyKey: 'service-key:hash',
			} as any);

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				idempotencyKey: "service-key",
			});

			expect(result.success).toBe(true);
			expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(expect.objectContaining({
				data: expect.objectContaining({ idempotencyKey: expect.stringContaining('service-key:') }),
			}));
		});

		it("replay mixto devuelve un envelope estable y no un array crudo", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			const stored = {
				...mockVentaRow,
				cantidad: 1,
				costo: 0,
				condicionPago: 'CONTADO',
				idempotencyKey: 'service-key:legacy',
			};
			vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([stored] as any);

			const result = await createVentaServicioAction({
				lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 1 }],
				idempotencyKey: 'service-key',
			} as any);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(Array.isArray(result.data)).toBe(false);
				expect(result.data).toMatchObject({ mode: 'MIXED_LINES', replayed: true });
			}
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it("rechaza la misma clave legacy cuando la cantidad cambia de 1 a 2", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([] as any);
			vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(mockTx));
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue({
				...mockVentaRow,
				cantidad: 1,
				idempotencyKey: 'service-key:stored-hash',
			} as any);
			const first = await createVentaServicioAction({
				servicioId: 'sv-1', cantidad: 1, idempotencyKey: 'service-key',
			});
			expect(first.success).toBe(true);
			vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([{
				...mockVentaRow,
				cantidad: 1,
				costo: 0,
				condicionPago: 'CONTADO',
				idempotencyKey: 'service-key:stored-hash',
			}] as any);

			const conflict = await createVentaServicioAction({
				servicioId: 'sv-1', cantidad: 2, idempotencyKey: 'service-key',
			});

			expect(conflict.success).toBe(false);
			if (!conflict.success) expect(conflict.error?.code).toBe('IDEMPOTENCY_CONFLICT');
		});

		it("deniega actor sin permiso de registrar ventas antes de abrir transacción", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: 'user',
				tenantRole: 'dependiente',
				planFeatures: { servicios: true },
				permissions: new Set(),
			} as never);

			const result = await createVentaServicioAction({ servicioId: 'sv-1', cantidad: 1 });

			expect(result.success).toBe(false);
			expect(prisma.servicios.findMany).not.toHaveBeenCalled();
			expect(prisma.$transaction).not.toHaveBeenCalled();
		});

		it("crea venta legacy exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
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
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);

			const result = await createVentaServicioAction({
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

		it("persiste snapshot original de CxC mixta desde el total y moneda del catálogo", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: " usd ", precio: 1250 },
				{ servicioId: "sv-2", moneda: "eur", precio: 800 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: "cl-1" } as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "MLC",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOfExact).mockImplementation(
				async ({ sourceCurrency }) => ({
					tasaId: `rate-${sourceCurrency.toLowerCase()}-mlc`,
					tasa: new Prisma.Decimal(sourceCurrency === "USD" ? "24" : "30"),
					fechaVigencia: new Date("2026-09-25T12:00:00.000Z"),
				}) as any,
			);
			mockTx.ventaServicios.create
				.mockResolvedValueOnce({ ...mockVentaRow, ventaServicioId: "vs-usd", total: 2500 } as any)
				.mockResolvedValueOnce({ ...mockVentaRow, ventaServicioId: "vs-eur", total: 1600 } as any);
			mockTx.cuentaPorCobrar.create.mockResolvedValue({} as any);

			const result = await createVentaServicioAction({
				lineas: [
					{ tipoLinea: "SERVICIO", servicioId: "sv-1", cantidad: 2 },
					{ tipoLinea: "SERVICIO", servicioId: "sv-2", cantidad: 2 },
				],
				condicionPago: "CREDITO",
				clienteId: "cl-1",
			} as any);

			expect(result.success).toBe(true);
			expect(prisma.$transaction).toHaveBeenCalledTimes(1);
			expect(mockTx.cuentaPorCobrar.create).toHaveBeenNthCalledWith(1, {
				data: expect.objectContaining({
					ventaServicioId: "vs-usd",
					montoDeuda: 2500,
					monedaOriginal: "USD",
					montoOriginal: 2500,
					montoDeudaFuncional: new Prisma.Decimal("60000"),
					monedaFuncional: "MLC",
				}),
			});
			expect(mockTx.cuentaPorCobrar.create).toHaveBeenNthCalledWith(2, {
				data: expect.objectContaining({
					ventaServicioId: "vs-eur",
					montoDeuda: 1600,
					monedaOriginal: "EUR",
					montoOriginal: 1600,
					montoDeudaFuncional: new Prisma.Decimal("48000"),
					monedaFuncional: "MLC",
				}),
			});
			expect(mockTx.cuentaPorCobrar.create.mock.calls[0][0].data).not.toHaveProperty(
				"fxEvidenceJson",
			);
		});

		it("persiste snapshot original de CxC legacy cuando no se aplican anticipos", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: " eur ", precio: 1250 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: "cl-1" } as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "MLC",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOfExact).mockResolvedValue({
				tasaId: "rate-eur-mlc",
				tasa: new Prisma.Decimal("24.125"),
				fechaVigencia: new Date("2026-09-25T12:00:00.000Z"),
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue({
				...mockVentaRow,
				ventaServicioId: "vs-legacy-credit",
				total: 2500,
			} as any);

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 2,
				condicionPago: "CREDITO",
				clienteId: "cl-1",
			});

			expect(result.success).toBe(true);
			expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					montoDeuda: 2500,
					monedaOriginal: "EUR",
					montoOriginal: 2500,
					montoDeudaFuncional: new Prisma.Decimal("60312.5"),
					monedaFuncional: "MLC",
					tasaCambio: new Prisma.Decimal("24.125"),
					fxProvenanceKind: "CATALOG_RATE",
					fxCatalogRateId: "rate-eur-mlc",
					fxEvidenceVersion: 2,
				}),
			});
			expect(mockTx.cuentaPorCobrar.create.mock.calls[0][0].data).not.toHaveProperty(
				"fxEvidenceJson",
			);
		});

		it("valora CxC legacy parcial cuando todos los anticipos comparten la moneda de venta", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: "cl-1" } as any);
			mockTx.ventaServicios.create.mockResolvedValue({
				...mockVentaRow,
				ventaServicioId: "vs-legacy-anticipation",
			} as any);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({
				cuentaId: "cb-1",
				tipoCuenta: "EFECTIVO",
			} as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
				moneda: "CUP",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
				clienteId: "cl-1",
			} as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.reconciliacionServicio.create.mockImplementationOnce(async ({ data }: any) => ({
				reconciliacionId: "rec-cup",
				...data,
			}));

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				condicionPago: "CREDITO",
				clienteId: "cl-1",
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					montoDeuda: 5000,
					monedaOriginal: "CUP",
					montoOriginal: 5000,
					montoDeudaFuncional: new Prisma.Decimal("5000"),
					monedaFuncional: "CUP",
					tasaCambio: new Prisma.Decimal("1"),
				}),
			});
			expect(mockTx.cuentaPorCobrar.create.mock.calls[0][0].data).not.toHaveProperty(
				"fxEvidenceJson",
			);
		});

		it("rechaza crédito extranjero si falta la tasa histórica para valoración formal", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "EUR", precio: 1250 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: "cl-1" } as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "MLC",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOfExact).mockResolvedValue(null);
			mockTx.ventaServicios.create.mockResolvedValue({
				...mockVentaRow,
				ventaServicioId: "vs-credit-no-rate",
				total: 1250,
			} as any);

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				condicionPago: "CREDITO",
				clienteId: "cl-1",
			});

			expect(result.success).toBe(false);
			expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
		});

		it("rechaza un saldo CxC si la tasa excede la escala persistida", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "EUR", precio: 2_000_000_000 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: "cl-1" } as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "MLC",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOfExact).mockResolvedValue({
				tasaId: "rate-over-scale",
				tasa: new Prisma.Decimal("1.00000000005"),
				fechaVigencia: new Date("2026-09-25T12:00:00.000Z"),
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue({
				...mockVentaRow,
				total: 2_000_000_000,
			} as any);

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				condicionPago: "CREDITO",
				clienteId: "cl-1",
			});

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error?.code).toBe("FX_INSUFICIENTE");
			expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
		});

		it("rechaza una tasa que excede la precisión entera Decimal(20,10)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "EUR", precio: 1 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: "cl-1" } as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "MLC",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOfExact).mockResolvedValue({
				tasaId: "rate-over-integer-precision",
				tasa: new Prisma.Decimal("10000000000"),
				fechaVigencia: new Date("2026-09-25T12:00:00.000Z"),
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue({ ...mockVentaRow, total: 1 } as any);

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				condicionPago: "CREDITO",
				clienteId: "cl-1",
			});

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error?.code).toBe("FX_INSUFICIENTE");
			expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
		});

		it("propaga el rechazo FX de la aplicación dentro de la transacción", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: "cl-1" } as any);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: "a1", montoAplicado: 100 },
			] as any);
			mockTx.ventaServicios.create.mockResolvedValue({ ...mockVentaRow, total: 5000 } as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: "COBRO",
				moneda: "USD",
				cuentaOrigenId: "cb-1",
				tipoPagoOrigenId: "tp-1",
				clienteId: "cl-1",
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: "tp-1" } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: "cb-1" } as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
				tasaId: "rate-usd-cup",
				tasa: 24,
				fechaVigencia: new Date("2026-09-25T12:00:00.000Z"),
			});
			mockTx.reconciliacionServicio.create.mockImplementation(async ({ data }: any) => ({
				reconciliacionId: "rec-advance-usd",
				...data,
			}));
			vi.mocked(applyAnticipoAllocations).mockRejectedValueOnce(
				new ActionError('Moneda del anticipo incompatible', 'FX_INSUFICIENTE'));

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				condicionPago: "CREDITO",
				clienteId: "cl-1",
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error?.code).toBe("FX_INSUFICIENTE");
			expect(applyAnticipoAllocations).toHaveBeenCalled();
		});

		it("usa el precioUnitario persistido al recalcular el total en update", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue({
				...mockVentaRow,
				precioUnitario: 6000,
				cantidad: 1,
				total: 5000,
			} as never);
			vi.mocked(prisma.ventaServicios.update).mockResolvedValue(mockVentaRow as never);

			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(true);
			expect(prisma.ventaServicios.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ cantidad: 3, total: 18000 }),
				}),
			);
			});
			it("recurre al precio derivado cuando el registro no tiene snapshot de precio", async () => {
				vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow as never,
			);
			vi.mocked(prisma.ventaServicios.update).mockResolvedValue(mockVentaRow as never);

			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 3,
			});

			expect(result.success).toBe(true);
			expect(prisma.ventaServicios.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ cantidad: 3, total: 15000 }),
				}),
			);
		});

		it("rechaza servicio de otro tenant en modo legacy", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([] as any);

			const result = await createVentaServicioAction({
				servicioId: "sv-otro-tenant",
				cantidad: 1,
			});

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
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
					},
				],
			} as any);

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("NOT_FOUND");
		});

		it("rechaza cliente de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

			const result = await createVentaServicioAction({
				servicioId: "sv-1",
				cantidad: 1,
				clienteId: "cliente-otro-tenant",
			});

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("NOT_FOUND");
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
			vi.mocked(prisma.ventaServicios.create).mockResolvedValue(mockVentaRow as never);

			const result = await createVentaServicioAction({
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
		it("devenga la venta extranjera sin crear otro cobro bancario", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: "sv-1", moneda: "CUP", precio: 5000 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: "CUP",
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			mockTx.reconciliacionServicio.create.mockImplementationOnce(async ({ data }) => ({
				reconciliacionId: 'rec-serv-fx', ...data,
			}));
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
				servicioId: "sv-1",
				cantidad: 1,
				clienteId: 'cl-1',
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			expect(mockTx.reconciliacionServicio.create).not.toHaveBeenCalled();
			expect(postEventoMock).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ userId: 'user-1', tenantId: 'tenant-test' }),
				expect.objectContaining({
					tipo: 'VENTA_SERVICIO_CREDITO',
					montoFuncional: new Prisma.Decimal(5000),
					fxEvidenceFingerprint: expect.any(String),
				}),
			);
		});

		it('usa la valoración del devengo sin reutilizar una reconciliación bancaria ajena', async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.servicios.findMany).mockResolvedValue([
				{ servicioId: 'sv-1', moneda: 'CUP', precio: 5000 },
			] as any);
			mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({
				functionalCurrencyCode: 'CUP',
			} as any);
			mockTx.ventaServicios.create.mockResolvedValue(mockVentaRow);
			vi.mocked(applyAnticipoAllocations).mockResolvedValue([
				{ anticipoId: 'a1', montoAplicado: 100 },
			] as any);
			mockTx.anticipo.findUnique.mockResolvedValue({
				tipo: 'COBRO',
				moneda: 'USD',
				cuentaOrigenId: 'cb-1',
				tipoPagoOrigenId: 'tp-1',
			} as any);
			mockTx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tp-1' } as any);
			mockTx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-1' } as any);
			vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
				tasaId: 'tasa-1',
				tasa: 24.5,
				fechaVigencia: new Date('2026-09-03'),
			});

			const original = new Prisma.Decimal('9007199254740993.1250');
			const functional = new Prisma.Decimal('216172782113783834.0000');
			const rate = new Prisma.Decimal('24.5000000000');
			mockTx.reconciliacionServicio.create.mockResolvedValue({
				reconciliacionId: 'rec-serv-decimal',
				fechaReconciliacion: new Date('2026-09-03'),
				monto: original,
				moneda: 'USD',
				montoConvertido: functional,
				functionalCurrency: 'CUP',
				tasaCambio: rate,
				fxEvidenceFingerprint: 'fx-decimal',
			});

			const result = await createVentaServicioAction({
				servicioId: 'sv-1',
				cantidad: 1,
				clienteId: 'cl-1',
				anticipos: [{ anticipoId: 'a1', montoAplicado: 100 }],
			});

			expect(result.success).toBe(true);
			const event = postEventoMock.mock.calls.at(-1)?.[2];
			expect(event.monto).toBe(5000);
			expect(event.montoFuncional.eq(5000)).toBe(true);
			expect(event.tasaCambio.eq(1)).toBe(true);
			expect(mockTx.reconciliacionServicio.create).not.toHaveBeenCalled();
		});

		it("la aplicación conserva su movimiento sin duplicar transaccionMoneda", async () => {
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
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
				clienteId: 'cl-1',
			});

			// La captación de transaccionMoneda debe reflejar la conversión aplicada.
			// El movimiento original pertenece al workflow; no se duplica el cobro.
			expect(result.success).toBe(true);
			expect(mockTx.transaccionMoneda.create).not.toHaveBeenCalled();
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
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
				clienteId: 'cl-1',
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
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("VALIDATION_ERROR");
			expect(mockTx.reconciliacionServicio.create).not.toHaveBeenCalled();
		});

		it("la aplicación recibe la moneda del documento para validar el anticipo", async () => {
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
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
				clienteId: 'cl-1',
			});

			expect(result.success).toBe(true);
			expect(applyAnticipoAllocations).toHaveBeenCalledWith(expect.anything(),
				expect.anything(), expect.objectContaining({ monedaDocumento: 'CUP' }));
		});

		it("usa el usuario autenticado como actor al aplicar anticipos", async () => {
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
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
				clienteId: 'cl-1',
			});

			expect(result.success).toBe(true);
			expect(applyAnticipoAllocations).toHaveBeenCalledWith(expect.anything(),
				expect.anything(), expect.objectContaining({ usuarioId: 'user-1' }));
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
				servicioId: "sv-1",
				cantidad: 1,
				anticipos: [{ anticipoId: "a1", montoAplicado: 100 }],
			});

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("VALIDATION_ERROR");
			expect(mockTx.reconciliacionServicio.create).not.toHaveBeenCalled();
		});
	});

	describe("updateVentaServicioAction", () => {
		it("actualiza exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow as never,
			);
			vi.mocked(prisma.ventaServicios.update).mockResolvedValue(mockVentaRow as never);
			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 2,
			});
			expect(result.success).toBe(true);
		});
	});

	describe("deleteVentaServicioAction", () => {
		it("elimina exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow as never,
			);
			vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(0);
			vi.mocked(prisma.ventaServicios.delete).mockResolvedValue(mockVentaRow as never);
			const result = await deleteVentaServicioAction("vs-1");
			expect(result.success).toBe(true);
		});

		it("bloquea el borrado de ventas con reconciliaciones (HAS_REFERENCES)", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow as never,
			);
			vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(2);

			const result = await deleteVentaServicioAction("vs-1");

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("HAS_REFERENCES");
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
				mockVentaRow as never,
			);

			const result = await updateVentaServicioAction({
				ventaServicioId: "vs-1",
				cantidad: 2,
			});

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("FORBIDDEN");
		});

		it("deleteVentaServicioAction requiere rol manager", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue({
				...mockUser,
				role: "regularUser",
				planFeatures: { servicios: true },
				tenantRole: "dependiente",
			});
			vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(
				mockVentaRow as never,
			);
			vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(0);

			const result = await deleteVentaServicioAction("vs-1");

			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("FORBIDDEN");
		});
	});

	describe("auth requerido", () => {
		it("retorna AUTH_REQUIRED", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);
			const result = await getVentaServiciosAction();
			expect(result.success).toBe(false);
			if (result.success) expect.unreachable('Se esperaba que la accion fallara');
			expect(result.error!.code).toBe("AUTH_REQUIRED");
		});
	});
});
