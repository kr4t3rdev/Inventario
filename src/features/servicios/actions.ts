'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { servicioSchema, servicioUpdateSchema } from './schemas';
import type { ServicioInput, ServicioUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getServiciosAction = withAction(async (_: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.servicios.findMany({ where: { tenantId }, orderBy: { nombre: 'asc' } });
});
export const getServicioByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const s = await prisma.servicios.findFirst({ where: { servicioId: id, tenantId } });
  if (!s) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  return s;
});
export const createServicioAction = withAction(async (input: ServicioInput, user: AuthenticatedUser) => {
  const p = servicioSchema.parse(input); const tid = requireTenant(user);
  const s = await prisma.servicios.create({ data: { ...p, tenantId: tid } });
  revalidatePath('/busy/servicios'); return s;
});
export const updateServicioAction = withAction(async (input: ServicioUpdateInput, user: AuthenticatedUser) => {
  const p = servicioUpdateSchema.parse(input); const { servicioId, ...d } = p; const tid = requireTenant(user);
  const ex = await prisma.servicios.findFirst({ where: { servicioId, tenantId: tid } });
  if (!ex) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  const s = await prisma.servicios.update({ where: { servicioId }, data: d });
  revalidatePath('/busy/servicios'); return s;
});
export const deleteServicioAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tid = requireTenant(user);
  const ex = await prisma.servicios.findFirst({ where: { servicioId: id, tenantId: tid } });
  if (!ex) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  await prisma.servicios.delete({ where: { servicioId: id } });
  revalidatePath('/busy/servicios'); return { id, eliminado: true };
});
