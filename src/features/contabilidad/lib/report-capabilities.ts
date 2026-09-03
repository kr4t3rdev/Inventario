import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { canAccessAccountingItem } from '@/lib/plan-access';

/**
 * @description Deriva las fuentes contables habilitadas por el plan del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado con capacidades del plan.
 * @returns {object} Capacidades que limitan las fuentes incluidas en reportes.
 */
export function getReportCapabilities(user: AuthenticatedUser) {
  return {
    includeServicios: user.planFeatures?.servicios === true,
    includeTransfers: canAccessAccountingItem(user, 'Transferencias Bancarias'),
    includeAdjustments: canAccessAccountingItem(user, 'Ajustes Bancarios'),
    includeCapital: user.planFeatures?.['inyeccion-capital'] === true,
    includePrestamosCash: user.planFeatures?.['prestamos-cash'] === true,
    includeDeudasCash: user.planFeatures?.['deudas-cash'] === true,
  };
}
