'use server';

import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { ActionError, withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const ubicacionesHijasSchema = z.object({ almacenId: z.string().min(1) });

/**
 * @description Lista las hojas jerárquicas de un almacén del tenant.
 * @param {{ almacenId: string }} input - Almacén cuyas hojas se consultan.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<Array<{ id: string; nombre: string; parentId: string | null }>>}
 * Hojas ordenadas por nombre.
 */
export const getUbicacionesHijasAction = withAction(
  async (input: { almacenId: string }, user: AuthenticatedUser) => {
    const parsed = ubicacionesHijasSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'ubicaciones-avanzadas', 'consultar ubicaciones avanzadas');

    const almacen = await prisma.almacen.findFirst({
      where: { tenantId, almacenId: parsed.almacenId },
      select: { almacenId: true },
    });
    if (!almacen) throw new ActionError('Almacén no encontrado', 'NOT_FOUND');

    return prisma.ubicacion.findMany({
      where: {
        tenantId,
        almacenId: parsed.almacenId,
        children: { none: {} },
      },
      select: { id: true, nombre: true, parentId: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
  },
);