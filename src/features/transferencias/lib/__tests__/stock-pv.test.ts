/**
 * @description Tests del cálculo puro de aporte de transferencias al stock de
 * un punto de venta (BUG-3 de la Sesión A + semántica PARCIAL de la Sesión B).
 */
import { describe, expect, it } from "vitest";

import { calcularAporteRecibido } from "../stock-pv";

describe("calcularAporteRecibido", () => {
	it("una COMPLETADA con cantidadRecibida aporta lo recibido", () => {
		expect(
			calcularAporteRecibido([
				{ estado: "COMPLETADA", cantidad: 10, cantidadRecibida: 10 },
			]),
		).toBe(10);
	});

	it("una COMPLETADA de creación directa (sin cantidadRecibida) aporta su cantidad", () => {
		expect(
			calcularAporteRecibido([
				{ estado: "COMPLETADA", cantidad: 7, cantidadRecibida: null },
			]),
		).toBe(7);
	});

	it("una PARCIAL aporta solo lo recibido", () => {
		expect(
			calcularAporteRecibido([
				{ estado: "PARCIAL", cantidad: 10, cantidadRecibida: 4 },
			]),
		).toBe(4);
	});

	it("una PARCIAL sin recepciones aporta 0", () => {
		expect(
			calcularAporteRecibido([
				{ estado: "PARCIAL", cantidad: 10, cantidadRecibida: null },
			]),
		).toBe(0);
	});

	it("PENDIENTE, APROBADA y EN_TRANSITO no aportan (el stock se mueve al recibir)", () => {
		for (const estado of ["PENDIENTE", "APROBADA", "EN_TRANSITO"]) {
			expect(
				calcularAporteRecibido([
					{ estado, cantidad: 10, cantidadRecibida: null },
				]),
			).toBe(0);
		}
	});

	it("suma los aportes de varias filas", () => {
		expect(
			calcularAporteRecibido([
				{ estado: "COMPLETADA", cantidad: 10, cantidadRecibida: 10 },
				{ estado: "PARCIAL", cantidad: 5, cantidadRecibida: 2 },
				{ estado: "EN_TRANSITO", cantidad: 8, cantidadRecibida: null },
			]),
		).toBe(12);
	});

	it("una lista vacía aporta 0", () => {
		expect(calcularAporteRecibido([])).toBe(0);
	});
});
