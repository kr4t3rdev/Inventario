'use server';

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { consultarMetricasShadow } from '@/features/contabilidad-formal/services/shadow-outbox';

/**
 * @description Consulta las métricas del outbox confirmado del tenant autenticado.
 * @param {void} _input - No admite parámetros de tenant provenientes del cliente.
 * @param {AuthenticatedUser} user - Actor autenticado y autorizado.
 * @returns {Promise<MetricaShadow[]>} Conteos y latencia agrupados del tenant.
 */
export const getMetricasShadowAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'contabilidad-formal', 'consultar métricas contables');
  requirePermission(user, 'financiero.auditoria.ver', 'consultar métricas contables');
  return consultarMetricasShadow(prisma, tenantId);
});
