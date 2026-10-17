/**
 * @description Server Actions para Ajustes Bancarios.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';


const createSchema = z.object({
  cuentaId: z.string().min(1, 'ID de cuenta es requerido'),
  tipo: z.enum(['ingreso', 'egreso']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  moneda: z.string().min(1, 'Moneda es requerida').default('CUP'),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  motivo: z.string().min(1, 'Motivo es obligatorio'),
  tasaCambio: z.number().positive().optional(),
  fechaOperacion: z.coerce.date().optional(),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
});

export const getAjustesByCuentaAction = withAction(async (params: { cuentaId: string; page?: number; limit?: number; fechaInicio?: string; fechaFin?: string; tipo?: string }, user: AuthenticatedUser) => {
  requireFeature(user, 'ajustes-bancarios', 'gestionar ajustes bancarios');
  return AccountingOperationsReadService.getBankAdjustments({
    ...params,
    tenantId: requireTenant(user),
  });
});

const createAdjustmentWithPeriodValidation = withPeriodValidation(
  (input: z.infer<typeof createSchema>) => input.fechaOperacion ? new Date(input.fechaOperacion) : new Date(),
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
    requireFeature(user, 'ajustes-bancarios', 'registrar ajustes bancarios');
    const result = await AccountingOperationsMutationService.createBankAdjustment({
      input,
      user,
    });
    revalidatePath('/busy/contabilidad/ajustes');
    return result;
  }
);

export const createAjusteBancarioAction = withAction(async (
  input: z.infer<typeof createSchema>,
  user: AuthenticatedUser,
) => {
  requireFeature(user, 'ajustes-bancarios', 'registrar ajustes bancarios');
  const existingReplay = await AccountingOperationsMutationService.findBankAdjustmentReplay({
    input,
    user,
  });
  if (existingReplay) return existingReplay;

  try {
    return await createAdjustmentWithPeriodValidation(input, user);
  } catch (error) {
    const replayAfterGate = await AccountingOperationsMutationService.findBankAdjustmentReplay({
      input,
      user,
    });
    if (replayAfterGate) return replayAfterGate;
    throw error;
  }
});
