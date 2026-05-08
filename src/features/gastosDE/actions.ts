'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { gastosDESchema, gastosDEUpdateSchema } from './schemas';
import type { GastosDEInput, GastosDEUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const INCLUDE = { concepto: true, elemento: true } as const;

export const getGastosDEAction = withAction(async (filters: { periodo?: string; conceptoId?: string; elementoId?: string } = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (filters.periodo) where.periodo = filters.periodo;
  if (filters.conceptoId) where.conceptoId = filters.conceptoId;
  if (filters.elementoId) where.elementoId = filters.elementoId;
  return prisma.gastosDE.findMany({ where, include: INCLUDE, orderBy: { monto: 'desc' } });
});

export const getGastoDEByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const g = await prisma.gastosDE.findFirst({ where: { gastosDEId: id, tenantId }, include: INCLUDE });
  if (!g) throw new ActionError('Gasto de explotación no encontrado', 'NOT_FOUND');
  return g;
});

export const createGastosDEAction = withAction(async (input: GastosDEInput, user: AuthenticatedUser) => {
  const parsed = gastosDESchema.parse(input);
  const tenantId = requireTenant(user);
  if (parsed.conceptoId && parsed.elementoId) {
    const elem = await prisma.gastoElemento.findFirst({ where: { elementoId: parsed.elementoId, conceptoId: parsed.conceptoId } });
    if (!elem) throw new ActionError('El elemento no pertenece al concepto seleccionado', 'VALIDATION_ERROR');
  }
  const periodo = parsed.periodo || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  let tipo = parsed.tipo || null;
  if (parsed.conceptoId && parsed.elementoId) {
    const concepto = await prisma.gastoConcepto.findUnique({ where: { conceptoId: parsed.conceptoId }, include: { elementos: { where: { elementoId: parsed.elementoId } } } });
    const elemento = concepto?.elementos?.[0];
    if (concepto && elemento) tipo = `${concepto.nombre} — ${elemento.nombre}`;
  }
  const gasto = await prisma.gastosDE.create({
    data: { tipo, conceptoId: parsed.conceptoId || null, elementoId: parsed.elementoId || null, proveedor: parsed.proveedor, monto: parsed.monto, periodo, numeroFactura: parsed.numeroFactura || null, descripcion: parsed.descripcion, tenantId },
    include: INCLUDE,
  });
  revalidatePath('/busy/gastosDE');
  return gasto;
});

export const updateGastosDEAction = withAction(async (input: GastosDEUpdateInput, user: AuthenticatedUser) => {
  const parsed = gastosDEUpdateSchema.parse(input);
  const { gastosDEId, ...data } = parsed;
  const tenantId = requireTenant(user);
  const existing = await prisma.gastosDE.findFirst({ where: { gastosDEId, tenantId } });
  if (!existing) throw new ActionError('Gasto no encontrado', 'NOT_FOUND');
  const g = await prisma.gastosDE.update({
    where: { gastosDEId },
    data: { ...(data.proveedor !== undefined && { proveedor: data.proveedor }), ...(data.monto !== undefined && { monto: data.monto }), ...(data.descripcion !== undefined && { descripcion: data.descripcion }), ...(data.numeroFactura !== undefined && { numeroFactura: data.numeroFactura }) },
  });
  revalidatePath('/busy/gastosDE');
  return g;
});

export const deleteGastosDEAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.gastosDE.findFirst({ where: { gastosDEId: id, tenantId } });
  if (!existing) throw new ActionError('Gasto no encontrado', 'NOT_FOUND');
  await prisma.gastosDE.delete({ where: { gastosDEId: id } });
  revalidatePath('/busy/gastosDE');
  return { id, eliminado: true };
});
