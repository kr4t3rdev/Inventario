/**
 * @description Test de contrato estático: las actions de transferencias no
 * emiten logs con datos de negocio (hallazgo #11 de la re-auditoría 2026-09-26).
 * Permitido: console.warn genérico (reintentos) y console.error con mensaje
 * estático + el error capturado. Prohibido: console.log/info/debug,
 * interpolaciones de datos en logs y marcadores de depuración.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ACTIONS_PATH = join(
	process.cwd(),
	"src/features/transferencias/actions.ts",
);

const LINEAS_PERMITIDAS = [
	// console.warn estático sin datos (reintento por colisión de numeración).
	/^console\.warn\(\s*["'`][^"'`]*["'`]\s*\)\s*;?$/,
	// console.error con mensaje estático + el error capturado.
	/^console\.error\(\s*["'`][^"'`]*["'`]\s*,\s*[A-Za-z_$][\w$]*\s*\)\s*;?$/,
];

function lineasDeLog(fuente: string): string[] {
	return fuente
		.split("\n")
		.map((linea) => linea.trim())
		.filter((linea) => /^console\.(log|warn|error|debug|info)\(/.test(linea));
}

describe("B-4: higiene de logs en transferencias (Sesión B)", () => {
	it("actions.ts solo contiene logs genéricos sin datos de negocio", () => {
		const fuente = readFileSync(ACTIONS_PATH, "utf8");

		const offending = lineasDeLog(fuente).filter(
			(linea) => !LINEAS_PERMITIDAS.some((patron) => patron.test(linea)),
		);

		expect(
			offending,
			"actions.ts solo puede registrar console.warn genéricos y console.error con mensaje estático + error capturado",
		).toEqual([]);
	});

	it("actions.ts no usa el marcador de depuración '=== ' en literales de log", () => {
		const fuente = readFileSync(ACTIONS_PATH, "utf8");

		// Un literal de string que arranca con '=== ' es un marcador de log de
		// depuración; las comparaciones legítimas del código ('x === "y"') no lo
		// cumplen porque la comilla va después del operador.
		expect(/["'`]\s*===\s/.test(fuente)).toBe(false);
	});
});
