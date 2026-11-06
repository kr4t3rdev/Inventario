'use server';

import { z } from 'zod';

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { calcularForecastQuiebre, resolverVentanaForecast, VENTANA_DIAS_MAXIMOS, VENTANA_DIAS_MINIMOS } from './lib/forecast-quiebre';

const forecastSchema = z.object({
  ventanaDias: z.coerce.number().int().min(VENTANA_DIAS_MINIMOS).max(VENTANA_DIAS_MAXIMOS).default(90),
  fechaCorte: z.coerce.date().optional(),
});
export type ForecastQuiebreInput = z.input<typeof forecastSchema>;

/**
 * @description Estima fecha y días hasta quiebre usando stock disponible y consumo histórico.
 * @param {ForecastQuiebreInput} input - Ventana de 7–180 días y fecha de corte opcional.
 * @param {AuthenticatedUser} user - Usuario autenticado del tenant.
 * @returns Forecast por producto con ventana y supuestos aplicados.
 */
export const getForecastQuiebreAction = withAction(
  async (input: ForecastQuiebreInput, user: AuthenticatedUser) => {
    requireFeature(user, 'reportes-financieros', 'consultar el forecast de quiebre');
    const tenantId = requireTenant(user);
    const { ventanaDias, fechaCorte = new Date() } = forecastSchema.parse(input);
    const ventana = resolverVentanaForecast(fechaCorte, ventanaDias);
    const [stock, movimientos, productos] = await Promise.all([
      prisma.stockUbicacion.groupBy({ by: ['productoId'], where: { tenantId }, _sum: { cantidadDisponible: true } }),
      prisma.stockMoveLine.groupBy({
        by: ['productoId', 'createdAt'],
        where: { tenantId, tipoOrigen: 'VENTA', createdAt: { gte: ventana.inicio, lt: ventana.fin }, cantidad: { lt: 0 } },
        _sum: { cantidad: true },
      }),
      prisma.producto.findMany({ where: { tenantId }, select: { id: true, nombre: true } }),
    ]);
    const disponibles = new Map(stock.map((fila) => [fila.productoId, fila._sum.cantidadDisponible ?? 0]));
    const salidas = movimientos.map((fila) => ({
      productoId: fila.productoId, dia: fila.createdAt.toISOString().slice(0, 10),
      unidades: Math.abs(fila._sum.cantidad ?? 0),
    }));
    return calcularForecastQuiebre(disponibles, salidas, new Map(productos.map((p) => [p.id, p.nombre])), ventana);
  },
);
