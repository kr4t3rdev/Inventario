import type { Prisma } from '@/generated/prisma';

/**
 * @description Ejecuta un intento especulativo en el TransactionClient del writer.
 * Siempre revierte el intento, aun si tuvo éxito; nunca afirma un commit exterior.
 * Un fallo al recuperar el savepoint se propaga para abortar el writer.
 * @param {Prisma.TransactionClient} tx - Transacción activa del writer.
 * @param {() => Promise<T>} intento - Trabajo especulativo.
 * @returns {Promise<{ok: boolean; error?: unknown}>} Resultado sin escrituras formales.
 */
export async function intentarPosteoShadow<T>(
  tx: Prisma.TransactionClient,
  intento: () => Promise<T>,
): Promise<{ ok: boolean; error?: unknown }> {
  // Identificador SQL fijo, sin entrada de usuario; cada invocación libera el savepoint.
  await tx.$executeRawUnsafe('SAVEPOINT cta_posteo_shadow');
  let error: unknown;
  try {
    await intento();
  } catch (cause) {
    error = cause;
  } finally {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT cta_posteo_shadow');
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT cta_posteo_shadow');
  }
  return error === undefined ? { ok: true } : { ok: false, error };
}
