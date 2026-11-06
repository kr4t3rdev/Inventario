'use server';

import { z } from 'zod';
import { resolverReglaPutaway } from '@/features/inventario/services/putaway';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { ActionError, withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';

const productoSchema = z.object({ productoId: z.string().trim().min(1) });

/**
 * @description Sugiere una ubicación de putaway por producto y luego categoría, sin mover stock.
 * @param {{ productoId: string }} input - Producto recibido.
 * @param {AuthenticatedUser} user - Usuario autenticado con tenant activo.
 * @returns {Promise<{
 *   ubicacionId: string; nombre: string; almacenId: string; alcance: string;
 * } | null>}
 * Ubicación sugerida o null cuando no existe una regla.
 */
export const getUbicacionSugeridaPutawayAction = withAction(
	async (input: { productoId: string }, user: AuthenticatedUser) => {
		const { productoId } = productoSchema.parse(input);
		const tenantId = requireTenant(user);
		requireFeature(user, 'ubicaciones-avanzadas', 'sugerir ubicación de recepción');
		const producto = await prisma.producto.findFirst({
			where: { id: productoId, tenantId },
			select: { categoriaId: true },
		});
		if (!producto) throw new ActionError('Producto no encontrado', 'NOT_FOUND');
		const reglas = await prisma.reglaPutaway.findMany({
			where: { tenantId, OR: [{ productoId }, { categoriaId: producto.categoriaId }] },
			select: {
				id: true, tenantId: true, productoId: true, categoriaId: true, ubicacionId: true,
				ubicacion: { select: { nombre: true, almacenId: true } },
			},
		});
		const resolucion = resolverReglaPutaway({
			tenantId, productoId, categoriaId: producto.categoriaId,
		}, reglas);
		const regla = reglas.find((candidata) => candidata.id === resolucion?.reglaId);
		return regla && resolucion ? {
			ubicacionId: regla.ubicacionId,
			nombre: regla.ubicacion.nombre,
			almacenId: regla.ubicacion.almacenId,
			alcance: resolucion.alcance,
		} : null;
	},
);
