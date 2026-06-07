/**
 * @description Tests para la Server Action getCuadreTurnoAction.
 *
 * Patrón: mock de prisma, llamada directa a la action con mock de AuthenticatedUser.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ── Mocks de dependencias externas ────────────────────────

const mockPrisma = vi.hoisted(() => ({
	turnoPuntoVenta: {
		findFirst: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
	},
	ventaItem: {
		findMany: vi.fn(),
	},
	venta: {
		aggregate: vi.fn(),
	},
	stockUbicacion: {
		findMany: vi.fn(),
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
}));

vi.mock("@/lib/server-actions/get-current-user", () => ({
	getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// ── Import después de mocks ───────────────────────────────

import { getCuadreTurnoAction } from "../actions-cuadre";

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
		tipo: "NORMAL",
		empleado: null,
		puntoDeVenta: { pvId: "pv-1", nombre: "PV Test" },
		arqueos: [
			{
				id: "arqueo-1",
				totalEfectivoCup: 150000, // $1,500.00 en centavos
				totalEfectivoUsd: 0,
				totalTarjeta: 50000, // $500.00
				totalTransferencia: 0,
				totalCredito: 0,
				diferenciaCup: 0,
				diferenciaUsd: 0,
			},
		],
		...overrides,
	};
}

// ─── Suite: getCuadreTurnoAction ──────────────────────────

describe("getCuadreTurnoAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return cuadre data with productos, ventas and arqueo", async () => {
		// Mock turno con arqueo
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());

		// Mock ventaItems del turno
		mockPrisma.ventaItem.findMany.mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 5,
				precioUnitario: 10000, // $100.00 en pesos (no centavos)
				producto: {
					id: "prod-1",
					nombre: "Producto A",
					codigoInterno: "ABC123",
					precioVenta: 10000,
					fotos: ["/foto-a.jpg"],
					unidad: { simbolo: "u" },
				},
			},
			{
				productoId: "prod-2",
				cantidad: 3,
				precioUnitario: 5000, // $50.00
				producto: {
					id: "prod-2",
					nombre: "Producto B",
					codigoInterno: "DEF456",
					precioVenta: 5000,
					fotos: [],
					unidad: { simbolo: "u" },
				},
			},
		]);

		// Mock stockUbicacion en el PV (Fase 4: usa getStockPorUbicacionBatch → findMany)
		mockPrisma.stockUbicacion.findMany.mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 20,
				cantidadReservada: 0,
				cantidadDisponible: 20,
			},
			{
				productoId: "prod-2",
				cantidad: 15,
				cantidadReservada: 0,
				cantidadDisponible: 15,
			},
		]);

		// Mock aggregate de venta (totalVentaTurno)
		mockPrisma.venta.aggregate.mockResolvedValue({ _sum: { total: 65000 } }); // $650.00

		const result = await getCuadreTurnoAction("turno-1", mockUser);

		expect(result.success).toBe(true);
		if (result.success && result.data) {
			// Datos del turno
			expect(result.data.turno.puntoDeVentaNombre).toBe("PV Test");
			expect(result.data.turno.fondoInicialCup).toBe(50000);

			// Arqueo
			expect(result.data.arqueo).not.toBeNull();
			expect(result.data.arqueo!.totalEfectivoCup).toBe(150000);

			// Productos
			// Con Fase 4: stockUbicacion.cantidad = stock actual = restante
			// stockInicial = stockActual + vendido
			expect(result.data.productos).toHaveLength(2);
			expect(result.data.productos[0].nombre).toBe("Producto A");
			expect(result.data.productos[0].vendidoEnTurno).toBe(5);
			expect(result.data.productos[0].stockEnUbicacion).toBe(25); // 20 (actual) + 5 (vendido)
			expect(result.data.productos[0].restante).toBe(20); // stock actual

			// Total venta turno
			expect(result.data.totalVentaTurno).toBe(65000);

			// Resumen
			expect(result.data.resumen.totalVendido).toBe(8);
			expect(result.data.resumen.totalStock).toBe(43); // 25 + 18 = 43 (stocks iniciales)
		}
	});

	it("should fail when turno does not exist", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(null);

		const result = await getCuadreTurnoAction("nonexistent", mockUser);

		expect(result.success).toBe(false);
		if (!result.success && result.error) {
			expect(result.error.message).toContain("no encontrado");
		}
	});

	it("should fail when turno has no arqueo", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(
			buildTurno({ arqueos: [] }),
		);

		const result = await getCuadreTurnoAction("turno-1", mockUser);

		expect(result.success).toBe(false);
		if (!result.success && result.error) {
			expect(result.error.code).toBe("NO_ARQUEO");
		}
	});

	it("should handle turno with no ventas", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());
		mockPrisma.ventaItem.findMany.mockResolvedValue([]);
		mockPrisma.stockUbicacion.findMany.mockResolvedValue([]);
		mockPrisma.venta.aggregate.mockResolvedValue({ _sum: { total: 0 } });

		const result = await getCuadreTurnoAction("turno-1", mockUser);

		expect(result.success).toBe(true);
		if (result.success && result.data) {
			expect(result.data.productos).toHaveLength(0);
			expect(result.data.resumen.totalVendido).toBe(0);
			expect(result.data.totalVentaTurno).toBe(0);
		}
	});

	it("should fallback to warehouse stock when no PV StockUbicacion records exist", async () => {
		// Turno con PV que tiene almacenId
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(
			buildTurno({
				puntoDeVenta: {
					pvId: "pv-1",
					nombre: "PV Test",
					almacenId: "alm-1",
				},
			}),
		);

		mockPrisma.ventaItem.findMany.mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 5,
				precioUnitario: 10000,
				producto: {
					id: "prod-1",
					nombre: "Producto A",
					codigoInterno: null,
					precioVenta: 10000,
					fotos: [],
					unidad: { simbolo: "u" },
				},
			},
		]);

		// Solo PV (sin fallback a almacén). Sin StockUbicacion en PV → stock 0
		mockPrisma.stockUbicacion.findMany.mockResolvedValue([]);

		mockPrisma.venta.aggregate.mockResolvedValue({ _sum: { total: 50000 } });

		const result = await getCuadreTurnoAction("turno-1", mockUser);

		expect(result.success).toBe(true);
		if (result.success && result.data) {
			// Sin StockUbicacion en PV: stockActual=0, stockInicial=0+5=5, restante=0
			expect(result.data.productos).toHaveLength(1);
			expect(result.data.productos[0].stockEnUbicacion).toBe(5); // 0 + 5
			expect(result.data.productos[0].vendidoEnTurno).toBe(5);
			expect(result.data.productos[0].restante).toBe(0);
		}
	});

	it("should group ventaItems by productoId", async () => {
		mockPrisma.turnoPuntoVenta.findFirst.mockResolvedValue(buildTurno());

		// Mismo producto aparece en 2 ventas diferentes
		mockPrisma.ventaItem.findMany.mockResolvedValue([
			{
				productoId: "prod-1",
				cantidad: 2,
				precioUnitario: 10000,
				producto: {
					id: "prod-1",
					nombre: "Producto A",
					codigoInterno: null,
					precioVenta: 10000,
					fotos: [],
					unidad: { simbolo: "u" },
				},
			},
			{
				productoId: "prod-1",
				cantidad: 3,
				precioUnitario: 10000,
				producto: {
					id: "prod-1",
					nombre: "Producto A",
					codigoInterno: null,
					precioVenta: 10000,
					fotos: [],
					unidad: { simbolo: "u" },
				},
			},
		]);

		mockPrisma.stockUbicacion.findMany.mockResolvedValue([
			{ productoId: "prod-1", cantidad: 10 },
		]);

		mockPrisma.venta.aggregate.mockResolvedValue({ _sum: { total: 50000 } }); // $500.00

		const result = await getCuadreTurnoAction("turno-1", mockUser);

		expect(result.success).toBe(true);
		if (result.success && result.data) {
			// Solo 1 producto (agrupado)
			expect(result.data.productos).toHaveLength(1);
			expect(result.data.productos[0].vendidoEnTurno).toBe(5); // 2 + 3
			// precioVenta ahora es total = vendido * precioUnitario
			expect(result.data.productos[0].precioVenta).toBe(50000); // 5 * 10000
		}
	});
});
