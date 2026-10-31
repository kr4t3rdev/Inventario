import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ActionError } from "@/lib/server-actions";

vi.mock("@/lib/auth-middleware", () => {
	const mockUser = { userId: "user-test", tenantId: "tenant-1" };
	return {
		withAuthGet:
			(handler: any) =>
			(request: NextRequest, context: any = {}) =>
				handler(request, context, mockUser),
		withAuthPost:
			(handler: any) => async (request: NextRequest, context: any = {}) =>
				handler(request, context, mockUser),
	};
});

vi.mock("@/lib/prisma", () => {
	const prisma = {
		prestamoCash: {
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
		},
		cuentaBancaria: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		cuentaPorCobrar: {
			create: vi.fn(),
		},
		tipoPago: {
			findFirst: vi.fn(),
		},
		reconciliacionVenta: {
			create: vi.fn(),
		},
		$transaction: vi.fn(),
	};
	return { prisma, default: prisma };
});

vi.mock("@/lib/services/audit-log-service", () => ({
	AuditLogService: { log: vi.fn() },
}));

vi.mock("@/lib/services/tenant-scope", () => ({
	requireTenant: vi.fn(() => "tenant-1"),
	hasFeature: vi.fn(() => true),
	requirePermission: vi.fn(),
}));

describe("API contabilidad/prestamos-cash", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
		vi.stubEnv("NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH", "true");
		const scope = await import("@/lib/services/tenant-scope");
		vi.mocked(scope.requirePermission).mockImplementation(() => undefined);
		vi.mocked(scope.hasFeature).mockReturnValue(true);
	});

	it("GET devuelve lista vacía si no hay datos (GET no verifica módulo deshabilitado)", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.prestamoCash.findMany.mockResolvedValue([]);
		prisma.prestamoCash.count.mockResolvedValue(0);

		const { GET } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/prestamos-cash",
		);
		const response = await GET(request, {});
		expect(response.status).toBe(200);
	});

	it("GET lista préstamos con status 200", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		const mockPrestamos = [
			{
				id: "p-1",
				montoCapital: 1000,
				estado: "ACTIVO",
				cuentaPorCobrar: {
					montoDeuda: 1100,
					montoPagado: 1100,
					estado: "PAGADA",
				},
				cliente: { clienteId: "c-1", nombre: "Test" },
			},
		];
		prisma.prestamoCash.findMany.mockResolvedValue(mockPrestamos);
		prisma.prestamoCash.count.mockResolvedValue(1);

		const { GET } = await import("../route");
		const scope = await import("@/lib/services/tenant-scope");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/prestamos-cash",
		);
		const response = await GET(request, {});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(scope.requirePermission).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "user-test" }),
			"financiero.contabilidad.acceder",
			"consultar préstamos cash",
		);
		expect(body.prestamos).toHaveLength(1);
		expect(body.pagination.total).toBe(1);
		expect(body.prestamos[0].estado).toBe("PAGADO");
		expect(body.prestamos[0].saldoPendiente).toBe(0);
	});

	it("GET filtra por estado", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.prestamoCash.findMany.mockResolvedValue([]);
		prisma.prestamoCash.count.mockResolvedValue(0);

		const { GET } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/prestamos-cash?estado=ACTIVO",
		);
		await GET(request, {});

		expect(prisma.prestamoCash.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ estado: "ACTIVO" }),
			}),
		);
	});

	it("GET incluye cuentaPorCobrar para normalizar saldo y estado", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.prestamoCash.findMany.mockResolvedValue([]);
		prisma.prestamoCash.count.mockResolvedValue(0);

		const { GET } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/prestamos-cash",
		);
		const response = await GET(request, {});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.prestamos).toEqual([]);
		expect(prisma.prestamoCash.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				include: expect.objectContaining({
					cuentaPorCobrar: true,
				}),
			}),
		);
	});

	it("POST crea préstamo con status 201", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;

		const mockCuenta = { id: "cxc-1" };
		const mockPrestamo = {
			id: "p-new",
			montoCapital: 500,
			moneda: "CUP",
			clienteId: "c-1",
			cliente: { clienteId: "c-1", nombre: "Test" },
			cuentaPorCobrar: mockCuenta,
		};

		prisma.cuentaBancaria.findUnique.mockResolvedValue({
			cuentaId: "cb-1",
			saldo: 1000,
			isActive: true,
		});
		prisma.tipoPago = {
			findFirst: vi
				.fn()
				.mockResolvedValue({
					tipoId: "tp-transferencia",
					nombre: "Transferencia",
				}),
		};

		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				cuentaBancaria: { update: vi.fn().mockResolvedValue({}) },
				cuentaPorCobrar: { create: vi.fn().mockResolvedValue(mockCuenta) },
				prestamoCash: { create: vi.fn().mockResolvedValue(mockPrestamo) },
				reconciliacionVenta: {
					create: vi
						.fn()
						.mockResolvedValue({ reconciliacionId: "rec-prestamo-1" }),
				},
			};
			return callback(tx);
		});

		const { POST } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/prestamos-cash",
			{
				method: "POST",
				body: JSON.stringify({
					clienteId: "c-1",
					montoCapital: 500,
					moneda: "CUP",
					tasaInteres: 10,
					cuentaBancariaId: "cb-1",
				}),
			},
		);

		const response = await POST(request, {});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.prestamo.id).toBe("p-new");
	});

	it("POST blocks a new receivable when the plan lacks the cash-loan feature", async () => {
		const scope = await import("@/lib/services/tenant-scope");
		vi.mocked(scope.hasFeature).mockReturnValue(false);
		const { POST } = await import("../route");
		const request = new NextRequest("http://localhost/api/contabilidad/prestamos-cash", {
			method: "POST",
			body: JSON.stringify({
				clienteId: "c-1", montoCapital: 500, moneda: "CUP", cuentaBancariaId: "cb-1",
			}),
		});

		const response = await POST(request, {});

		expect(response.status).toBe(403);
		vi.mocked(scope.hasFeature).mockReturnValue(true);
	});

	it("POST maps missing accounting permission to 403 before touching the database", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		const scope = await import("@/lib/services/tenant-scope");
		vi.mocked(scope.requirePermission).mockImplementation(() => {
			throw new ActionError("Forbidden", "FORBIDDEN");
		});
		const { POST } = await import("../route");
		const request = new NextRequest("http://localhost/api/contabilidad/prestamos-cash", {
			method: "POST",
			body: JSON.stringify({
				clienteId: "c-1", montoCapital: 500, moneda: "CUP", cuentaBancariaId: "cb-1",
			}),
		});

		const response = await POST(request, {});
		vi.mocked(scope.requirePermission).mockImplementation(() => undefined);

		expect(response.status).toBe(403);
		expect(prisma.prestamoCash.create).not.toHaveBeenCalled();
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it("POST devuelve 400 con body inválido", async () => {
		const { POST } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/prestamos-cash",
			{
				method: "POST",
				body: JSON.stringify({ montoCapital: -10 }),
			},
		);

		const response = await POST(request, {});

		expect(response.status).toBe(400);
	});
});
