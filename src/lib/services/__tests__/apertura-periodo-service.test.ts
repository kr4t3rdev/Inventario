import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
	mockPrisma: {
		periodoContable: { findFirst: vi.fn(), findUnique: vi.fn() },
		aperturaPeriodo: { findUnique: vi.fn(), create: vi.fn() },
		cuentaBancaria: { findMany: vi.fn() },
		cuentaPorCobrar: { aggregate: vi.fn() },
		cuentaPorPagar: { aggregate: vi.fn() },
	},
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { AperturaPeriodoService } from "../apertura-periodo-service";
import { TipoPeriodo } from "../periodo-contable-types";

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
		mockPrisma.cuentaBancaria.findMany.mockResolvedValue([]);
		mockPrisma.cuentaPorCobrar.aggregate.mockResolvedValue({ _sum: { montoDeuda: null, montoPagado: null } });
		mockPrisma.cuentaPorPagar.aggregate.mockResolvedValue({ _sum: { saldoPendiente: null } });
	});

	it("rejects opening when no complete verified opening-balance evidence exists", async () => {
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
