import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';

interface ConvertirOfertaAPedidoParams {
  ofertaId: string;
  puntoDeVentaId: string;
  tenantId: string;
  usuarioId?: string;
}

/**
 * @description Convierte una oferta (PENDIENTE o ACEPTADA) en un pedido de
 * venta (venta en estado PEDIDO, sin efectos de stock ni factura). Idempotente:
 * si ya existe un pedido vinculado, lo devuelve sin crear otro.
 * @param {ConvertirOfertaAPedidoParams} params - Oferta, punto de venta y tenant.
 * @returns {Promise<{ ventaId: string; creado: boolean }>} Pedido resultante.
 */
export async function convertirOfertaAPedido({
  ofertaId,
  puntoDeVentaId,
  tenantId,
  usuarioId,
}: ConvertirOfertaAPedidoParams) {
  const oferta = await prisma.oferta.findFirst({
    where: { id: ofertaId, tenantId },
    include: { items: true },
  });
  if (!oferta) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
  if (oferta.estado === 'FACTURADA') {
    throw new ActionError('La oferta ya fue facturada', 'VALIDATION_ERROR');
  }
  if (oferta.estado === 'RECHAZADA') {
    throw new ActionError('No se puede convertir una oferta rechazada', 'VALIDATION_ERROR');
  }

  const itemsProducto = oferta.items.filter((item) => item.productoId);
  if (itemsProducto.length !== oferta.items.length) {
    throw new ActionError(
      'La conversión a pedido solo admite ofertas con productos (sin servicios).',
      'NOT_SUPPORTED',
    );
  }
  if (itemsProducto.length === 0) {
    throw new ActionError('La oferta no tiene ítems de producto', 'VALIDATION_ERROR');
  }

  // El punto de venta debe pertenecer al tenant (aislamiento: sin esta guarda,
  // la entrega posterior movería stock de una ubicación ajena).
  const puntoVenta = await prisma.puntoDeVenta.findFirst({
    where: { pvId: puntoDeVentaId, tenantId },
    select: { pvId: true },
  });
  if (!puntoVenta) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');

  // Idempotencia: si ya existe pedido vinculado, devolverlo sin duplicar.
  const ventaVinculada = await prisma.venta.findFirst({
    where: { ofertaId: oferta.id, tenantId, deletedAt: null },
    select: { ventaId: true, estado: true },
  });
  if (ventaVinculada) {
    if (ventaVinculada.estado !== 'PEDIDO') {
      throw new ActionError(
        'La oferta ya tiene una venta procesada vinculada.',
        'VALIDATION_ERROR',
      );
    }
    return { ventaId: ventaVinculada.ventaId, creado: false };
  }

  return prisma.$transaction(async (tx) => {
    const subtotal = itemsProducto.reduce(
      (sum, item) => sum + Number(item.total ?? 0),
      0,
    );
    const descuento = Math.max(Number(oferta.subtotal) - subtotal, 0);
    const totalCantidad = itemsProducto.reduce(
      (sum, item) => sum + Number(item.cantidad ?? 0),
      0,
    );

    const venta = await tx.venta.create({
      data: {
        tenantId,
        puntoDeVentaId,
        clienteId: oferta.clienteId ?? null,
        ofertaId: oferta.id,
        estado: 'PEDIDO',
        metodoPago: null,
        descuento,
        total: Math.max(Number(oferta.total), 0),
        cantidad: totalCantidad,
        esVentaUnica: true,
        items: {
          create: itemsProducto.map((item) => ({
            productoId: item.productoId as string,
            cantidad: item.cantidad,
            precioUnitario: Number(item.precioUnitario),
            total: Number(item.total),
          })),
        },
      },
    });

    const updatedOferta = await tx.oferta.updateMany({
      where: { id: oferta.id, tenantId, estado: { in: ['PENDIENTE', 'ACEPTADA'] } },
      data: { estado: 'ACEPTADA' },
    });
    if (updatedOferta.count !== 1) {
      throw new ActionError(
        'La oferta cambió de estado; recarga la página e inténtalo de nuevo.',
        'VALIDATION_ERROR',
      );
    }

    await AuditLogService.logStrict(
      {
        accion: 'EXECUTE',
        entidad: 'VENTA',
        entidadId: venta.ventaId,
        usuarioId: usuarioId ?? 'sistema',
        detalles: {
          tipo: 'OFERTA_CONVERTIDA_PEDIDO',
          ofertaId: oferta.id,
          ventaId: venta.ventaId,
        },
      },
      tx,
    );

    return { ventaId: venta.ventaId, creado: true };
  });
}
