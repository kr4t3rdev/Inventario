import { createHash } from 'node:crypto';

/** Asiento formal reducido a los datos que identifican su posición en la cadena. */
export interface AsientoProcedencia {
	/** Identificador del asiento. */
	asientoId: string;
	/** Hash de integridad del asiento. */
	hash: string;
}

/**
 * @description Serializa un valor de forma canónica: claves ordenadas de
 * manera estable y propiedades indefinidas omitidas.
 *
 * Dos payloads con el mismo contenido producen la misma serialización, sin
 * depender del orden de construcción ni del entorno de ejecución.
 *
 * @param {unknown} valor - Valor a serializar.
 * @returns {string} JSON canónico.
 */
export function canonicalJson(valor: unknown): string {
	if (valor === null || typeof valor !== 'object') {
		return JSON.stringify(valor) ?? 'null';
	}
	if (Array.isArray(valor)) {
		return `[${valor.map((item) => canonicalJson(item)).join(',')}]`;
	}
	const entradas = Object.entries(valor as Record<string, unknown>)
		.filter(([, item]) => item !== undefined)
		.sort(([izquierda], [derecha]) => (izquierda < derecha ? -1 : izquierda > derecha ? 1 : 0));
	return `{${entradas
		.map(([clave, item]) => `${JSON.stringify(clave)}:${canonicalJson(item)}`)
		.join(',')}}`;
}

/**
 * @description Calcula el SHA-256 de la serialización canónica de un valor.
 * @param {unknown} valor - Valor a resumir.
 * @returns {string} Hash hexadecimal de 64 caracteres.
 */
export function hashCanonical(valor: unknown): string {
	return createHash('sha256').update(canonicalJson(valor)).digest('hex');
}

/**
 * @description Calcula el hash de procedencia del mayor formal a un corte.
 *
 * El hash resume la cadena de asientos en su orden: si un asiento se altera,
 * se elimina o se inserta, el hash cambia y el checkpoint deja de coincidir
 * con el ledger del que dice provenir.
 *
 * @param {AsientoProcedencia[]} asientos - Asientos ordenados por cadena.
 * @returns {string} Hash hexadecimal de 64 caracteres.
 */
export function calcularLedgerHash(asientos: AsientoProcedencia[]): string {
	return hashCanonical(asientos.map((asiento) => [asiento.asientoId, asiento.hash]));
}
