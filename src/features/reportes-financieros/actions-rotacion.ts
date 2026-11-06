'use server';

import { z } from 'zod';

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { ActionError, withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { calcularRotacionInventario, resolverPeriodoRotacion } from './lib/rotacion-inventario';

const rotacionSchema = z.object({ fechaDesde: z.coerce.date(), fechaHasta: z.coerce.date() });
export type RotacionInventarioInput = z.infer<typeof rotacionSchema>;

/**
 * @description Calcula la rotación de inventario por producto en el periodo indicado.
 * @param {RotacionInventarioInput} input - Fechas inclusivas del periodo (UTC).
 * @param {AuthenticatedUser} user - Usuario autenticado del tenant.
 * @returns {Promise<unknown>} Rotación por producto, periodo y definición del cálculo.
 */
export const getRotacionInventarioAction = withAction(
  async (input: RotacionInventarioInput, user: AuthenticatedUser) => {
    requireFeature(user, 'reportes-financieros', 'consultar la rotación de inventario');
    const tenantId = requireTenant(user);
    const { fechaDesde, fechaHasta } = rotacionSchema.parse(input);
    const periodo = resolverPeriodoRotacion(fechaDesde, fechaHasta);
    if (periodo.fin <= periodo.inicio) throw new ActionError('El periodo de rotación es inválido: la fecha final no puede ser anterior a la inicial', 'PERIODO_ROTACION_INVALIDO');

    const [inicial, final, salidas, productos] = await Promise.all([
      prisma.stockMoveLine.groupBy({ by: ['productoId'], where: { tenantId, createdAt: { lt: periodo.inicio } }, _sum: { cantidad: true } }),
      prisma.stockMoveLine.groupBy({ by: ['productoId'], where: { tenantId, createdAt: { lt: periodo.fin } }, _sum: { cantidad: true } }),
      prisma.stockMoveLine.groupBy({ by: ['productoId'], where: { tenantId, createdAt: { gte: periodo.inicio, lt: periodo.fin }, cantidad: { lt: 0 } }, _sum: { cantidad: true } }),
      prisma.producto.findMany({ where: { tenantId }, select: { id: true, nombre: true } }),
    ]);
    const aMapa = (filas: { productoId: string; _sum: { cantidad: number | null } }[]) => new Map(filas.map((fila) => [fila.productoId, fila._sum.cantidad ?? 0]));

    const saldos = { inicial: aMapa(inicial), final: aMapa(final), salidas: aMapa(salidas) };
    return calcularRotacionInventario(saldos, new Map(productos.map((producto) => [producto.id, producto.nombre])), periodo);
  },
);
