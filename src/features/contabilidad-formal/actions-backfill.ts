'use server';

/**
 * @description Server Actions del replay historico de la contabilidad formal.
 *
 * El plan (dry-run) es lectura pura. La ejecucion exige un preflight vigente
 * con aprobacion independiente: las acciones no permiten contabilizar un
 * periodo sin ese doble control.
 *
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

/** Feature de licencia que habilita la contabilidad formal. */
const FEATURE = 'contabilidad-formal';

/** Permiso que habilita a operar el replay contable. */
const PERMISO = 'financiero.contabilidad.acceder';

const periodoSchema = z.object({ periodoId: z.string().trim().min(1) }).strict();
const preflightSchema = z.object({ replayPreflightId: z.string().trim().min(1) }).strict();
const ejecutarSchema = z.object({
	replayPreflightId: z.string().trim().min(1),
	replayApprovalId: z.string().trim().min(1),
}).strict();

/**
 * @description Exige el permiso contable vigente del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {void} Resuelve si el usuario puede operar el replay.
 */
function requireReplayPermission(user: AuthenticatedUser): void {
	requirePermission(user, PERMISO, 'operar el replay contable');
}

/**
 * @description Exige un responsable contable (la aprobacion y la ejecucion no
 * admiten otros roles).
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {void} Resuelve si el usuario es responsable contable.
 */
function requireReplayManager(user: AuthenticatedUser): void {
	if (user.tenantRole !== 'manager') {
		throw new ActionError(
			'Solo un responsable activo puede operar el replay contable',
			'FORBIDDEN',
		);
	}
	requireReplayPermission(user);
}

/**
 * @description Plan dry-run del replay por periodos (lectura, sin escribir).
 * @param {void} _input - Sin entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Conteo de fuentes por periodo y omisiones.
 */
export const getPlanBackfillAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'consultar el plan de replay contable');
		requireReplayPermission(user);
		return planBackfillContable(tenantId);
	},
);

/**
 * @description Persiste el preflight (snapshot y digest) de un periodo.
 * @param {object} input - Periodo contable a reconstruir.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Preflight persistido.
 */
export const crearPreflightBackfillAction = withAction(
	async (input: z.infer<typeof periodoSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'generar el preflight contable');
		const parsed = periodoSchema.parse(input);
		requireReplayPermission(user);
		return crearPreflightBackfill(tenantId, parsed.periodoId, user.userId);
	},
);

/**
 * @description Aprueba el preflight con un responsable distinto del solicitante.
 * @param {object} input - Preflight a aprobar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Aprobacion persistida.
 */
export const aprobarPreflightBackfillAction = withAction(
	async (input: z.infer<typeof preflightSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'aprobar el preflight contable');
		const parsed = preflightSchema.parse(input);
		requireReplayManager(user);
		return aprobarPreflightBackfill(tenantId, parsed.replayPreflightId, user.userId);
	},
);

/**
 * @description Ejecuta un preflight aprobado y ligado al tenant autenticado.
 * @param {object} input - Preflight y aprobacion que lo habilitan.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado de la ejecucion con el verificador forense.
 */
export const ejecutarBackfillPeriodoAction = withAction(
	async (input: z.infer<typeof ejecutarSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, FEATURE, 'ejecutar el replay contable');
		const parsed = ejecutarSchema.parse(input);
		requireReplayManager(user);
		return ejecutarBackfillAutorizado({ ...parsed, tenantId, actorId: user.userId });
	},
);
