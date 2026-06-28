/**
 * @description Server Actions para Ajustes Bancarios.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { isBasicPlanName } from '@/lib/plan-access';
import { requireFeature } from '@/lib/services/tenant-scope';


function guardAdvancedBasicAccounting(user: AuthenticatedUser, action: string): void {
  requireFeature(user, 'contabilidad', action);

  if (user.role !== 'admin' && isBasicPlanName(user.planName)) {
    throw new ActionError(
      `Tu plan actual no incluye la funcionalidad de ${action}. Actualiza tu plan para continuar.`,
      'FEATURE_NOT_AVAILABLE',
    );
  }
}

const createSchema = z.object({
  cuentaId: z.string().min(1, 'ID de cuenta es requerido'),
  tipo: z.enum(['ingreso', 'egreso']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  moneda: z.string().min(1, 'Moneda es requerida').default('CUP'),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  motivo: z.string().min(1, 'Motivo es obligatorio')
});

export const getAjustesByCuentaAction = withAction(async (params: { cuentaId: string; page?: number; limit?: number; fechaInicio?: string; fechaFin?: string; tipo?: string }, user: AuthenticatedUser) => {
  guardAdvancedBasicAccounting(user, 'gestionar ajustes bancarios');
  return AccountingOperationsReadService.getBankAdjustments(params);
});

export const createAjusteBancarioAction = withAction(withPeriodValidation(
  // Ajustes bancarios usan la fecha actual como fecha de negocio
  () => new Date(),
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
    guardAdvancedBasicAccounting(user, 'registrar ajustes bancarios');
    const result = await AccountingOperationsMutationService.createBankAdjustment({
      input,
      user,
    });
    revalidatePath('/busy/contabilidad/ajustes');
    return result;
  }
));
