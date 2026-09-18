'use server';

/**
 * @description Server Actions del flujo de devoluciones de venta (DNC-T4).
 */
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { revalidatePath } from 'next/cache';
import { DevolucionVentaService } from './services/devolucion-venta-service';
import type { RegistrarDevolucionInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Contexto para el wizard de devolución: venta con ítems y
 * disponibilidad por ítem, saldo CxC, NCs previas y si hay turno abierto (para
 * habilitar el reembolso en efectivo).
 * @param {string} ventaId - Venta sobre la que se quiere devolver.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns Contexto de devolución para la UI.
 */
export const getDevolucionContextoAction = withAction(
  async (ventaId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'ventas-pos', 'consultar ventas');
    const tenantId = requireTenant(user);

    const venta = await prisma.venta.findFirst({
      where: { ventaId, tenantId },
      select: {
        ventaId: true,
        estado: true,
        deletedAt: true,
        puntoDeVentaId: true,
        clienteId: true,
        total: true,
        descuento: true,
        cliente: { select: { clienteId: true, nombre: true } },
        factura: { select: { idFactura: true, numeroFactura: true } },
        items: {
          select: {
            id: true,
            productoId: true,
            cantidad: true,
            precioUnitario: true,
            total: true,
            producto: { select: { nombre: true } },
          },
        },
        devoluciones: {
          where: { estado: 'REGISTRADA' },
          select: {
            devolucionId: true,
            total: true,
            facturaNotaCreditoId: true,
            items: { select: { ventaItemId: true, cantidad: true } },
          },
        },
      },
    });
    if (!venta) throw new ActionError('Venta no encontrada', 'NOT_FOUND');

    const devueltasPorItem = new Map<string, number>();
    for (const devolucion of venta.devoluciones) {
      for (const item of devolucion.items) {
        devueltasPorItem.set(
          item.ventaItemId,
          (devueltasPorItem.get(item.ventaItemId) ?? 0) + item.cantidad,
        );
      }
    }

    const items = venta.items.map((item) => ({
      ventaItemId: item.id,
      productoId: item.productoId,
      nombre: item.producto.nombre,
      cantidadVendida: item.cantidad,
      yaDevuelto: devueltasPorItem.get(item.id) ?? 0,
      disponible: item.cantidad - (devueltasPorItem.get(item.id) ?? 0),
      precioUnitario: item.precioUnitario,
    }));

    const cuentasPorCobrar = await prisma.cuentaPorCobrar.findMany({
      where: {
        tenantId,
        estado: { not: 'ANULADA' },
        OR: [
          { facturaId: venta.ventaId },
          ...(venta.factura?.idFactura ? [{ facturaId: venta.factura.idFactura }] : []),
        ],
      },
      select: { id: true, montoDeuda: true, montoPagado: true },
    });
    const saldoCxc = cuentasPorCobrar.reduce(
      (sum, c) => sum + Math.max(Number(c.montoDeuda) - Number(c.montoPagado), 0),
      0,
    );

    const turnoAbierto = venta.puntoDeVentaId
      ? await prisma.turnoPuntoVenta.findFirst({
          where: {
            tenantId,
            puntoDeVentaId: venta.puntoDeVentaId,
            estado: 'ABIERTO',
          },
          select: { id: true },
        })
      : null;

    const notasCreditoPrevias = venta.devoluciones
      .map((d) => d.facturaNotaCreditoId)
      .filter((id): id is string => id != null);

    return {
      venta: {
        ventaId: venta.ventaId,
        estado: venta.estado,
        anulada: venta.deletedAt != null,
        total: venta.total,
        descuento: venta.descuento ?? 0,
        cliente: venta.cliente,
        factura: venta.factura,
      },
      items,
      saldoCxc,
      hayTurnoAbierto: turnoAbierto != null,
      notasCreditoPrevias,
    };
  },
);

/**
 * @description Registra una devolución parcial o total de la venta.
 * @param {RegistrarDevolucionInput} input - Ítems, motivo, preferencia y clave.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns Resumen de la devolución registrada.
 */
export const registrarDevolucionAction = withAction(
  async (input: RegistrarDevolucionInput, user: AuthenticatedUser) => {
    const result = await DevolucionVentaService.registrar({ input, user });
    revalidatePath('/busy/sales');
    revalidatePath('/busy/facturas');
    return result;
  },
);

/**
 * @description Lista las devoluciones registradas de una venta.
 * @param {string} ventaId - Venta a consultar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 */
export const getDevolucionesDeVentaAction = withAction(
  async (ventaId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'ventas-pos', 'consultar devoluciones');
    const tenantId = requireTenant(user);
    return prisma.devolucionVenta.findMany({
      where: { tenantId, ventaId },
      include: {
        items: true,
        facturaNotaCredito: { select: { numeroFactura: true, estado: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
);
