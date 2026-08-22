"use server";

import { z } from 'zod';

import { withAction, ActionError } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  getBalanceResultsReport,
  type BalanceResultsReport,
} from '@/features/contabilidad/services/balance-results-report-service';

const balanceResultsInputSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  cutoffAt: z.string().datetime({ offset: true }).optional(),
  moneda: z.string().trim().min(3).max(5).regex(/^[A-Za-z]+$/).transform((value) => value.toUpperCase()).optional(),
}).strict();

type BalanceResultsActionInput = z.input<typeof balanceResultsInputSchema>;

/**
 * @description Consulta balance y resultados con tenant, feature y parámetros validados.
 * @param {BalanceResultsActionInput} input - Período, corte y moneda solicitados.
 * @param {AuthenticatedUser} user - Usuario autenticado inyectado por withAction.
 * @returns {Promise<BalanceResultsReport>} Reporte contable compartido.
 */
export const getBalanceResultsAction = withAction<
  BalanceResultsActionInput,
  BalanceResultsReport
>(async (input, user: AuthenticatedUser) => {
  let tenantId: string;
  try {
    tenantId = requireTenant(user);
  } catch {
    throw new ActionError(
      'Selecciona una empresa para consultar el reporte',
      'TENANT_REQUIRED',
    );
  }

  requireFeature(user, 'contabilidad', 'consultar balance y resultados');

  const parsed = balanceResultsInputSchema.parse(input ?? {});
  return getBalanceResultsReport({
    tenantId,
    year: parsed.year,
    cutoffAt: parsed.cutoffAt ? new Date(parsed.cutoffAt) : undefined,
    moneda: parsed.moneda,
  });
});
