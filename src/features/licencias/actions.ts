'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { resolveLicenseDurationDays } from '@/lib/services/license-duration';
import { createLicenciaSchema, updateLicenciaSchema } from './schemas';
import type { CreateLicenciaInput, UpdateLicenciaInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

function generarClave(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts: string[] = [];
  for (let s = 0; s < 4; s++) {
    let seg = '';
    for (let i = 0; i < 5; i++) seg += chars.charAt(Math.floor(Math.random() * chars.length));
    parts.push(seg);
  }
  return parts.join('-');
}

export const getLicenciasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('No autorizado', 'FORBIDDEN');
  return prisma.licencia.findMany({
    include: { usuario: { select: { userId: true, name: true, email: true } }, plan: true },
    orderBy: { createdAt: 'desc' },
  });
});

export const createLicenciaAction = withAction(async (input: CreateLicenciaInput, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('No autorizado', 'FORBIDDEN');
  const parsed = createLicenciaSchema.parse(input);
  const plan = await prisma.plan.findUnique({ where: { planId: parsed.planId } });
  if (!plan) throw new ActionError('Plan no encontrado', 'NOT_FOUND');
  const usuario = await prisma.user.findUnique({ where: { userId: parsed.usuarioId } });
  if (!usuario) throw new ActionError('Usuario no encontrado', 'NOT_FOUND');
  const expiracion = new Date();
  expiracion.setDate(
    expiracion.getDate() +
      resolveLicenseDurationDays(plan.duracionDias, parsed.duracionDias)!,
  );
  const licenseKey = parsed.clave?.trim() || generarClave();
  const licencia = await prisma.$transaction(async (tx: any) => {
    const nueva = await tx.licencia.create({
      data: { clave: licenseKey, usuarioId: parsed.usuarioId, planId: parsed.planId, expiracion },
      include: { usuario: { select: { userId: true, name: true, email: true } }, plan: true },
    });
    await tx.user.update({ where: { userId: parsed.usuarioId }, data: { expiresAt: expiracion } });
    return nueva;
  });
  revalidatePath('/admin');
  return licencia;
});

export const updateLicenciaAction = withAction(async (input: UpdateLicenciaInput, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('No autorizado', 'FORBIDDEN');
  const parsed = updateLicenciaSchema.parse(input);
  const existing = await prisma.licencia.findUnique({ where: { licenciaId: parsed.licenciaId } });
  if (!existing) throw new ActionError('Licencia no encontrada', 'NOT_FOUND');
  const data: Record<string, any> = {};
  if (parsed.activa !== undefined) data.activa = parsed.activa;
  if (parsed.expiracion !== undefined) data.expiracion = new Date(parsed.expiracion);
  const licencia = await prisma.licencia.update({ where: { licenciaId: parsed.licenciaId }, data });
  revalidatePath('/admin');
  return licencia;
});

export const deleteLicenciaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('No autorizado', 'FORBIDDEN');
  const existing = await prisma.licencia.findUnique({ where: { licenciaId: id } });
  if (!existing) throw new ActionError('Licencia no encontrada', 'NOT_FOUND');
  await prisma.licencia.delete({ where: { licenciaId: id } });
  revalidatePath('/admin');
  return { id, eliminado: true };
});
