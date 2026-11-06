import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';

/** Origen de los asientos de cierre formal de período. */
export const ORIGEN_CIERRE_PERIODO = 'cierre_periodo';

/** Origen de los contraasientos de reversión. */
export const ORIGEN_REVERSO_ASIENTO = 'REVERSO_ASIENTO';

/** Niveles máximos de reversión recorridos para acotar la resolución. */
const MAX_NIVELES_REVERSION = 8;

/** Parámetros de resolución del alcance de cierre. */
export interface ClosingScopeParams {
  /** Tenant propietario de los asientos. */
  tenantId: string;
  /** Cliente transaccional opcional para leer en el mismo contexto. */
  client?: Prisma.TransactionClient;
}

/**
 * @description Resuelve los asientos que pertenecen a la mecánica de cierre:
 * el cierre formal del período y los contraasientos que lo revierten, directa
 * o indirectamente. Un cierre y su reverso forman una sola unidad: excluir uno
 * sin el otro deja el resultado del período descuadrado.
 * @param {ClosingScopeParams} params - Tenant y cliente transaccional opcional.
 * @returns {Promise<string[]>} Identificadores de asientos a excluir del resultado.
 */
export async function resolveClosingScope(params: ClosingScopeParams): Promise<string[]> {
  if (!params.tenantId.trim()) {
    throw new Error('El tenant es obligatorio para resolver el alcance de cierre');
  }

  const db = params.client ?? prisma;
  const cierres = await db.asiento.findMany({
    where: { tenantId: params.tenantId, origenTipo: ORIGEN_CIERRE_PERIODO },
    select: { asientoId: true },
  });

  const excluidos = new Set<string>(cierres.map((cierre) => cierre.asientoId));
  let frontera = [...excluidos];

  for (let nivel = 0; nivel < MAX_NIVELES_REVERSION && frontera.length > 0; nivel += 1) {
    const reversos = await db.asiento.findMany({
      where: {
        tenantId: params.tenantId,
        origenTipo: ORIGEN_REVERSO_ASIENTO,
        origenId: { in: frontera },
      },
      select: { asientoId: true },
    });
    const nuevos = reversos
      .map((reverso) => reverso.asientoId)
      .filter((asientoId) => !excluidos.has(asientoId));
    if (nuevos.length === 0) break;
    for (const asientoId of nuevos) excluidos.add(asientoId);
    frontera = nuevos;
  }

  return [...excluidos];
}
