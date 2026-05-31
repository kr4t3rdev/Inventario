'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireManagerRole } from '@/lib/services/tenant-scope';
import { servicioSchema, servicioUpdateSchema } from './schemas';
import type { ServicioInput, ServicioUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { Servicios } from '@/app/models/model';

type ServicioRow = NonNullable<Awaited<ReturnType<typeof prisma.servicios.findFirst>>>;

type ServicioActionItem = Servicios & {
  tenantId: string;
};

function serializeServicio(servicio: ServicioRow): ServicioActionItem {
  return {
    ...servicio,
    createdAt: servicio.createdAt.toISOString(),
    updatedAt: servicio.updatedAt.toISOString(),
  };
}

export const getServiciosAction = withAction(async (_: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const servicios = await prisma.servicios.findMany({ where: { tenantId }, orderBy: { nombre: 'asc' } });
  return servicios.map(serializeServicio);
});
export const getServicioByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const s = await prisma.servicios.findFirst({ where: { servicioId: id, tenantId } });
  if (!s) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  return serializeServicio(s);
});
export const createServicioAction = withAction(async (input: ServicioInput, user: AuthenticatedUser) => {
  requireManagerRole(user, 'crear servicios');
  const p = servicioSchema.parse(input); const tid = requireTenant(user);
  const s = await prisma.servicios.create({ data: { ...p, tenantId: tid } });
  revalidatePath('/busy/servicios'); return serializeServicio(s);
});
export const updateServicioAction = withAction(async (input: ServicioUpdateInput, user: AuthenticatedUser) => {
  requireManagerRole(user, 'editar servicios');
  const p = servicioUpdateSchema.parse(input); const { servicioId, ...d } = p; const tid = requireTenant(user);
  const ex = await prisma.servicios.findFirst({ where: { servicioId, tenantId: tid } });
  if (!ex) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  const s = await prisma.servicios.update({ where: { servicioId }, data: d });
  revalidatePath('/busy/servicios'); return serializeServicio(s);
});
export const deleteServicioAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireManagerRole(user, 'eliminar servicios');
  const tid = requireTenant(user);
  const ex = await prisma.servicios.findFirst({ where: { servicioId: id, tenantId: tid } });
  if (!ex) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  await prisma.servicios.delete({ where: { servicioId: id } });
  revalidatePath('/busy/servicios'); return { id, eliminado: true };
});
