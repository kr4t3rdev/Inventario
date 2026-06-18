/**
 * @description Server Actions para Inyección de Capital.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const createSchema = z.object({
  monto: z.coerce.number().positive(),
  moneda: z.string().optional().default('CUP'),
  tipo: z.string().optional().default('APORTE'),
  descripcion: z.string().optional(),
  cuentaBancariaId: z.string().optional(),
});

const pagoSchema = z.object({
  inyeccionId: z.string().min(1),
  monto: z.coerce.number().positive(),
  cuentaBancariaId: z.string().min(1),
  tipoPagoId: z.string().min(1),
  observaciones: z.string().optional(),
});

export const getInyeccionesCapitalAction = withAction(async (_input: { tipo?: string } = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'inyeccion-capital', 'ver inyecciones de capital');
  return AccountingOperationsReadService.getCapitalInjections({
    tenantId,
    tipo: _input.tipo,
  });
});

export const createInyeccionCapitalAction = withAction(withPeriodValidation(
  () => new Date(),
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  requireFeature(user, 'inyeccion-capital', 'registrar inyecciones de capital');
  const inyeccion = await AccountingOperationsMutationService.createCapitalInjection({
    input,
    user,
  });
  revalidatePath('/busy/contabilidad/capital');
  return inyeccion;
}));

export const registrarPagoCapitalAction = withAction(withPeriodValidation(
  () => new Date(),
  async (input: z.infer<typeof pagoSchema>, user: AuthenticatedUser) => {
  requireFeature(user, 'inyeccion-capital', 'registrar pagos de deuda');
  const pago = await AccountingOperationsMutationService.registerCapitalPayment({
    input,
    user,
  });
  revalidatePath('/busy/contabilidad/capital');
  return pago;
}));
