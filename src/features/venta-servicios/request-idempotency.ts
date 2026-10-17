/**
 * @description Reutiliza una clave solo para reintentos del mismo payload.
 * @param {PendingServiceSaleRequest | null} pending - Intento pendiente actual.
 * @param {string} fingerprint - Representación estable del payload enviado.
 * @returns {PendingServiceSaleRequest} Intento reutilizable o uno nuevo.
 */
export function resolveServiceSaleRequestKey(
  pending: PendingServiceSaleRequest | null,
  fingerprint: string,
): PendingServiceSaleRequest {
  if (pending?.fingerprint === fingerprint) return pending;
  return { fingerprint, key: crypto.randomUUID() };
}

export interface PendingServiceSaleRequest {
  fingerprint: string;
  key: string;
}
