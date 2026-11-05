'use server';

/**
 * @description Server Actions de observabilidad de la contabilidad formal.
 *
 * Las metricas del outbox en modo shadow permiten seguir el comportamiento del
 * emisor antes de exigir el asiento formal: son la evidencia que pide el
 * rollout para decidir cuando pasar de `shadow` a `enforce`.
 *
 * Las metricas son siempre del tenant autenticado: la accion no acepta un
 * tenant por parametro y exige la licencia de contabilidad formal y el
 * permiso de auditoria financiera.
 *
 * @module src/features/contabilidad-formal/actions-metricas-shadow
 */
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { consultarMetricasShadow } from '@/features/contabilidad-formal/services/shadow-outbox';

/**
 * @description Consulta las metricas del outbox shadow del tenant autenticado.
 * @param {void} _input - No admite parametros: el tenant sale de la sesion.
 * @param {AuthenticatedUser} user - Actor autenticado y autorizado.
 * @returns {Promise<import('@/features/contabilidad-formal/services/shadow-outbox').MetricaShadow[]>} Conteos y latencia por evento, resultado y causa.
 */
export const getMetricasShadowAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requireFeature(user, 'contabilidad-formal', 'consultar las metricas contables');
		requirePermission(user, 'financiero.auditoria.ver', 'consultar las metricas contables');
		return consultarMetricasShadow(prisma, tenantId);
	},
);
