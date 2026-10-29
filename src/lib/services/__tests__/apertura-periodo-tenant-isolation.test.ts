import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
	db: {
		periodoContable: { findUnique: vi.fn(), findFirst: vi.fn() },
		aperturaPeriodo: { findUnique: vi.fn(), create: vi.fn() },
	},
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { AperturaPeriodoService } from "../apertura-periodo-service";

describe("AperturaPeriodoService tenant isolation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		db.periodoContable.findUnique.mockResolvedValue({
			periodoId: "periodo-ajeno",
			tenantId: "tenant-otro",
			tipo: "MENSUAL",
			fechaInicio: new Date("2026-04-01T00:00:00.000Z"),
		});
		db.aperturaPeriodo.findUnique.mockResolvedValue(null);
		db.periodoContable.findFirst.mockResolvedValue({ periodoId: "p1", tenantId: "tenant-propio" });
		db.aperturaPeriodo.create.mockResolvedValue({ aperturaId: "a1" });
	});

	it("rejects a period owned by a different tenant", async () => {
		await expect(AperturaPeriodoService.createAperturaPeriodo("periodo-ajeno", "tenant-propio", "user"))
			.rejects.toMatchObject({ code: "PERIODO_NO_EXISTE" });
		expect(db.aperturaPeriodo.findUnique).not.toHaveBeenCalled();
	});

	it("stores manual lines without asserting unassigned legacy rubrics are zero", async () => {
		await AperturaPeriodoService.createManualApertura("p1", "tenant-propio", "opener", {
			solicitudId: "s1",
			hashAprobacion: "hash",
			aprobadaPor: "approver",
			functionalCurrencyCode: "CUP",
			fxFingerprints: [],
			asientoId: "journal-1",
			lineas: [
				{ cuentaCodigo: "101", moneda: "CUP", debito: "100", credito: "0" },
				{ cuentaCodigo: "301", moneda: "CUP", debito: "0", credito: "100" },
			],
			lineasValuadas: [
				{ cuentaCodigo: "101", debitoFuncional: "100", creditoFuncional: "0" },
				{ cuentaCodigo: "301", debitoFuncional: "0", creditoFuncional: "100" },
			],
		}, db as never);
		const createData = db.aperturaPeriodo.create.mock.calls[0][0].data;
		expect(createData).not.toHaveProperty("saldoCajaInicial");
		expect(createData).not.toHaveProperty("saldoCapitalInicial");
		expect(createData.detalleJson.lineas).toHaveLength(2);
	});
});
