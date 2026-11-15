/**
 * @description Prevención de duplicados de puntos mediante idempotencia.
 *
 * Genera claves de idempotencia y verifica si una operación ya fue procesada.
 *
 * @module features/lealtad/services/idempotency-service
 */

/**
 * @description Crea una clave de idempotencia a partir del tipo y referencia.
 * @param {string} tipo - Tipo de operación (COMPRA, CANJE, BONUS, etc.).
 * @param {string} referenciaId - ID de la referencia (ventaId, cuponId, etc.).
 * @returns {string} Clave de idempotencia única.
 */
export function crearIdempotenciaKey(tipo: string, referenciaId: string): string {
  return `${tipo}-${referenciaId}`;
}

/**
 * @description Verifica si una clave de idempotencia ya fue procesada.
 * @param {object} params - Parámetros de verificación.
 * @param {string} params.key - Clave de idempotencia a verificar.
 * @param {string[]} params.keysExistentes - Lista de claves ya procesadas.
 * @returns {object} Resultado con indicador de duplicado.
 */
export function verificarIdempotencia(params: {
  key: string;
  keysExistentes: string[];
}): { yaExiste: boolean } {
  return { yaExiste: params.keysExistentes.includes(params.key) };
}
