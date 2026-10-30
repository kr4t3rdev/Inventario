/**
 * @description Tests de integración para las Server Actions de períodos contables.
 *
 * Cubre: listar períodos, abrir, cerrar, reabrir, aprobar y obtener timeline.
 * Usa mocks de Prisma, getCurrentUser y revalidatePath.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks (antes de los imports) ──────────────────────────────────────────

vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/audit-log-service", () => ({
	AuditLogService: {
		log: vi.fn().mockResolvedValue(undefined),
		logStrict: vi.fn().mockResolvedValue(undefined),
	},
}));

	const { mockPrisma } = vi.hoisted(() => ({
		mockPrisma: {
			$executeRaw: vi.fn().mockResolvedValue(1),
			$transaction: vi.fn(
			(
				cb: (tx: typeof mockPrisma) => Promise<unknown>,
			): Promise<unknown> => cb(mockPrisma),
		),
		periodoContable: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
		venta: { findMany: vi.fn() },
		ventaServicios: { findMany: vi.fn(), count: vi.fn() },
		gastosDE: { findMany: vi.fn() },
		gastoCompra: { findMany: vi.fn() },
		compraServicio: { count: vi.fn(), findMany: vi.fn() },
		auditoriaPeriodo: {
			findMany: vi.fn(),
			create: vi.fn(),
		},
		saldoSnapshot: {
			findMany: vi.fn(),
			create: vi.fn(),
		},
		cuentaBancaria: {
			findMany: vi.fn(),
		},
		stockUbicacion: {
			findMany: vi.fn(),
		},
		compraDocumentoItem: {
			findMany: vi.fn(),
		},
		inyeccionCapital: {
			findMany: vi.fn(),
		},
		reconciliacionVenta: {
			aggregate: vi.fn(),
		},
		reconciliacionServicio: {
			aggregate: vi.fn(),
		},
		reconciliacionGasto: {
			aggregate: vi.fn(),
			findMany: vi.fn(),
		},
		ajusteBancario: {
			aggregate: vi.fn(),
		},
		transferenciaBancaria: {
			aggregate: vi.fn(),
		},
		aperturaPeriodo: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
		aperturaPeriodoSolicitud: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
		cuentaContable: { findMany: vi.fn() },
		fxEvidence: { findFirst: vi.fn(), create: vi.fn() },
		tasaCambio: { findUnique: vi.fn() },
		tenantAccountingPolicy: { findUnique: vi.fn() },
		diario: { findFirst: vi.fn() },
		asiento: { findUnique: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), create: vi.fn() },
		snapshotPeriodo: {
			findFirst: vi.fn(),
			create: vi.fn(),
		},
		cuentaPorCobrar: {
			aggregate: vi.fn(),
			findMany: vi.fn(),
		},
		cuentaPorPagar: {
			aggregate: vi.fn(),
			findMany: vi.fn(),
		},
		periodoCache: {
			findUnique: vi.fn(),
			upsert: vi.fn().mockResolvedValue({}),
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			delete: vi.fn().mockResolvedValue({}),
		},
	},
}));

const accountingSnapshotMocks = vi.hoisted(() => ({
  getCurrentBalance: vi.fn(),
  getReconciledResultForYear: vi.fn(),
}));

const checkpointMocks = vi.hoisted(() => ({
	captureFinancialAuxiliaryCheckpoint: vi.fn(),
	collectFinancialAuxiliaryEvidence: vi.fn(),
}));

const financialSnapshotV3Mocks = vi.hoisted(() => ({
	captureFinancialSnapshotV3: vi.fn(),
	approveFinancialSnapshotV3: vi.fn(),
}));

const exchangeRateMocks = vi.hoisted(() => ({ getRateAsOf: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
	prisma: mockPrisma,
}));
vi.mock("@/features/contabilidad/services/current-balance-service", () => accountingSnapshotMocks);
vi.mock(
	"@/features/contabilidad/services/reconciled-result-service",
	() => accountingSnapshotMocks,
);
vi.mock(
	"@/features/contabilidad/services/financial-auxiliary-checkpoint-service",
	() => checkpointMocks,
);
vi.mock(
	"@/features/contabilidad/services/financial-snapshot-v3-service",
	() => financialSnapshotV3Mocks,
);
vi.mock("@/features/contabilidad/services/exchange-rate-provider", () => ({ exchangeRateProvider: exchangeRateMocks }));

// ── Imports bajo test ─────────────────────────────────────────────────────

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
	listarPeriodosAction,
	obtenerPeriodoAction,
	obtenerTimelineAction,
	abrirPeriodoAction,
	cerrarPeriodoAction,
	verificarOperacionesPendientesAction,
	reabrirPeriodoAction,
	aprobarPeriodoAction,
	solicitarAperturaManualAction,
	aprobarAperturaManualAction,
	abrirPeriodoManualAprobadoAction,
	listarSolicitudesAperturaManualAction,
	obtenerSolicitudAperturaManualAction,
} from "@/features/contabilidad/actions-periodos";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import {
	EstadoPeriodo,
	TipoPeriodo,
	EventoAuditoria,
	generarLabelPeriodo,
} from "@/lib/services/periodo-contable-types";
import { PeriodoContableService } from "@/lib/services/periodo-contable-service";
import { Prisma } from "@/generated/prisma";
import { buildAppliedFxEvidence } from "@/features/contabilidad/domain/fx-evidence";
import type { ActionResponse } from "@/lib/server-actions/types";

// ── Helpers ───────────────────────────────────────────────────────────────

const TENANT = "tenant-1";
const ACTOR = "user-1";

/**
 * @description Verifica el resultado exitoso y devuelve la variante discriminada.
 * @param {ActionResponse<T>} response - Resultado devuelto por una Server Action.
 * @returns {Extract<ActionResponse<T>, { success: true }>} Datos de la variante exitosa.
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
 * @param {ActionResponse<T>} response - Resultado devuelto por una Server Action.
 * @returns {Extract<ActionResponse<T>, { success: false }>} Error de la variante fallida.
 */
function expectActionFailure<T>(
	response: ActionResponse<T>,
): Extract<ActionResponse<T>, { success: false }> {
	expect(response.success).toBe(false);
	if (response.success) throw new Error("Expected the action to fail");
	return response;
}

const mockUser: AuthenticatedUser = {
	userId: ACTOR,
	name: "Test User",
	email: "test@test.com",
	role: "admin",
	isActive: true,
	tenantId: TENANT,
	tenantRole: "manager",
};

function makePeriodo(overrides: Record<string, unknown> = {}) {
	return {
		periodoId: "p-1",
		tenantId: TENANT,
		tipo: TipoPeriodo.MENSUAL,
		codigo: null,
		fechaInicio: new Date("2026-03-01T00:00:00Z"),
		fechaFin: new Date("2026-03-31T23:59:59Z"),
		estado: EstadoPeriodo.BORRADOR,
		periodoPadreId: null,
		aperturaAutomatica: false,
		categoria: "ORDINARIO",
		abiertoPorId: null,
		fechaApertura: null,
		motivoReapertura: null,
		cerradoPor: null,
		cerradoAt: null,
		aprobadoPor: null,
		aprobadoAt: null,
		reabiertoPorId: null,
		fechaReapertura: null,
		segundoAprobadorId: null,
		observaciones: null,
		resumenJson: null,
		hashIntegridad: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		_count: { subperiodos: 0 },
		...overrides,
	};
}

function mockAperturaService() {
	// Mocks mínimos para que AperturaPeriodoService.createAperturaPeriodo funcione
	mockPrisma.periodoContable.findUnique.mockResolvedValue(
		makePeriodo({ estado: EstadoPeriodo.ABIERTO }),
	);
	mockPrisma.aperturaPeriodo.findUnique.mockResolvedValue(null);
	mockPrisma.aperturaPeriodo.create.mockResolvedValue({ aperturaId: "ap-1" });
	mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]);
	mockPrisma.cuentaPorCobrar.aggregate.mockResolvedValue({
		_sum: { saldoPendiente: null },
	});
	mockPrisma.cuentaPorPagar.aggregate.mockResolvedValue({
		_sum: { saldoPendiente: null },
	});
	// DeriveOpeningBalances busca periodo anterior
	mockPrisma.periodoContable.findFirst.mockResolvedValue(null);
}

function resetMocks() {
	vi.clearAllMocks();
}

// ── Setup común ───────────────────────────────────────────────────────────

beforeEach(() => {
	resetMocks();
	process.env.FINANCIAL_V3_CAPTURE = "true";
	mockPrisma.stockUbicacion.findMany.mockResolvedValue([]);
	mockPrisma.compraDocumentoItem.findMany.mockResolvedValue([]);
	mockPrisma.cuentaPorCobrar.findMany.mockResolvedValue([]);
	mockPrisma.cuentaPorPagar.findMany.mockResolvedValue([]);
	mockPrisma.venta.findMany.mockResolvedValue([]);
	mockPrisma.ventaServicios.findMany.mockResolvedValue([]);
	mockPrisma.ventaServicios.count.mockResolvedValue(0);
	mockPrisma.gastosDE.findMany.mockResolvedValue([]);
	mockPrisma.gastoCompra.findMany.mockResolvedValue([]);
	mockPrisma.compraServicio.count.mockResolvedValue(0);
		mockPrisma.compraServicio.findMany.mockResolvedValue([]);
	mockPrisma.reconciliacionGasto.findMany.mockResolvedValue([]);
	mockPrisma.inyeccionCapital.findMany.mockResolvedValue([]);
	checkpointMocks.collectFinancialAuxiliaryEvidence.mockResolvedValue({
		bankAccounts: [],
		inventory: [],
		receivables: [],
		payables: [],
		debt: [],
		capital: [],
	});
	vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
	mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue(null);
	mockPrisma.aperturaPeriodoSolicitud.create.mockResolvedValue({ solicitudId: "request-1", estado: "PENDIENTE" });
	mockPrisma.aperturaPeriodoSolicitud.updateMany.mockResolvedValue({ count: 1 });
	checkpointMocks.captureFinancialAuxiliaryCheckpoint.mockImplementation(
		async (params: {
			collectEvidence: (
				client: typeof mockPrisma,
				cutoffAt: Date,
			) => Promise<Record<string, unknown>>;
		}) => {
			const evidence = await params.collectEvidence(
				mockPrisma,
				new Date("2026-01-02T12:00:00.000Z"),
			);
			return {
				checkpointId: "checkpoint-annual",
				payload: {
					...evidence,
					version: 3,
					cutoffAt: "2026-01-02T12:00:00.000Z",
					capturedAt: "2026-01-02T12:00:01.000Z",
					tenantId: TENANT,
					auxiliaries: {
						bankAccounts: [],
						inventory: [],
						receivables: [],
						payables: [],
						debt: [],
						capital: [],
					},
				},
			};
		},
	);
	financialSnapshotV3Mocks.captureFinancialSnapshotV3.mockImplementation(
		async (input: Record<string, unknown>) => ({
			snapshotId: "snapshot-v3",
			tenantId: input.tenantId,
			status: "CAPTURED",
			resumenJson: {
				version: 3,
				cutoffAt: (input.cutoffAt as Date).toISOString(),
				capturedAt: (input.capturedAt as Date).toISOString(),
				balance: input.balance,
				result: input.result,
				cashFlow: input.cashFlow,
				coverage: input.coverage,
				provenance: input.provenance,
			},
			hashIntegridad: "v3-capture-hash",
		}));
	financialSnapshotV3Mocks.approveFinancialSnapshotV3.mockImplementation(
		async (params: Record<string, unknown>) => ({
			snapshotId: params.snapshotId,
			status: "APPROVED",
			resumenJson: {
				version: 3,
				cutoffAt: "2026-01-02T12:00:00.000Z",
				capturedAt: "2026-01-02T12:00:01.000Z",
				approvedAt: (params.approvedAt as Date).toISOString(),
				balance: {},
				result: {},
				cashFlow: {},
				coverage: {},
				provenance: {},
			},
			hashIntegridad: "v3-approved-hash",
		}));
});

// ── Tests: listarPeriodosAction ───────────────────────────────────────────

describe("listarPeriodosAction", () => {
	it("retorna lista vacía cuando no hay períodos", async () => {
		mockPrisma.periodoContable.findMany.mockResolvedValue([]);
		mockPrisma.periodoContable.count.mockResolvedValue(0);

		const result = await listarPeriodosAction();

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.periodos).toEqual([]);
		expect(expectActionSuccess(result).data?.pagination.total).toBe(0);
	});

	it("retorna períodos del tenant con paginación", async () => {
		const periodos = [
			makePeriodo({
				periodoId: "p-1",
				tipo: TipoPeriodo.MENSUAL,
				estado: EstadoPeriodo.ABIERTO,
				auditoria: [],
			}),
			makePeriodo({
				periodoId: "p-2",
				tipo: TipoPeriodo.DIARIO,
				estado: EstadoPeriodo.CERRADO,
				auditoria: [],
			}),
		];
		mockPrisma.periodoContable.findMany.mockResolvedValue(periodos);
		mockPrisma.periodoContable.count.mockResolvedValue(2);

		const result = await listarPeriodosAction({ page: 1, limit: 10 });

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.periodos).toHaveLength(2);
		expect(expectActionSuccess(result).data?.periodos[0]).toHaveProperty("tieneHash");
		expect(expectActionSuccess(result).data?.periodos[0]).toHaveProperty("ultimaAuditoria");
		expect(expectActionSuccess(result).data?.periodos[0]).toHaveProperty("blockers");
		expect(expectActionSuccess(result).data?.pagination).toEqual({
			page: 1,
			limit: 10,
			total: 2,
			totalPages: 1,
		});
	});

	it("filtra por tipo de período", async () => {
		mockPrisma.periodoContable.findMany.mockResolvedValue([]);
		mockPrisma.periodoContable.count.mockResolvedValue(0);

		await listarPeriodosAction({ tipo: TipoPeriodo.DIARIO });

		expect(mockPrisma.periodoContable.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tenantId: TENANT,
					tipo: TipoPeriodo.DIARIO,
				}),
			}),
		);
	});

	it("filtra por estado de período", async () => {
		mockPrisma.periodoContable.findMany.mockResolvedValue([]);
		mockPrisma.periodoContable.count.mockResolvedValue(0);

		await listarPeriodosAction({ estado: EstadoPeriodo.ABIERTO });

		expect(mockPrisma.periodoContable.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tenantId: TENANT,
					estado: EstadoPeriodo.ABIERTO,
				}),
			}),
		);
	});

	it("falla si el usuario no está autenticado", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);

		const result = await listarPeriodosAction();

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("AUTH_REQUIRED");
	});
});

// ── Tests: obtenerPeriodoAction ───────────────────────────────────────────

describe("obtenerPeriodoAction", () => {
	it("retorna detalle del período con timeline", async () => {
		const periodo = makePeriodo({ estado: EstadoPeriodo.ABIERTO });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue([]);

		const result = await obtenerPeriodoAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.periodo.periodoId).toBe("p-1");
		expect(expectActionSuccess(result).data?.timeline).toBeDefined();
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await obtenerPeriodoAction("p-no-existe");

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
	});

	it("falla si el período no pertenece al tenant", async () => {
		// findFirst con where { periodoId, tenantId } no encuentra períodos de otro tenant
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await obtenerPeriodoAction("p-1");

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
	});
});

// ── Tests: obtenerTimelineAction ──────────────────────────────────────────

describe("obtenerTimelineAction", () => {
	it("retorna timeline de eventos de auditoría", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue({
			periodoId: "p-1",
		});
		mockPrisma.auditoriaPeriodo.findMany.mockResolvedValue([
			{
				auditoriaId: "a-1",
				periodoId: "p-1",
				evento: EventoAuditoria.APERTURA,
				actor: ACTOR,
				timestamp: new Date("2026-03-01"),
				motivo: null,
				payload: null,
				entidadAfectada: null,
				createdAt: new Date("2026-03-01"),
			},
			{
				auditoriaId: "a-2",
				periodoId: "p-1",
				evento: EventoAuditoria.CIERRE,
				actor: ACTOR,
				timestamp: new Date("2026-03-31"),
				motivo: null,
				payload: null,
				entidadAfectada: null,
				createdAt: new Date("2026-03-31"),
			},
		]);

		const result = await obtenerTimelineAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.timeline).toHaveLength(2);
		expect(expectActionSuccess(result).data?.timeline[0].evento).toBe(EventoAuditoria.APERTURA);
		expect(expectActionSuccess(result).data?.timeline[1].evento).toBe(EventoAuditoria.CIERRE);
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await obtenerTimelineAction("p-no-existe");

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
	});
});

// ── Tests: abrirPeriodoAction ─────────────────────────────────────────────

describe("abrirPeriodoAction", () => {
	it("bloquea la apertura no verificable y mantiene la operación atómica", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.create.mockResolvedValue(
			makePeriodo({ tipo: TipoPeriodo.MENSUAL, estado: EstadoPeriodo.ABIERTO }),
		);
		mockAperturaService();
		const { AuditLogService } = await import("@/lib/services/audit-log-service");

		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-03-01T00:00:00Z",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
		expect(expectActionFailure(result).error?.message).toContain("revisión contable");
		expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
		expect(AuditLogService.logStrict).not.toHaveBeenCalled();
		expect(revalidatePath).not.toHaveBeenCalled();
	});

	it("falla con fechas inválidas (inicio posterior a fin)", async () => {
		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00Z",
			fechaFin: "2026-03-01T00:00:00Z",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("FECHAS_INVALIDAS");
		expect(mockPrisma.periodoContable.create).not.toHaveBeenCalled();
	});

	it("falla con fecha de inicio inválida (Zod)", async () => {
		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "no-es-fecha",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("VALIDATION_ERROR");
	});

	it("falla con fecha de fin inválida (Zod)", async () => {
		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-03-01T00:00:00Z",
			fechaFin: "tampoco-es-fecha",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("VALIDATION_ERROR");
	});

	it("falla si hay solapamiento de fechas", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(1); // ya existe solapado

		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-03-01T00:00:00Z",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("PERIODO_SOLAPADO");
		expect(mockPrisma.periodoContable.create).not.toHaveBeenCalled();
	});

	it.each([
		TipoPeriodo.DIARIO,
		TipoPeriodo.MENSUAL,
		TipoPeriodo.TRIMESTRAL,
		TipoPeriodo.SEMESTRAL,
		TipoPeriodo.ANUAL,
	])("bloquea períodos %s hasta contar con saldos iniciales verificables", async (tipo) => {
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.create.mockResolvedValue(
			makePeriodo({ tipo, estado: EstadoPeriodo.ABIERTO }),
		);
		mockAperturaService();

		const result = await abrirPeriodoAction({
			tipo,
			fechaInicio: "2026-03-01T00:00:00Z",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
		expect(mockPrisma.aperturaPeriodo.create).not.toHaveBeenCalled();
	});
});

// ── Tests: cerrarPeriodoAction ────────────────────────────────────────────

	describe("cerrarPeriodoAction", () => {
	it("blocks a direct close when a sale has no verified reconciliation or open debt", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.MENSUAL,
			estado: EstadoPeriodo.ABIERTO,
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.venta.findMany.mockResolvedValue([{
			tenantId: TENANT,
			total: 4300,
			VentaServicios: [],
			reconciliaciones: [],
			factura: null,
		}] as never);

		const result = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("PERIOD_RECONCILIATION_PENDING");
		expect(mockPrisma.periodoContable.update).not.toHaveBeenCalled();
	});

	it("allows a direct close when an unreconciled sale is fully explained by open CxC", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.MENSUAL,
			estado: EstadoPeriodo.ABIERTO,
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.CERRADO,
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockPrisma.venta.findMany.mockResolvedValue([{
			tenantId: TENANT,
			total: 4300,
			VentaServicios: [],
			reconciliaciones: [],
			factura: {
				idFactura: "invoice-1",
				tenantId: TENANT,
				total: 4300,
				cuentaPorCobrar: {
					id: "receivable-1",
					tenantId: TENANT,
					facturaId: "invoice-1",
					estado: "PENDIENTE",
					montoDeuda: 4300,
					montoPagado: 0,
					monedaOriginal: "CUP",
					monedaFuncional: "CUP",
					montoDeudaFuncional: 4300,
					montoPagadoFuncional: 0,
					fechaVencimiento: null,
				},
			},
		}] as never);

		const result = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(true);
		expect(mockPrisma.periodoContable.update).toHaveBeenCalled();
	});

	it("no invoca fórmulas legacy de agregación al cerrar un período anual", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.ANUAL,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2025-01-01T05:00:00Z"),
			fechaFin: new Date("2026-01-01T04:59:59Z"),
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.CERRADO,
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockPrisma.snapshotPeriodo.findFirst.mockResolvedValue(null);
		mockPrisma.snapshotPeriodo.create.mockResolvedValue({ snapshotId: "sp-red" });
		mockPrisma.saldoSnapshot.findMany.mockResolvedValue([]);
		accountingSnapshotMocks.getReconciledResultForYear.mockResolvedValue({
			year: 2025,
			timeZone: "America/Havana",
			functionalCurrency: "CUP",
			monthly: [],
			annual: { reconciledResult: 0, cashFlow: { operating: 0, financial: 0, net: 0 } },
			incidents: [],
			estimates: [],
		});
		accountingSnapshotMocks.getCurrentBalance.mockResolvedValue({
			asOf: "2026-01-02T12:00:00.000Z",
			functionalCurrency: "CUP",
			assets: { cashAndBanks: 0, inventory: { historical: 0, estimated: 0, total: 0 }, receivables: 0, total: 0 },
			liabilities: { payables: 0, externalDebt: 0, total: 0 },
			equity: { capital: 0, retainedEarnings: 0, currentResult: 0, total: 0 },
			equation: { assets: 0, liabilitiesAndEquity: 0, difference: 0, status: "CUADRADO" },
			coverage: { complete: true, unresolvedCount: 0, unresolvedAmount: 0, parts: [] },
			estimates: [],
			incidents: [],
		});

		const response = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(response.success).toBe(true);
		expect(mockPrisma.reconciliacionVenta.aggregate).not.toHaveBeenCalled();
		expect(mockPrisma.reconciliacionServicio.aggregate).not.toHaveBeenCalled();
		expect(mockPrisma.reconciliacionGasto.aggregate).not.toHaveBeenCalled();
	});

	it("no invoca fórmulas legacy de agregación al cerrar un período diario", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.DIARIO,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2026-03-15"),
			fechaFin: new Date("2026-03-15"),
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.CERRADO,
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

		const result = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(true);
		expect(mockPrisma.reconciliacionVenta.aggregate).not.toHaveBeenCalled();
		expect(mockPrisma.reconciliacionServicio.aggregate).not.toHaveBeenCalled();
		expect(mockPrisma.reconciliacionGasto.aggregate).not.toHaveBeenCalled();
	});

	it("persiste un snapshot financiero v3 al cerrar un período anual", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.ANUAL,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2025-01-01T05:00:00Z"),
			fechaFin: new Date("2026-01-01T04:59:59Z"),
		});
		const result = {
			year: 2025,
			timeZone: "America/Havana",
			functionalCurrency: "CUP",
			monthly: [],
			annual: { reconciledResult: 10, cashFlow: { operating: 10, financial: 0, net: 10 } },
			incidents: [],
			estimates: [],
		};
		const balance = {
			asOf: "2026-01-02T12:00:00.000Z",
			functionalCurrency: "CUP",
			assets: {
				cashAndBanks: 100,
				inventory: { historical: 0, estimated: 0, total: 0 },
				receivables: 0,
				total: 100,
			},
			liabilities: { payables: 0, externalDebt: 0, total: 0 },
			equity: { capital: 90, retainedEarnings: 0, currentResult: 10, total: 100 },
			equation: {
				assets: 100,
				liabilitiesAndEquity: 100,
				difference: 0,
				status: "CUADRADO",
			},
			coverage: { complete: true, unresolvedCount: 0, unresolvedAmount: 0, parts: [] },
			estimates: [],
			incidents: [],
		};
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.CERRADO,
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]);
		mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
		mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
		mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({ _sum: { montoConvertido: null } });
		mockPrisma.snapshotPeriodo.findFirst.mockResolvedValue(null);
		mockPrisma.snapshotPeriodo.create.mockResolvedValue({ snapshotId: "sp-annual" });
		mockPrisma.saldoSnapshot.findMany.mockResolvedValue([]);
		accountingSnapshotMocks.getReconciledResultForYear.mockResolvedValue(result);
		accountingSnapshotMocks.getCurrentBalance.mockResolvedValue(balance);

  const response = await cerrarPeriodoAction({ periodoId: "p-1" });

  expect(response.success).toBe(true);
		  expect(mockPrisma.$transaction).toHaveBeenCalledWith(
		    expect.any(Function),
		    { isolationLevel: "Serializable" },
		  );
		  expect(accountingSnapshotMocks.getCurrentBalance).toHaveBeenCalledWith(
		    expect.objectContaining({ asOf: expect.any(Date) }),
		  );
		  expect(accountingSnapshotMocks.getReconciledResultForYear).toHaveBeenCalledWith(
		    expect.objectContaining({
		      cutoffAt: new Date("2026-01-02T12:00:00.000Z"),
		    }),
		  );
  const snapshotUpdate = mockPrisma.periodoContable.update.mock.calls.find(
    (call) => call[0].data?.resumenJson,
  );
  const snapshotPayload = snapshotUpdate?.[0].data.resumenJson;
    expect(snapshotPayload.cutoffAt).not.toBe(snapshotPayload.capturedAt);
    const capturedInput = financialSnapshotV3Mocks.captureFinancialSnapshotV3.mock.calls[0][0];
    expect(capturedInput.range.lt).toBe(capturedInput.cutoffAt.toISOString());
  expect(mockPrisma.periodoContable.update).toHaveBeenCalledWith(expect.objectContaining({
			data: expect.objectContaining({
				resumenJson: expect.objectContaining({ version: 3 }),
				hashIntegridad: "v3-approved-hash",
			}),
		}));
	});

	it("captura el checkpoint una sola vez en el flujo anual completo", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.ANUAL,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2025-01-01T05:00:00Z"),
			fechaFin: new Date("2026-01-01T04:59:59Z"),
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.CERRADO,
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockPrisma.snapshotPeriodo.findFirst.mockResolvedValue(null);
		mockPrisma.snapshotPeriodo.create.mockResolvedValue({ snapshotId: "sp-annual" });
		mockPrisma.saldoSnapshot.findMany.mockResolvedValue([]);
		accountingSnapshotMocks.getReconciledResultForYear.mockResolvedValue({
			year: 2025,
			timeZone: "America/Havana",
			functionalCurrency: "CUP",
			monthly: [],
			annual: { reconciledResult: 10, cashFlow: { operating: 10, financial: 0, net: 10 } },
			incidents: [],
			estimates: [],
		});
		accountingSnapshotMocks.getCurrentBalance.mockResolvedValue({
			asOf: "2026-01-02T12:00:00.000Z",
			functionalCurrency: "CUP",
			assets: { cashAndBanks: 100, inventory: { historical: 0, estimated: 0, total: 0 }, receivables: 0, total: 100 },
			liabilities: { payables: 0, externalDebt: 0, total: 0 },
			equity: { capital: 90, retainedEarnings: 0, currentResult: 10, total: 100 },
			equation: { assets: 100, liabilitiesAndEquity: 100, difference: 0, status: "CUADRADO" },
			coverage: { complete: true, unresolvedCount: 0, unresolvedAmount: 0, parts: [] },
			estimates: [],
			incidents: [],
		});

		const response = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(response.success).toBe(true);
		expect(checkpointMocks.captureFinancialAuxiliaryCheckpoint).toHaveBeenCalledTimes(1);
	});

	it("captura y aprueba v3 después de la proyección canónica bajo el mismo lock", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.ANUAL,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2025-01-01T05:00:00Z"),
			fechaFin: new Date("2026-01-01T04:59:59Z"),
		});
		const events: string[] = [];
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockImplementation(async (args) => {
			events.push("period-close");
			return { ...periodo, ...args.data, estado: EstadoPeriodo.CERRADO };
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		accountingSnapshotMocks.getReconciledResultForYear.mockImplementation(async () => {
			events.push("canonical-result");
			return {
				year: 2025,
				timeZone: "America/Havana",
				functionalCurrency: "CUP",
				monthly: [],
				annual: {
					reconciledResult: 10,
					cashFlow: { operating: 10, financial: 0, net: 10 },
				},
				incidents: [],
				estimates: [],
			};
		});
		accountingSnapshotMocks.getCurrentBalance.mockImplementation(async () => {
			events.push("canonical-balance");
			return {
				functionalCurrency: "CUP",
				coverage: { complete: true, unresolvedCount: 0, unresolvedAmount: 0, parts: [] },
				equation: { status: "CUADRADO" },
				estimates: [],
				incidents: [],
			};
		});
		checkpointMocks.captureFinancialAuxiliaryCheckpoint.mockImplementation(
			async (params: {
				collectEvidence: (client: typeof mockPrisma, cutoffAt: Date) => Promise<unknown>;
			}) => {
				events.push("checkpoint");
				await params.collectEvidence(mockPrisma, new Date("2026-01-02T12:00:00.000Z"));
				return {
					checkpointId: "checkpoint-v3",
					payload: {
						version: 3,
						cutoffAt: "2026-01-02T12:00:00.000Z",
						capturedAt: "2026-01-02T12:00:01.000Z",
						functionalCurrency: "CUP",
						balance: {},
						result: {},
						auxiliaries: {
							bankAccounts: [],
							inventory: [],
							receivables: [],
							payables: [],
							debt: [],
							capital: [],
						},
					},
				};
			},
		);
		financialSnapshotV3Mocks.captureFinancialSnapshotV3.mockImplementationOnce(
			async (input: Record<string, unknown>) => {
				events.push("v3-capture");
				expect(input.tenantId).toBe(TENANT);
				expect(input.range).toEqual({
					gte: periodo.fechaInicio.toISOString(),
					lt: "2026-01-02T12:00:00.000Z",
				});
				return {
					snapshotId: "snapshot-v3",
					status: "CAPTURED",
					resumenJson: { version: 3 },
					hashIntegridad: "capture-hash",
				};
			},
		);
		financialSnapshotV3Mocks.approveFinancialSnapshotV3.mockImplementationOnce(async () => {
			events.push("v3-approve");
			return {
				snapshotId: "snapshot-v3",
				status: "APPROVED",
				resumenJson: { version: 3, approvedAt: "2026-01-02T12:00:02.000Z" },
				hashIntegridad: "approved-hash",
			};
		});

		const response = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(response.success).toBe(true);
		expect(events).toEqual([
			"checkpoint",
			"canonical-result",
			"canonical-balance",
			"v3-capture",
			"v3-approve",
			"period-close",
			"period-close",
		]);
		expect(financialSnapshotV3Mocks.captureFinancialSnapshotV3).toHaveBeenCalledTimes(1);
		expect(financialSnapshotV3Mocks.approveFinancialSnapshotV3).toHaveBeenCalledTimes(1);
	});

	it("no cierra el período ni aprueba v3 si la aprobación falla", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.ANUAL,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2025-01-01T05:00:00Z"),
			fechaFin: new Date("2026-01-01T04:59:59Z"),
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({ ...periodo, estado: EstadoPeriodo.CERRADO });
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		accountingSnapshotMocks.getReconciledResultForYear.mockResolvedValue({
			year: 2025,
			functionalCurrency: "CUP",
			monthly: [],
			annual: { reconciledResult: 10, cashFlow: { operating: 10, financial: 0, net: 10 } },
			incidents: [],
			estimates: [],
		});
		accountingSnapshotMocks.getCurrentBalance.mockResolvedValue({
			functionalCurrency: "CUP",
			coverage: { complete: true, unresolvedCount: 0, unresolvedAmount: 0, parts: [] },
			estimates: [],
			incidents: [],
		});
		financialSnapshotV3Mocks.approveFinancialSnapshotV3.mockRejectedValueOnce(
			new Error("approval unavailable"),
		);

		const response = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(response.success).toBe(false);
		expect(mockPrisma.periodoContable.update).not.toHaveBeenCalled();
		expect(expectActionFailure(response).error?.code).not.toBe("INTERNAL_ERROR");
	});

	it("recolecta resultado y balance dentro de la captura protegida", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.ANUAL,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2025-01-01T05:00:00Z"),
			fechaFin: new Date("2026-01-01T04:59:59Z"),
		});
		const events: string[] = [];
		const result = {
			year: 2025,
			timeZone: "America/Havana",
			functionalCurrency: "CUP",
			monthly: [],
			annual: { reconciledResult: 10, cashFlow: { operating: 10, financial: 0, net: 10 } },
			incidents: [],
			estimates: [],
		};
		const balance = {
			functionalCurrency: "CUP",
			coverage: { complete: true, unresolvedCount: 0, unresolvedAmount: 0, parts: [] },
			estimates: [],
			incidents: [],
		};

		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.CERRADO,
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockPrisma.snapshotPeriodo.findFirst.mockResolvedValue(null);
		mockPrisma.snapshotPeriodo.create.mockResolvedValue({ snapshotId: "sp-annual" });
		mockPrisma.saldoSnapshot.findMany.mockResolvedValue([]);
		accountingSnapshotMocks.getReconciledResultForYear.mockImplementation(async () => {
			events.push("result");
			return result;
		});
		accountingSnapshotMocks.getCurrentBalance.mockImplementation(async () => {
			events.push("balance");
			return balance;
		});
		checkpointMocks.captureFinancialAuxiliaryCheckpoint.mockImplementation(
			async (params: {
				collectEvidence: (
					client: typeof mockPrisma,
					cutoffAt: Date,
				) => Promise<unknown>;
			}) => {
				events.push("capture");
				const evidence = await params.collectEvidence(
					mockPrisma,
					new Date("2026-01-02T12:00:00.000Z"),
				);
				return {
					checkpointId: "checkpoint-annual",
					payload: {
						...(evidence as Record<string, unknown>),
					version: 3,
						cutoffAt: "2026-01-02T12:00:00.000Z",
						capturedAt: "2026-01-02T12:00:01.000Z",
					},
				};
			},
		);

		const response = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(response.success).toBe(true);
		expect(events).toEqual(["capture", "result", "balance"]);
	});

	it("no captura checkpoint cuando el resultado canónico queda incompleto", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.ANUAL,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2025-01-01T05:00:00Z"),
			fechaFin: new Date("2026-01-01T04:59:59Z"),
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({ ...periodo, estado: EstadoPeriodo.CERRADO });
		accountingSnapshotMocks.getReconciledResultForYear.mockResolvedValue({
			year: 2025,
			monthly: [],
			annual: { reconciledResult: 10 },
			incidents: [{ code: "MISSING_EVIDENCE" }],
			estimates: [],
		});
		accountingSnapshotMocks.getCurrentBalance.mockResolvedValue({
			functionalCurrency: "CUP",
			coverage: { complete: true },
		});

		const response = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(response.success).toBe(false);
		expect(expectActionFailure(response).error?.code).toBe("CUTOFF_EVIDENCE_UNAVAILABLE");
		expect(checkpointMocks.captureFinancialAuxiliaryCheckpoint).toHaveBeenCalledTimes(1);
	});

	it("cierra un período exitosamente con snapshot", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.DIARIO,
			estado: EstadoPeriodo.ABIERTO,
			fechaInicio: new Date("2026-03-15"),
			fechaFin: new Date("2026-03-15"),
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.CERRADO,
			cerradoPor: ACTOR,
			cerradoAt: new Date(),
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]); // sin cuentas → 0 snapshots
		// Mocks para generarResumenSnapshot (sin cuentas, sin movimientos)
		mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});
		mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});
		mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});
		// Mocks para crearVersionSnapshot
		mockPrisma.snapshotPeriodo.findFirst.mockResolvedValue(null);
		mockPrisma.snapshotPeriodo.create.mockResolvedValue({
			snapshotId: "sp-1",
			periodoId: "p-1",
			version: 1,
			baseCajaJson: null,
			baseDevengoJson: null,
			resumenJson: null,
			hashIntegridad: null,
			createdAt: new Date(),
		});
		mockPrisma.saldoSnapshot.findMany.mockResolvedValue([]);

		const result = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.periodo.estado).toBe(EstadoPeriodo.CERRADO);
		expect(expectActionSuccess(result).data?.snapshots).toBe(0);
		expect(revalidatePath).toHaveBeenCalledWith("/busy/contabilidad/periodos");
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await cerrarPeriodoAction({ periodoId: "p-no-existe" });

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
	});

	it("falla si el período no pertenece al tenant", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
	});

	it("falla si la transición no es válida", async () => {
		// APROBADO no permite transición a EN_CIERRE ni CERRADO (solo REABIERTO)
		// CERRADO sí permitía CERRADO→APROBADO vía admin bypass, por eso usamos APROBADO
		const periodo = makePeriodo({ estado: EstadoPeriodo.APROBADO });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		// Mocks para generarResumenSnapshot (se llama antes de validar transición)
		mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]);
		mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});
		mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});
		mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});

		const result = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("TRANSICION_INVALIDA");
	});

	it("falla si tiene hijos abiertos", async () => {
		const periodo = makePeriodo({
			tipo: TipoPeriodo.MENSUAL,
			estado: EstadoPeriodo.ABIERTO,
		});
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.count.mockResolvedValue(2); // 2 hijos abiertos
		// Mocks para generarResumenSnapshot (se llama antes de validar hijos)
		mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]);
		mockPrisma.reconciliacionVenta.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});
		mockPrisma.reconciliacionServicio.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});
		mockPrisma.reconciliacionGasto.aggregate.mockResolvedValue({
			_sum: { montoConvertido: null },
		});

		const result = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("HIJOS_ABIERTOS");
		expect(mockPrisma.periodoContable.update).not.toHaveBeenCalled();
	});
});

describe("verificarOperacionesPendientesAction", () => {
	it("keeps service costs blocked when reconciliation references lack amount and FX evidence", async () => {
		const periodo = makePeriodo({ tipo: TipoPeriodo.MENSUAL });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.compraServicio.findMany.mockResolvedValue([{
			tenantId: TENANT,
			compraServicioId: "purchase-service-1",
			total: 700,
			moneda: "CUP",
			createdAt: periodo.fechaInicio,
		}] as never);
		mockPrisma.ventaServicios.findMany.mockResolvedValue([{
			tenantId: TENANT,
			ventaServicioId: "sale-service-1",
			costo: 300,
			cantidad: 2,
			moneda: "CUP",
			createdAt: periodo.fechaInicio,
			reconciliaciones: [],
		}] as never);
		mockPrisma.reconciliacionGasto.findMany
			.mockResolvedValueOnce([{ referenciaId: "purchase-service-1" }] as never)
			.mockResolvedValueOnce([{ referenciaId: "sale-service-1" }] as never);

		const result = await verificarOperacionesPendientesAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.gastosSinReconciliar).toBe(2);
	});

	it("accepts service costs only when reconciled amounts and CUP evidence match exactly", async () => {
		const periodo = makePeriodo({ tipo: TipoPeriodo.MENSUAL });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.compraServicio.findMany.mockResolvedValue([{
			tenantId: TENANT,
			compraServicioId: "purchase-service-1",
			total: 700,
			moneda: "CUP",
		}] as never);
		mockPrisma.ventaServicios.findMany.mockResolvedValue([{
			tenantId: TENANT,
			ventaServicioId: "sale-service-1",
			costo: 300,
			cantidad: 2,
			moneda: "CUP",
			reconciliaciones: [],
		}] as never);
		const evidence = (amount: number) => ({
			tenantId: TENANT,
			tipoGasto: "servicio",
			referenciaId: "purchase-service-1",
			estado: "POSTED",
			monto: amount,
			montoConvertido: amount,
			moneda: "CUP",
			functionalCurrency: "CUP",
			tasaCambio: null,
			...buildAppliedFxEvidence({
				originalAmount: amount,
				originalCurrency: "CUP",
				functionalCurrency: "CUP",
				source: `period-close-${amount}`,
			}),
		});
		mockPrisma.reconciliacionGasto.findMany
			.mockResolvedValueOnce([evidence(700)] as never)
			.mockResolvedValueOnce([{
				...evidence(600),
				tipoGasto: "venta_servicio",
				referenciaId: "sale-service-1",
			}] as never);

		const result = await verificarOperacionesPendientesAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.gastosSinReconciliar).toBe(0);
	});

	it("does not compare CUP payments to a non-CUP service sale's nominal amount", async () => {
		const periodo = makePeriodo({ tipo: TipoPeriodo.MENSUAL });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		const evidence = buildAppliedFxEvidence({
			originalAmount: 100,
			originalCurrency: "CUP",
			functionalCurrency: "CUP",
			source: "unit-test-cup-settlement",
		});
		mockPrisma.ventaServicios.findMany
			.mockResolvedValueOnce([{
				tenantId: TENANT,
				ventaServicioId: "usd-service-sale",
				total: 100,
				moneda: "USD",
				reconciliaciones: [{
					monto: 100,
					montoConvertido: 100,
					moneda: "CUP",
					functionalCurrency: "CUP",
					tasaCambio: null,
					...evidence,
				}],
				cuentaPorCobrar: null,
				factura: null,
			}] as never)
			.mockResolvedValueOnce([]);

		const result = await verificarOperacionesPendientesAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.serviciosSinReconciliar).toBe(1);
	});

	it("keeps pending expense reconciliations blocked even when amounts and FX evidence match", async () => {
		const periodo = makePeriodo({ tipo: TipoPeriodo.MENSUAL });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		const makePendingReconciliation = (amount: number, referenceId: string) => ({
			referenciaId: referenceId,
			estado: "PENDIENTE",
			monto: amount,
			montoConvertido: amount,
			moneda: "CUP",
			functionalCurrency: "CUP",
			tasaCambio: null,
			...buildAppliedFxEvidence({
				originalAmount: amount,
				originalCurrency: "CUP",
				functionalCurrency: "CUP",
				source: `pending-expense-${referenceId}`,
			}),
		});
		mockPrisma.gastosDE.findMany.mockResolvedValue([{
			tenantId: TENANT,
			gastosDEId: "pending-gastos-de",
			monto: 200,
			isPagado: "NO",
			cuentaPorPagar: null,
			reconciliaciones: [makePendingReconciliation(200, "pending-gastos-de")],
		}] as never);
		mockPrisma.gastoCompra.findMany.mockResolvedValue([{
			tenantId: TENANT,
			gastoCompraId: "pending-gasto-compra",
			total: 300,
			deletedAt: null,
			cuentaPorPagar: null,
			reconciliaciones: [makePendingReconciliation(300, "pending-gasto-compra")],
		}] as never);

		const result = await verificarOperacionesPendientesAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.gastosSinReconciliar).toBe(2);
	});

	it("permits one unpaid CxC and two fully linked unpaid CxP balances", async () => {
		const periodo = makePeriodo({ tipo: TipoPeriodo.MENSUAL });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.venta.findMany.mockResolvedValue([{
			tenantId: TENANT,
			total: 4300,
			VentaServicios: [],
			reconciliaciones: [],
			factura: {
				idFactura: "invoice-1",
				tenantId: TENANT,
				total: 4300,
				cuentaPorCobrar: {
					id: "receivable-1",
					tenantId: TENANT,
					facturaId: "invoice-1",
					estado: "PENDIENTE",
					montoDeuda: 4300,
					montoPagado: 0,
					monedaOriginal: "CUP",
					monedaFuncional: "CUP",
					montoDeudaFuncional: 4300,
					montoPagadoFuncional: 0,
					fechaVencimiento: null,
				},
			},
		}] as never);
		mockPrisma.gastosDE.findMany.mockResolvedValue([
			{
				tenantId: TENANT,
				gastosDEId: "expense-1200",
				monto: 1200,
				isPagado: "NO",
				reconciliaciones: [],
				cuentaPorPagar: {
					cuentaPorPagarId: "payable-1200",
					tenantId: TENANT,
					gastosDEId: "expense-1200",
					estado: "PENDIENTE",
					montoDeuda: 1200,
					montoPagado: 0,
					saldoPendiente: 1200,
					moneda: "CUP",
					deletedAt: null,
				},
			},
			{
				tenantId: TENANT,
				gastosDEId: "expense-1100",
				monto: 1100,
				isPagado: null,
				reconciliaciones: [],
				cuentaPorPagar: {
					cuentaPorPagarId: "payable-1100",
					tenantId: TENANT,
					gastosDEId: "expense-1100",
					estado: "PENDIENTE",
					montoDeuda: 1100,
					montoPagado: 0,
					saldoPendiente: 1100,
					moneda: "CUP",
					deletedAt: null,
				},
			},
		] as never);

		const result = await verificarOperacionesPendientesAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data).toMatchObject({
			ventasSinReconciliar: 0,
			serviciosSinReconciliar: 0,
			gastosSinReconciliar: 0,
		});
	});

	it("does not count a directly linked fully unpaid receivable as a blocker", async () => {
		const periodo = makePeriodo({ tipo: TipoPeriodo.MENSUAL });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.venta.findMany.mockResolvedValue([{
			tenantId: TENANT,
			total: 4300,
			VentaServicios: [],
			reconciliaciones: [],
			factura: {
				idFactura: "invoice-1",
				tenantId: TENANT,
				total: 4300,
				cuentaPorCobrar: {
					id: "receivable-1",
					tenantId: TENANT,
					facturaId: "invoice-1",
					estado: "PENDIENTE",
					montoDeuda: 4300,
					montoPagado: 0,
					monedaOriginal: "CUP",
					monedaFuncional: "CUP",
					montoDeudaFuncional: 4300,
					montoPagadoFuncional: 0,
					fechaVencimiento: null,
				},
			},
		}] as never);

		const result = await verificarOperacionesPendientesAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data).toMatchObject({
			ventasSinReconciliar: 0,
			serviciosSinReconciliar: 0,
			gastosSinReconciliar: 0,
		});
	});

	it("keeps a partially paid receivable blocked when a payment lacks reconciliation", async () => {
		const periodo = makePeriodo({ tipo: TipoPeriodo.MENSUAL });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.venta.findMany.mockResolvedValue([{
			tenantId: TENANT,
			total: 4300,
			VentaServicios: [],
			reconciliaciones: [],
			factura: {
				idFactura: "invoice-1",
				tenantId: TENANT,
				total: 4300,
				cuentaPorCobrar: {
					id: "receivable-1",
					tenantId: TENANT,
					facturaId: "invoice-1",
					estado: "PARCIAL",
					montoDeuda: 4300,
					montoPagado: 500,
					monedaOriginal: "CUP",
					monedaFuncional: "CUP",
					montoDeudaFuncional: 4300,
					montoPagadoFuncional: 500,
					fechaVencimiento: null,
				},
			},
		}] as never);

		const result = await verificarOperacionesPendientesAction("p-1");

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.ventasSinReconciliar).toBe(1);
	});
});

// ── Tests: reabrirPeriodoAction ───────────────────────────────────────────

describe("reabrirPeriodoAction", () => {
	it("falla sin motivo (Zod min 10 chars)", async () => {
		const result = await reabrirPeriodoAction({
			periodoId: "p-1",
			motivo: "corto",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("VALIDATION_ERROR");
	});

	it("falla con motivo vacío", async () => {
		const result = await reabrirPeriodoAction({
			periodoId: "p-1",
			motivo: "",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("VALIDATION_ERROR");
	});

	it("reabre un período APROBADO exitosamente", async () => {
		const periodo = makePeriodo({ estado: EstadoPeriodo.APROBADO });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.REABIERTO,
			motivoReapertura: "Error en conciliación de saldos del mes de marzo",
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

		const result = await reabrirPeriodoAction({
			periodoId: "p-1",
			motivo: "Error en conciliación de saldos del mes de marzo",
		});

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.periodo.estado).toBe(EstadoPeriodo.REABIERTO);
		expect(expectActionSuccess(result).data?.periodo.motivoReapertura).toBe(
			"Error en conciliación de saldos del mes de marzo",
		);
		expect(revalidatePath).toHaveBeenCalledWith("/busy/contabilidad/periodos");
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await reabrirPeriodoAction({
			periodoId: "p-no-existe",
			motivo: "Error en conciliación de saldos del mes de marzo",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
	});

	it("falla si la transición no es válida (período no APROBADO)", async () => {
		const periodo = makePeriodo({ estado: EstadoPeriodo.ABIERTO });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

		const result = await reabrirPeriodoAction({
			periodoId: "p-1",
			motivo: "Error en conciliación de saldos del mes de marzo",
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("TRANSICION_INVALIDA");
	});
});

// ── Tests: aprobarPeriodoAction ───────────────────────────────────────────

describe("aprobarPeriodoAction", () => {
	it("aprueba un período CERRADO exitosamente", async () => {
		const periodo = makePeriodo({ estado: EstadoPeriodo.CERRADO });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);
		mockPrisma.periodoContable.update.mockResolvedValue({
			...periodo,
			estado: EstadoPeriodo.APROBADO,
			aprobadoPor: ACTOR,
			aprobadoAt: new Date(),
		});
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});

		const result = await aprobarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data?.periodo.estado).toBe(EstadoPeriodo.APROBADO);
		expect(expectActionSuccess(result).data?.periodo.aprobadoPor).toBe(ACTOR);
		expect(revalidatePath).toHaveBeenCalledWith("/busy/contabilidad/periodos");
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await aprobarPeriodoAction({ periodoId: "p-no-existe" });

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
	});

	it("falla si la transición no es válida (período APROBADO no se puede aprobar de nuevo)", async () => {
		// APROBADO solo permite transición a REABIERTO
		// ABIERTO sí permitía ABIERTO→APROBADO, por eso usamos APROBADO
		const periodo = makePeriodo({ estado: EstadoPeriodo.APROBADO });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

		const result = await aprobarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe("TRANSICION_INVALIDA");
	});
});

// ── Tests: Códigos y Jerarquía ────────────────────────────────────────────

describe("generarCodigoPeriodo", () => {
	it("genera código trimestral T1 para enero-marzo", () => {
		const codigo = PeriodoContableService.generarCodigoPeriodo(
			TipoPeriodo.TRIMESTRAL,
			new Date("2026-01-15T00:00:00Z"),
		);
		expect(codigo).toBe("T-2026-T1");
	});

	it("genera código trimestral T4 para octubre-diciembre", () => {
		const codigo = PeriodoContableService.generarCodigoPeriodo(
			TipoPeriodo.TRIMESTRAL,
			new Date("2026-10-15T00:00:00Z"),
		);
		expect(codigo).toBe("T-2026-T4");
	});

	it("genera código semestral S1 para primer semestre", () => {
		const codigo = PeriodoContableService.generarCodigoPeriodo(
			TipoPeriodo.SEMESTRAL,
			new Date("2026-01-01T00:00:00Z"),
		);
		expect(codigo).toBe("S-2026-S1");
	});

	it("genera código semestral S2 para segundo semestre", () => {
		const codigo = PeriodoContableService.generarCodigoPeriodo(
			TipoPeriodo.SEMESTRAL,
			new Date("2026-07-01T00:00:00Z"),
		);
		expect(codigo).toBe("S-2026-S2");
	});
});

describe("jerarquía de períodos", () => {
	it("hijoTipo retorna SEMESTRAL para ANUAL", () => {
		const hijoTipo = (PeriodoContableService as any)._hijoTipo(
			TipoPeriodo.ANUAL,
		);
		expect(hijoTipo).toBe(TipoPeriodo.SEMESTRAL);
	});

	it("hijoTipo retorna TRIMESTRAL para SEMESTRAL", () => {
		const hijoTipo = (PeriodoContableService as any)._hijoTipo(
			TipoPeriodo.SEMESTRAL,
		);
		expect(hijoTipo).toBe(TipoPeriodo.TRIMESTRAL);
	});

	it("hijoTipo retorna MENSUAL para TRIMESTRAL", () => {
		const hijoTipo = (PeriodoContableService as any)._hijoTipo(
			TipoPeriodo.TRIMESTRAL,
		);
		expect(hijoTipo).toBe(TipoPeriodo.MENSUAL);
	});

	it("resuelve periodo padre de TRIMESTRAL como SEMESTRAL", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(
			makePeriodo({ periodoId: "sem-1", tipo: TipoPeriodo.SEMESTRAL }),
		);

		const padreId = await PeriodoContableService.resolverPeriodoPadre(
			TENANT,
			TipoPeriodo.TRIMESTRAL,
			new Date("2026-01-01"),
			new Date("2026-03-31"),
		);

		expect(padreId).toBe("sem-1");
		expect(mockPrisma.periodoContable.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ tipo: TipoPeriodo.SEMESTRAL }),
			}),
		);
	});

	it("resuelve periodo padre de SEMESTRAL como ANUAL", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(
			makePeriodo({ periodoId: "anual-1", tipo: TipoPeriodo.ANUAL }),
		);

		const padreId = await PeriodoContableService.resolverPeriodoPadre(
			TENANT,
			TipoPeriodo.SEMESTRAL,
			new Date("2026-01-01"),
			new Date("2026-06-30"),
		);

		expect(padreId).toBe("anual-1");
		expect(mockPrisma.periodoContable.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ tipo: TipoPeriodo.ANUAL }),
			}),
		);
	});
});

describe("apertura manual verificable", () => {
	it("returns server-verified FX conversion provenance to the tenant approver", async () => {
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue({
			solicitudId: "request-preview", tenantId: TENANT, tipo: "MENSUAL",
			fechaInicio: new Date("2026-04-01T00:00:00.000Z"), fechaFin: new Date("2026-04-30T23:59:59.000Z"),
			functionalCurrencyCode: "CUP", estado: "PENDIENTE", solicitadaPor: "creator",
			lineas: [{ lineId: "line-1", cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0", fxEvidenceId: "fx-1" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "20" }],
		});
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		exchangeRateMocks.getRateAsOf.mockResolvedValue({ tasaId: "rate-1", tasa: 2, fechaVigencia: new Date("2026-03-31T00:00:00.000Z") });
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "a1" }, { codigo: "301", cuentaContableId: "a2" },
		]);
		const canonical = buildAppliedFxEvidence({ originalAmount: 10, originalCurrency: "USD", functionalCurrency: "CUP", exchangeRate: 2, convertedAmount: 20, rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"), source: "TasaCambio catalog", fxCatalogRateId: "rate-1" });
		mockPrisma.tasaCambio.findUnique.mockResolvedValue({ monedaOrigenId: "USD", monedaDestino: "CUP", tasa: new Prisma.Decimal("2"), fechaVigencia: new Date("2026-03-31T00:00:00.000Z") });
		exchangeRateMocks.getRateAsOf.mockResolvedValue({ tasaId: "rate-1", tasa: 2, fechaVigencia: new Date("2026-03-31T00:00:00.000Z") });
		mockPrisma.fxEvidence.findFirst.mockResolvedValue({
			sourceType: "MANUAL_OPENING_LINE", sourceId: "request-preview:line-1:a1",
			originalAmount: new Prisma.Decimal("10"), originalCurrency: "USD",
			functionalAmount: new Prisma.Decimal("20"), functionalCurrency: "CUP",
			exchangeRate: new Prisma.Decimal("2"), rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"),
			cutoffAt: new Date("2026-04-01T00:00:00.000Z"), fxCatalogRateId: "rate-1",
			provenance: canonical.fxProvenanceKind, source: canonical.fxProvenanceSource,
			evidence: { ...canonical, solicitudId: "request-preview", lineId: "line-1", cuentaContableId: "a1", cutoffAt: "2026-04-01T00:00:00.000Z", originalAmount: "10", functionalAmount: "20", exchangeRate: "2" }, evidenceFingerprint: canonical.fxEvidenceFingerprint, evidenceVersion: canonical.fxEvidenceVersion,
		});

		const result = await obtenerSolicitudAperturaManualAction({ solicitudId: "request-preview" });

		expect(result.success, JSON.stringify(result)).toBe(true);
		expectActionSuccess(result);
		if (!result.success) return;
		expect(result.data.solicitud.lineasValuadas[0]).toMatchObject({
			debitoFuncional: "20", monedaFuncional: "CUP", tasaCambio: "2",
			fxEvidence: {
				rateEffectiveAt: "2026-03-31T00:00:00.000Z", cutoffAt: "2026-04-01T00:00:00.000Z",
				provenance: "MANUAL_GOVERNED", source: "TasaCambio catalog", fxCatalogRateId: "rate-1",
				evidenceFingerprint: canonical.fxEvidenceFingerprint,
			},
		});
		expect(JSON.stringify(result)).not.toContain('"verified":true');
	});

	it("rejects FX evidence whose conversion or canonical fingerprint does not verify", async () => {
		const request = {
			solicitudId: "request-bad-fx", tenantId: TENANT, tipo: "MENSUAL",
			fechaInicio: new Date("2026-04-01T00:00:00.000Z"), fechaFin: new Date("2026-04-30T23:59:59.000Z"),
			functionalCurrencyCode: "CUP", estado: "PENDIENTE", solicitadaPor: "creator",
			lineas: [{ lineId: "line-1", cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0", fxEvidenceId: "fx-bad" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "20" }],
		};
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue(request);
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "a1" }, { codigo: "301", cuentaContableId: "a2" },
		]);
		mockPrisma.fxEvidence.findFirst.mockResolvedValue({
			originalAmount: new Prisma.Decimal("10"), originalCurrency: "USD",
			functionalAmount: new Prisma.Decimal("19"), functionalCurrency: "CUP",
			exchangeRate: new Prisma.Decimal("2"), rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"),
			cutoffAt: new Date("2026-03-31T23:59:59.000Z"), fxCatalogRateId: null,
			provenance: "MANUAL_GOVERNED", source: "rate capture", evidence: {},
			evidenceFingerprint: "forged", evidenceVersion: 1,
		});

		const result = await obtenerSolicitudAperturaManualAction({ solicitudId: request.solicitudId });

		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
	});

	it("rejects a forged fingerprint even when FX amounts balance", async () => {
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue({
			solicitudId: "request-forged-fingerprint", tipo: "MENSUAL",
			fechaInicio: new Date("2026-04-01T00:00:00.000Z"), fechaFin: new Date("2026-04-30T23:59:59.000Z"),
			functionalCurrencyCode: "CUP", estado: "PENDIENTE", solicitadaPor: "creator",
			lineas: [{ lineId: "line-1", cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0", fxEvidenceId: "fx-forged" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "20" }],
		});
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "a1" }, { codigo: "301", cuentaContableId: "a2" },
		]);
		const canonical = buildAppliedFxEvidence({ originalAmount: 10, originalCurrency: "USD", functionalCurrency: "CUP", exchangeRate: 2, convertedAmount: 20, rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"), source: "TasaCambio catalog", fxCatalogRateId: "rate-1" });
		mockPrisma.fxEvidence.findFirst.mockResolvedValue({
			originalAmount: new Prisma.Decimal("10"), originalCurrency: "USD",
			functionalAmount: new Prisma.Decimal("20"), functionalCurrency: "CUP",
			exchangeRate: new Prisma.Decimal("2"), rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"),
			cutoffAt: new Date("2026-03-31T23:59:59.000Z"), fxCatalogRateId: null,
			provenance: canonical.fxProvenanceKind, source: canonical.fxProvenanceSource,
			evidence: canonical, evidenceFingerprint: "f".repeat(64), evidenceVersion: canonical.fxEvidenceVersion,
		});

		const result = await obtenerSolicitudAperturaManualAction({ solicitudId: "request-forged-fingerprint" });

		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
	});

	it("rejects two opening lines that reuse the same FX source evidence", async () => {
		const request = {
			solicitudId: "request-duplicate-fx", tenantId: TENANT, tipo: "MENSUAL",
			fechaInicio: new Date("2026-04-01T00:00:00.000Z"), fechaFin: new Date("2026-04-30T23:59:59.000Z"),
			functionalCurrencyCode: "CUP", estado: "PENDIENTE", solicitadaPor: "creator",
			lineas: [
				{ lineId: "line-1", cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0", fxEvidenceId: "same-fx" },
				{ cuentaCodigo: "102", moneda: "USD", debito: "0", credito: "10", fxEvidenceId: "same-fx" },
			],
		};
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue(request);
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "a1" }, { codigo: "102", cuentaContableId: "a2" },
		]);
		const canonical = buildAppliedFxEvidence({ originalAmount: 10, originalCurrency: "USD", functionalCurrency: "CUP", exchangeRate: 2, convertedAmount: 20, rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"), source: "TasaCambio catalog", fxCatalogRateId: "rate-1" });
		mockPrisma.fxEvidence.findFirst.mockResolvedValue({
			originalAmount: new Prisma.Decimal("10"), originalCurrency: "USD",
			functionalAmount: new Prisma.Decimal("20"), functionalCurrency: "CUP",
			exchangeRate: new Prisma.Decimal("2"), rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"),
			cutoffAt: new Date("2026-03-31T23:59:59.000Z"), fxCatalogRateId: null,
			provenance: canonical.fxProvenanceKind, source: canonical.fxProvenanceSource,
			evidence: canonical, evidenceFingerprint: canonical.fxEvidenceFingerprint, evidenceVersion: canonical.fxEvidenceVersion,
		});

		const result = await aprobarAperturaManualAction({ solicitudId: request.solicitudId });

		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
		expect(mockPrisma.fxEvidence.findFirst).toHaveBeenCalledTimes(1);
		expect(mockPrisma.aperturaPeriodoSolicitud.updateMany).not.toHaveBeenCalled();
	});

	it("lists persisted requests with tenant and approver permission scope", async () => {
		mockPrisma.aperturaPeriodoSolicitud.findMany.mockResolvedValue([{ solicitudId: "own-request" }]);
		const result = await listarSolicitudesAperturaManualAction({});
		expectActionSuccess(result);
		expect(mockPrisma.aperturaPeriodoSolicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { tenantId: TENANT, estado: { in: ["PENDIENTE", "APROBADA"] } },
			take: 50,
		}));
	});

	it("lists only the authenticated requester's rows when the user cannot approve", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser, role: "user", tenantRole: "dependiente", permissions: new Set(),
			planFeatures: { contabilidad: true },
		});
		mockPrisma.aperturaPeriodoSolicitud.findMany.mockResolvedValue([{ solicitudId: "mine" }]);

		const result = await listarSolicitudesAperturaManualAction({});

		expectActionSuccess(result);
		expect(mockPrisma.aperturaPeriodoSolicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { tenantId: TENANT, solicitadaPor: mockUser.userId, estado: { in: ["PENDIENTE", "APROBADA"] } },
		}));
	});

	it("does not disclose another tenant's persisted request on detail read", async () => {
		const result = await obtenerSolicitudAperturaManualAction({ solicitudId: "foreign-request" });
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
		expect(mockPrisma.aperturaPeriodoSolicitud.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { solicitudId: "foreign-request", tenantId: TENANT, estado: { in: ["PENDIENTE", "APROBADA"] } },
		}));
	});

	it("allows a non-approver to read only their own just-submitted request", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser, role: "user", tenantRole: "dependiente", permissions: new Set(),
			planFeatures: { contabilidad: true },
		});
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue({
			solicitudId: "my-request", tenantId: TENANT, tipo: "MENSUAL",
			fechaInicio: new Date("2026-04-01T00:00:00.000Z"), fechaFin: new Date("2026-04-30T23:59:59.000Z"),
			functionalCurrencyCode: "CUP", estado: "PENDIENTE", solicitadaPor: mockUser.userId,
			lineas: [
				{ cuentaCodigo: "101", moneda: "CUP", debito: "10", credito: "0" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "10" },
			],
		});
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "a1" }, { codigo: "301", cuentaContableId: "a2" },
		]);

		const result = await obtenerSolicitudAperturaManualAction({ solicitudId: "my-request" });

		expectActionSuccess(result);
		expect(mockPrisma.aperturaPeriodoSolicitud.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { solicitudId: "my-request", tenantId: TENANT, estado: { in: ["PENDIENTE", "APROBADA"] } },
		}));
	});

	it("hides another user's request from non-approvers in the same tenant", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser, role: "user", tenantRole: "dependiente", permissions: new Set(),
			planFeatures: { contabilidad: true },
		});
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue({
			solicitudId: "other-request", solicitadaPor: "different-user", estado: "PENDIENTE",
		});

		const result = await obtenerSolicitudAperturaManualAction({ solicitudId: "other-request" });

		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
		expect(mockPrisma.tenantAccountingPolicy.findUnique).not.toHaveBeenCalled();
	});

	it("rechaza propuestas sin líneas explícitas antes de consultar política o persistir", async () => {
		const result = await solicitarAperturaManualAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00.000Z",
			fechaFin: "2026-04-30T23:59:59.000Z",
			lineas: [],
		});
		expect(result.success).toBe(false);
		expect(mockPrisma.aperturaPeriodoSolicitud.create).not.toHaveBeenCalled();
	});

	it("scopes approval lookup to the authenticated tenant", async () => {
		const result = await aprobarAperturaManualAction({ solicitudId: "request-foreign" });
		expect(expectActionFailure(result).error?.code).toBe("NOT_FOUND");
		expect(mockPrisma.aperturaPeriodoSolicitud.findFirst).toHaveBeenCalledWith({
			where: { solicitudId: "request-foreign", tenantId: TENANT, estado: "PENDIENTE" },
		});
		expect(mockPrisma.cuentaContable.findMany).not.toHaveBeenCalled();
	});

	it("requires the dedicated approval permission", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser,
			role: "user",
			tenantRole: "dependiente",
			permissions: new Set(),
			planFeatures: { contabilidad: true },
		});
		const result = await aprobarAperturaManualAction({ solicitudId: "request-1" });
		expect(expectActionFailure(result).error?.code).toBe("FORBIDDEN");
		expect(mockPrisma.aperturaPeriodoSolicitud.findFirst).not.toHaveBeenCalled();
	});

	it("rejects approval when canonical FX evidence is absent", async () => {
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue({
			solicitudId: "request-fx", fechaInicio: new Date("2026-04-01T00:00:00Z"),
			functionalCurrencyCode: "CUP", lineas: [
				{ cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0", fxEvidenceId: "missing" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "20" },
			],
		});
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "a1" }, { codigo: "301", cuentaContableId: "a2" },
		]);
		mockPrisma.fxEvidence.findFirst.mockResolvedValue(null);
		const result = await aprobarAperturaManualAction({ solicitudId: "request-fx" });
		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
		expect(mockPrisma.aperturaPeriodoSolicitud.updateMany).not.toHaveBeenCalled();
	});

	it("rejects a BANK_ACCOUNT evidence row even when amount and currency happen to match", async () => {
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue({
			solicitudId: "request-source-mismatch", fechaInicio: new Date("2026-04-01T00:00:00Z"),
			functionalCurrencyCode: "CUP", lineas: [
				{ lineId: "line-1", cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0", fxEvidenceId: "fx-bank" },
				{ lineId: "line-2", cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "20" },
			],
		});
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "account-101" }, { codigo: "301", cuentaContableId: "account-301" },
		]);
		mockPrisma.fxEvidence.findFirst.mockResolvedValue({
			fxEvidenceId: "fx-bank", sourceType: "BANK_ACCOUNT", sourceId: "some-bank",
		});

		const result = await aprobarAperturaManualAction({ solicitudId: "request-source-mismatch" });

		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
		expect(mockPrisma.fxEvidence.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({
				sourceType: "MANUAL_OPENING_LINE",
				sourceId: "request-source-mismatch:line-1:account-101",
			}),
		}));
		expect(mockPrisma.aperturaPeriodoSolicitud.updateMany).not.toHaveBeenCalled();
	});

	it("fails closed without a catalog rate and does not persist an FX row", async () => {
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue(null);
		mockPrisma.aperturaPeriodoSolicitud.create.mockResolvedValue({ solicitudId: "no-rate-request", estado: "PENDIENTE" });
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "account-101" }, { codigo: "301", cuentaContableId: "account-301" },
		]);
		exchangeRateMocks.getRateAsOf.mockResolvedValue(null);

		const result = await solicitarAperturaManualAction({
			idempotencyKey: "no-rate-request-key", tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00.000Z", fechaFin: "2026-04-30T23:59:59.000Z",
			lineas: [
				{ cuentaCodigo: "101", moneda: "EUR", debito: "10", credito: "0" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "10" },
			],
		});

		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
		expect(mockPrisma.fxEvidence.create).not.toHaveBeenCalled();
		const { AuditLogService } = await import("@/lib/services/audit-log-service");
		expect(AuditLogService.logStrict).not.toHaveBeenCalled();
	});

	it("does not open a request without prior approval", async () => {
		const result = await abrirPeriodoManualAprobadoAction({ solicitudId: "request-pending" });
		expect(expectActionFailure(result).error?.code).toBe("APERTURA_SALDOS_NO_VERIFICABLES");
		expect(mockPrisma.periodoContable.create).not.toHaveBeenCalled();
	});

	it("requires the approval permission before consuming an approved opening", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser, role: "user", tenantRole: "dependiente", permissions: new Set(),
			planFeatures: { contabilidad: true },
		});

		const result = await abrirPeriodoManualAprobadoAction({ solicitudId: "approved-request" });

		expect(expectActionFailure(result).error?.code).toBe("FORBIDDEN");
		expect(mockPrisma.$transaction).not.toHaveBeenCalled();
		expect(mockPrisma.aperturaPeriodoSolicitud.findFirst).not.toHaveBeenCalled();
	});

	it("submits, approves, and consumes one balanced opening into exact formal journal lines", async () => {
		const request = {
			solicitudId: "manual-1", tenantId: TENANT, tipo: "MENSUAL",
			fechaInicio: new Date("2026-04-01T00:00:00.000Z"),
			fechaFin: new Date("2026-04-30T23:59:59.000Z"),
			observaciones: null, categoria: "ORDINARIO", modoContable: "CAJA",
			functionalCurrencyCode: "CUP", estado: "PENDIENTE", solicitadaPor: ACTOR,
			aprobadaPor: null, aprobadaAt: null, hashAprobacion: null,
			lineas: [
				{ cuentaCodigo: "101", moneda: "USD", debito: "10.00", credito: "0" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "20.00" },
			],
		};
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.aperturaPeriodoSolicitud.create.mockResolvedValue(request);
		mockPrisma.aperturaPeriodoSolicitud.updateMany.mockResolvedValue({ count: 1 });
		mockPrisma.aperturaPeriodoSolicitud.update.mockResolvedValue({});
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "account-cash" },
			{ codigo: "301", cuentaContableId: "account-equity" },
		]);
		const canonical = buildAppliedFxEvidence({ originalAmount: 10, originalCurrency: "USD", functionalCurrency: "CUP", exchangeRate: 2, convertedAmount: 20, rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"), source: "TasaCambio catalog", fxCatalogRateId: "rate-1" });
		exchangeRateMocks.getRateAsOf.mockResolvedValue({ tasaId: "rate-1", tasa: 2, fechaVigencia: new Date("2026-03-31T00:00:00.000Z") });
		mockPrisma.fxEvidence.create.mockResolvedValue({ fxEvidenceId: "fx-1" });
		mockPrisma.fxEvidence.findFirst.mockResolvedValue({
			sourceType: "MANUAL_OPENING_LINE", sourceId: "manual-1:line-1:account-cash",
			functionalAmount: new Prisma.Decimal("20.00"),
			exchangeRate: new Prisma.Decimal("2.0000000000"),
			originalAmount: new Prisma.Decimal("10"), originalCurrency: "USD", functionalCurrency: "CUP",
			rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"), cutoffAt: new Date("2026-04-01T00:00:00.000Z"),
			fxCatalogRateId: "rate-1", provenance: canonical.fxProvenanceKind, source: "TasaCambio catalog",
			evidence: { ...buildAppliedFxEvidence({ originalAmount: 10, originalCurrency: "USD", functionalCurrency: "CUP", exchangeRate: 2, convertedAmount: 20, rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"), source: "TasaCambio catalog", fxCatalogRateId: "rate-1" }), solicitudId: "manual-1", lineId: "line-1", cuentaContableId: "account-cash", originalAmount: "10", functionalAmount: "20", exchangeRate: "2", cutoffAt: "2026-04-01T00:00:00.000Z" }, evidenceFingerprint: buildAppliedFxEvidence({ originalAmount: 10, originalCurrency: "USD", functionalCurrency: "CUP", exchangeRate: 2, convertedAmount: 20, rateEffectiveAt: new Date("2026-03-31T00:00:00.000Z"), source: "TasaCambio catalog", fxCatalogRateId: "rate-1" }).fxEvidenceFingerprint, evidenceVersion: canonical.fxEvidenceVersion,
		});
		mockPrisma.tasaCambio.findUnique.mockResolvedValue({ monedaOrigenId: "USD", monedaDestino: "CUP", tasa: new Prisma.Decimal("2"), fechaVigencia: new Date("2026-03-31T00:00:00.000Z") });
		mockPrisma.periodoContable.findFirst.mockImplementation(async (args: { where?: { periodoId?: string } }) =>
			args.where?.periodoId ? makePeriodo({ periodoId: "p-manual", tenantId: TENANT }) : null);
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.create.mockResolvedValue(makePeriodo({ periodoId: "p-manual", estado: EstadoPeriodo.ABIERTO }));
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockPrisma.diario.findFirst.mockResolvedValue({ diarioId: "journal-opening" });
		mockPrisma.asiento.findUnique.mockResolvedValue(null);
		mockPrisma.asiento.aggregate.mockResolvedValue({ _max: { numero: null } });
		mockPrisma.asiento.findMany.mockResolvedValue([]);
		mockPrisma.asiento.create.mockResolvedValue({ asientoId: "journal-entry-1" });
		mockPrisma.aperturaPeriodo.findUnique.mockResolvedValue(null);
		mockPrisma.aperturaPeriodo.create.mockResolvedValue({ aperturaId: "opening-1" });

		const submitted = await solicitarAperturaManualAction({
			idempotencyKey: "manual-opening-request-1",
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00.000Z",
			fechaFin: "2026-04-30T23:59:59.000Z",
			lineas: request.lineas,
		});
		if (!submitted.success) throw new Error(JSON.stringify(submitted.error));
		expectActionSuccess(submitted);
		request.lineas = mockPrisma.aperturaPeriodoSolicitud.update.mock.calls[0][0].data.lineas as typeof request.lineas;
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue(request);
		const approved = await aprobarAperturaManualAction({ solicitudId: "manual-1" });
		expectActionSuccess(approved);
		request.estado = "APROBADA";
		request.aprobadaPor = ACTOR;
		request.aprobadaAt = mockPrisma.aperturaPeriodoSolicitud.updateMany.mock.calls[0][0].data.aprobadaAt;
		request.hashAprobacion = "";
		// Use the digest returned by the approval action as the immutable approval token.
		if (approved.success) request.hashAprobacion = approved.data.hashAprobacion;
		const opened = await abrirPeriodoManualAprobadoAction({ solicitudId: "manual-1" });
		if (!opened.success) throw new Error(JSON.stringify(opened.error));
		expectActionSuccess(opened);
		expect(mockPrisma.asiento.create).toHaveBeenCalledTimes(1);
		const storedLines = mockPrisma.asiento.create.mock.calls[0][0].data.lineas.create;
		expect(storedLines).toHaveLength(2);
		expect(storedLines.map((line: { cuenta?: { connect: { tenantId_cuentaContableId: { cuentaContableId: string } } } }) => line.cuenta?.connect.tenantId_cuentaContableId.cuentaContableId)).toEqual(["account-cash", "account-equity"]);
		expect(storedLines.map((line: { debe: unknown; haber: unknown }) => [String(line.debe), String(line.haber)])).toEqual([["20", "0"], ["0", "20"]]);
		expect(storedLines[0].fxEvidenceFingerprint).toBe(canonical.fxEvidenceFingerprint);
		expect(storedLines[0].montoOriginal.toString()).toBe("10");
	});

	it("replays a request retry with the same key and payload without creating another row", async () => {
		const payload = {
			idempotencyKey: "manual-opening-retry",
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00.000Z",
			fechaFin: "2026-04-30T23:59:59.000Z",
			lineas: [
				{ cuentaCodigo: "101", moneda: "CUP", debito: "10", credito: "0" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "10" },
			],
		};
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValueOnce(null);
		mockPrisma.aperturaPeriodoSolicitud.create.mockResolvedValue({ solicitudId: "existing-request", estado: "PENDIENTE" });
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });

		const first = await solicitarAperturaManualAction(payload);
		const requestHash = mockPrisma.aperturaPeriodoSolicitud.create.mock.calls[0]?.[0]?.data?.idempotencyPayloadHash;
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue({
			solicitudId: "existing-request", estado: "PENDIENTE", idempotencyPayloadHash: requestHash, tenantId: TENANT,
		});
		const second = await solicitarAperturaManualAction(payload);

		expectActionSuccess(first);
		expectActionSuccess(second);
		if (first.success && second.success) expect(second.data).toMatchObject({ solicitudId: first.data.solicitudId, replayed: true });
		expect(mockPrisma.aperturaPeriodoSolicitud.create).toHaveBeenCalledTimes(1);
	});

	it("rejects reuse of an idempotency key with a different payload", async () => {
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue({
			solicitudId: "existing-request", estado: "PENDIENTE", idempotencyPayloadHash: "different-payload-hash",
		});
		const result = await solicitarAperturaManualAction({
			idempotencyKey: "manual-opening-retry",
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00.000Z",
			fechaFin: "2026-04-30T23:59:59.000Z",
			lineas: [
				{ cuentaCodigo: "101", moneda: "CUP", debito: "11", credito: "0" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "11" },
			],
		});
		expect(expectActionFailure(result).error?.code).toBe("IDEMPOTENCY_CONFLICT");
		expect(mockPrisma.aperturaPeriodoSolicitud.create).not.toHaveBeenCalled();
	});

	it("rejects a submission that reuses an FX evidence id across two lines", async () => {
		const result = await solicitarAperturaManualAction({
			idempotencyKey: "duplicate-source-evidence",
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00.000Z",
			fechaFin: "2026-04-30T23:59:59.000Z",
			lineas: [
				{ cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0", fxEvidenceId: "same-fx" },
				{ cuentaCodigo: "102", moneda: "USD", debito: "0", credito: "10", fxEvidenceId: "same-fx" },
			],
		});
		expect(expectActionFailure(result).error?.code).toBe("VALIDATION_ERROR");
		expect(mockPrisma.aperturaPeriodoSolicitud.create).not.toHaveBeenCalled();
	});

	it("creates immutable FX evidence bound to the generated request, line, and tenant account", async () => {
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue(null);
		mockPrisma.aperturaPeriodoSolicitud.create.mockResolvedValue({ solicitudId: "manual-fx-1", estado: "PENDIENTE" });
		mockPrisma.aperturaPeriodoSolicitud.update.mockResolvedValue({});
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "account-101" },
			{ codigo: "301", cuentaContableId: "account-301" },
		]);
		mockPrisma.fxEvidence.create.mockResolvedValue({ fxEvidenceId: "created-fx-1" });
		exchangeRateMocks.getRateAsOf.mockResolvedValue({
			tasaId: "rate-1", tasa: 2, fechaVigencia: new Date("2026-03-31T00:00:00.000Z"),
		});

		const result = await solicitarAperturaManualAction({
			idempotencyKey: "manual-fx-source-1",
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00.000Z",
			fechaFin: "2026-04-30T23:59:59.000Z",
			lineas: [
				{ cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "20" },
			],
		});

		expect(result.success, JSON.stringify(result)).toBe(true);
		expectActionSuccess(result);
		expect(exchangeRateMocks.getRateAsOf).toHaveBeenCalledWith(expect.objectContaining({
			sourceCurrency: "USD", targetCurrency: "CUP", boundaryAt: new Date("2026-04-01T00:00:00.000Z"),
		}));
		expect(mockPrisma.fxEvidence.create).toHaveBeenCalledWith(expect.objectContaining({
			data: expect.objectContaining({
				tenantId: TENANT, sourceType: "MANUAL_OPENING_LINE",
				sourceId: "manual-fx-1:line-1:account-101", originalAmount: expect.anything(),
				originalCurrency: "USD", functionalCurrency: "CUP", fxCatalogRateId: "rate-1",
			}),
		}));
		expect(mockPrisma.aperturaPeriodoSolicitud.update).toHaveBeenCalledWith(expect.objectContaining({
			where: { solicitudId: "manual-fx-1", tenantId: TENANT },
			data: { lineas: expect.arrayContaining([expect.objectContaining({
				lineId: "line-1", fxEvidenceId: "created-fx-1",
			})]) },
		}));
	});

	it("uses one FX cutoff and one catalog quote for same-currency lines in a request", async () => {
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ tenantId: TENANT, functionalCurrencyCode: "CUP" });
		mockPrisma.aperturaPeriodoSolicitud.findFirst.mockResolvedValue(null);
		mockPrisma.aperturaPeriodoSolicitud.create.mockResolvedValue({ solicitudId: "same-currency-fx", estado: "PENDIENTE" });
		mockPrisma.aperturaPeriodoSolicitud.update.mockResolvedValue({});
		mockPrisma.cuentaContable.findMany.mockResolvedValue([
			{ codigo: "101", cuentaContableId: "account-101" }, { codigo: "102", cuentaContableId: "account-102" },
		]);
		mockPrisma.fxEvidence.create.mockResolvedValueOnce({ fxEvidenceId: "fx-line-1" }).mockResolvedValueOnce({ fxEvidenceId: "fx-line-2" });
		exchangeRateMocks.getRateAsOf.mockResolvedValueOnce({
			tasaId: "rate-stable", tasa: 2, fechaVigencia: new Date("2026-03-31T00:00:00.000Z"),
		}).mockResolvedValueOnce({
			tasaId: "rate-changed", tasa: 3, fechaVigencia: new Date("2026-03-31T00:00:00.000Z"),
		});

		const result = await solicitarAperturaManualAction({
			idempotencyKey: "same-currency-fx-key", tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00.000Z", fechaFin: "2026-04-30T23:59:59.000Z",
			lineas: [
				{ cuentaCodigo: "101", moneda: "USD", debito: "10", credito: "0" },
				{ cuentaCodigo: "102", moneda: "USD", debito: "0", credito: "10" },
			],
		});

		expectActionSuccess(result);
		expect(exchangeRateMocks.getRateAsOf).toHaveBeenCalledTimes(1);
		const [firstEvidence, secondEvidence] = mockPrisma.fxEvidence.create.mock.calls.map(([call]) => call.data);
		expect(firstEvidence.cutoffAt).toEqual(secondEvidence.cutoffAt);
		expect(firstEvidence.fxCatalogRateId).toBe("rate-stable");
		expect(secondEvidence.fxCatalogRateId).toBe("rate-stable");
	});
});

describe("label de períodos", () => {
	it("genera label trimestral T1 para enero", () => {
		const label = generarLabelPeriodo(
			TipoPeriodo.TRIMESTRAL,
			new Date("2026-01-01"),
			new Date("2026-03-31"),
		);
		expect(label).toBe("T1 2026");
	});

	it("genera label semestral S2 para julio", () => {
		const label = generarLabelPeriodo(
			TipoPeriodo.SEMESTRAL,
			new Date("2026-07-01"),
			new Date("2026-12-31"),
		);
		expect(label).toBe("S2 2026");
	});
});
