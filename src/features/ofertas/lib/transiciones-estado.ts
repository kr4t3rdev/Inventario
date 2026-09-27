/**
 * @description Matriz de transiciones de estado de ofertas (E-2). Solo
 * PENDIENTE puede moverse vía update; FACTURADA es alcanzable únicamente por
 * facturarOfertaAction; ACEPTADA por el conversor de pedidos; VENCIDA por la
 * expiración perezosa.
 */

const TRANSICIONES_PERMITIDAS: Record<string, readonly string[]> = {
  PENDIENTE: ['ACEPTADA', 'RECHAZADA'],
  ACEPTADA: [],
  RECHAZADA: [],
  FACTURADA: [],
  VENCIDA: [],
};

/**
 * @description Indica si el salto de estado está permitido por la matriz.
 * @param {string} actual - Estado vigente de la oferta.
 * @param {string} destino - Estado solicitado.
 * @returns {boolean} true si la transición es válida.
 */
export function transicionPermitida(actual: string, destino: string): boolean {
  return TRANSICIONES_PERMITIDAS[actual]?.includes(destino) ?? false;
}
