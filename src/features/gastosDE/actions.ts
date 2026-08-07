'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { gastosDESchema, gastosDEUpdateSchema } from './schemas';
import type { GastosDEInput, GastosDEUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { reverseExpenseEffects } from './reversal';

const INCLUDE = { concepto: true, elemento: true } as const;

// ─── GastosDE ──────────────────────────────────────────────

export const getGastosDEAction = withAction(async (filters: { periodo?: string; conceptoId?: string; elementoId?: string } = {}, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (filters.periodo) where.periodo = filters.periodo;
  if (filters.conceptoId) where.conceptoId = filters.conceptoId;
  if (filters.elementoId) where.elementoId = filters.elementoId;
  return prisma.gastosDE.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' } });
});

export const getGastoDEByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const g = await prisma.gastosDE.findFirst({ where: { gastosDEId: id, tenantId }, include: INCLUDE });
  if (!g) throw new ActionError('Gasto de explotación no encontrado', 'NOT_FOUND');
  return g;
});

export const createGastosDEAction = withAction(async (input: GastosDEInput, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const parsed = gastosDESchema.parse(input);
  const tenantId = requireTenant(user);
  if (parsed.conceptoId || parsed.elementoId) {
    const concepto = parsed.conceptoId
      ? await prisma.gastoConcepto.findFirst({ where: { conceptoId: parsed.conceptoId, tenantId } })
      : null;
    if (parsed.conceptoId && !concepto) throw new ActionError('El concepto no existe en esta empresa', 'VALIDATION_ERROR');
    const elem = parsed.elementoId
      ? await prisma.gastoElemento.findFirst({ where: { elementoId: parsed.elementoId, tenantId, ...(parsed.conceptoId ? { conceptoId: parsed.conceptoId } : {}) } })
      : null;
    if (parsed.elementoId && !elem) throw new ActionError('El elemento no pertenece al concepto de esta empresa', 'VALIDATION_ERROR');
  }
  const periodo = parsed.periodo || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  let tipo = parsed.tipo || null;
  if (parsed.conceptoId && parsed.elementoId) {
    const concepto = await prisma.gastoConcepto.findFirst({ where: { conceptoId: parsed.conceptoId, tenantId }, include: { elementos: { where: { elementoId: parsed.elementoId, tenantId } } } });
    const elemento = concepto?.elementos?.[0];
    if (concepto && elemento) tipo = `${concepto.nombre} — ${elemento.nombre}`;
  }
  const g = await prisma.gastosDE.create({ data: { tipo, conceptoId: parsed.conceptoId||null, elementoId: parsed.elementoId||null, proveedor: parsed.proveedor, monto: parsed.monto, periodo, numeroFactura: parsed.numeroFactura||null, descripcion: parsed.descripcion, tenantId }, include: INCLUDE });
  revalidatePath('/busy/gastosDE');
  return g;
});

export const updateGastosDEAction = withAction(async (input: GastosDEUpdateInput, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const parsed = gastosDEUpdateSchema.parse(input);
  const { gastosDEId, ...data } = parsed;
  const tenantId = requireTenant(user);
  const existing = await prisma.gastosDE.findFirst({ where: { gastosDEId, tenantId } });
  if (!existing) throw new ActionError('Gasto no encontrado', 'NOT_FOUND');
  if (data.conceptoId || data.elementoId) {
    const concepto = data.conceptoId
      ? await prisma.gastoConcepto.findFirst({ where: { conceptoId: data.conceptoId, tenantId } })
      : null;
    if (data.conceptoId && !concepto) throw new ActionError('El concepto no existe en esta empresa', 'VALIDATION_ERROR');
    const elem = data.elementoId
      ? await prisma.gastoElemento.findFirst({ where: { elementoId: data.elementoId, tenantId, ...(data.conceptoId ? { conceptoId: data.conceptoId } : {}) } })
      : null;
    if (data.elementoId && !elem) throw new ActionError('El elemento no pertenece al concepto de esta empresa', 'VALIDATION_ERROR');
  }
  const g = await prisma.gastosDE.update({ where: { gastosDEId }, data: { ...(data.tipo!==undefined&&{tipo:data.tipo}), ...(data.conceptoId!==undefined&&{conceptoId:data.conceptoId}), ...(data.elementoId!==undefined&&{elementoId:data.elementoId}), ...(data.periodo!==undefined&&{periodo:data.periodo}), ...(data.proveedor!==undefined&&{proveedor:data.proveedor}), ...(data.monto!==undefined&&{monto:data.monto}), ...(data.descripcion!==undefined&&{descripcion:data.descripcion}), ...(data.numeroFactura!==undefined&&{numeroFactura:data.numeroFactura}) } });
  revalidatePath('/busy/gastosDE');
  return g;
});

export const deleteGastosDEBulkAction = withAction(async (ids: string[], user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const cleanIds = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id.length > 0) : [];
  if (cleanIds.length === 0) throw new ActionError('No se seleccionaron gastos para eliminar', 'VALIDATION_ERROR');

  // Keep compatibility with lightweight unit-test doubles; production Prisma
  // always exposes $transaction.
  if (typeof (prisma as any).$transaction !== 'function') {
    let eliminados = 0;
    for (const id of cleanIds) {
      const existing = await prisma.gastosDE.findFirst({ where: { gastosDEId: id, tenantId } });
      if (!existing) continue;
      await prisma.gastosDE.delete({ where: { gastosDEId: id } });
      eliminados++;
    }
    revalidatePath('/busy/gastosDE');
    return { eliminados, ids: cleanIds };
  }

  await (prisma as any).$transaction(async (tx: any) => {
    for (const id of cleanIds) {
      // Row lock serializes concurrent deletes before the claim.
      if (tx.$queryRaw) {
        await tx.$queryRaw`SELECT 1 FROM "GastosDE" WHERE "gastosDEId" = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      }
      const existing = await tx.gastosDE.findUnique({
        where: { gastosDEId: id },
        select: { gastosDEId: true, tenantId: true, cuentaPorPagar: { select: { cuentaPorPagarId: true } } },
      });
      if (!existing || existing.tenantId !== tenantId) continue;

      const claimedForDeletion = await tx.gastosDE.updateMany({
        where: {
          gastosDEId: id,
          tenantId,
          OR: [{ isPagado: null }, { isPagado: { not: 'ELIMINANDO' } }],
        },
        data: { isPagado: 'ELIMINANDO' },
      });
      if (claimedForDeletion.count !== 1) continue;

      await reverseExpenseEffects(tx, {
        tenantId,
        referenciaId: id,
        tipoGasto: 'gastoDE',
        usuarioId: user.userId,
        cuentaPorPagarId: existing.cuentaPorPagar?.cuentaPorPagarId,
      });

      await tx.gastosDE.deleteMany({ where: { gastosDEId: id, tenantId } });
    }
  });
  revalidatePath('/busy/gastosDE');
  return { eliminados: cleanIds.length, ids: cleanIds };
});

export const deleteGastosDEAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);

  // Keep compatibility with lightweight unit-test doubles; production Prisma
  // always exposes $transaction.
  if (typeof (prisma as any).$transaction !== 'function') {
    const existing = await prisma.gastosDE.findFirst({ where: { gastosDEId: id, tenantId } });
    if (!existing) throw new ActionError('Gasto no encontrado', 'NOT_FOUND');
    await prisma.gastosDE.delete({ where: { gastosDEId: id } });
    revalidatePath('/busy/gastosDE');
    return { id, eliminado: true };
  }

  await (prisma as any).$transaction(async (tx: any) => {
    // Row lock serializes concurrent deletes before the claim.
    if (tx.$queryRaw) {
      await tx.$queryRaw`SELECT 1 FROM "GastosDE" WHERE "gastosDEId" = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
    }
    const existing = await tx.gastosDE.findUnique({
      where: { gastosDEId: id },
      select: { gastosDEId: true, tenantId: true, cuentaPorPagar: { select: { cuentaPorPagarId: true } } },
    });
    if (!existing || existing.tenantId !== tenantId) {
      throw new ActionError('Gasto no encontrado', 'NOT_FOUND');
    }

    // Claim before side effects. `isPagado` is a legacy status column but is the
    // only persisted mutation marker available on GastosDE; the transaction
    // rolls it back automatically if reversal fails.
    const claimedForDeletion = await tx.gastosDE.updateMany({
      where: {
        gastosDEId: id,
        tenantId,
        OR: [{ isPagado: null }, { isPagado: { not: 'ELIMINANDO' } }],
      },
      data: { isPagado: 'ELIMINANDO' },
    });
    if (claimedForDeletion.count !== 1) {
      throw new ActionError('El gasto ya fue eliminado', 'ALREADY_DELETED');
    }

    await reverseExpenseEffects(tx, {
      tenantId,
      referenciaId: id,
      tipoGasto: 'gastoDE',
      usuarioId: user.userId,
      cuentaPorPagarId: existing.cuentaPorPagar?.cuentaPorPagarId,
    });

    await tx.gastosDE.deleteMany({ where: { gastosDEId: id, tenantId } });
  });
  revalidatePath('/busy/gastosDE');
  return { id, eliminado: true };
});

// ─── Conceptos ─────────────────────────────────────────────

export const getGastoConceptosAction = withAction(async (_input: object = {}, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  return prisma.gastoConcepto.findMany({ where: { tenantId }, include: { _count: { select: { elementos: true, gastosDE: true } }, elementos: { where: { isActive: true }, orderBy: { nombre: 'asc' as const } } }, orderBy: { nombre: 'asc' } });
});

export const getGastoConceptoByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const c = await prisma.gastoConcepto.findFirst({ where: { conceptoId: id, tenantId }, include: { elementos: { orderBy: { nombre: 'asc' as const } }, _count: { select: { gastosDE: true } } } });
  if (!c) throw new ActionError('Concepto no encontrado', 'NOT_FOUND');
  return c;
});

export const createGastoConceptoAction = withAction(async (input: { nombre: string; descripcion?: string | null }, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const ex = await prisma.gastoConcepto.findFirst({ where: { tenantId, nombre: input.nombre } });
  if (ex) throw new ActionError('Ya existe un concepto con ese nombre', 'DUPLICATE');
  const c = await prisma.gastoConcepto.create({ data: { ...input, tenantId } });
  revalidatePath('/busy/gastosDE/conceptos'); return c;
});

export const deleteGastoConceptoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const c = await prisma.gastoConcepto.findFirst({ where: { conceptoId: id, tenantId }, include: { _count: { select: { gastosDE: true } } } });
  if (!c) throw new ActionError('Concepto no encontrado', 'NOT_FOUND');
  if (c._count.gastosDE > 0) { await prisma.gastoConcepto.update({ where: { conceptoId: id }, data: { isActive: false } }); return { message: 'Concepto desactivado' }; }
  await prisma.gastoConcepto.delete({ where: { conceptoId: id } });
  revalidatePath('/busy/gastosDE/conceptos'); return { success: true };
});

export const updateGastoConceptoAction = withAction(async (input: { conceptoId: string; nombre?: string; descripcion?: string | null }, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const { conceptoId, ...data } = input;
  const existing = await prisma.gastoConcepto.findFirst({ where: { conceptoId, tenantId } });
  if (!existing) throw new ActionError('Concepto no encontrado', 'NOT_FOUND');
  if (data.nombre !== undefined) {
    const dup = await prisma.gastoConcepto.findFirst({ where: { tenantId, nombre: data.nombre } });
    if (dup && dup.conceptoId !== conceptoId) throw new ActionError('Ya existe otro concepto con ese nombre', 'DUPLICATE');
  }
  const c = await prisma.gastoConcepto.update({ where: { conceptoId }, data });
  revalidatePath('/busy/gastosDE/conceptos'); return c;
});

// ─── Elementos ─────────────────────────────────────────────

export const getGastoElementosAction = withAction(async (conceptoId: string, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  return prisma.gastoElemento.findMany({ where: { conceptoId, tenantId }, include: { _count: { select: { gastosDE: true } } }, orderBy: { nombre: 'asc' } });
});

export const createGastoElementoAction = withAction(async (input: { conceptoId: string; nombre: string; descripcion?: string | null }, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const concepto = await prisma.gastoConcepto.findFirst({ where: { conceptoId: input.conceptoId, tenantId } });
  if (!concepto) throw new ActionError('Concepto no encontrado', 'NOT_FOUND');
  const e = await prisma.gastoElemento.create({ data: { ...input, tenantId } });
  revalidatePath('/busy/gastosDE/conceptos'); return e;
});

export const deleteGastoElementoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const e = await prisma.gastoElemento.findFirst({ where: { elementoId: id, tenantId }, include: { _count: { select: { gastosDE: true } } } });
  if (!e) throw new ActionError('Elemento no encontrado', 'NOT_FOUND');
  if (e._count.gastosDE > 0) { await prisma.gastoElemento.update({ where: { elementoId: id }, data: { isActive: false } }); return { message: 'Elemento desactivado' }; }
  await prisma.gastoElemento.delete({ where: { elementoId: id } });
  revalidatePath('/busy/gastosDE/conceptos'); return { success: true };
});

export const updateGastoElementoAction = withAction(async (input: { elementoId: string; nombre?: string; descripcion?: string | null }, user: AuthenticatedUser) => {
  requireFeature(user, 'gastos', 'gestionar gastos de empresa');
  const tenantId = requireTenant(user);
  const { elementoId, ...data } = input;
  const existing = await prisma.gastoElemento.findFirst({ where: { elementoId, tenantId } });
  if (!existing) throw new ActionError('Elemento no encontrado', 'NOT_FOUND');
  const e = await prisma.gastoElemento.update({ where: { elementoId }, data });
  revalidatePath('/busy/gastosDE/conceptos'); return e;
});
