import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ActionError } from "@/lib/server-actions";

vi.mock("@/lib/auth-middleware", () => {
	const mockUser = { userId: "user-test", tenantId: "tenant-1" };
	return {
		withAuthGet:
			(handler: any) =>
			(...args: any[]) =>
				handler(args[0], undefined, mockUser),
		withAuthPost:
			(handler: any) => async (request: NextRequest, context: any = {}) =>
				handler(request, context, mockUser),
	};
});

vi.mock("@/lib/prisma", () => {
	const prisma = {
		deudaCash: {
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
		},
		cuentaPorPagar: {
			create: vi.fn(),
			update: vi.fn(),
		},
		vendor: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
		},
		cuentaBancaria: {
			update: vi.fn(),
			findFirst: vi.fn(),
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

vi.mock("@/generated/prisma", () => ({ Prisma: {} }));
vi.mock(
	"@/features/contabilidad/services/accounting-reconciliation-service",
	() => ({
		buildPersistedAccountingAmount: vi.fn((amount: number) => ({
			montoConvertido: amount,
			tasaCambio: 1,
			fxEvidence: { fxEvidenceFingerprint: "test-fingerprint" },
		})),
	}),
);
vi.mock("@/features/contabilidad/services/cash-debt-payment-valuation", () => ({
	resolveCashDebtCurrencyAmounts: vi.fn(({ montoFondos }: { montoFondos: number }) => ({
		montoCuenta: { toNumber: () => montoFondos },
	})),
}));
vi.mock("@/features/contabilidad/services/tenant-accounting-policy-service", () => ({
	getRequiredTenantAccountingPolicy: vi.fn().mockResolvedValue({ functionalCurrencyCode: "CUP" }),
}));
vi.mock("@/features/contabilidad-formal/services/posting-engine", () => ({
	postEvento: vi.fn(),
}));

vi.mock("@/lib/services/audit-log-service", () => ({
	AuditLogService: { log: vi.fn(), logStrict: vi.fn() },
}));

vi.mock(
	"@/features/contabilidad/services/accounting-cash-operations-mutation-service",
	() => ({
		AccountingCashOperationsMutationService: {
			findCashDebtCreateReplay: vi.fn(),
			createCashDebt: vi.fn(),
			findCashDebtPaymentReplay: vi.fn(),
			registerCashDebtPayment: vi.fn(),
		},
		validateCashPaymentAmount: vi.fn((amount: number) => {
			if (Math.round(amount * 10_000) !== amount * 10_000) {
				throw new ActionError("Invalid amount precision", "INVALID_AMOUNT");
			}
			return { toNumber: () => amount };
		}),
	}),
);

vi.mock("@/lib/services/validate-period-write", () => ({
	validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true }),
	extraerFechaDeBody: vi.fn(() => undefined),
}));

vi.mock("@/lib/services/tenant-scope", () => ({
	requireTenant: vi.fn(() => "tenant-1"),
	requireFeature: vi.fn(),
	requirePermission: vi.fn(),
	hasFeature: vi.fn(() => true),
	hasPermission: vi.fn(() => true),
}));

describe("API contabilidad/deudas-cash", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("NEXT_PUBLIC_ENABLE_DEUDAS_CASH", "true");
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
	});

	it("PUT detalle rechaza edición después de downgrade", async () => {
		const { hasFeature } = await import("@/lib/services/tenant-scope");
		const prisma = (await import("@/lib/prisma")).default as any;
		vi.mocked(hasFeature).mockReturnValueOnce(false);

		const { PUT } = await import("../[id]/route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash/deuda-1", {
			method: "PUT",
			body: JSON.stringify({ observaciones: "No debe editarse" }),
		});
		const response = await PUT(request, { params: Promise.resolve({ id: "deuda-1" }) });
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.code).toBe("FEATURE_NOT_AVAILABLE");
		expect(prisma.deudaCash.findFirst).not.toHaveBeenCalled();
		expect(prisma.deudaCash.update).not.toHaveBeenCalled();
	});

	it("PUT detalle scopea lookup y escritura al tenant autenticado", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.deudaCash.findFirst.mockResolvedValueOnce({
			id: "deuda-1",
			tenantId: "tenant-1",
			fechaVencimiento: null,
			tasaInteres: 1,
			observaciones: null,
		});
		prisma.deudaCash.update.mockResolvedValueOnce({ id: "deuda-1" });

		const { PUT } = await import("../[id]/route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash/deuda-1", {
			method: "PUT",
			body: JSON.stringify({ observaciones: "Updated" }),
		});
		const response = await PUT(request, { params: Promise.resolve({ id: "deuda-1" }) });

		expect(response.status).toBe(200);
		expect(prisma.deudaCash.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "deuda-1", tenantId: "tenant-1", deletedAt: null } }),
		);
		expect(prisma.deudaCash.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "deuda-1", tenantId: "tenant-1" } }),
		);
	});

	it("GET lista deudas con status 200", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		const mockDeudas = [
			{
				id: "d-1",
				montoCapital: 2000,
				estado: "ACTIVO",
				proveedor: { vendorId: "v-1", nombre: "Vendor Test" },
			},
		];
		prisma.deudaCash.findMany.mockResolvedValue(mockDeudas);
		prisma.deudaCash.count.mockResolvedValue(1);

		const { GET } = await import("../route");
		const { requirePermission } = await import("@/lib/services/tenant-scope");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash",
		);
		const response = await GET(request, {});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.deudas).toHaveLength(1);
		expect(body.pagination.total).toBe(1);
		expect(requirePermission).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "user-test" }),
			"financiero.contabilidad.acceder",
			"consultar deudas cash",
		);
	});

	it("GET devuelve 403 y no consulta cuando falta permiso financiero", async () => {
		const { requirePermission } = await import("@/lib/services/tenant-scope");
		const prisma = (await import("@/lib/prisma")).default as any;
		vi.mocked(requirePermission).mockImplementationOnce(() => {
			throw new ActionError("Forbidden", "FORBIDDEN");
		});

		const { GET } = await import("../route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash");
		const response = await GET(request, {});

		expect(response.status).toBe(403);
		expect(prisma.deudaCash.findMany).not.toHaveBeenCalled();
	});

	it("GET filtra por proveedorId", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.deudaCash.findMany.mockResolvedValue([]);
		prisma.deudaCash.count.mockResolvedValue(0);

		const { GET } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash?proveedorId=v-1",
		);
		await GET(request, {});

		expect(prisma.deudaCash.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ proveedorId: "v-1" }),
			}),
		);
	});

	it("GET devuelve 404 si módulo deshabilitado", async () => {
		vi.stubEnv("NEXT_PUBLIC_ENABLE_DEUDAS_CASH", "false");

		const { GET } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash",
		);
		const response = await GET(request, {});

		expect(response.status).toBe(404);
	});

	it("POST crea deuda con status 201", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		const mockCuenta = { cuentaPorPagarId: "cxp-1" };
		const mockDeuda = {
			id: "d-new",
			montoCapital: 3000,
			moneda: "CUP",
			proveedorId: "v-1",
			proveedor: { vendorId: "v-1", nombre: "Vendor Test" },
			cuentaPorPagar: mockCuenta,
		};

		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service")).AccountingCashOperationsMutationService;
		vi.mocked(service.createCashDebt).mockResolvedValue(mockDeuda as never);

		const { POST } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash",
			{
				method: "POST",
				body: JSON.stringify({
					proveedorId: "v-1",
					montoCapital: 3000,
					moneda: "CUP",
					cuentaBancariaId: "cb-1",
				}),
			},
		);

		const response = await POST(request, {});
		const body = await response.json();

		expect(response.status, JSON.stringify(body)).toBe(201);
		expect(body.deuda.id).toBe("d-new");
		expect(service.createCashDebt).toHaveBeenCalledWith(expect.objectContaining({
			input: expect.objectContaining({ tasaInteresMoratorio: 0, tasaInteres: 0 }),
		}));
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it("POST devuelve 404 si proveedor no existe", async () => {
		const { AccountingCashOperationsMutationService } = await import(
			"@/features/contabilidad/services/accounting-cash-operations-mutation-service"
		);
		vi.mocked(AccountingCashOperationsMutationService.createCashDebt)
			.mockRejectedValue(new ActionError("Proveedor no encontrado", "NOT_FOUND"));

		const { POST } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash",
			{
				method: "POST",
				body: JSON.stringify({
					proveedorId: "v-inexistente",
					montoCapital: 1000,
					moneda: "CUP",
					cuentaBancariaId: "cb-1",
				}),
			},
		);

		const response = await POST(request, {});

		expect(response.status).toBe(404);
	});

	it("POST devuelve 400 con body inválido", async () => {
		const { POST } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash",
			{
				method: "POST",
				body: JSON.stringify({ montoCapital: -5 }),
			},
		);

		const response = await POST(request, {});

		expect(response.status).toBe(400);
	});

	it("POST replays an idempotent debt before checking the closed accounting period", async () => {
		const { AccountingCashOperationsMutationService } = await import(
			"@/features/contabilidad/services/accounting-cash-operations-mutation-service"
		);
		const { validarEscrituraPeriodo } = await import(
			"@/lib/services/validate-period-write"
		);
		const replay = { id: "deuda-existente" };
		vi.mocked(
			AccountingCashOperationsMutationService.findCashDebtCreateReplay,
		).mockResolvedValue(replay as never);

		const { POST } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash",
			{
				method: "POST",
				headers: { "Idempotency-Key": "debt-replay-1" },
				body: JSON.stringify({
					proveedorId: "v-1",
					montoCapital: 3000,
					moneda: "CUP",
					cuentaBancariaId: "cb-1",
				}),
			},
		);

		const response = await POST(request, {});
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ deuda: replay });
		expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
		expect(
			AccountingCashOperationsMutationService.findCashDebtCreateReplay,
		).toHaveBeenCalledWith({
			input: expect.objectContaining({ idempotencyKey: "debt-replay-1" }),
			user: expect.objectContaining({ userId: "user-test" }),
		});
		expect(
			AccountingCashOperationsMutationService.createCashDebt,
		).not.toHaveBeenCalled();
	});

	it("POST replays an existing debt after plan downgrade without creating another debt", async () => {
		const guards = await import("@/lib/services/tenant-scope");
		vi.mocked(guards.requireFeature).mockImplementation(() => {
			throw new ActionError("plan downgraded", "FEATURE_NOT_AVAILABLE");
		});
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService;
		vi.mocked(service.findCashDebtCreateReplay).mockResolvedValue({ id: "existing-debt" } as never);
		const { POST } = await import("../route");
		const response = await POST(new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
			method: "POST",
			headers: { "Idempotency-Key": "existing-debt-key" },
			body: JSON.stringify({ proveedorId: "v-1", montoCapital: 3000, moneda: "CUP", cuentaBancariaId: "cb-1" }),
		}), {});

		expect(response.status).toBe(201);
		expect(service.createCashDebt).not.toHaveBeenCalled();
	});

	it("POST maps a reused idempotency key with a different payload to 409", async () => {
		const { AccountingCashOperationsMutationService } = await import(
			"@/features/contabilidad/services/accounting-cash-operations-mutation-service"
		);
		vi.mocked(AccountingCashOperationsMutationService.findCashDebtCreateReplay)
			.mockRejectedValue(new ActionError("Idempotency conflict", "IDEMPOTENCY_CONFLICT"));

		const { POST } = await import("../route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
			method: "POST",
			headers: { "Idempotency-Key": "conflicting-key" },
			body: JSON.stringify({
				proveedorId: "v-1",
				montoCapital: 3000,
				moneda: "CUP",
				cuentaBancariaId: "cb-1",
			}),
		});

		const response = await POST(request, {});
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
	});

	it("POST creates an idempotent debt after the period gate", async () => {
		const { requireFeature } = await import("@/lib/services/tenant-scope");
		vi.mocked(requireFeature).mockImplementationOnce(() => undefined);
		const { AccountingCashOperationsMutationService } = await import(
			"@/features/contabilidad/services/accounting-cash-operations-mutation-service"
		);
		vi.mocked(AccountingCashOperationsMutationService.createCashDebt)
			.mockResolvedValue({ id: "deuda-creada" } as never);
		vi.mocked(AccountingCashOperationsMutationService.findCashDebtCreateReplay)
			.mockResolvedValue(null as never);

		const { POST } = await import("../route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
			method: "POST",
			headers: { "Idempotency-Key": "create-key-1" },
			body: JSON.stringify({
				proveedorId: "v-1",
				montoCapital: 3000,
				moneda: "CUP",
				cuentaBancariaId: "cb-1",
			}),
		});

		const response = await POST(request, {});
		expect(response.status).toBe(201);
		expect(AccountingCashOperationsMutationService.createCashDebt).toHaveBeenCalledWith({
			input: expect.objectContaining({
				idempotencyKey: "create-key-1",
				tasaInteres: 0,
				tasaInteresMoratorio: 0,
			}),
			user: expect.objectContaining({ userId: "user-test" }),
			operationDate: expect.any(Date),
		});
	});

	it("POST rechecks idempotency after a closed-period rejection", async () => {
		const { requireFeature } = await import("@/lib/services/tenant-scope");
		vi.mocked(requireFeature).mockImplementationOnce(() => undefined);
		const { AccountingCashOperationsMutationService } = await import(
			"@/features/contabilidad/services/accounting-cash-operations-mutation-service"
		);
		const { validarEscrituraPeriodo } = await import(
			"@/lib/services/validate-period-write"
		);
		const { extraerFechaDeBody } = await import(
			"@/lib/services/validate-period-write"
		);
		const replay = { id: "deuda-race-winner" };
		vi.mocked(extraerFechaDeBody).mockReturnValue(undefined);
		vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
			permitido: false,
			error: { message: "Período cerrado", code: "PERIODO_CERRADO" },
		} as never);
		vi.mocked(
			AccountingCashOperationsMutationService.findCashDebtCreateReplay,
		)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(replay as never);

		const { POST } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash",
			{
				method: "POST",
				headers: { "Idempotency-Key": "debt-replay-race" },
				body: JSON.stringify({
					proveedorId: "v-1",
					montoCapital: 3000,
					moneda: "CUP",
					cuentaBancariaId: "cb-1",
				}),
			},
		);

		const response = await POST(request, {});
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ deuda: replay });
		expect(validarEscrituraPeriodo).toHaveBeenCalledWith(
			expect.objectContaining({
				fecha: expect.any(Date),
				tipoOperacion: "deuda_cash",
			}),
		);
		expect(
			AccountingCashOperationsMutationService.findCashDebtCreateReplay,
		).toHaveBeenCalledTimes(2);
		expect(
			AccountingCashOperationsMutationService.createCashDebt,
		).not.toHaveBeenCalled();
	});
});

describe("API contabilidad/deudas-cash/[id]/pagar", () => {
	const mockContext = { params: Promise.resolve({ id: "d-1" }) };
	const payment = {
		monto: 0.0123,
		cuentaId: "cuenta-1",
		tipoPagoId: "tp-1",
		moneda: "USD",
		tasaCambio: 300,
		observaciones: "partial installment",
	};
	const reconciliation = { reconciliacionId: "rec-1", monto: 0.0123, montoConvertido: 3.69 };

	beforeEach(async () => {
		vi.clearAllMocks();
		const guards = await import("@/lib/services/tenant-scope");
		vi.mocked(guards.requireFeature).mockImplementation(() => undefined);
		vi.stubEnv("NEXT_PUBLIC_ENABLE_DEUDAS_CASH", "true");
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService as any;
		service.findCashDebtPaymentReplay.mockResolvedValue(null);
		service.registerCashDebtPayment.mockResolvedValue(reconciliation);
		const period = await import("@/lib/services/validate-period-write");
		vi.mocked(period.validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as any);
	});

	it("writes the 4dp payment through the shared service and preserves the 201 response shape", async () => {
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService as any;
		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash/d-1/pagar", {
			method: "POST",
			body: JSON.stringify({ ...payment, idempotencyKey: "body-key" }),
			headers: { "Idempotency-Key": "header-key" },
		});

		const response = await POST(request, mockContext);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ reconciliacion: reconciliation });
		expect(service.registerCashDebtPayment).toHaveBeenCalledWith({
			input: { id: "d-1", ...payment, idempotencyKey: "body-key" },
			user: expect.objectContaining({ userId: "user-test", tenantId: "tenant-1" }),
		});
	});

	it("allows settlement of an existing debt when the plan feature is unavailable", async () => {
		const guards = await import("@/lib/services/tenant-scope");
		const { ActionError } = await import("@/lib/server-actions");
		vi.mocked(guards.requireFeature).mockImplementation(() => {
			throw new ActionError("plan downgraded", "FEATURE_NOT_AVAILABLE");
		});
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService as any;
		const { POST } = await import("../[id]/pagar/route");
		const response = await POST(new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
			{ method: "POST", body: JSON.stringify(payment) },
		), mockContext);

		expect(response.status).toBe(201);
		expect(service.registerCashDebtPayment).toHaveBeenCalledOnce();
	});

	it("uses the Idempotency-Key header when the request body omits a key", async () => {
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService as any;
		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash/d-1/pagar", {
			method: "POST",
			body: JSON.stringify(payment),
			headers: { "Idempotency-Key": "header-key" },
		});

		await POST(request, mockContext);

		expect(service.registerCashDebtPayment).toHaveBeenCalledWith({
			input: { id: "d-1", ...payment, idempotencyKey: "header-key" },
			user: expect.any(Object),
		});
	});

	it("replays the exact payment before rejecting a closed period", async () => {
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService as any;
		service.findCashDebtPaymentReplay.mockResolvedValue(reconciliation);
		const period = await import("@/lib/services/validate-period-write");
		vi.mocked(period.validarEscrituraPeriodo).mockResolvedValue({
			permitido: false,
			error: { code: "PERIODO_CERRADO", message: "closed" },
		} as any);
		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash/d-1/pagar", {
			method: "POST",
			body: JSON.stringify({ ...payment, idempotencyKey: "same-key" }),
		});

		const response = await POST(request, mockContext);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ reconciliacion: reconciliation });
		expect(period.validarEscrituraPeriodo).not.toHaveBeenCalled();
		expect(service.registerCashDebtPayment).not.toHaveBeenCalled();
	});

	it("blocks new writes when the accounting period is closed", async () => {
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService as any;
		const period = await import("@/lib/services/validate-period-write");
		vi.mocked(period.validarEscrituraPeriodo).mockResolvedValue({
			permitido: false,
			error: { code: "PERIODO_CERRADO", message: "closed" },
		} as any);
		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash/d-1/pagar", {
			method: "POST",
			body: JSON.stringify({ ...payment, idempotencyKey: "new-key" }),
		});

		const response = await POST(request, mockContext);

		expect(response.status).toBe(400);
		expect(service.registerCashDebtPayment).not.toHaveBeenCalled();
	});

	it("returns 409 for changed-payload key reuse and rejects excess precision before lookup", async () => {
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService as any;
		const { ActionError } = await import("@/lib/server-actions");
		service.findCashDebtPaymentReplay.mockRejectedValue(
			new ActionError("key conflict", "IDEMPOTENCY_CONFLICT"),
		);
		const { POST } = await import("../[id]/pagar/route");
		const conflictResponse = await POST(new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
			{ method: "POST", body: JSON.stringify({ ...payment, idempotencyKey: "same-key" }) },
		), mockContext);
		expect(conflictResponse.status).toBe(409);

		service.findCashDebtPaymentReplay.mockClear();
		const precisionResponse = await POST(new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
			{ method: "POST", body: JSON.stringify({ ...payment, monto: 0.01234 }) },
		), mockContext);
		expect(precisionResponse.status).toBe(400);
		expect(service.findCashDebtPaymentReplay).not.toHaveBeenCalled();
		expect(service.registerCashDebtPayment).not.toHaveBeenCalled();
	});

	it("denies a payment before replay when the permission gate fails", async () => {
		const { ActionError } = await import("@/lib/server-actions");
		const guards = await import("@/lib/services/tenant-scope");
		const service = (await import("@/features/contabilidad/services/accounting-cash-operations-mutation-service"))
			.AccountingCashOperationsMutationService as any;
		vi.mocked(guards.requirePermission)
			.mockImplementation(() => { throw new ActionError("denied", "FORBIDDEN"); });
		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash/d-1/pagar", {
			method: "POST",
			body: JSON.stringify({ monto: 0.0123, cuentaId: "cuenta-1", tipoPagoId: "tp-1", idempotencyKey: "denied-key" }),
		});

		const response = await POST(request, mockContext);

		expect(response.status).toBe(403);
		expect(service.findCashDebtPaymentReplay).not.toHaveBeenCalled();
		expect(service.registerCashDebtPayment).not.toHaveBeenCalled();
	});
});
