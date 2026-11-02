/**
 * @description Calcula el siguiente índice libre de secuencia para las líneas de
 * kardex de una transferencia.
 *
 * La clave de evento de una línea de kardex incluye la secuencia, por lo que
 * `registrarMovimiento` hace `upsert` con actualización vacía: si la secuencia
 * ya existe, el movimiento nuevo se descarta en silencio. Contar líneas no
 * garantiza que el índice siguiente esté libre (pueden existir huecos o
 * secuencia heredadas de otros flujos), así que se toma el índice numérico
 * máximo ya usado y se incrementa.
 *
 * @param {string[]} secuencias - Secuencias ya registradas para el origen.
 * @returns {number} Índice libre (0 si no hay ninguna secuencia numérica).
 */
export function siguienteIndiceKardex(secuencias: string[]): number {
	let max = -1;
	for (const secuencia of secuencias) {
		const match = /^(?:SALIDA|ENTRADA)-(\d+)$/.exec(secuencia);
		if (match) {
			const indice = Number(match[1]);
			if (Number.isFinite(indice) && indice > max) {
				max = indice;
			}
		}
	}
	return max + 1;
}
