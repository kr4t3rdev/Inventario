'use server';

/**
 * @description Server Actions del backfill histórico (CTA-4): el dry-run es
 * lectura pura. La ejecución queda bloqueada hasta persistir y validar la
 * aprobación independiente del preflight.
 * @module src/features/contabilidad-formal/actions-backfill
 */

import { z } from 'zod';

import { withAction, ActionError } from '@/lib/server-actions';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
	crearPreflightBackfill,
	aprobarPreflightBackfill,
	ejecutarBackfillAutorizado,
	planBackfillContable,
} from '@/features/contabilidad-formal/services/replay-backfill-service';

const FEATURE = 'contabilidad-formal';

const periodoSchema = z.object({ periodoId: z.string().trim().min(1) }).strict();
const preflightSchema = z.object({ replayPreflightId: z.string().trim().min(1) }).strict();
const ejecutarSchema = z.object({
	replayPreflightId: z.string().trim().min(1),
	replayApprovalId: z.string().trim().min(1),
}).strict();

function requireReplayPermission(user: AuthenticatedUser) {
	requirePermission(user, 'financiero.contabilidad.acceder', 'operar el replay contable');
}

function requireReplayManager(user: AuthenticatedUser) {
	if (user.tenantRole !== 'manager') {
		throw new ActionError('Solo un responsable activo puede operar el replay contable', 'FORBIDDEN');
	}
	requireReplayPermission(user);
}

/**
 * @description Plan dry-run del backfill por períodos (lectura, sin escribir).
 */
export const getPlanBackfillAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'consultar el plan de backfill contable');
		requireReplayPermission(user);
		return planBackfillContable(tenantId);
	},
);

/** @description Persiste el preflight para un único período. */
export const crearPreflightBackfillAction = withAction(
	async (input: z.infer<typeof periodoSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'generar el preflight contable');
		const parsed = periodoSchema.parse(input);
		requireReplayPermission(user);
		return crearPreflightBackfill(tenantId, parsed.periodoId, user.userId);
	},
);

/** @description Aprueba el preflight con un responsable distinto del solicitante. */
export const aprobarPreflightBackfillAction = withAction(
	async (input: z.infer<typeof preflightSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'aprobar el preflight contable');
		const parsed = preflightSchema.parse(input);
		requireReplayManager(user);
		return aprobarPreflightBackfill(tenantId, parsed.replayPreflightId, user.userId);
	},
);

/** @description Ejecuta un preflight aprobado y ligado al tenant autenticado. */
export const ejecutarBackfillPeriodoAction = withAction(
	async (input: z.infer<typeof ejecutarSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'ejecutar el backfill contable');
		const parsed = ejecutarSchema.parse(input);
		requireReplayManager(user);
		return ejecutarBackfillAutorizado({ ...parsed, tenantId, actorId: user.userId });
	},
);
