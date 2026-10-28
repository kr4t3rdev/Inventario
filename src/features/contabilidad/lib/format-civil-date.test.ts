import { describe, expect, it } from "vitest";
import { es } from "date-fns/locale";
import { formatCivilDate } from "./format-civil-date";

describe("formatCivilDate", () => {
	it("formats a UTC-midnight civil date without shifting to the previous day", () => {
		expect(formatCivilDate("2026-10-28T00:00:00.000Z", "dd/MM/yyyy")).toBe(
			"28/10/2026",
		);
	});

	it("preserves date-fns locale formatting", () => {
		expect(formatCivilDate("2026-10-28T00:00:00.000Z", "d MMM yyyy", es)).toBe(
			"28 oct 2026",
		);
	});
});
