import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconciliarGastoAction } from "@/features/contabilidad/actions-reconciliacion";

const prismaMock = vi.hoisted(() => ({
	$transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	prisma: prismaMock,
}));

const getCurrentUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server-actions/get-current-user", () => ({
	getCurrentUser: getCurrentUserMock,
}));

const workflowMock = vi.hoisted(() => ({
	applyPagoGastoWorkflow: vi.fn(),
	isGastoWorkflowError: vi.fn((error: unknown) => {
		const candidate = error as { status?: unknown; code?: unknown } | null;
		return Boolean(
			candidate &&
				typeof candidate === "object" &&
				typeof candidate.status === "number" &&
				typeof candidate.code === "string",
		);
	}),
}));

vi.mock("@/lib/services/pago-gastos-workflow", () => ({
	applyPagoGastoWorkflow: workflowMock.applyPagoGastoWorkflow,
	isGastoWorkflowError: workflowMock.isGastoWorkflowError,
}));

vi.mock("@/lib/services/periodo-contable-guard", () => ({
	PeriodoGuard: vi.fn().mockImplementation(() => ({
		verificarEscritura: vi.fn().mockResolvedValue({
			permitido: true,
			error: null,
			codigo: null,
		}),
	})),
	getGuardConfigExtended: vi.fn().mockReturnValue({
		mode: "enforce",
		enabled: true,
		auditLogPath: null,
		bypassSuperAdmin: false,
		bypassRoles: [],
	}),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

const AUTH_USER = {
	userId: "user-1",
	tenantId: "tenant-1",
	name: "Test",
	email: "test@test.com",
	role: "ADMIN" as const,
	isActive: true,
};

describe("Cuentas por Pagar — reconciliarGastoAction (flujo real)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserMock.mockResolvedValue(AUTH_USER);
	});

	it("1. Pago total simple → PAGADA, saldo 0", async () => {
		const workflowResult = {
			reconciliaciones: [
				{
					reconciliacionId: "rec-1",
					cuentaId: "cb-1",
					monto: 100,
					moneda: "CUP",
					montoConvertido: 100,
					descripcion: "Pago FAC-001",
				},
			],
			cuentaPorPagar: {
				cuentaPorPagarId: "cxp-1",
				estado: "PAGADA" as const,
				montoPagado: 100,
				saldoPendiente: 0,
			},
			pagoCuentaPorPagar: {
				pagoCuentaPorPagarId: "pago-1",
				numeroTransaccion: "TRX-001",
				monto: 100,
			},
		};

		workflowMock.applyPagoGastoWorkflow.mockResolvedValue(workflowResult);
		prismaMock.$transaction.mockImplementation(async (cb: any) => cb({}));

		const result = await reconciliarGastoAction({
			gastoCompraId: "gc-1",
			cuentaId: "cb-1",
			tipoPagoId: "tp-1",
			monto: 100,
			moneda: "CUP",
			descripcion: "Pago FAC-001",
			cuentaPorPagarId: "cxp-1",
		});

		expect(result.success).toBe(true);
		expect(workflowMock.applyPagoGastoWorkflow).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				cuentaPorPagarId: "cxp-1",
				monto: 100,
				tipoGasto: "compra",
				referenciaId: "gc-1",
			}),
		);
		const data = JSON.parse(JSON.stringify(result.data));
		expect(data.cuentaPorPagar.estado).toBe("PAGADA");
		expect(data.cuentaPorPagar.saldoPendiente).toBe(0);
	});

	it("2. Pago parcial → PARCIAL, saldo > 0", async () => {
		const workflowResult = {
			reconciliaciones: [
				{
					reconciliacionId: "rec-2",
					cuentaId: "cb-1",
					monto: 50,
					moneda: "CUP",
					montoConvertido: 50,
					descripcion: "Pago parcial FAC-002",
				},
			],
			cuentaPorPagar: {
				cuentaPorPagarId: "cxp-2",
				estado: "PARCIAL" as const,
				montoPagado: 50,
				saldoPendiente: 50,
			},
			pagoCuentaPorPagar: {
				pagoCuentaPorPagarId: "pago-2",
				numeroTransaccion: "TRX-002",
				monto: 50,
			},
		};

		workflowMock.applyPagoGastoWorkflow.mockResolvedValue(workflowResult);
		prismaMock.$transaction.mockImplementation(async (cb: any) => cb({}));

		const result = await reconciliarGastoAction({
			gastoCompraId: "gc-2",
			cuentaId: "cb-1",
			tipoPagoId: "tp-1",
			monto: 50,
			moneda: "CUP",
			descripcion: "Pago parcial FAC-002",
			cuentaPorPagarId: "cxp-2",
		});

		expect(result.success).toBe(true);
		const data = JSON.parse(JSON.stringify(result.data));
		expect(data.cuentaPorPagar.estado).toBe("PARCIAL");
		expect(data.cuentaPorPagar.saldoPendiente).toBe(50);
		expect(data.cuentaPorPagar.montoPagado).toBe(50);
	});

	it("3. Pago multi-cuenta (2 distribuciones)", async () => {
		const workflowResult = {
			reconciliaciones: [
				{
					reconciliacionId: "rec-3a",
					cuentaId: "cb-1",
					monto: 60,
					moneda: "CUP",
					montoConvertido: 60,
					descripcion: "Pago FAC-003 (cuenta 1)",
				},
				{
					reconciliacionId: "rec-3b",
					cuentaId: "cb-2",
					monto: 40,
					moneda: "CUP",
					montoConvertido: 40,
					descripcion: "Pago FAC-003 (cuenta 2)",
				},
			],
			cuentaPorPagar: {
				cuentaPorPagarId: "cxp-3",
				estado: "PAGADA" as const,
				montoPagado: 100,
				saldoPendiente: 0,
			},
			pagoCuentaPorPagar: {
				pagoCuentaPorPagarId: "pago-3",
				numeroTransaccion: "TRX-003",
				monto: 100,
			},
		};

		workflowMock.applyPagoGastoWorkflow.mockResolvedValue(workflowResult);
		prismaMock.$transaction.mockImplementation(async (cb: any) => cb({}));

		const result = await reconciliarGastoAction({
			gastoCompraId: "gc-3",
			cuentaId: "cb-1",
			tipoPagoId: "tp-1",
			monto: 100,
			moneda: "CUP",
			descripcion: "Pago FAC-003",
			cuentaPorPagarId: "cxp-3",
			distribucion: [
				{
					cuentaId: "cb-1",
					monto: 60,
					tipoPagoId: "tp-1",
					moneda: "CUP",
					numeroTransaccion: "TRX-003",
				},
				{
					cuentaId: "cb-2",
					monto: 40,
					tipoPagoId: "tp-1",
					moneda: "CUP",
					numeroTransaccion: "TRX-003",
				},
			],
		});

		expect(result.success).toBe(true);
		const callArgs = workflowMock.applyPagoGastoWorkflow.mock.calls[0][1];
		expect(callArgs.distribucion).toHaveLength(2);
		expect(callArgs.distribucion[0].cuentaId).toBe("cb-1");
		expect(callArgs.distribucion[1].cuentaId).toBe("cb-2");
		expect(callArgs.distribucion[0].monto).toBe(60);
		expect(callArgs.distribucion[1].monto).toBe(40);
	});

	it("4. Monto excede saldo → MONTO_EXCEDE_SALDO", async () => {
		workflowMock.applyPagoGastoWorkflow.mockRejectedValue({
			message: "El monto no puede exceder el saldo pendiente de 50.00",
			status: 400,
			code: "MONTO_EXCEDE_SALDO",
		});
		prismaMock.$transaction.mockImplementation(async (cb: any) => cb({}));

		const result = await reconciliarGastoAction({
			gastoCompraId: "gc-4",
			cuentaId: "cb-1",
			tipoPagoId: "tp-1",
			monto: 100,
			moneda: "CUP",
			descripcion: "Pago FAC-004",
			cuentaPorPagarId: "cxp-4",
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("MONTO_EXCEDE_SALDO");
	});

	it("5. CxP ya pagada → CUENTA_YA_PAGADA", async () => {
		workflowMock.applyPagoGastoWorkflow.mockRejectedValue({
			message: "La cuenta por pagar ya está pagada",
			status: 400,
			code: "CUENTA_YA_PAGADA",
		});
		prismaMock.$transaction.mockImplementation(async (cb: any) => cb({}));

		const result = await reconciliarGastoAction({
			gastoCompraId: "gc-5",
			cuentaId: "cb-1",
			tipoPagoId: "tp-1",
			monto: 50,
			moneda: "CUP",
			descripcion: "Pago FAC-005",
			cuentaPorPagarId: "cxp-5",
		});

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("CUENTA_YA_PAGADA");
	});

	it("6. Sin cuentaPorPagarId → flujo legacy preservado", async () => {
		prismaMock.$transaction.mockImplementation(async (cb: any) => {
			const mockTx = {
				reconciliacionGasto: {
					create: vi.fn().mockResolvedValue({
						reconciliacionId: "rec-legacy",
						monto: 200,
						moneda: "CUP",
						montoConvertido: 200,
						estado: "PAGADA",
					}),
				},
				cuentaBancaria: {
					update: vi.fn().mockResolvedValue({}),
				},
			};
			return cb(mockTx);
		});

		const result = await reconciliarGastoAction({
			pgId: "pg-1",
			cuentaId: "cb-1",
			tipoPagoId: "tp-1",
			monto: 200,
			moneda: "CUP",
			descripcion: "Pago salario",
		});

		expect(result.success).toBe(true);
		// applyPagoGastoWorkflow NO debe haberse llamado (es flujo legacy)
		expect(workflowMock.applyPagoGastoWorkflow).not.toHaveBeenCalled();
	});
});
