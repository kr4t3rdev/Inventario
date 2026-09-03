'use server';

import { withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

interface ReportFilters {
  busqueda?: string;
  fechaInicio?: string;
  fechaFin?: string;
  cuentaId?: string;
  tipoMovimiento?: string;
  moneda?: string;
  page?: number;
  limit?: number;
}

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

/**
 * @description Consulta transferencias bancarias desde el servicio de operaciones compartido.
 * @param {{ fechaInicio?: string; fechaFin?: string; cuentaId?: string }} params - Filtros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Transferencias tenant-scoped.
 */
export const getTransferenciasBancariasAction = withAction(
  async (
    params: { fechaInicio?: string; fechaFin?: string; cuentaId?: string } = {},
    user: AuthenticatedUser,
  ) => {
    requireFeature(user, 'transferencias-bancarias', 'consultar transferencias bancarias');
    return AccountingOperationsReadService.getBankTransfers({
      ...params,
      tenantId: requireTenant(user),
    });
  },
);

/**
 * @description Consulta el resumen financiero reconciliado desde el servicio canónico.
 * @param {{ fechaInicio?: string; fechaFin?: string; cuentaId?: string; moneda?: string }} filters - Filtros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Resumen financiero con cobertura.
 */
export const getResumenFinancieroAction = withAction(
  async (
    filters: {
      fechaInicio?: string;
      fechaFin?: string;
      cuentaId?: string;
      moneda?: string;
    } = {},
    user: AuthenticatedUser,
  ) => {
    requireFeature(user, 'contabilidad', 'consultar resumen financiero');
    return AccountingReportsService.getSummaryReport({
      tenantId: requireTenant(user),
      ...filters,
      ...getReportCapabilities(user),
    });
  },
);

/**
 * @description Consulta movimientos reconciliados desde el servicio canónico.
 * @param {ReportFilters} filters - Filtros y paginación.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Movimientos con totales y cobertura.
 */
export const getMovimientosReportAction = withAction(
  async (filters: ReportFilters = {}, user: AuthenticatedUser) => {
    requireFeature(user, 'contabilidad', 'consultar reportes financieros');
    return AccountingReportsService.getMovementsReport({
      tenantId: requireTenant(user),
      ...filters,
      ...getReportCapabilities(user),
    });
  },
);

/**
 * @description Valida una transferencia antes de ejecutarla.
 * @param {object} input - Datos de la transferencia.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Advertencias y suficiencia de saldo.
 */
export const validarTransferenciaAction = withAction(
  async (
    input: {
      cuentaOrigenId: string;
      cuentaDestinoId: string;
      monto: number;
      motivo: string;
      descripcion?: string;
    },
    user: AuthenticatedUser,
  ) => {
    requireFeature(user, 'transferencias-bancarias', 'validar transferencias bancarias');
    return AccountingOperationsMutationService.validateBankTransfer(input);
  },
);

/**
 * @description Crea una transferencia bancaria después de validar el período.
 * @param {object} input - Datos de la transferencia.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Transferencia creada.
 */
export const createTransferenciaBancariaAction = withAction(
  withPeriodValidation(
    () => new Date(),
    async (
      input: {
        cuentaOrigenId: string;
        cuentaDestinoId: string;
        montoOrigen: number;
        montoDestino?: number;
        motivo: string;
        descripcion?: string;
        tasaCambio?: number;
        monedaPrincipal?: string;
      },
      user: AuthenticatedUser,
    ) => {
      requireFeature(user, 'transferencias-bancarias', 'registrar transferencias bancarias');
      return AccountingOperationsMutationService.createBankTransfer({ input, user });
    },
  ),
);
