'use server';

import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { Prisma } from '@/generated/prisma';

const lotesInputSchema = z.object({
	search: z.string().trim().min(1).optional(),
	productoId: z.string().trim().min(1).optional(),
	page: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type LotesInput = z.infer<typeof lotesInputSchema>;

/**
 * @description Lista los lotes del tenant con producto, cantidades y fecha de vencimiento.
 * @param {LotesInput} input - Filtros opcionales de búsqueda por código o producto y paginación.
 * @param {AuthenticatedUser} user - Usuario autenticado con tenant activo.
 * @returns {Promise<unknown>} Lotes paginados del tenant.
 */
export const getLotesInventarioAction = withAction(
	async (input: LotesInput = {}, user: AuthenticatedUser) => {
		requireFeature(user, 'lotes-series', 'consultar lotes del inventario');
		const tenantId = requireTenant(user);
		const filtros = lotesInputSchema.parse(input ?? {});
		const page = filtros.page ?? 1;
		const limit = filtros.limit ?? 20;

		const where: Prisma.LoteWhereInput = {
			tenantId,
			...(filtros.productoId ? { productoId: filtros.productoId } : {}),
			...(filtros.search ? { codigo: { contains: filtros.search, mode: 'insensitive' } } : {}),
		};

		const [lotes, total] = await Promise.all([
			prisma.lote.findMany({
				where,
				select: {
					id: true,
					codigo: true,
					productoId: true,
					fechaVencimiento: true,
					cantidadInicial: true,
					cantidadDisponible: true,
					producto: { select: { nombre: true } },
				},
				orderBy: [{ fechaVencimiento: 'asc' }, { codigo: 'asc' }, { id: 'asc' }],
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.lote.count({ where }),
		]);

		return {
			lotes,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},
);
