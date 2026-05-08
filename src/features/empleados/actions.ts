/**
 * @description Server Actions para empleados (CRUD básico).
 *
 * @module features/empleados/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { empleadoSchema, empleadoUpdateSchema } from './schemas';
import type { EmpleadoInput, EmpleadoUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getEmpleadosAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.empleado.findMany({
    where: { tenantId },
    orderBy: { salarioBases: 'desc' },
  });
});

export const getEmpleadoByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const empleado = await prisma.empleado.findFirst({
    where: { empleadoId: id, tenantId },
    include: {
      ventas: { include: { producto: true }, orderBy: { createdAt: 'desc' as const }, take: 10 },
    },
  });
  if (!empleado) throw new ActionError('Empleado no encontrado', 'NOT_FOUND');
  return empleado;
});

export const createEmpleadoAction = withAction(async (input: EmpleadoInput, user: AuthenticatedUser) => {
  const parsed = empleadoSchema.parse(input);
  const tenantId = requireTenant(user);

  const empleado = await prisma.empleado.create({
    data: {
      nombre: parsed.nombre,
      apellido: parsed.apellido,
      telefono: parsed.telefono ?? null,
      cargo: parsed.cargo,
      salarioBases: parsed.salarioBases,
      fechaContratacion: parsed.fechaContratacion ? new Date(parsed.fechaContratacion) : new Date(),
      esTiempoCompleto: parsed.esTiempoCompleto ?? true,
      diasVacacionesAnuales: parsed.diasVacacionesAnuales ?? 15,
      tenantId,
    },
  });

  revalidatePath('/busy/empleados');
  return empleado;
});

export const updateEmpleadoAction = withAction(async (input: EmpleadoUpdateInput, user: AuthenticatedUser) => {
  const parsed = empleadoUpdateSchema.parse(input);
  const { empleadoId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.empleado.findFirst({ where: { empleadoId, tenantId } });
  if (!existing) throw new ActionError('Empleado no encontrado', 'NOT_FOUND');

  const empleado = await prisma.empleado.update({
    where: { empleadoId },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.apellido !== undefined && { apellido: data.apellido }),
      ...(data.telefono !== undefined && { telefono: data.telefono }),
      ...(data.cargo !== undefined && { cargo: data.cargo }),
      ...(data.salarioBases !== undefined && { salarioBases: data.salarioBases }),
      ...(data.esTiempoCompleto !== undefined && { esTiempoCompleto: data.esTiempoCompleto }),
      ...(data.diasVacacionesAnuales !== undefined && { diasVacacionesAnuales: data.diasVacacionesAnuales }),
    },
  });

  revalidatePath('/busy/empleados');
  return empleado;
});

export const deleteEmpleadoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.empleado.findFirst({ where: { empleadoId: id, tenantId } });
  if (!existing) throw new ActionError('Empleado no encontrado', 'NOT_FOUND');

  await prisma.empleado.delete({ where: { empleadoId: id } });
  revalidatePath('/busy/empleados');
  return { success: true };
});
