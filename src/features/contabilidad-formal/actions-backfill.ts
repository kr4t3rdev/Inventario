'use server';

/**
 * @description Server Actions del backfill histórico (CTA-4): el dry-run es
 * lectura pura y la ejecución exige confirmación explícita ('REPLAY').
 * @module src/features/contabilidad-formal/actions-backfill
 */

import { z } from 'zod';

import { withAction, ActionError } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
	ejecutarBackfillPeriodo,
	planBackfillContable,
} from '@/features/contabilidad-formal/services/replay-backfill-service';

const FEATURE = 'contabilidad-formal';

const ejecutarSchema = z.object({
	periodoId: z.string().trim().min(1, 'Período obligatorio'),
	confirmacion: z
		.string()
		.refine((v) => v === 'REPLAY', 'Escribe REPLAY para confirmar la ejecución'),
}).strict();

/**
 * @description Plan dry-run del backfill por períodos (lectura, sin escribir).
 */
export const getPlanBackfillAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'consultar el plan de backfill contable');
		return planBackfillContable(tenantId);
	},
);

/**
 * @description Ejecuta el replay histórico de un período explícito, con el
 * token de confirmación 'REPLAY'. Devuelve los conteos de la corrida.
 */
export const ejecutarBackfillPeriodoAction = withAction(
	async (input: z.infer<typeof ejecutarSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'ejecutar el backfill contable');
		const parsed = ejecutarSchema.parse(input);
		if (user.role !== 'admin' && user.tenantRole !== 'manager' && user.tenantRole !== 'contador') {
			throw new ActionError(
				'Solo un administrador o responsable de contabilidad puede ejecutar el replay',
				'FORBIDDEN',
			);
		}
		return ejecutarBackfillPeriodo(tenantId, parsed.periodoId, user.userId);
	},
);
