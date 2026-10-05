import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-middleware", () => {
	const hoisted = (globalThis as any).__testUserDeudas ??= { userId: "user-test", tenantId: "tenant-1", role: 'admin', planFeatures: { 'deudas-cash': true }, permissions: new Set(['financiero.contabilidad.acceder']) };
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
		deudaCash: {
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
			findFirst: vi.fn(),
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
			findFirst: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
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
	AuditLogService: { log: vi.fn(), logStrict: vi.fn() },
}));
const functionalCurrencyMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
)
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  getRequiredTenantAccountingPolicy: functionalCurrencyMock,
}));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn(),
}));
vi.mock("@/features/contabilidad-formal/services/posting-engine", () => ({
	postEvento: vi.fn(),
}));

describe("API contabilidad/deudas-cash", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		functionalCurrencyMock.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		vi.stubEnv("NEXT_PUBLIC_ENABLE_DEUDAS_CASH", "true");
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
	});

	it("POST rechaza 403 sin el permiso contable antes de escribir", async () => {
		const { POST } = await import("../route");
		const usuario = (globalThis as any).__testUserDeudas;
		const permisosPrevios = usuario.permissions;
		const rolePrevio = usuario.role;
		const tenantRolePrevio = usuario.tenantRole;
		usuario.permissions = new Set();
		usuario.role = "user";
		usuario.tenantRole = "dependiente";
		try {
			const prisma = (await import("@/lib/prisma")).default as any;
			const request = new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
				method: "POST",
				body: JSON.stringify({
					proveedorId: "v-1", montoCapital: 1000, moneda: "CUP",
					cuentaBancariaId: "cb-1",
				}),
			});
			const response = await POST(request, {});
			expect(response.status).toBe(403);
			expect(prisma.$transaction).not.toHaveBeenCalled();
			expect(prisma.deudaCash.create).not.toHaveBeenCalled();
		} finally {
			usuario.permissions = permisosPrevios;
			usuario.role = rolePrevio;
			usuario.tenantRole = tenantRolePrevio;
		}
	});

	it("POST de pago rechaza 403 sin el permiso contable antes de consultar la deuda", async () => {
		const { POST } = await import("../[id]/pagar/route");
		const usuario = (globalThis as any).__testUserDeudas;
		const permisosPrevios = usuario.permissions;
		const rolePrevio = usuario.role;
		const tenantRolePrevio = usuario.tenantRole;
		usuario.permissions = new Set();
		usuario.role = "user";
		usuario.tenantRole = "dependiente";
		try {
			const prisma = (await import("@/lib/prisma")).default as any;
			const response = await POST(new NextRequest(
				"http://localhost/api/contabilidad/deudas-cash/d-1/pagar", {
					method: "POST",
					body: JSON.stringify({ monto: 100, cuentaId: "cb-1", tipoPagoId: "tp-1" }),
				}), { params: Promise.resolve({ id: "d-1" }) });

			expect(response.status).toBe(403);
			expect(prisma.deudaCash.findFirst).not.toHaveBeenCalled();
			expect(prisma.cuentaBancaria.findFirst).not.toHaveBeenCalled();
			expect(prisma.$transaction).not.toHaveBeenCalled();
		} finally {
			usuario.permissions = permisosPrevios;
			usuario.role = rolePrevio;
			usuario.tenantRole = tenantRolePrevio;
		}
	});

	it("POST de pago rechaza un plan sin feature antes de consultar la deuda", async () => {
		const { POST } = await import("../[id]/pagar/route");
		const usuario = (globalThis as any).__testUserDeudas;
		const featuresPrevios = usuario.planFeatures;
		const rolePrevio = usuario.role;
		const tenantRolePrevio = usuario.tenantRole;
		usuario.planFeatures = {};
		usuario.role = "user";
		usuario.tenantRole = "manager";
		try {
			const prisma = (await import("@/lib/prisma")).default as any;
			const response = await POST(new NextRequest(
				"http://localhost/api/contabilidad/deudas-cash/d-1/pagar", {
					method: "POST",
					body: JSON.stringify({ monto: 100, cuentaId: "cb-1", tipoPagoId: "tp-1" }),
				}), { params: Promise.resolve({ id: "d-1" }) });

			expect(response.status).toBe(403);
			expect((await response.json()).code).toBe('FEATURE_NOT_AVAILABLE');
			expect(prisma.deudaCash.findFirst).not.toHaveBeenCalled();
		} finally {
			usuario.planFeatures = featuresPrevios;
			usuario.role = rolePrevio;
			usuario.tenantRole = tenantRolePrevio;
		}
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
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash",
		);
		const response = await GET(request);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.deudas).toHaveLength(1);
		expect(body.pagination.total).toBe(1);
	});

	it("GET filtra por proveedorId", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.deudaCash.findMany.mockResolvedValue([]);
		prisma.deudaCash.count.mockResolvedValue(0);

		const { GET } = await import("../route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash?proveedorId=v-1",
		);
		await GET(request);

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
		const response = await GET(request);

		expect(response.status).toBe(404);
	});

	it("POST crea deuda con status 201", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;

		prisma.vendor.findUnique.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.vendor.findFirst.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: "cb-1",
			moneda: "CUP",
			isActive: true,
		});
		prisma.tipoPago.findFirst.mockResolvedValue({
			tipoId: "tp-transferencia",
			nombre: "Transferencia",
		});

		const mockCuenta = { cuentaPorPagarId: "cxp-1" };
		const mockDeuda = {
			id: "d-new",
			montoCapital: 3000,
			moneda: "CUP",
			proveedorId: "v-1",
			proveedor: { vendorId: "v-1", nombre: "Vendor Test" },
			cuentaPorPagar: mockCuenta,
		};

		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				tipoPago: {
					findFirst: vi
						.fn()
						.mockResolvedValue({
							tipoId: "tp-transferencia",
							nombre: "Transferencia",
						}),
				},
				deudaCash: {
					findFirst: vi.fn().mockResolvedValue({ idNumerico: 5 }),
					create: vi.fn().mockResolvedValue(mockDeuda),
				},
				cuentaPorPagar: { create: vi.fn().mockResolvedValue(mockCuenta) },
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-deuda-1",
						monto: 3000,
						moneda: "CUP",
						montoConvertido: 3000,
						tasaCambio: 1,
						fxEvidenceFingerprint: "fp-cup-1",
						fechaReconciliacion: new Date(),
					}),
				},
			};
			return callback(tx);
		});

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

		expect(response.status).toBe(201);
		expect(body.deuda.id).toBe("d-new");
	});

	it("POST devuelve 404 si proveedor no existe", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.vendor.findUnique.mockResolvedValue(null);
		prisma.vendor.findFirst.mockResolvedValue(null);

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

	// ── R0.5/R6 fila 15: hook único por origen, referencias tenant-scoped y FX ──

	it("POST crea deuda CUP y llama postEvento una vez con valoración desde la fila persistida", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.vendor.findUnique.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.vendor.findFirst.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: "cb-1",
			moneda: "CUP",
			isActive: true,
		});
		prisma.tipoPago.findFirst.mockResolvedValue({
			tipoId: "tp-transferencia",
			nombre: "Transferencia",
		});
		const mockDeuda = {
			id: "d-new",
			montoCapital: 3000,
			moneda: "CUP",
			proveedorId: "v-1",
			proveedor: { vendorId: "v-1", nombre: "Vendor Test" },
			cuentaPorPagar: { cuentaPorPagarId: "cxp-1" },
		};
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				tipoPago: {
					findFirst: vi
						.fn()
						.mockResolvedValue({
							tipoId: "tp-transferencia",
							nombre: "Transferencia",
						}),
				},
				deudaCash: {
					findFirst: vi.fn().mockResolvedValue({ idNumerico: 5 }),
					create: vi.fn().mockResolvedValue(mockDeuda),
				},
				cuentaPorPagar: {
					create: vi.fn().mockResolvedValue({ cuentaPorPagarId: "cxp-1" }),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-deuda-1",
						monto: 3000,
						moneda: "CUP",
						montoConvertido: 3000,
						tasaCambio: 1,
						fxEvidenceFingerprint: "fp-cup-1",
						fechaReconciliacion: new Date("2026-09-25T12:00:00.000Z"),
					}),
				},
			};
			return callback(tx);
		});

		const { POST } = await import("../route");
		const response = await POST(
			new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
				method: "POST",
				body: JSON.stringify({
					proveedorId: "v-1",
					montoCapital: 3000,
					moneda: "CUP",
					cuentaBancariaId: "cb-1",
				}),
			}),
			{},
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.deuda.id).toBe("d-new");
		const { postEvento } = await import(
			"@/features/contabilidad-formal/services/posting-engine"
		);
		expect(postEvento).toHaveBeenCalledTimes(1);
		expect(postEvento).toHaveBeenCalledWith(
			expect.anything(),
			{ tenantId: "tenant-1", userId: "user-test" },
			expect.objectContaining({
				tipo: "DEUDA_RECIBIDA",
				origen: { tipo: "deuda_cash", id: "d-new" },
				monto: 3000,
				montoFuncional: 3000,
				tasaCambio: 1,
				fxEvidenceFingerprint: "fp-cup-1",
			}),
		);
	});

	it("POST rechaza proveedor de otro tenant antes de abrir transacción", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		// Emula aislamiento: el proveedor pertenece a otro tenant; la búsqueda
		// tenant-scoped no lo encuentra. findUnique devolvería el proveedor ajeno.
		prisma.vendor.findFirst.mockResolvedValue(null);
		prisma.vendor.findUnique.mockResolvedValue({
			nombre: "Vendor Otro Tenant",
		});
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: "cb-1",
			moneda: "CUP",
			isActive: true,
		});
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				tipoPago: {
					findFirst: vi
						.fn()
						.mockResolvedValue({ tipoId: "tp", nombre: "Transferencia" }),
				},
				deudaCash: {
					findFirst: vi.fn().mockResolvedValue({ idNumerico: 1 }),
					create: vi.fn().mockResolvedValue({ id: "d-otro" }),
				},
				cuentaPorPagar: {
					create: vi.fn().mockResolvedValue({ cuentaPorPagarId: "cxp-1" }),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-1",
						monto: 1000,
						moneda: "CUP",
						montoConvertido: 1000,
						tasaCambio: 1,
						fxEvidenceFingerprint: "fp-1",
						fechaReconciliacion: new Date(),
					}),
				},
			};
			return callback(tx);
		});

		const { POST } = await import("../route");
		const response = await POST(
			new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
				method: "POST",
				body: JSON.stringify({
					proveedorId: "v-otro",
					montoCapital: 1000,
					moneda: "CUP",
					cuentaBancariaId: "cb-1",
				}),
			}),
			{},
		);

		expect(response.status).toBe(404);
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(prisma.vendor.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ tenantId: "tenant-1" }),
			}),
		);
	});

	it("POST rechaza cuenta bancaria de otro tenant antes de abrir transacción", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.vendor.findUnique.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.vendor.findFirst.mockResolvedValue({ nombre: "Vendor Test" });
		// Emula aislamiento: la cuenta pertenece a otro tenant; la búsqueda
		// tenant-scoped no la encuentra.
		prisma.cuentaBancaria.findFirst.mockResolvedValue(null);
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				tipoPago: {
					findFirst: vi
						.fn()
						.mockResolvedValue({ tipoId: "tp", nombre: "Transferencia" }),
				},
				deudaCash: {
					findFirst: vi.fn().mockResolvedValue({ idNumerico: 1 }),
					create: vi.fn().mockResolvedValue({ id: "d-otra" }),
				},
				cuentaPorPagar: {
					create: vi.fn().mockResolvedValue({ cuentaPorPagarId: "cxp-1" }),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-1",
						monto: 1000,
						moneda: "CUP",
						montoConvertido: 1000,
						tasaCambio: 1,
						fxEvidenceFingerprint: "fp-1",
						fechaReconciliacion: new Date(),
					}),
				},
			};
			return callback(tx);
		});

		const { POST } = await import("../route");
		const response = await POST(
			new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
				method: "POST",
				body: JSON.stringify({
					proveedorId: "v-1",
					montoCapital: 1000,
					moneda: "CUP",
					cuentaBancariaId: "cb-otra",
				}),
			}),
			{},
		);

		expect(response.status).toBe(400);
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ tenantId: "tenant-1" }),
			}),
		);
	});

	it("POST FX extranjera sin tasa falla cerrada antes de abrir transacción", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.vendor.findUnique.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.vendor.findFirst.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: "cb-1",
			moneda: "CUP",
			isActive: true,
		});
		prisma.tipoPago.findFirst.mockResolvedValue({
			tipoId: "tp",
			nombre: "Transferencia",
		});
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				tipoPago: {
					findFirst: vi
						.fn()
						.mockResolvedValue({ tipoId: "tp", nombre: "Transferencia" }),
				},
				deudaCash: {
					findFirst: vi.fn().mockResolvedValue({ idNumerico: 1 }),
					create: vi.fn().mockResolvedValue({ id: "d-usd" }),
				},
				cuentaPorPagar: {
					create: vi.fn().mockResolvedValue({ cuentaPorPagarId: "cxp-1" }),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-usd",
						monto: 3000,
						moneda: "USD",
						fechaReconciliacion: new Date(),
					}),
				},
			};
			return callback(tx);
		});

		const { POST } = await import("../route");
		const response = await POST(
			new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
				method: "POST",
				body: JSON.stringify({
					proveedorId: "v-1",
					montoCapital: 3000,
					moneda: "USD",
					cuentaBancariaId: "cb-1",
				}),
			}),
			{},
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.code).toBe("FX_INSUFICIENTE");
	});

	it("POST FX extranjera con tasa persiste evidencia y hereda valoración en el evento", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.vendor.findUnique.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.vendor.findFirst.mockResolvedValue({ nombre: "Vendor Test" });
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: "cb-1",
			moneda: "CUP",
			isActive: true,
		});
		prisma.tipoPago.findFirst.mockResolvedValue({
			tipoId: "tp",
			nombre: "Transferencia",
		});
		const mockDeuda = {
			id: "d-usd",
			montoCapital: 3000,
			moneda: "USD",
			proveedorId: "v-1",
			proveedor: { vendorId: "v-1", nombre: "Vendor Test" },
			cuentaPorPagar: { cuentaPorPagarId: "cxp-1" },
		};
		const recCreate = vi.fn().mockResolvedValue({
			reconciliacionId: "rec-usd-1",
			monto: 3000,
			moneda: "USD",
			montoConvertido: 360000,
			tasaCambio: 120,
			fxEvidenceFingerprint: "fp-usd-1",
			fechaReconciliacion: new Date("2026-09-25T12:00:00.000Z"),
		});
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				tipoPago: {
					findFirst: vi
						.fn()
						.mockResolvedValue({ tipoId: "tp", nombre: "Transferencia" }),
				},
				deudaCash: {
					findFirst: vi.fn().mockResolvedValue({ idNumerico: 1 }),
					create: vi.fn().mockResolvedValue(mockDeuda),
				},
				cuentaPorPagar: {
					create: vi.fn().mockResolvedValue({ cuentaPorPagarId: "cxp-1" }),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: { create: recCreate },
			};
			return callback(tx);
		});

		const { POST } = await import("../route");
		const response = await POST(
			new NextRequest("http://localhost/api/contabilidad/deudas-cash", {
				method: "POST",
				body: JSON.stringify({
					proveedorId: "v-1",
					montoCapital: 3000,
					moneda: "USD",
					tasaCambio: 120,
					cuentaBancariaId: "cb-1",
				}),
			}),
			{},
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.deuda.id).toBe("d-usd");
		// La reconciliación persistida conserva la evidencia FX explícita.
		const reconciliation = recCreate.mock.calls[0]?.[0].data;
		expect(Number(reconciliation.tasaCambio)).toBe(120);
		expect(Number(reconciliation.montoConvertido)).toBe(360000);
		expect(reconciliation.fxEvidenceFingerprint).toEqual(expect.any(String));
		const { postEvento } = await import(
			"@/features/contabilidad-formal/services/posting-engine"
		);
		expect(postEvento).toHaveBeenCalledTimes(1);
		expect(postEvento).toHaveBeenCalledWith(
			expect.anything(),
			{ tenantId: "tenant-1", userId: "user-test" },
			expect.objectContaining({
				tipo: "DEUDA_RECIBIDA",
				origen: { tipo: "deuda_cash", id: "d-usd" },
				monto: 3000,
				montoFuncional: 360000,
				tasaCambio: 120,
				fxEvidenceFingerprint: "fp-usd-1",
			}),
		);
	});

	it('usa moneda funcional MLC y acredita una cuenta MLC con el importe convertido', async () => {
		const prisma = (await import('@/lib/prisma')).default as any;
		functionalCurrencyMock.mockResolvedValue({ functionalCurrencyCode: 'MLC' });
		prisma.vendor.findFirst.mockResolvedValue({ nombre: 'Vendor MLC' });
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: 'cb-mlc', moneda: 'MLC', isActive: true,
		});
		prisma.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tp-mlc', nombre: 'Transferencia' });
		const recCreate = vi.fn().mockImplementation(async ({ data }) => ({
			reconciliacionId: 'rec-mlc', ...data,
		}));
		const accountUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
		prisma.$transaction.mockImplementation(async (callback: any) => callback({
			deudaCash: {
				findFirst: vi.fn().mockResolvedValue({ idNumerico: 0 }),
				create: vi.fn().mockResolvedValue({
					id: 'deuda-mlc', proveedorId: 'v-1', montoCapital: 100, moneda: 'USD',
					proveedor: { vendorId: 'v-1', nombre: 'Vendor MLC' },
					cuentaPorPagar: { cuentaPorPagarId: 'cxp-mlc' },
				}),
			},
			cuentaPorPagar: { create: vi.fn().mockResolvedValue({ cuentaPorPagarId: 'cxp-mlc' }) },
			cuentaBancaria: { updateMany: accountUpdateMany },
			reconciliacionVenta: { create: recCreate },
			tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-mlc' }) },
		}));

		const { POST } = await import('../route');
		const response = await POST(new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
			method: 'POST',
			body: JSON.stringify({
				proveedorId: 'v-1', montoCapital: 100, moneda: 'USD', tasaCambio: 2.5,
				cuentaBancariaId: 'cb-mlc',
			}),
		}), {});

		expect(response.status, await response.clone().text()).toBe(201);
		const reconciliation = recCreate.mock.calls[0]?.[0].data;
		expect(reconciliation.functionalCurrency).toBe('MLC');
		expect(reconciliation.montoConvertido.toString()).toBe('250');
		expect(reconciliation.montoCuenta.toString()).toBe('250');
		expect(reconciliation.monedaCuenta).toBe('MLC');
		expect(accountUpdateMany).toHaveBeenCalledOnce();
		expect(accountUpdateMany.mock.calls[0]?.[0].data.saldo.increment.toString()).toBe('250');
		// F1: el evento hereda la moneda funcional del tenant, sin caer a CUP.
		const { postEvento } = await import(
			'@/features/contabilidad-formal/services/posting-engine'
		);
		const eventoArg = (postEvento as any).mock.calls[0][2];
		expect(eventoArg.monedaFuncional).toBe('MLC');
		expect(eventoArg.montoFuncional.toString()).toBe('250');
		expect(eventoArg.tasaCambio.toString()).toBe('2.5');
	});
});

	describe("API contabilidad/deudas-cash/[id]/pagar", () => {
	const mockContext = { params: Promise.resolve({ id: "d-1" }) };

	beforeEach(() => {
		vi.clearAllMocks();
		functionalCurrencyMock.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		vi.stubEnv("NEXT_PUBLIC_ENABLE_DEUDAS_CASH", "true");
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
	});

	it("POST registra pago parcial con status 201", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;

		const mockDeuda = {
			id: "d-1",
			tenantId: "tenant-1",
			estado: "ACTIVO",
			moneda: "CUP",
			cuentaPorPagarId: "cxp-1",
			cuentaPorPagar: {
				montoDeuda: 2000,
				montoPagado: 0,
				saldoPendiente: 2000,
				moneda: "CUP",
				estado: "PENDIENTE",
			},
			cuentaBancariaId: "cb-1",
		};
		const mockReconciliacion = {
			reconciliacionId: "rec-1",
			monto: 1000,
			moneda: "CUP",
			montoConvertido: 1000,
			tasaCambio: 1,
			fxEvidenceFingerprint: "fp-pago-1",
			fechaReconciliacion: new Date("2026-09-25T12:00:00.000Z"),
		};

		prisma.deudaCash.findFirst.mockResolvedValue(mockDeuda);
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: "cuenta-1",
			moneda: "CUP",
			isActive: true,
		});
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				$executeRaw: vi.fn(),
				tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-1' }) },
				deudaCash: {
					findFirst: vi.fn().mockResolvedValue(mockDeuda),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue(mockReconciliacion),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				cuentaPorPagar: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
			};
			return callback(tx);
		});

		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
			{
				method: "POST",
				body: JSON.stringify({
					monto: 1000,
					cuentaId: "cuenta-1",
					tipoPagoId: "tp-1",
				}),
			},
		);

		const response = await POST(request, mockContext);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.reconciliacion.reconciliacionId).toBe("rec-1");
	});

	it("POST devuelve 404 si deuda no existe", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.deudaCash.findFirst.mockResolvedValue(null);

		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
			{
				method: "POST",
				body: JSON.stringify({
					monto: 100,
					cuentaId: "cuenta-1",
					tipoPagoId: "tp-1",
				}),
			},
		);

		const response = await POST(request, mockContext);

		expect(response.status).toBe(404);
	});

	it("POST devuelve 400 si deuda ya está pagada", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.deudaCash.findFirst.mockResolvedValue({
			id: "d-1",
			estado: "PAGADO",
			cuentaPorPagar: {
				montoDeuda: 2000,
				montoPagado: 2000,
				saldoPendiente: 0,
			},
		});

		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
			{
				method: "POST",
				body: JSON.stringify({
					monto: 100,
					cuentaId: "cuenta-1",
					tipoPagoId: "tp-1",
				}),
			},
		);

		const response = await POST(request, mockContext);

		expect(response.status).toBe(400);
	});

	it("POST devuelve 400 si monto excede saldo", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		prisma.deudaCash.findFirst.mockResolvedValue({
			id: "d-1",
			estado: "ACTIVO",
			cuentaPorPagar: {
				montoDeuda: 2000,
				montoPagado: 1800,
				saldoPendiente: 200,
			},
		});

		const { POST } = await import("../[id]/pagar/route");
		const request = new NextRequest(
			"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
			{
				method: "POST",
				body: JSON.stringify({
					monto: 500,
					cuentaId: "cuenta-1",
					tipoPagoId: "tp-1",
				}),
			},
		);

		const response = await POST(request, mockContext);

		expect(response.status).toBe(400);
	});

	// ── R0.5/R6 fila 16: hook único por origen, referencias tenant-scoped y FX ──

	it("POST registra pago y llama postEvento una vez con valoración desde la fila persistida", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		const mockDeuda = {
			id: "d-1",
			tenantId: "tenant-1",
			estado: "ACTIVO",
			moneda: "CUP",
			cuentaPorPagarId: "cxp-1",
			cuentaPorPagar: {
				montoDeuda: 2000,
				montoPagado: 0,
				saldoPendiente: 2000,
				moneda: "CUP",
				estado: "PENDIENTE",
			},
			cuentaBancariaId: "cb-1",
		};
		prisma.deudaCash.findFirst.mockResolvedValue(mockDeuda);
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: "cuenta-1",
			moneda: "CUP",
			isActive: true,
		});
		const recCreate = vi.fn().mockResolvedValue({
			reconciliacionId: "rec-pago-1",
			monto: 1000,
			moneda: "CUP",
			montoConvertido: 1000,
			tasaCambio: 1,
			fxEvidenceFingerprint: "fp-pago-1",
			fechaReconciliacion: new Date("2026-09-25T12:00:00.000Z"),
		});
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				$executeRaw: vi.fn(),
				tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-1' }) },
				deudaCash: {
					findFirst: vi.fn().mockResolvedValue(mockDeuda),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: { create: recCreate },
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				cuentaPorPagar: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
			};
			return callback(tx);
		});

		const { POST } = await import("../[id]/pagar/route");
		const response = await POST(
			new NextRequest(
				"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
				{
					method: "POST",
					body: JSON.stringify({
						monto: 1000,
						cuentaId: "cuenta-1",
						tipoPagoId: "tp-1",
					}),
				},
			),
			mockContext,
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.reconciliacion.reconciliacionId).toBe("rec-pago-1");
		const { postEvento } = await import(
			"@/features/contabilidad-formal/services/posting-engine"
		);
		expect(postEvento).toHaveBeenCalledTimes(1);
		expect(postEvento).toHaveBeenCalledWith(
			expect.anything(),
			{ tenantId: "tenant-1", userId: "user-test" },
			expect.objectContaining({
				tipo: "PAGO_DEUDA",
				origen: { tipo: "reconciliacion_venta", id: "rec-pago-1" },
				monto: 1000,
				montoFuncional: 1000,
				tasaCambio: 1,
				monedaFuncional: "CUP",
				fxEvidenceFingerprint: "fp-pago-1",
			}),
		);
	});

	it("POST rechaza deuda de otro tenant con búsqueda tenant-scoped", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		const mockDeudaOtroTenant = {
			id: "d-1",
			tenantId: "tenant-2",
			estado: "ACTIVO",
			moneda: "CUP",
			cuentaPorPagarId: "cxp-2",
			cuentaPorPagar: {
				montoDeuda: 2000,
				montoPagado: 0,
				saldoPendiente: 2000,
			},
		};
		// Emula aislamiento: la deuda pertenece a tenant-2; la búsqueda con
		// tenant-1 no la encuentra. Sin filtro, el canal la pagaría.
		prisma.deudaCash.findFirst.mockImplementation(async (args: any) => {
			const where = args?.where ?? {};
			if (where.tenantId && where.tenantId !== "tenant-2") return null;
			return mockDeudaOtroTenant;
		});
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-x",
						monto: 100,
						moneda: "CUP",
						montoConvertido: 100,
						tasaCambio: 1,
						fxEvidenceFingerprint: "fp-x",
						fechaReconciliacion: new Date(),
					}),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				cuentaPorPagar: { update: vi.fn() },
				deudaCash: { update: vi.fn() },
			};
			return callback(tx);
		});

		const { POST } = await import("../[id]/pagar/route");
		const response = await POST(
			new NextRequest(
				"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
				{
					method: "POST",
					body: JSON.stringify({
						monto: 100,
						cuentaId: "cuenta-1",
						tipoPagoId: "tp-1",
					}),
				},
			),
			mockContext,
		);

		expect(response.status).toBe(404);
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(prisma.deudaCash.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ tenantId: "tenant-1" }),
			}),
		);
	});

	it("POST rechaza cuenta bancaria de otro tenant antes de abrir transacción", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		const mockDeuda = {
			id: "d-1",
			tenantId: "tenant-1",
			estado: "ACTIVO",
			moneda: "CUP",
			cuentaPorPagarId: "cxp-1",
			cuentaPorPagar: {
				montoDeuda: 2000,
				montoPagado: 0,
				saldoPendiente: 2000,
			},
		};
		prisma.deudaCash.findFirst.mockResolvedValue(mockDeuda);
		// Emula aislamiento: la cuenta pertenece a otro tenant.
		prisma.cuentaBancaria.findFirst.mockResolvedValue(null);
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-x",
						monto: 100,
						moneda: "CUP",
						montoConvertido: 100,
						tasaCambio: 1,
						fxEvidenceFingerprint: "fp-x",
						fechaReconciliacion: new Date(),
					}),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				cuentaPorPagar: { update: vi.fn() },
				deudaCash: { update: vi.fn() },
			};
			return callback(tx);
		});

		const { POST } = await import("../[id]/pagar/route");
		const response = await POST(
			new NextRequest(
				"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
				{
					method: "POST",
					body: JSON.stringify({
						monto: 100,
						cuentaId: "cuenta-otra",
						tipoPagoId: "tp-1",
					}),
				},
			),
			mockContext,
		);

		expect(response.status).toBe(400);
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ tenantId: "tenant-1" }),
			}),
		);
	});

	it("POST FX extranjera sin tasa falla cerrada antes de abrir transacción", async () => {
		const prisma = (await import("@/lib/prisma")).default as any;
		const mockDeuda = {
			id: "d-1",
			tenantId: "tenant-1",
			estado: "ACTIVO",
			moneda: "USD",
			cuentaPorPagarId: "cxp-1",
			cuentaPorPagar: {
				montoDeuda: 2000,
				montoPagado: 0,
				saldoPendiente: 2000,
			},
		};
		prisma.deudaCash.findFirst.mockResolvedValue(mockDeuda);
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: "cuenta-1",
			isActive: true,
		});
		prisma.$transaction.mockImplementation(async (callback: any) => {
			const tx = {
				reconciliacionVenta: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-usd",
						monto: 1000,
						moneda: "USD",
						fechaReconciliacion: new Date(),
					}),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				cuentaPorPagar: { update: vi.fn() },
				deudaCash: { update: vi.fn() },
			};
			return callback(tx);
		});

		const { POST } = await import("../[id]/pagar/route");
		const response = await POST(
			new NextRequest(
				"http://localhost/api/contabilidad/deudas-cash/d-1/pagar",
				{
					method: "POST",
					body: JSON.stringify({
						monto: 1000,
						cuentaId: "cuenta-1",
						tipoPagoId: "tp-1",
					}),
				},
			),
			mockContext,
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.code).toBe("FX_INSUFICIENTE");
	});

	it('valora en MLC el pago web USD y registra el delta nativo de la cuenta', async () => {
		const prisma = (await import('@/lib/prisma')).default as any;
		functionalCurrencyMock.mockResolvedValue({ functionalCurrencyCode: 'MLC' });
		const deuda = {
			id: 'deuda-mlc', tenantId: 'tenant-1', estado: 'ACTIVO', moneda: 'USD',
			cuentaPorPagarId: 'cxp-mlc',
			cuentaPorPagar: {
				cuentaPorPagarId: 'cxp-mlc', montoDeuda: 100, montoPagado: 0,
				saldoPendiente: 100, moneda: 'USD', estado: 'PENDIENTE',
			},
		};
		prisma.deudaCash.findFirst.mockResolvedValue(deuda);
		prisma.cuentaBancaria.findFirst.mockResolvedValue({
			cuentaId: 'cb-mlc', moneda: 'MLC', isActive: true,
		});
		const reconciliationCreate = vi.fn().mockImplementation(async ({ data }) => ({
			reconciliacionId: 'rec-mlc-pay', ...data,
		}));
		const accountUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
		prisma.$transaction.mockImplementation(async (callback: any) => callback({
			deudaCash: { findFirst: vi.fn().mockResolvedValue(deuda), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
			tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-mlc', isActive: true }) },
			cuentaBancaria: { updateMany: accountUpdateMany },
			reconciliacionVenta: { create: reconciliationCreate },
			cuentaPorPagar: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
		}));

		const { POST } = await import('../[id]/pagar/route');
		const response = await POST(new NextRequest(
			'http://localhost/api/contabilidad/deudas-cash/deuda-mlc/pagar', {
				method: 'POST',
				body: JSON.stringify({
					monto: 10, cuentaId: 'cb-mlc', tipoPagoId: 'tp-mlc',
					moneda: 'USD', tasaCambio: 2.5,
				}),
			}), { params: Promise.resolve({ id: 'deuda-mlc' }) });

		expect(response.status, await response.clone().text()).toBe(201);
		const reconciliation = reconciliationCreate.mock.calls[0]?.[0].data;
		expect(reconciliation.functionalCurrency).toBe('MLC');
		expect(reconciliation.montoConvertido.toString()).toBe('25');
		expect(reconciliation.montoCuenta.toString()).toBe('25');
		expect(reconciliation.monedaCuenta).toBe('MLC');
		expect(accountUpdateMany).toHaveBeenCalledOnce();
		expect(accountUpdateMany.mock.calls[0]?.[0].data.saldo.decrement.toString()).toBe('25');
	});
});
