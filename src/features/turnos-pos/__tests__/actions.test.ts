/**
 * @description Tests para las Server Actions de Turnos de Punto de Venta.
 *
 * Patrón: mock de prisma y requireTenant, llamada directa a la action
 * con un mock de AuthenticatedUser.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ── Mocks de dependencias externas ────────────────────────

const mockPrisma = vi.hoisted(() => ({
	puntoDeVenta: {
		findFirst: vi.fn(),
	},
	turnoPuntoVenta: {
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
	},
	venta: {
		aggregate: vi.fn(),
	},
}));

const mockUser = vi.hoisted(
	(): AuthenticatedUser => ({
		userId: "user-1",
		tenantId: "tenant-mock-1",
		role: "ADMIN",
		email: "test@test.com",
		name: "Test User",
	}),
);

vi.mock("@/lib/prisma", () => ({
	prisma: mockPrisma,
}));

vi.mock("@/lib/services/tenant-scope", () => ({
	requireTenant: vi.fn(() => "tenant-mock-1"),
	requireFeature: vi.fn(),
}));

vi.mock("@/lib/server-actions/get-current-user", () => ({
	getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// ── Import después de mocks ───────────────────────────────

import {
	abrirTurnoAction,
	cerrarTurnoAction,
	getTurnosAction,
	getOrCreateTurnoActivo,
} from "../actions";
import { getCuadresCerradosAction } from "../actions-historial";

function buildTurno(overrides: Record<string, unknown> = {}) {
	return {
		id: "turno-1",
		tenantId: "tenant-mock-1",
		puntoDeVentaId: "pv-1",
		empleadoId: null,
		estado: "ABIERTO",
		fondoInicialCup: 50000,
		fondoInicialUsd: 0,
		fechaApertura: new Date(),
		fechaCierre: null,
		observaciones: null,
		tipo: "PRINCIPAL",
		...overrides,
	};
}

// ─── Suite: abrirTurnoAction ──────────────────────────────

describe("abrirTurnoAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// puntoDeVenta.findFirst devuelve un POS válido por defecto
		mockPrisma.puntoDeVenta.findFirst.mockResolvedValue({
			pvId: "pv-1",
			nombre: "PV Test",
			tipoCaja: "PRINCIPAL",
		});
	});

	it("should open a turno when no active turno exists", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);
		mockPrisma.turnoPuntoVenta.create.mockResolvedValue(buildTurno());

		const result = await abrirTurnoAction(
			{ puntoDeVentaId: "pv-1", fondoInicialCup: 50000, fondoInicialUsd: 0 },
			mockUser,
		);

		expect(result.success).toBe(true);
		expect(result.data).toBeDefined();
		expect(mockPrisma.turnoPuntoVenta.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					puntoDeVentaId: "pv-1",
					fondoInicialCup: 50000,
					estado: "ABIERTO",
				}),
			}),
		);
	});

	it("should register fondoInicialCup = 50000 correctly", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);
		mockPrisma.turnoPuntoVenta.create.mockResolvedValue(
			buildTurno({ fondoInicialCup: 50000 }),
		);

		const result = await abrirTurnoAction(
			{ puntoDeVentaId: "pv-1", fondoInicialCup: 50000, fondoInicialUsd: 0 },
			mockUser,
		);

		expect(result.success).toBe(true);
		if (result.success && result.data) {
			expect(result.data.fondoInicialCup).toBe(50000);
		}
	});

	it("should fail when there is already an ABIERTO turno", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());

		const result = await abrirTurnoAction(
			{ puntoDeVentaId: "pv-1", fondoInicialCup: 50000, fondoInicialUsd: 0 },
			mockUser,
		);

		expect(result.success).toBe(false);
		if (!result.success && result.error) {
			expect(result.error.message).toContain("Ya existe un turno abierto");
		}
	});

	it("should fail validation with negative fondo", async () => {
		const result = await abrirTurnoAction(
			{ puntoDeVentaId: "pv-1", fondoInicialCup: -100, fondoInicialUsd: 0 },
			mockUser,
		);

		expect(result.success).toBe(false);
	});
});

// ─── Suite: getOrCreateTurnoActivo ─────────────────────────

describe("getOrCreateTurnoActivo", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrisma.puntoDeVenta.findFirst.mockResolvedValue({
			pvId: "pv-1",
			nombre: "PV Test",
			tipoCaja: "PRINCIPAL",
		});
	});

	it("should return existing turno if found", async () => {
		const turno = buildTurno();
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(turno);

		const result = await getOrCreateTurnoActivo({ puntoDeVentaId: "pv-1" });

		expect(result.success).toBe(true);
		if (result.success && result.data) {
			expect(result.data.turnoId).toBe("turno-1");
			expect(result.data.created).toBe(false);
		}
	});

	it("should throw NO_TURNO_ACTIVO for PRINCIPAL without turno", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);

		const result = await getOrCreateTurnoActivo({ puntoDeVentaId: "pv-1" });

		expect(result.success).toBe(false);
		if (!result.success && result.error) {
			expect(result.error.code).toBe("NO_TURNO_ACTIVO");
		}
	});

	it("should auto-create turno for MOVIL without active turno", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);
		mockPrisma.puntoDeVenta.findFirst.mockResolvedValue({
			pvId: "pv-1",
			nombre: "PV Test",
			tipoCaja: "MOVIL",
		});
		mockPrisma.turnoPuntoVenta.create.mockResolvedValue(buildTurno());

		const result = await getOrCreateTurnoActivo({ puntoDeVentaId: "pv-1" });

		expect(result.success).toBe(true);
		expect(mockPrisma.turnoPuntoVenta.create).toHaveBeenCalled();
	});
});

// ─── Suite: getCuadresCerradosAction ──────────────────────

describe("getCuadresCerradosAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return only closed shifts with sales and arqueo summary", async () => {
		mockPrisma.turnoPuntoVenta.findMany.mockResolvedValue([
			{
				...buildTurno({
					id: "turno-cerrado-1",
					estado: "CERRADO",
					fechaCierre: new Date("2026-06-19T10:00:00.000Z"),
					puntoDeVenta: { pvId: "pv-1", nombre: "PV Centro", tipoCaja: "PRINCIPAL" },
					empleado: { empleadoId: "emp-1", nombre: "Ana", apellido: "Pérez" },
					arqueos: [{ diferenciaCup: 3500, createdAt: new Date("2026-06-19T10:00:00.000Z") }],
					ventas: [{ total: 120 }, { total: 80 }],
					_count: { ventas: 2 },
				}),
			},
		]);

		const result = await getCuadresCerradosAction({ limit: 20 }, mockUser);

		expect(result.success).toBe(true);
		if (result.success && result.data) {
			expect(result.data).toHaveLength(1);
			expect(result.data[0]).toMatchObject({
				turnoId: "turno-cerrado-1",
				puntoDeVentaNombre: "PV Centro",
				empleadoNombre: "Ana Pérez",
				totalVentas: 200,
				diferenciaCup: 35,
				arqueado: true,
				totalTickets: 2,
			});
		}

		expect(mockPrisma.turnoPuntoVenta.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tenantId: "tenant-mock-1",
					estado: "CERRADO",
				}),
				take: 20,
			}),
		);
	});

	it("should keep closed shifts without arqueo or employee as consultable rows", async () => {
		mockPrisma.turnoPuntoVenta.findMany.mockResolvedValue([
			{
				...buildTurno({
					id: "turno-cerrado-2",
					estado: "CERRADO",
					puntoDeVenta: { pvId: "pv-2", nombre: "PV Norte", tipoCaja: "PRINCIPAL" },
					arqueos: [],
					empleado: null,
					ventas: [],
					_count: { ventas: 0 },
				}),
			},
		]);

		const result = await getCuadresCerradosAction({}, mockUser);

		expect(result.success).toBe(true);
		if (result.success && result.data) {
			expect(result.data[0]).toMatchObject({
				turnoId: "turno-cerrado-2",
				puntoDeVentaNombre: "PV Norte",
				empleadoNombre: null,
				arqueado: false,
				diferenciaCup: null,
				totalVentas: 0,
				totalTickets: 0,
			});
		}
	});
});

// ─── Suite: cerrarTurnoAction ─────────────────────────────

describe("cerrarTurnoAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should close an active turno with valid arqueo", async () => {
		// Turno con arqueo y puntoDeVenta (include requerido)
		// fondoInicialCup=50000, totalEfectivoCup=60000 → neto efectivo = 10000 centavos ($100)
		// totalTarjeta=0, totalTransferencia=0, totalCredito=0
		// → arqueoTotalPesos = (60000 - 50000 + 0 + 0 + 0) / 100 = 100
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue({
			...buildTurno(),
			arqueos: [
				{
					id: "arq-1",
					totalEfectivoCup: 60000, // $600
					totalEfectivoUsd: 0,
					totalTarjeta: 0,
					totalTransferencia: 0,
					totalCredito: 0,
					diferenciaCup: 0,
					diferenciaUsd: 0,
				},
			],
			puntoDeVenta: { pvId: "pv-1" },
		});
		// Venta.total está en pesos → $100 coincide con arqueoTotalPesos
		mockPrisma.venta.aggregate.mockResolvedValue({
			_sum: { total: 100 },
		});
		mockPrisma.turnoPuntoVenta.update.mockResolvedValue(
			buildTurno({ estado: "CERRADO" }),
		);

		const result = await cerrarTurnoAction({ turnoId: "turno-1" });

		expect(result.success).toBe(true);
		expect(mockPrisma.turnoPuntoVenta.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "turno-1" },
				data: expect.objectContaining({ estado: "CERRADO" }),
			}),
		);
	});

	it("should fail when turno does not exist", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);

		const result = await cerrarTurnoAction(
			{ turnoId: "nonexistent" },
			mockUser,
		);

		expect(result.success).toBe(false);
		if (!result.success && result.error) {
			expect(result.error.message).toContain("no encontrado");
		}
	});
});
