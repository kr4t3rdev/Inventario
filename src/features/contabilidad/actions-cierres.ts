/**
 * @description Server Actions para Cierres Contables.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const createSchema = z.object({
  tipo: z.string().min(1),
  fechaInicio: z.string().min(1),
  fechaFin: z.string().min(1),
  creadoPor: z.string().min(1),
  observaciones: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  estado: z.string().optional(),
  aprobadoPor: z.string().optional(),
  observaciones: z.string().optional(),
});

export const getCierresAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.cierreContable.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
});

export const getCierreByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const cierre = await prisma.cierreContable.findFirst({ where: { cierreId: id, tenantId } });
  if (!cierre) throw new ActionError('Cierre no encontrado', 'NOT_FOUND');
  return cierre;
});

export const createCierreAction = withAction(async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  const parsed = createSchema.parse(input);
  const tenantId = requireTenant(user);
  const cierre = await prisma.cierreContable.create({
    data: { tipo: parsed.tipo, fechaInicio: new Date(parsed.fechaInicio), fechaFin: new Date(parsed.fechaFin), creadoPor: parsed.creadoPor, observaciones: parsed.observaciones, tenantId, estado: 'BORRADOR' },
  });
  revalidatePath('/busy/contabilidad/cierres');
  return cierre;
});

export const updateCierreAction = withAction(async (input: z.infer<typeof updateSchema>, user: AuthenticatedUser) => {
  const parsed = updateSchema.parse(input);
  const tenantId = requireTenant(user);
  const existing = await prisma.cierreContable.findFirst({ where: { cierreId: parsed.id, tenantId } });
  if (!existing) throw new ActionError('Cierre no encontrado', 'NOT_FOUND');
  const cierre = await prisma.cierreContable.update({
    where: { cierreId: parsed.id },
    data: { ...(parsed.estado && { estado: parsed.estado }), ...(parsed.aprobadoPor && { aprobadoPor: parsed.aprobadoPor }), ...(parsed.observaciones && { observaciones: parsed.observaciones }) },
  });
  revalidatePath('/busy/contabilidad/cierres');
  return cierre;
});

export const deleteCierreAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.cierreContable.findFirst({ where: { cierreId: id, tenantId } });
  if (!existing) throw new ActionError('Cierre no encontrado', 'NOT_FOUND');
  await prisma.cierreContable.delete({ where: { cierreId: id } });
  revalidatePath('/busy/contabilidad/cierres');
  return { success: true };
});
