/**
 * @description Expiración perezosa de ofertas (E-2): marca VENCIDA las ofertas
 * PENDIENTE cuya fechaVencimiento ya pasó. Sin cron — se invoca al tocar el
 * módulo (listar, leer, facturar, convertir). Las ofertas sin fecha de
 * vencimiento nunca expiran.
 */
import { prisma } from '@/lib/prisma';

/**
 * @description Marca como VENCIDA las ofertas PENDIENTE vencidas del tenant.
 * @param {string} tenantId - Tenant cuyo catálogo de ofertas se expira.
 * @returns {Promise<number>} Cantidad de ofertas marcadas.
 */
export async function expirarOfertasVencidas(tenantId: string): Promise<number> {
  const resultado = await prisma.oferta.updateMany({
    where: {
      tenantId,
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: new Date() },
    },
    data: { estado: 'VENCIDA' },
  });
  return resultado.count;
}
