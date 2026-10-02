/**
 * @description Resolución de turno POS dentro de una transacción ajena (tarea
 * 3.2.c.iii del change remediacion-integridad-ventas-credito-fiscal).
 *
 * `getOrCreateTurnoActivo` (action) usa el cliente global de Prisma: crear el
 * turno ANTES de la transacción de la venta deja turnos AUTO huérfanos si la
 * venta se rechaza. Este helper espeja su semántica con el cliente
 * transaccional: el turno creado vive y muere con la transacción propietaria.
 */
import type { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';

/**
 * @description Busca el turno ABIERTO del punto de venta o, si el PV es
 * MOVIL/SECUNDARIA, crea un turno AUTO con el cliente transaccional.
 * Un PV PRINCIPAL sin turno abierto devuelve null (la venta continúa sin
 * turno, igual que con la action); un PV inexistente o ajeno rechaza.
 * @param {Prisma.TransactionClient} tx - Transacción propietaria del turno.
 * @param {object} params - Tenant, punto de venta y empleado opcional.
 * @returns {Promise<string | null>} ID del turno resuelto o null.
 */
export async function resolverTurnoDentroDeTx(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    puntoDeVentaId: string;
    empleadoId?: string | null;
  },
): Promise<string | null> {
  const turnoActivo = await tx.turnoPuntoVenta.findFirst({
    where: {
      puntoDeVentaId: params.puntoDeVentaId,
      tenantId: params.tenantId,
      estado: 'ABIERTO',
    },
  });
  if (turnoActivo) return turnoActivo.id;

  const pv = await tx.puntoDeVenta.findFirst({
    where: { pvId: params.puntoDeVentaId, tenantId: params.tenantId },
    select: { tipoCaja: true },
  });
  if (!pv) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');

  // PRINCIPAL no crea turno automático: la venta queda sin turno (paridad con
  // la action, cuyo fallo NO_TURNO_ACTIVO deja turnoId null en el create).
  if (pv.tipoCaja === 'PRINCIPAL' || !pv.tipoCaja) {
    return null;
  }

  const turno = await tx.turnoPuntoVenta.create({
    data: {
      tenantId: params.tenantId,
      puntoDeVentaId: params.puntoDeVentaId,
      empleadoId: params.empleadoId ?? null,
      fondoInicialCup: 0,
      fondoInicialUsd: 0,
      estado: 'ABIERTO',
      tipo: 'AUTO',
    },
  });
  return turno.id;
}
