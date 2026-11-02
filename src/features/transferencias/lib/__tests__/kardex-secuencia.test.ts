/**
 * @description Tests del cálculo de la secuencia libre del kardex de
 * transferencias.
 *
 * La clave de evento de una línea de kardex incluye la secuencia, por lo que
 * `registrarMovimiento` hace `upsert` con actualización vacía: reutilizar una
 * secuencia existente descarta el movimiento en silencio.
 */
import { describe, expect, it } from "vitest";

import { siguienteIndiceKardex } from "../kardex-secuencia";

describe("siguienteIndiceKardex", () => {
	it("devuelve 0 cuando no hay ninguna secuencia registrada", () => {
		expect(siguienteIndiceKardex([])).toBe(0);
	});

	it("devuelve el índice siguiente al máximo usado", () => {
		expect(siguienteIndiceKardex(["SALIDA-0", "ENTRADA-0"])).toBe(1);
		expect(siguienteIndiceKardex(["SALIDA-0", "ENTRADA-0", "SALIDA-1", "ENTRADA-1"])).toBe(2);
	});

	it("ignora las secuencias de compensación (REV-)", () => {
		expect(
			siguienteIndiceKardex(["SALIDA-0", "ENTRADA-0", "REV-SALIDA-0", "REV-ENTRADA-0"]),
		).toBe(1);
	});

	it("ignora las secuencias que no son numéricas", () => {
		expect(siguienteIndiceKardex(["SALIDA-abc", "OTRA-3", "SALIDA-1"])).toBe(2);
	});
});
