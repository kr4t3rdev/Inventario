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
	AuditLogService: { log: vi.fn().mockResolvedValue(undefined) },
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
	reabrirPeriodoAction,
	aprobarPeriodoAction,
} from "@/features/contabilidad/actions-periodos";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import {
	EstadoPeriodo,
	TipoPeriodo,
	EventoAuditoria,
	generarLabelPeriodo,
} from "@/lib/services/periodo-contable-types";
import { PeriodoContableService } from "@/lib/services/periodo-contable-service";

// ── Helpers ───────────────────────────────────────────────────────────────

const TENANT = "tenant-1";
const ACTOR = "user-1";

const mockUser: AuthenticatedUser = {
	userId: ACTOR,
	name: "Test User",
	email: "test@test.com",
	role: "admin",
	isActive: true,
	tenantId: TENANT,
	tenantRole: "admin",
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
		expect(result.data?.periodos).toEqual([]);
		expect(result.data?.pagination.total).toBe(0);
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
		expect(result.data?.periodos).toHaveLength(2);
		expect(result.data?.periodos[0]).toHaveProperty("tieneHash");
		expect(result.data?.periodos[0]).toHaveProperty("ultimaAuditoria");
		expect(result.data?.periodos[0]).toHaveProperty("blockers");
		expect(result.data?.pagination).toEqual({
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
		expect(result.error?.code).toBe("AUTH_REQUIRED");
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
		expect(result.data?.periodo.periodoId).toBe("p-1");
		expect(result.data?.timeline).toBeDefined();
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await obtenerPeriodoAction("p-no-existe");

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
	});

	it("falla si el período no pertenece al tenant", async () => {
		// findFirst con where { periodoId, tenantId } no encuentra períodos de otro tenant
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await obtenerPeriodoAction("p-1");

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
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
		expect(result.data?.timeline).toHaveLength(2);
		expect(result.data?.timeline[0].evento).toBe(EventoAuditoria.APERTURA);
		expect(result.data?.timeline[1].evento).toBe(EventoAuditoria.CIERRE);
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await obtenerTimelineAction("p-no-existe");

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
	});
});

// ── Tests: abrirPeriodoAction ─────────────────────────────────────────────

describe("abrirPeriodoAction", () => {
	it("abre un período mensual exitosamente", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(0); // sin solapamiento
		mockPrisma.periodoContable.create.mockResolvedValue(
			makePeriodo({
				tipo: TipoPeriodo.MENSUAL,
				estado: EstadoPeriodo.ABIERTO,
				fechaInicio: new Date("2026-03-01"),
				fechaFin: new Date("2026-03-31"),
			}),
		);
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockAperturaService();

		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-03-01T00:00:00Z",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		expect(result.success).toBe(true);
		expect(result.data?.periodo.estado).toBe(EstadoPeriodo.ABIERTO);
		expect(result.data?.periodo.tipo).toBe(TipoPeriodo.MENSUAL);
		expect(revalidatePath).toHaveBeenCalledWith("/busy/contabilidad/periodos");
	});

	it("abre un período diario exitosamente", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.create.mockResolvedValue(
			makePeriodo({
				tipo: TipoPeriodo.DIARIO,
				estado: EstadoPeriodo.ABIERTO,
				fechaInicio: new Date("2026-03-15"),
				fechaFin: new Date("2026-03-15"),
			}),
		);
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockAperturaService();

		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.DIARIO,
			fechaInicio: "2026-03-15T00:00:00Z",
			fechaFin: "2026-03-15T23:59:59Z",
		});

		expect(result.success).toBe(true);
		expect(result.data?.periodo.tipo).toBe(TipoPeriodo.DIARIO);
	});

	it("abre un período anual exitosamente", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.create.mockResolvedValue(
			makePeriodo({
				tipo: TipoPeriodo.ANUAL,
				estado: EstadoPeriodo.ABIERTO,
				fechaInicio: new Date("2026-01-01"),
				fechaFin: new Date("2026-12-31"),
			}),
		);
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockAperturaService();

		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.ANUAL,
			fechaInicio: "2026-01-01T00:00:00Z",
			fechaFin: "2026-12-31T23:59:59Z",
		});

		expect(result.success).toBe(true);
		expect(result.data?.periodo.tipo).toBe(TipoPeriodo.ANUAL);
	});

	it("falla con fechas inválidas (inicio posterior a fin)", async () => {
		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-04-01T00:00:00Z",
			fechaFin: "2026-03-01T00:00:00Z",
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("FECHAS_INVALIDAS");
		expect(mockPrisma.periodoContable.create).not.toHaveBeenCalled();
	});

	it("falla con fecha de inicio inválida (Zod)", async () => {
		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "no-es-fecha",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("VALIDATION_ERROR");
	});

	it("falla con fecha de fin inválida (Zod)", async () => {
		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-03-01T00:00:00Z",
			fechaFin: "tampoco-es-fecha",
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("VALIDATION_ERROR");
	});

	it("falla si hay solapamiento de fechas", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(1); // ya existe solapado

		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-03-01T00:00:00Z",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("PERIODO_SOLAPADO");
		expect(mockPrisma.periodoContable.create).not.toHaveBeenCalled();
	});

	it("invalida el caché del guard después de abrir", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.create.mockResolvedValue(
			makePeriodo({ estado: EstadoPeriodo.ABIERTO }),
		);
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockAperturaService();

		await abrirPeriodoAction({
			tipo: TipoPeriodo.MENSUAL,
			fechaInicio: "2026-03-01T00:00:00Z",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		// invalidateCache se llama internamente; verificamos revalidatePath
		expect(revalidatePath).toHaveBeenCalledWith("/busy/contabilidad/periodos");
	});

	it("abre un período trimestral exitosamente", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.create.mockResolvedValue(
			makePeriodo({
				tipo: TipoPeriodo.TRIMESTRAL,
				estado: EstadoPeriodo.ABIERTO,
				fechaInicio: new Date("2026-01-01"),
				fechaFin: new Date("2026-03-31"),
			}),
		);
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockAperturaService();

		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.TRIMESTRAL,
			fechaInicio: "2026-01-01T00:00:00Z",
			fechaFin: "2026-03-31T23:59:59Z",
		});

		expect(result.success).toBe(true);
		expect(result.data?.periodo.tipo).toBe(TipoPeriodo.TRIMESTRAL);
	});

	it("abre un período semestral exitosamente", async () => {
		mockPrisma.periodoContable.count.mockResolvedValue(0);
		mockPrisma.periodoContable.create.mockResolvedValue(
			makePeriodo({
				tipo: TipoPeriodo.SEMESTRAL,
				estado: EstadoPeriodo.ABIERTO,
				fechaInicio: new Date("2026-01-01"),
				fechaFin: new Date("2026-06-30"),
			}),
		);
		mockPrisma.auditoriaPeriodo.create.mockResolvedValue({});
		mockAperturaService();

		const result = await abrirPeriodoAction({
			tipo: TipoPeriodo.SEMESTRAL,
			fechaInicio: "2026-01-01T00:00:00Z",
			fechaFin: "2026-06-30T23:59:59Z",
		});

		expect(result.success).toBe(true);
		expect(result.data?.periodo.tipo).toBe(TipoPeriodo.SEMESTRAL);
	});
});

// ── Tests: cerrarPeriodoAction ────────────────────────────────────────────

	describe("cerrarPeriodoAction", () => {
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
		expect(response.error?.code).not.toBe("INTERNAL_ERROR");
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
		expect(response.error?.code).toBe("CUTOFF_EVIDENCE_UNAVAILABLE");
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
		expect(result.data?.periodo.estado).toBe(EstadoPeriodo.CERRADO);
		expect(result.data?.snapshots).toBe(0);
		expect(revalidatePath).toHaveBeenCalledWith("/busy/contabilidad/periodos");
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await cerrarPeriodoAction({ periodoId: "p-no-existe" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
	});

	it("falla si el período no pertenece al tenant", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await cerrarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
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
		expect(result.error?.code).toBe("TRANSICION_INVALIDA");
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
		expect(result.error?.code).toBe("HIJOS_ABIERTOS");
		expect(mockPrisma.periodoContable.update).not.toHaveBeenCalled();
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
		expect(result.error?.code).toBe("VALIDATION_ERROR");
	});

	it("falla con motivo vacío", async () => {
		const result = await reabrirPeriodoAction({
			periodoId: "p-1",
			motivo: "",
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("VALIDATION_ERROR");
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
		expect(result.data?.periodo.estado).toBe(EstadoPeriodo.REABIERTO);
		expect(result.data?.periodo.motivoReapertura).toBe(
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
		expect(result.error?.code).toBe("NOT_FOUND");
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
		expect(result.error?.code).toBe("TRANSICION_INVALIDA");
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
		expect(result.data?.periodo.estado).toBe(EstadoPeriodo.APROBADO);
		expect(result.data?.periodo.aprobadoPor).toBe(ACTOR);
		expect(revalidatePath).toHaveBeenCalledWith("/busy/contabilidad/periodos");
	});

	it("falla si el período no existe", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);

		const result = await aprobarPeriodoAction({ periodoId: "p-no-existe" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("NOT_FOUND");
	});

	it("falla si la transición no es válida (período APROBADO no se puede aprobar de nuevo)", async () => {
		// APROBADO solo permite transición a REABIERTO
		// ABIERTO sí permitía ABIERTO→APROBADO, por eso usamos APROBADO
		const periodo = makePeriodo({ estado: EstadoPeriodo.APROBADO });
		mockPrisma.periodoContable.findFirst.mockResolvedValue(periodo);
		mockPrisma.periodoContable.findUnique.mockResolvedValue(periodo);

		const result = await aprobarPeriodoAction({ periodoId: "p-1" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("TRANSICION_INVALIDA");
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
