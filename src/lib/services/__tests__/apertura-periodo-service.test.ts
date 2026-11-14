import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
	mockPrisma: {
		periodoContable: { findFirst: vi.fn(), findUnique: vi.fn() },
		aperturaPeriodo: { findUnique: vi.fn(), create: vi.fn() },
		financialAuxiliaryCheckpoint: { findUnique: vi.fn() },
		snapshotPeriodo: { findFirst: vi.fn() },
		tenantAccountingPolicy: { findUnique: vi.fn() },
		asiento: { count: vi.fn() },
		cuentaBancaria: { findMany: vi.fn() },
		cuentaPorCobrar: { aggregate: vi.fn() },
		cuentaPorPagar: { aggregate: vi.fn() },
	},
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/features/contabilidad/services/financial-auxiliary-checkpoint-service", () => ({
	collectFinancialAuxiliaryEvidence: vi.fn(),
}));

import { AperturaPeriodoService } from "../apertura-periodo-service";
import { TipoPeriodo } from "../periodo-contable-types";
import { collectFinancialAuxiliaryEvidence } from "@/features/contabilidad/services/financial-auxiliary-checkpoint-service";
import { hashImmutableFinancialEvidence } from "@/features/contabilidad/services/immutable-financial-evidence";

const period = {
	periodoId: "periodo-nuevo",
	tenantId: "tenant-1",
	tipo: TipoPeriodo.MENSUAL,
	fechaInicio: new Date("2026-04-01T00:00:00.000Z"),
};

describe("AperturaPeriodoService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrisma.periodoContable.findUnique.mockResolvedValue(period);
		mockPrisma.aperturaPeriodo.findUnique.mockResolvedValue(null);
		mockPrisma.periodoContable.findFirst.mockResolvedValue(null);
		mockPrisma.financialAuxiliaryCheckpoint.findUnique.mockResolvedValue(null);
		mockPrisma.snapshotPeriodo.findFirst.mockResolvedValue(null);
		mockPrisma.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: "CUP" });
		mockPrisma.asiento.count.mockResolvedValue(0);
		mockPrisma.aperturaPeriodo.create.mockResolvedValue({ periodoId: "periodo-nuevo" });
		mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]);
		mockPrisma.cuentaPorCobrar.aggregate.mockResolvedValue({ _sum: { montoDeuda: null, montoPagado: null } });
		mockPrisma.cuentaPorPagar.aggregate.mockResolvedValue({ _sum: { saldoPendiente: null } });
		vi.mocked(collectFinancialAuxiliaryEvidence).mockResolvedValue({
			bankAccounts: [], inventory: [], receivables: [], payables: [], debt: [], capital: [],
		});
	});

	it("opens an empty first period only after proving there are no balances to carry", async () => {
		mockPrisma.aperturaPeriodo.create.mockResolvedValue({ periodoId: "periodo-nuevo" });

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).resolves.toMatchObject({ periodoId: "periodo-nuevo" });

		expect(mockPrisma.aperturaPeriodo.create).toHaveBeenCalledWith(expect.objectContaining({
			data: expect.objectContaining({
				saldoCuentasCobrarInicial: 0,
				saldoCuentasPagarInicial: 0,
				detalleJson: expect.objectContaining({ origen: "INICIO_VACIO_VERIFICADO" }),
			}),
		}));
	});

	it("requires explicit approved opening evidence when a first-period auxiliary has a balance", async () => {
		vi.mocked(collectFinancialAuxiliaryEvidence).mockResolvedValue({
			bankAccounts: [], inventory: [],
			receivables: [{ sourceId: "ar-1", sourceType: "RECEIVABLE", status: "PENDIENTE", identity: {}, originalAmount: "25", originalCurrency: "CUP", functionalAmount: "25", functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ar-fp" }],
			payables: [], debt: [], capital: [],
		});

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).rejects.toMatchObject({ code: "APERTURA_SALDOS_NO_VERIFICABLES" });
		expect(mockPrisma.aperturaPeriodo.create).not.toHaveBeenCalled();
	});

	it("rejects an auxiliary functional amount when its original balance is zero", async () => {
		vi.mocked(collectFinancialAuxiliaryEvidence).mockResolvedValue({
			bankAccounts: [], inventory: [],
			receivables: [{ sourceId: "ar-zero", sourceType: "RECEIVABLE", status: "PENDIENTE", identity: {}, originalAmount: "0", originalCurrency: "USD", functionalAmount: "175", functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ar-zero-fp" }],
			payables: [], debt: [], capital: [],
		});

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).rejects.toMatchObject({ code: "APERTURA_SALDOS_NO_VERIFICABLES" });
		expect(mockPrisma.aperturaPeriodo.create).not.toHaveBeenCalled();
	});

	it("does not omit an unpaid CxP when its stored pending field is zero", async () => {
		vi.mocked(collectFinancialAuxiliaryEvidence).mockResolvedValue({
			bankAccounts: [], inventory: [], receivables: [],
			payables: [{ sourceId: "ap-inconsistent", sourceType: "PAYABLE", status: "PARCIAL", identity: { debt: "10", paid: "3", pending: "0" }, originalAmount: "7", originalCurrency: "CUP", functionalAmount: null, functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ap-inconsistent-fp" }],
			debt: [], capital: [],
		});

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).rejects.toMatchObject({ code: "APERTURA_SALDOS_NO_VERIFICABLES" });
		expect(mockPrisma.aperturaPeriodo.create).not.toHaveBeenCalled();
	});

	it("carries receivables and payables from the prior close without posting duplicate balances", async () => {
		const auxiliaries = {
			bankAccounts: [], inventory: [],
			receivables: [{ sourceId: "ar-1", sourceType: "RECEIVABLE", status: "PENDIENTE", identity: {}, originalAmount: "120", originalCurrency: "CUP", functionalAmount: "120", functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ar-fp" }],
			payables: [{ sourceId: "ap-1", sourceType: "PAYABLE", status: "PENDIENTE", identity: {}, originalAmount: "45", originalCurrency: "CUP", functionalAmount: "45", functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ap-fp" }],
			debt: [], capital: [],
		};
		const payload = { version: 3, tenantId: "tenant-1", cutoffAt: "2026-03-31T23:59:59.000Z", capturedAt: "2026-04-01T00:00:00.000Z", resultThrough: "2026-03-31T23:59:59.000Z", functionalCurrency: "CUP", balance: null, result: null, sourceFingerprints: {}, appliedFxEvidence: [], auxiliaries };
		const checkpointHash = hashImmutableFinancialEvidence(payload);
		const auxiliaryHash = hashImmutableFinancialEvidence(auxiliaries);
		const priorSummary = { continuityCheckpoint: { cutoffAt: payload.cutoffAt, checkpointHash, auxiliaryHash } };
		mockPrisma.periodoContable.findFirst.mockResolvedValue({
			periodoId: "periodo-anterior", estado: "APROBADO", fechaFin: new Date("2026-03-31T23:59:59Z"),
			resumenJson: priorSummary, hashIntegridad: hashImmutableFinancialEvidence(priorSummary),
		});
		mockPrisma.financialAuxiliaryCheckpoint.findUnique.mockResolvedValue({
			tenantId: "tenant-1", cutoffAt: new Date(payload.cutoffAt), capturedAt: new Date(payload.capturedAt), payload, hashIntegridad: checkpointHash,
		});
		vi.mocked(collectFinancialAuxiliaryEvidence).mockResolvedValue(auxiliaries);
		mockPrisma.aperturaPeriodo.create.mockResolvedValue({ periodoId: "periodo-nuevo" });

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).resolves.toMatchObject({ periodoId: "periodo-nuevo" });

		const created = mockPrisma.aperturaPeriodo.create.mock.calls[0][0].data;
		expect(created.origenPeriodoId).toBe("periodo-anterior");
		expect(created.saldoCuentasCobrarInicial?.toString()).toBe("120");
		expect(created.saldoCuentasPagarInicial?.toString()).toBe("45");
		expect(created.detalleJson).toMatchObject({
			origen: "CONTINUIDAD_CHECKPOINT", checkpointHash,
			balancesByOriginalCurrency: { receivables: { CUP: "120" }, payables: { CUP: "45" } },
		});
	});

	it("uses an approved annual snapshot as the continuity source", async () => {
		const auxiliaries = {
			bankAccounts: [], inventory: [],
			receivables: [{ sourceId: "ar-annual", sourceType: "RECEIVABLE", status: "PENDIENTE", identity: {}, originalAmount: "80", originalCurrency: "CUP", functionalAmount: "80", functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ar-annual-fp" }],
			payables: [{ sourceId: "ap-annual", sourceType: "PAYABLE", status: "PENDIENTE", identity: {}, originalAmount: "30", originalCurrency: "CUP", functionalAmount: "30", functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ap-annual-fp" }],
			debt: [], capital: [],
		};
		const cutoffAt = "2026-12-31T23:59:59.000Z";
		const payload = { version: 3, tenantId: "tenant-1", cutoffAt, capturedAt: "2027-01-01T00:00:00.000Z", resultThrough: cutoffAt, functionalCurrency: "CUP", balance: null, result: null, sourceFingerprints: Object.fromEntries(Object.entries(auxiliaries).map(([key, rows]) => [key, hashImmutableFinancialEvidence(rows)])), appliedFxEvidence: [], auxiliaries };
		const checkpointHash = hashImmutableFinancialEvidence(payload);
		const snapshotSummary = {
			version: 3, tenantId: "tenant-1", cutoffAt, provenance: { sourceFingerprints: payload.sourceFingerprints },
		};
		mockPrisma.periodoContable.findFirst.mockResolvedValue({
			periodoId: "periodo-anual", estado: "APROBADO", resumenJson: null, hashIntegridad: null,
		});
		mockPrisma.snapshotPeriodo.findFirst.mockResolvedValue({
			cutoffAt: new Date(cutoffAt), resumenJson: snapshotSummary,
			hashIntegridad: hashImmutableFinancialEvidence(snapshotSummary),
		});
		mockPrisma.financialAuxiliaryCheckpoint.findUnique.mockResolvedValue({
			tenantId: "tenant-1", cutoffAt: new Date(cutoffAt), capturedAt: new Date(payload.capturedAt), payload, hashIntegridad: checkpointHash,
		});
		vi.mocked(collectFinancialAuxiliaryEvidence).mockResolvedValue(auxiliaries);
		mockPrisma.aperturaPeriodo.create.mockResolvedValue({ periodoId: "periodo-nuevo" });

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).resolves.toMatchObject({ periodoId: "periodo-nuevo" });
		const created = mockPrisma.aperturaPeriodo.create.mock.calls[0][0].data;
		expect(created.saldoCuentasCobrarInicial?.toString()).toBe("80");
		expect(created.saldoCuentasPagarInicial?.toString()).toBe("30");
	});

	it("rejects CxC and CxP balances without verified functional valuation", async () => {
		const auxiliaries = {
			bankAccounts: [], inventory: [],
			receivables: [{ sourceId: "ar-usd", sourceType: "RECEIVABLE", status: "PENDIENTE", identity: {}, originalAmount: "80", originalCurrency: "USD", functionalAmount: null, functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ar-usd-fp" }],
			payables: [{ sourceId: "ap-eur", sourceType: "PAYABLE", status: "PENDIENTE", identity: {}, originalAmount: "30", originalCurrency: "EUR", functionalAmount: null, functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "ap-eur-fp" }],
			debt: [], capital: [],
		};
		const payload = { version: 3, tenantId: "tenant-1", cutoffAt: "2026-03-31T23:59:59.000Z", capturedAt: "2026-04-01T00:00:00.000Z", resultThrough: "2026-03-31T23:59:59.000Z", functionalCurrency: "CUP", balance: null, result: null, sourceFingerprints: {}, appliedFxEvidence: [], auxiliaries };
		const checkpointHash = hashImmutableFinancialEvidence(payload);
		const auxiliaryHash = hashImmutableFinancialEvidence(auxiliaries);
		const priorSummary = { continuityCheckpoint: { cutoffAt: payload.cutoffAt, checkpointHash, auxiliaryHash } };
		mockPrisma.periodoContable.findFirst.mockResolvedValue({
			periodoId: "periodo-anterior", estado: "CERRADO", resumenJson: priorSummary,
			hashIntegridad: hashImmutableFinancialEvidence(priorSummary),
		});
		mockPrisma.financialAuxiliaryCheckpoint.findUnique.mockResolvedValue({
			tenantId: "tenant-1", cutoffAt: new Date(payload.cutoffAt), capturedAt: new Date(payload.capturedAt), payload, hashIntegridad: checkpointHash,
		});
		vi.mocked(collectFinancialAuxiliaryEvidence).mockResolvedValue(auxiliaries);

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).rejects.toMatchObject({ code: "APERTURA_SALDOS_NO_VERIFICABLES" });
		expect(mockPrisma.aperturaPeriodo.create).not.toHaveBeenCalled();
	});

	it("blocks continuity when receivable or payable state changed after the prior close", async () => {
		const priorAux = { bankAccounts: [], inventory: [], receivables: [], payables: [], debt: [], capital: [] };
		const payload = { version: 3, tenantId: "tenant-1", cutoffAt: "2026-03-31T23:59:59.000Z", capturedAt: "2026-04-01T00:00:00.000Z", resultThrough: "2026-03-31T23:59:59.000Z", functionalCurrency: "CUP", balance: null, result: null, sourceFingerprints: {}, appliedFxEvidence: [], auxiliaries: priorAux };
		const checkpointHash = hashImmutableFinancialEvidence(payload);
		const priorSummary = { continuityCheckpoint: { cutoffAt: payload.cutoffAt, checkpointHash, auxiliaryHash: hashImmutableFinancialEvidence(priorAux) } };
		mockPrisma.periodoContable.findFirst.mockResolvedValue({
			periodoId: "periodo-anterior", estado: "APROBADO", fechaFin: new Date("2026-03-31T23:59:59Z"),
			resumenJson: priorSummary, hashIntegridad: hashImmutableFinancialEvidence(priorSummary),
		});
		mockPrisma.financialAuxiliaryCheckpoint.findUnique.mockResolvedValue({ tenantId: "tenant-1", cutoffAt: new Date(payload.cutoffAt), capturedAt: new Date(payload.capturedAt), payload, hashIntegridad: checkpointHash });
		vi.mocked(collectFinancialAuxiliaryEvidence).mockResolvedValue({ ...priorAux, receivables: [{ sourceId: "new-ar", sourceType: "RECEIVABLE", status: "PENDIENTE", identity: {}, originalAmount: "9", originalCurrency: "CUP", functionalAmount: "9", functionalCurrency: "CUP", fxEvidence: null, evidenceFingerprint: "new-fp" }] });

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).rejects.toMatchObject({ code: "APERTURA_SALDOS_NO_VERIFICABLES" });
		expect(mockPrisma.aperturaPeriodo.create).not.toHaveBeenCalled();
	});

	it("rejects an older multi-currency summary instead of summing unlike currencies", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue({
			periodoId: "periodo-anterior",
			codigo: "2026-03",
			estado: "CERRADO",
			resumenJson: { saldosPorMoneda: { CUP: 100, USD: 20, MLC: 5 } },
		});

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).rejects.toMatchObject({ code: "APERTURA_SALDOS_NO_VERIFICABLES" });

		expect(mockPrisma.aperturaPeriodo.create).not.toHaveBeenCalled();
	});

	it("rejects a V3-shaped balance that does not explicitly split opening rubrics", async () => {
		mockPrisma.periodoContable.findFirst.mockResolvedValue({
			periodoId: "periodo-anterior",
			codigo: "2026-03",
			estado: "CERRADO",
			resumenJson: {
				version: 3,
				tenantId: "tenant-1",
				cutoffAt: "2026-04-01T00:00:00.000Z",
				functionalCurrency: "CUP",
				approvedAt: "2026-04-01T00:00:02.000Z",
				balance: {
					assets: {
						cashAndBanks: 100,
						inventory: { total: 50 },
						receivables: 20,
					},
					liabilities: { payables: 15, externalDebt: 10 },
					equity: { capital: 100, retainedEarnings: 30, currentResult: 15 },
				},
			},
		});

		await expect(
			AperturaPeriodoService.createAperturaPeriodo("periodo-nuevo", "tenant-1", "user-1"),
		).rejects.toMatchObject({ code: "APERTURA_SALDOS_NO_VERIFICABLES" });

		expect(mockPrisma.aperturaPeriodo.create).not.toHaveBeenCalled();
	});
});
