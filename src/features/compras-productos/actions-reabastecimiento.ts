'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { ActionError, withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

interface ReglaInput {
  productoId: string;
  tipoUbicacion?: string;
  ubicacionId: string;
  min: number;
  max: number;
}

/**
 * @description Crea o actualiza una regla de reabastecimiento min/max.
 * @param {ReglaInput} input - Producto, ubicación y umbrales válidos.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Regla guardada.
 */
export const upsertReglaReabastecimientoAction = withAction(
  async (input: ReglaInput, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'reabastecimiento', 'reglas de reabastecimiento');
    if (!input.productoId || !input.ubicacionId || input.min < 0 || input.max < input.min) {
      throw new ActionError('Los umbrales min/max no son válidos', 'VALIDATION_ERROR');
    }
    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    });
    if (!producto) throw new ActionError('Producto no encontrado', 'NOT_FOUND');
    return prisma.reglaReabastecimiento.upsert({
      where: {
        tenantId_productoId_tipoUbicacion_ubicacionId: {
          tenantId,
          productoId: input.productoId,
          tipoUbicacion: input.tipoUbicacion ?? 'almacen',
          ubicacionId: input.ubicacionId,
        },
      },
      create: {
        tenantId,
        productoId: input.productoId,
        tipoUbicacion: input.tipoUbicacion ?? 'almacen',
        ubicacionId: input.ubicacionId,
        min: input.min,
        max: input.max,
      },
      update: { min: input.min, max: input.max },
    });
  },
);

/**
 * @description Sugiere reponer hasta max cuando el disponible está por debajo de min.
 * Si existe una receta del producto propone FABRICAR; de lo contrario COMPRAR.
 * @param {{ tipoUbicacion?: string; ubicacionId?: string }} input - Filtros opcionales.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Sugerencias accionables.
 */
export const sugerirReabastecimientoAction = withAction(
  async (
    input: { tipoUbicacion?: string; ubicacionId?: string } = {},
    user: AuthenticatedUser,
  ) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'reabastecimiento', 'reabastecimiento');
    const where: Record<string, unknown> = { tenantId };
    if (input.tipoUbicacion) where.tipoUbicacion = input.tipoUbicacion;
    if (input.ubicacionId) where.ubicacionId = input.ubicacionId;
    const reglas = await prisma.reglaReabastecimiento.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    const stocks = await prisma.stockUbicacion.findMany({ where });
    const stockByLocation = new Map(
      stocks.map((stock: any) => [
        `${stock.productoId}:${stock.tipoUbicacion}:${stock.ubicacionId}`,
        stock.cantidadDisponible,
      ]),
    );
    const suggestions = [];
    for (const rule of reglas as any[]) {
      const available = Number(
        stockByLocation.get(`${rule.productoId}:${rule.tipoUbicacion}:${rule.ubicacionId}`) ?? 0,
      );
      if (available >= rule.min) continue;
      const producto = await prisma.producto.findFirst({
        where: { id: rule.productoId, tenantId },
        select: { id: true, nombre: true, Receta: { select: { recetaId: true }, take: 1 } },
      });
      if (!producto) continue;
      suggestions.push({
        reglaId: rule.id,
        productoId: rule.productoId,
        productoNombre: producto.nombre,
        tipoUbicacion: rule.tipoUbicacion,
        ubicacionId: rule.ubicacionId,
        disponible: available,
        min: rule.min,
        max: rule.max,
        cantidadSugerida: rule.max - available,
        tipo: producto.Receta.length > 0 ? 'FABRICAR' : 'COMPRAR',
        recetaId: producto.Receta[0]?.recetaId ?? null,
      });
    }
    return suggestions;
  },
);

/**
 * @description Elimina una regla de reabastecimiento del tenant.
 * @param {string} reglaId - Identificador de la regla.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Resultado de eliminación.
 */
export const deleteReglaReabastecimientoAction = withAction(
  async (reglaId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'reabastecimiento', 'reglas de reabastecimiento');
    const result = await prisma.reglaReabastecimiento.deleteMany({ where: { id: reglaId, tenantId } });
    if (result.count !== 1) throw new ActionError('Regla no encontrada', 'NOT_FOUND');
    revalidatePath('/busy/compras/reabastecimiento');
    return { deleted: true };
  },
);
