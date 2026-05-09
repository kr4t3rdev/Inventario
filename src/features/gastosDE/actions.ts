'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { gastosDESchema, gastosDEUpdateSchema } from './schemas';
import type { GastosDEInput, GastosDEUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const INCLUDE = { concepto: true, elemento: true } as const;

// ─── GastosDE ──────────────────────────────────────────────

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
    if (!elem) throw new ActionError('El elemento no pertenece al concepto', 'VALIDATION_ERROR');
  }
  const periodo = parsed.periodo || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  let tipo = parsed.tipo || null;
  if (parsed.conceptoId && parsed.elementoId) {
    const concepto = await prisma.gastoConcepto.findUnique({ where: { conceptoId: parsed.conceptoId }, include: { elementos: { where: { elementoId: parsed.elementoId } } } });
    const elemento = concepto?.elementos?.[0];
    if (concepto && elemento) tipo = `${concepto.nombre} — ${elemento.nombre}`;
  }
  const g = await prisma.gastosDE.create({ data: { tipo, conceptoId: parsed.conceptoId||null, elementoId: parsed.elementoId||null, proveedor: parsed.proveedor, monto: parsed.monto, periodo, numeroFactura: parsed.numeroFactura||null, descripcion: parsed.descripcion, tenantId }, include: INCLUDE });
  revalidatePath('/busy/gastosDE');
  return g;
});

export const updateGastosDEAction = withAction(async (input: GastosDEUpdateInput, user: AuthenticatedUser) => {
  const parsed = gastosDEUpdateSchema.parse(input);
  const { gastosDEId, ...data } = parsed;
  const tenantId = requireTenant(user);
  const existing = await prisma.gastosDE.findFirst({ where: { gastosDEId, tenantId } });
  if (!existing) throw new ActionError('Gasto no encontrado', 'NOT_FOUND');
  const g = await prisma.gastosDE.update({ where: { gastosDEId }, data: { ...(data.proveedor!==undefined&&{proveedor:data.proveedor}), ...(data.monto!==undefined&&{monto:data.monto}), ...(data.descripcion!==undefined&&{descripcion:data.descripcion}), ...(data.numeroFactura!==undefined&&{numeroFactura:data.numeroFactura}) } });
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

// ─── Conceptos ─────────────────────────────────────────────

export const getGastoConceptosAction = withAction(async () => {
  return prisma.gastoConcepto.findMany({ include: { _count: { select: { elementos: true, gastosDE: true } }, elementos: { where: { isActive: true }, orderBy: { nombre: 'asc' as const } } }, orderBy: { nombre: 'asc' } });
});

export const getGastoConceptoByIdAction = withAction(async (id: string) => {
  const c = await prisma.gastoConcepto.findUnique({ where: { conceptoId: id }, include: { elementos: { orderBy: { nombre: 'asc' as const } }, _count: { select: { gastosDE: true } } } });
  if (!c) throw new ActionError('Concepto no encontrado', 'NOT_FOUND');
  return c;
});

export const createGastoConceptoAction = withAction(async (input: { nombre: string; descripcion?: string | null }) => {
  const ex = await prisma.gastoConcepto.findUnique({ where: { nombre: input.nombre } });
  if (ex) throw new ActionError('Ya existe un concepto con ese nombre', 'DUPLICATE');
  const c = await prisma.gastoConcepto.create({ data: input });
  revalidatePath('/busy/gastosDE/conceptos'); return c;
});

export const deleteGastoConceptoAction = withAction(async (id: string) => {
  const c = await prisma.gastoConcepto.findUnique({ where: { conceptoId: id }, include: { _count: { select: { gastosDE: true } } } });
  if (!c) throw new ActionError('Concepto no encontrado', 'NOT_FOUND');
  if (c._count.gastosDE > 0) { await prisma.gastoConcepto.update({ where: { conceptoId: id }, data: { isActive: false } }); return { message: 'Concepto desactivado' }; }
  await prisma.gastoConcepto.delete({ where: { conceptoId: id } });
  revalidatePath('/busy/gastosDE/conceptos'); return { success: true };
});

export const updateGastoConceptoAction = withAction(async (input: { conceptoId: string; nombre?: string; descripcion?: string | null }) => {
  const { conceptoId, ...data } = input;
  const existing = await prisma.gastoConcepto.findUnique({ where: { conceptoId } });
  if (!existing) throw new ActionError('Concepto no encontrado', 'NOT_FOUND');
  if (data.nombre !== undefined) {
    const dup = await prisma.gastoConcepto.findUnique({ where: { nombre: data.nombre } });
    if (dup && dup.conceptoId !== conceptoId) throw new ActionError('Ya existe otro concepto con ese nombre', 'DUPLICATE');
  }
  const c = await prisma.gastoConcepto.update({ where: { conceptoId }, data });
  revalidatePath('/busy/gastosDE/conceptos'); return c;
});

// ─── Elementos ─────────────────────────────────────────────

export const getGastoElementosAction = withAction(async (conceptoId: string) => {
  return prisma.gastoElemento.findMany({ where: { conceptoId }, include: { _count: { select: { gastosDE: true } } }, orderBy: { nombre: 'asc' } });
});

export const createGastoElementoAction = withAction(async (input: { conceptoId: string; nombre: string; descripcion?: string | null }) => {
  const concepto = await prisma.gastoConcepto.findUnique({ where: { conceptoId: input.conceptoId } });
  if (!concepto) throw new ActionError('Concepto no encontrado', 'NOT_FOUND');
  const e = await prisma.gastoElemento.create({ data: input });
  revalidatePath('/busy/gastosDE/conceptos'); return e;
});

export const deleteGastoElementoAction = withAction(async (id: string) => {
  const e = await prisma.gastoElemento.findUnique({ where: { elementoId: id }, include: { _count: { select: { gastosDE: true } } } });
  if (!e) throw new ActionError('Elemento no encontrado', 'NOT_FOUND');
  if (e._count.gastosDE > 0) { await prisma.gastoElemento.update({ where: { elementoId: id }, data: { isActive: false } }); return { message: 'Elemento desactivado' }; }
  await prisma.gastoElemento.delete({ where: { elementoId: id } });
  revalidatePath('/busy/gastosDE/conceptos'); return { success: true };
});

export const updateGastoElementoAction = withAction(async (input: { elementoId: string; nombre?: string; descripcion?: string | null }) => {
  const { elementoId, ...data } = input;
  const existing = await prisma.gastoElemento.findUnique({ where: { elementoId } });
  if (!existing) throw new ActionError('Elemento no encontrado', 'NOT_FOUND');
  const e = await prisma.gastoElemento.update({ where: { elementoId }, data });
  revalidatePath('/busy/gastosDE/conceptos'); return e;
});
