'use server';

import { z } from 'zod';

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { calcularValuacionFifo } from './lib/valoracion-fifo';

const valorizadoSchema = z.object({ fechaCorte: z.coerce.date() });
export type ValorizadoAFechaInput = z.infer<typeof valorizadoSchema>;

/**
 * @description Calcula el inventario valorizado al cierre de una fecha del tenant.
 * @param {ValorizadoAFechaInput} input - Fecha de corte inclusiva.
 * @param {AuthenticatedUser} user - Usuario autenticado del tenant.
 * @returns {Promise<unknown>} Saldos por producto y total valorizado.
 */
export const getValorizadoAFechaAction = withAction(
  async (input: ValorizadoAFechaInput, user: AuthenticatedUser) => {
    requireFeature(user, 'reportes-financieros', 'consultar el valorizado');
    const tenantId = requireTenant(user);
    const { fechaCorte } = valorizadoSchema.parse(input);
    const hasta = new Date(fechaCorte);
    hasta.setUTCHours(0, 0, 0, 0);
    hasta.setUTCDate(hasta.getUTCDate() + 1);

    const [productos, existencias, compras] = await Promise.all([
      prisma.producto.findMany({
        where: { tenantId },
        select: { id: true, precioCosto: true },
      }),
      prisma.stockMoveLine.groupBy({
        by: ['productoId'],
        where: { tenantId, createdAt: { lt: hasta } },
        _sum: { cantidad: true },
      }),
      prisma.compraDocumentoItem.findMany({
        where: {
          tenantId,
          compraDocumento: {
            tenantId, deletedAt: null, estado: { not: 'ANULADA' }, fechaCompra: { lt: hasta },
          },
        },
        select: {
          compraDocumentoItemId: true, productoId: true, cantidad: true, precioUnitario: true,
        },
      }),
    ]);
    const ids = productos.map(({ id }) => id);
    const [asignaciones, cambiosFuturos] = await Promise.all([
      prisma.purchaseAllocation.groupBy({
        by: ['compraDocumentoItemId'],
        where: {
          tenantId, createdAt: { lt: hasta },
          compraDocumentoItem: { tenantId, compraDocumento: { fechaCompra: { lt: hasta } } },
        },
        _sum: { cantidad: true },
      }),
      prisma.productoCostHistory.findMany({
        where: { productoId: { in: ids }, changedAt: { gte: hasta } },
        orderBy: { changedAt: 'asc' },
        select: { productoId: true, oldPrecioCosto: true },
      }),
    ]);
    const stock = new Map(existencias.map(({ productoId, _sum }) => [productoId, _sum.cantidad ?? 0]));
    const costoAlCorte = new Map<string, number>();
    for (const cambio of cambiosFuturos) {
      if (!costoAlCorte.has(cambio.productoId)) {
        costoAlCorte.set(cambio.productoId, cambio.oldPrecioCosto);
      }
    }
    const asignado = new Map<string, number>();
    for (const item of asignaciones) {
      if (item.compraDocumentoItemId) {
        asignado.set(item.compraDocumentoItemId, item._sum.cantidad ?? 0);
      }
    }
    return calcularValuacionFifo(
      compras.map((item) => ({
        id: item.compraDocumentoItemId, productoId: item.productoId,
        cantidad: item.cantidad, precioUnitario: item.precioUnitario,
      })),
      asignado,
      productos.map((producto) => ({
        productoId: producto.id,
        precioCosto: costoAlCorte.get(producto.id) ?? producto.precioCosto,
        stockTotal: stock.get(producto.id) ?? 0,
      })),
    );
  },
);
