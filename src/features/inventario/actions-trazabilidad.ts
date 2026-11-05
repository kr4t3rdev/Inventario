'use server';

import { ActionError, withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

import {
	construirTrazabilidadLote,
	trazabilidadLoteSelect,
} from '@/features/inventario/services/trazabilidad-lote';

/**
 * @description Obtiene la trazabilidad de un lote: documento de origen y ventas destino.
 * @param {string} loteId - Identificador del lote dentro del tenant autenticado.
 * @param {AuthenticatedUser} user - Usuario autenticado con tenant activo.
 * @returns {Promise<Object>} Trazabilidad del lote con su origen y sus destinos.
 */
export const getTrazabilidadLoteAction = withAction(
	async (loteId: string, user: AuthenticatedUser) => {
		requireFeature(user, 'lotes-series', 'consultar trazabilidad de lotes');
		const tenantId = requireTenant(user);
		if (!loteId) throw new ActionError('El lote es obligatorio', 'VALIDATION_ERROR');

		const lote = await prisma.lote.findFirst({
			where: { id: loteId, tenantId },
			select: trazabilidadLoteSelect,
		});
		if (!lote) throw new ActionError('Lote no encontrado', 'NOT_FOUND');

		return construirTrazabilidadLote(lote);
	},
);
