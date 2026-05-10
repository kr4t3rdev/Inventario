/**
 * @description Server Actions para Inyección de Capital.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
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
  const inyecciones = await prisma.inyeccionCapital.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return { inyecciones };
});

export const createInyeccionCapitalAction = withAction(async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  const parsed = createSchema.parse(input);
  const tenantId = requireTenant(user);
  const inyeccion = await prisma.inyeccionCapital.create({
    data: { monto: parsed.monto, moneda: parsed.moneda, tipo: parsed.tipo, descripcion: parsed.descripcion, cuentaBancariaId: parsed.cuentaBancariaId, tenantId },
  });
  revalidatePath('/busy/contabilidad/capital');
  return inyeccion;
});

export const registrarPagoCapitalAction = withAction(async (input: z.infer<typeof pagoSchema>, user: AuthenticatedUser) => {
  const parsed = pagoSchema.parse(input);
  const tenantId = requireTenant(user);
  const pago = await prisma.pagoDeuda.create({
    data: { inyeccionId: parsed.inyeccionId, monto: parsed.monto, cuentaBancariaId: parsed.cuentaBancariaId, tipoPagoId: parsed.tipoPagoId, observaciones: parsed.observaciones, tenantId },
  });
  revalidatePath('/busy/contabilidad/capital');
  return pago;
});
