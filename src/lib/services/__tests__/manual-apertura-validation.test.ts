import { describe, expect, it } from "vitest";
import { validateManualOpeningLines } from "../apertura-periodo-service";

const lines = [
	{ cuentaContableId: "cash", currency: "CUP", debit: "100.00", credit: "0", fxRate: "1", fxSource: "cierre aprobado" },
	{ cuentaContableId: "capital", currency: "CUP", debit: "0", credit: "100.00", fxRate: "1", fxSource: "cierre aprobado" },
];

describe("validateManualOpeningLines", () => {
	it("accepts explicit balanced debit and credit lines in functional currency", () => {
		expect(validateManualOpeningLines(lines, "CUP")).toHaveLength(2);
	});

	it("rejects a non-balanced opening", () => {
		expect(() => validateManualOpeningLines([lines[0]], "CUP")).toThrowError(
			 expect.objectContaining({ code: "APERTURA_SALDOS_NO_VERIFICABLES" }),
		);
	});

	it("rejects missing account, invalid currency, and invalid amounts", () => {
		for (const invalid of [
			{ ...lines[0], cuentaContableId: "" },
			{ ...lines[0], currency: "" },
			{ ...lines[0], debit: "-1" },
			{ ...lines[0], debit: "NaN" },
			{ ...lines[0], fxSource: "" },
		]) {
			expect(() => validateManualOpeningLines([invalid, lines[1]], "CUP")).toThrow();
		}
	});

	it("compares converted functional totals without creating a counterline", () => {
		const foreign = [
			{ ...lines[0], currency: "USD", debit: "10", fxRate: "2", fxSource: "approved rate #4" },
			{ ...lines[1], currency: "CUP", credit: "20", fxRate: "1", fxSource: "functional currency" },
		];
		expect(validateManualOpeningLines(foreign, "CUP")).toHaveLength(2);
	});
});
