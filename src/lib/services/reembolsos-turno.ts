import { prisma } from '@/lib/prisma';

/**
 * @description Devuelve el total reembolsado en efectivo (centavos CUP) por
 * devoluciones REGISTRADAS ligadas a un turno (DNC-T3.3). Punto único consumido
 * por getEsperadosArqueoAction, realizarArqueoAction y la ruta mobile de
 * esperados, para que el efectivo esperado descuente los reembolsos del turno.
 * @param {string} turnoId - Turno de punto de venta.
 * @param {string} tenantId - Tenant activo.
 * @returns {Promise<number>} Total reembolsado en centavos.
 */
export async function getReembolsosTurnoCup(
  turnoId: string,
  tenantId: string,
): Promise<number> {
  const agg = await prisma.devolucionVenta.aggregate({
    where: { tenantId, turnoReembolsoId: turnoId, estado: 'REGISTRADA' },
    _sum: { montoReembolsado: true },
  });
  return agg._sum.montoReembolsado ?? 0;
}
