/**
 * @description Re-resuelve los ítems de una oferta a precio vigente en servidor:
 * cada producto/servicio se valida scoped por tenant y se resuelve con la misma
 * cadena que valida la venta (LP-1.3): lista del cliente > lista default del
 * tenant > precio base. Lo que envíe el cliente en precioUnitario/total nunca
 * es autoridad (E-3/E-4).
 */
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { resolvePrecioVenta } from '@/features/ventas/services/precio-venta-resolver';

export interface ItemEntradaOferta {
  productoId?: string;
  servicioId?: string;
  cantidad: number;
}

export interface ItemResueltoOferta {
  productoId: string | null;
  servicioId: string | null;
  cantidad: number;
  precioUnitario: number;
}

/**
 * @description Resuelve los ítems de una oferta contra catálogo del tenant.
 * @param {string} tenantId - Tenant dueño de la oferta.
 * @param {ItemEntradaOferta[]} items - Ítems solicitados (producto o servicio).
 * @param {string | null} listaPrecioId - Lista de precios del cliente, si aplica.
 * @returns {Promise<ItemResueltoOferta[]>} Ítems con precio vigente resuelto.
 */
export async function resolverItemsOferta(
  tenantId: string,
  items: ItemEntradaOferta[],
  listaPrecioId: string | null,
): Promise<ItemResueltoOferta[]> {
  // Lista marcada como default del tenant: fallback intermedio de la cadena
  // compartida con ventas (LP-1.2/LP-1.3). Un solo lookup para todo el lote.
  const listaDefault = await prisma.listaPrecio.findFirst({
    where: { tenantId, esDefault: true },
    select: { id: true },
  });
  const defaultListaId = listaDefault?.id ?? null;

  return Promise.all(items.map(async (item) => {
    if (item.productoId) {
      const producto = await prisma.producto.findFirst({
        where: { id: item.productoId, tenantId },
        include: { precios: true },
      });
      if (!producto) throw new ActionError('Producto no encontrado', 'NOT_FOUND');
      // Misma cadena que valida la venta: cliente > PV (n/a en ofertas) >
      // default del tenant > base.
      const { precio: precioUnitario } = resolvePrecioVenta({
        precioBase: producto.precioVenta,
        precios: producto.precios,
        pvListaId: null,
        clienteListaId: listaPrecioId,
        defaultListaId,
      });
      return {
        productoId: item.productoId,
        servicioId: null,
        cantidad: item.cantidad,
        precioUnitario,
      };
    }

    const servicio = await prisma.servicios.findFirst({
      where: { servicioId: item.servicioId, tenantId },
    });
    if (!servicio) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
    return {
      productoId: null,
      servicioId: item.servicioId ?? null,
      cantidad: item.cantidad,
      precioUnitario: Number(servicio.precio),
    };
  }));
}
