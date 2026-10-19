/**
 * @description Lock advisory transaccional por oferta (integración Sesión E).
 * Todo writer que edita ítems, factura o convierte una oferta debe tomarlo
 * dentro de su transacción antes de leer estado/ítems: serializa las
 * operaciones sobre la misma oferta para que el snapshot usado por la
 * venta/factura coincida siempre con el contenido persistido y ninguna
 * edición intermedia quede reflejada a medias en los documentos generados.
 */
import type { Prisma } from '@/generated/prisma';

/** Cliente transaccional capaz de tomar advisory locks de PostgreSQL. */
export type ClienteBloqueoOferta = Pick<Prisma.TransactionClient, '$executeRaw'>;

/**
 * @description Toma el advisory lock transaccional de una oferta.
 * @param {ClienteBloqueoOferta} tx - Transacción del caller.
 * @param {string} tenantId - Tenant del usuario autenticado.
 * @param {string} ofertaId - Oferta que se va a mutar o snapshotear.
 * @returns {Promise<void>} El lock se mantiene hasta el fin de la transacción.
 */
export async function lockOferta(
  tx: ClienteBloqueoOferta,
  tenantId: string,
  ofertaId: string,
): Promise<void> {
  const lockIdentity = JSON.stringify(['oferta', tenantId, ofertaId]);
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))
  `;
}
