import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-middleware", () => {
	const hoisted = (globalThis as any).__testUser ??= { userId: "user-test", tenantId: "tenant-1", role: 'admin', planFeatures: { 'prestamos-cash': true }, permissions: new Set(['financiero.contabilidad.acceder']) };
	const mockUser = hoisted;
	return {
		withAuthGet:
			(handler: any) =>
			(...args: any[]) =>
				handler(args[0], undefined, mockUser),
		withAuthPost:
			(handler: any) => async (request: NextRequest, context: any) =>
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
			findFirst: vi.fn(),
			update: vi.fn(),
		},
		cuentaPorCobrar: {
			create: vi.fn(),
			findMany: vi.fn(),
		},
		cliente: { findFirst: vi.fn() },
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
	AuditLogService: { log: vi.fn(), logStrict: vi.fn() },
}));
const functionalCurrencyMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
)
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  getRequiredTenantAccountingPolicy: functionalCurrencyMock,
}));
vi.mock('@/lib/auth/permissions', () => ({ requirePermission: vi.fn() }));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({ postEvento: vi.fn() }));

describe("API contabilidad/prestamos-cash", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		functionalCurrencyMock.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
		vi.stubEnv("NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH", "true");
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
		const request = new NextRequest(
			"http://localhost/api/contabilidad/prestamos-cash",
		);
		const response = await GET(request, {});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.prestamos).toHaveLength(1);
		expect(body.pagination.total).toBe(1);
		expect(body.prestamos[0].estado).toBe("PAGADO");
		expect(Number(body.prestamos[0].saldoPendiente)).toBe(0);
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

		prisma.cuentaBancaria.findFirst = vi.fn().mockResolvedValue({
			cuentaId: "cb-1",
			saldo: 1000,
			isActive: true,
			moneda: "CUP",
		});
		prisma.cliente = { findFirst: vi.fn().mockResolvedValue({ clienteId: 'c-1' }) };
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
				$queryRaw: vi.fn().mockResolvedValue([]),
				cuentaBancaria: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
				cuentaPorCobrar: { create: vi.fn().mockResolvedValue(mockCuenta), findMany: vi.fn().mockResolvedValue([]) },
				cliente: { findFirst: vi.fn().mockResolvedValue({ clienteId: 'c-1', limiteCredito: null }) },
				prestamoCash: { create: vi.fn().mockResolvedValue(mockPrestamo) },
				reconciliacionVenta: {
					update: vi.fn().mockResolvedValue({}),
					create: vi
						.fn()
						.mockResolvedValue({ reconciliacionId: "rec-prestamo-1", monto: 500,
							moneda: 'CUP', montoConvertido: 500, fechaReconciliacion: new Date() }),
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

		if (response.status !== 201) console.error("POST_FAIL_BODY", JSON.stringify(body));
		expect(response.status).toBe(201);
		expect(body.prestamo.id).toBe("p-new");
		const { postEvento } = await import('@/features/contabilidad-formal/services/posting-engine');
		expect(postEvento).toHaveBeenCalledTimes(1);
		expect(postEvento).toHaveBeenCalledWith(expect.anything(),
			{ tenantId: 'tenant-1', userId: 'user-test' }, expect.objectContaining({
				origen: { tipo: 'prestamo_cash', id: 'p-new' },
			}));
	});

	it('usa la moneda funcional MLC y persiste el movimiento nativo del banco', async () => {
		const prisma = (await import('@/lib/prisma')).default as any;
		const txReconciliationCreate = vi.fn().mockImplementation(async ({ data }) => ({
			reconciliacionId: 'rec-mlc', ...data,
		}));
		const txAccountUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
		functionalCurrencyMock.mockResolvedValue({ functionalCurrencyCode: 'MLC' });
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: 'cb-mlc', saldo: 1000, isActive: true, moneda: 'MLC',
		});
		prisma.cliente.findFirst.mockResolvedValue({ clienteId: 'c-1' });
		prisma.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tp-mlc', nombre: 'Transferencia' });
		prisma.$transaction.mockImplementation(async (callback: any) => callback({
			$queryRaw: vi.fn().mockResolvedValue([]),
			cuentaBancaria: { updateMany: txAccountUpdateMany },
			cuentaPorCobrar: {
				create: vi.fn().mockResolvedValue({ id: 'cxc-mlc' }),
				findMany: vi.fn().mockResolvedValue([]),
			},
			cliente: { findFirst: vi.fn().mockResolvedValue({ clienteId: 'c-1', limiteCredito: null }) },
			prestamoCash: { create: vi.fn().mockResolvedValue({
				id: 'p-mlc', clienteId: 'c-1', cuentaPorCobrar: {},
			}) },
			reconciliacionVenta: {
				create: txReconciliationCreate,
				update: vi.fn().mockResolvedValue({}),
			},
		}));

		const { POST } = await import('../route');
		const response = await POST(new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
			method: 'POST',
			body: JSON.stringify({
				clienteId: 'c-1', montoCapital: 100, moneda: 'USD',
				tasaCambioAlCrear: 2.5, cuentaBancariaId: 'cb-mlc',
			}),
		}), {});

		expect(response.status, await response.clone().text()).toBe(201);
		const reconciliation = txReconciliationCreate.mock.calls[0]?.[0].data;
		expect(reconciliation.functionalCurrency).toBe('MLC');
		expect(reconciliation.montoConvertido.toString()).toBe('250');
		expect(reconciliation.montoCuenta.toString()).toBe('250');
		expect(reconciliation.monedaCuenta).toBe('MLC');
		expect(txAccountUpdateMany).toHaveBeenCalledOnce();
		expect(txAccountUpdateMany.mock.calls[0]?.[0].data.saldo.decrement.toString()).toBe('250');
		// F1: el evento hereda la moneda funcional del tenant, sin caer a CUP.
		const { postEvento } = await import('@/features/contabilidad-formal/services/posting-engine');
		const eventoArg = (postEvento as any).mock.calls[0][2];
		expect(eventoArg.monedaFuncional).toBe('MLC');
		expect(eventoArg.montoFuncional.toString()).toBe('250');
		expect(eventoArg.tasaCambio.toString()).toBe('2.5');
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

	it('POST rechaza referencias bancarias ajenas antes de abrir transacción', async () => {
		const prisma = (await import('@/lib/prisma')).default as any;
		prisma.cliente = { findFirst: vi.fn().mockResolvedValue({ clienteId: 'c-1' }) };
		prisma.cuentaBancaria.findFirst = vi.fn().mockResolvedValue(null);
		const { POST } = await import('../route');
		const response = await POST(new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
			method: 'POST', body: JSON.stringify({ clienteId: 'c-1', montoCapital: 50, cuentaBancariaId: 'otra' }),
		}), {});
		expect(response.status).toBe(400);
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ cuentaId: 'otra', tenantId: 'tenant-1' }),
		}));
	});
});
