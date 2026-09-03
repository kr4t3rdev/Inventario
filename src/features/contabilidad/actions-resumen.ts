'use server';

import { withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { getReportCapabilities } from '@/features/contabilidad/actions';
import { getMonedasAction } from '@/features/contabilidad/actions-exchange';
import { getPrestamosCashStatsAction } from '@/features/contabilidad/actions-prestamos-cash';
import { getResumenAnticiposAction } from '@/features/contabilidad/actions-anticipos';
import { getReconciliacionStatsAction } from '@/features/contabilidad/actions-reconciliacion';

/**
 * Payload completo del panel de resumen del dashboard de contabilidad.
 * Cada subconsulta tolera fallo individual: las secciones opcionales
 * devuelven null/[] en lugar de tumbar todo el panel.
 */
interface ResumenCompletoPayload {
  resumen: unknown;
  monedas: unknown[];
  prestamosStats: unknown | null;
  resumenAnticipos: unknown | null;
  conteos: { ventas: { pending: number }; servicios: { pending: number }; gastos: { pending: number } } | null;
}

/**
 * @description Consolida en una sola llamada todo lo que necesita el panel de
 * resumen financiero del dashboard: reporte canónico, catálogo de monedas,
 * estadísticas de préstamos/anticipos (si el plan las habilita) y conteos
 * ligeros de pendientes de conciliación.
 * Sustituye ~7 llamadas independientes del cliente por una sola petición.
 * @param {{ fechaInicio?: string; fechaFin?: string; cuentaId?: string }} params - Filtros del período.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Payload consolidado tolerante a fallos parciales.
 */
export const getResumenCompletoAction = withAction(
  async (
    params: { fechaInicio?: string; fechaFin?: string; cuentaId?: string } = {},
    user: AuthenticatedUser,
  ) => {
    requireFeature(user, 'contabilidad', 'consultar el resumen completo');
    const tenantId = requireTenant(user);
    const capabilities = getReportCapabilities(user);

    const [resumen, monedas, prestamos, anticipos, conteos] = await Promise.all([
      AccountingReportsService.getSummaryReport({
        tenantId,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
        cuentaId: params.cuentaId,
        ...capabilities,
      }),
      getMonedasAction(),
      capabilities.includePrestamosCash
        ? getPrestamosCashStatsAction()
        : Promise.resolve(null),
      user.planFeatures?.['anticipos'] === true
        ? getResumenAnticiposAction({ fechaInicio: params.fechaInicio, fechaFin: params.fechaFin })
        : Promise.resolve(null),
      getReconciliacionStatsAction(),
    ]);

    const payload: ResumenCompletoPayload = {
      resumen,
      monedas: monedas?.success ? (monedas.data as unknown[]) : [],
      prestamosStats: prestamos?.success ? prestamos.data : null,
      resumenAnticipos: anticipos?.success ? anticipos.data : null,
      conteos: conteos?.success ? (conteos.data?.modules as ResumenCompletoPayload['conteos']) : null,
    };
    return payload;
  },
);
