'use server';

/**
 * @description Server Actions del reporte financiero formal.
 *
 * El reporte formal se publica por cuentas y tipos contables a partir del
 * mayor formal. Si la evidencia no alcanza, la acción devuelve el reporte
 * como no disponible con su causa: nunca degrada a fuentes legacy.
 *
 * @module src/features/contabilidad-formal/actions-reporte
 */
import { z } from 'zod';

import { withAction, ActionError } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { FormalFinancialReportResolution } from '@/features/contabilidad-formal/services/formal-financial-report-contract';
import { getFormalFinancialReport } from '@/features/contabilidad-formal/services/formal-financial-report-service';
import {
	listFormalPeriods,
	type FormalPeriodSummary,
} from '@/features/contabilidad-formal/services/formal-periods-service';

/** Feature de licencia que habilita la contabilidad formal. */
const FEATURE = 'contabilidad-formal';

const reporteSchema = z.object({
	periodoId: z.string().trim().min(1),
	cutoffAt: z.string().datetime({ offset: true }).optional(),
}).strict();

/**
 * @description Exige una empresa activa para consultar el reporte formal.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {string} Tenant del usuario autenticado.
 */
function exigirTenant(user: AuthenticatedUser): string {
	try {
		return requireTenant(user);
	} catch {
		throw new ActionError(
			'Selecciona una empresa para consultar el reporte contable formal',
			'TENANT_REQUIRED',
		);
	}
}

/**
 * @description Consulta el reporte financiero formal de un período contable.
 * @param {object} input - Período y corte opcional solicitados.
 * @param {AuthenticatedUser} user - Usuario autenticado inyectado por withAction.
 * @returns {Promise<FormalFinancialReportResolution>} Reporte formal o causa de indisponibilidad.
 */
export const getFormalFinancialReportAction = withAction<
	z.infer<typeof reporteSchema>,
	FormalFinancialReportResolution
>(async (input, user: AuthenticatedUser) => {
	const tenantId = exigirTenant(user);
	requireFeature(user, FEATURE, 'consultar el reporte contable formal');
	const parsed = reporteSchema.parse(input);
	return getFormalFinancialReport({
		tenantId,
		periodoId: parsed.periodoId,
		cutoffAt: parsed.cutoffAt ? new Date(parsed.cutoffAt) : undefined,
	});
});

/**
 * @description Lista los períodos del tenant con evidencia en el mayor formal.
 * @param {void} _input - Sin entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado inyectado por withAction.
 * @returns {Promise<FormalPeriodSummary[]>} Períodos consultables del reporte formal.
 */
export const listarPeriodosFormalesAction = withAction<void, FormalPeriodSummary[]>(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = exigirTenant(user);
		requireFeature(user, FEATURE, 'consultar el reporte contable formal');
		return listFormalPeriods({ tenantId });
	},
);
