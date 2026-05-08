/**
 * @description Server Actions para mermas.
 *
 * @module features/mermas/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { notificarMerma } from '@/lib/notificaciones-utils';
import { createMermaSchema, updateMermaSchema } from './schemas';
import type { CreateMermaInput, UpdateMermaInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const MERMA_INCLUDE = { producto: true } as const;

export const getMermasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.merma.findMany({
    where: { tenantId },
    include: MERMA_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
});

export const getMermaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const merma = await prisma.merma.findFirst({
    where: { mermaId: id, tenantId },
    include: MERMA_INCLUDE,
  });
  if (!merma) throw new ActionError('Merma no encontrada', 'NOT_FOUND');
  return merma;
});

export const createMermaAction = withAction(async (input: CreateMermaInput, user: AuthenticatedUser) => {
  const parsed = createMermaSchema.parse(input);
  const tenantId = requireTenant(user);

  const producto = await prisma.producto.findUnique({
    where: { id: parsed.productoId },
    select: { id: true, stock: true, precioCosto: true, tenantId: true },
  });
  if (!producto) throw new ActionError('Producto no encontrado', 'NOT_FOUND');
  if (producto.tenantId !== tenantId) throw new ActionError('Producto no encontrado', 'NOT_FOUND');
  if (producto.stock < parsed.cantidad) throw new ActionError('Stock insuficiente', 'STOCK_INSUFICIENTE');

  const costoTotal = producto.precioCosto * parsed.cantidad;

  const [merma] = await prisma.$transaction([
    prisma.merma.create({
      data: {
        productoId: parsed.productoId,
        cantidad: parsed.cantidad,
        motivo: parsed.motivo ?? null,
        costoTotal,
        tenantId,
      },
      include: MERMA_INCLUDE,
    }),
    prisma.producto.update({
      where: { id: parsed.productoId },
      data: { stock: { decrement: parsed.cantidad } },
    }),
  ]);

  try {
    await notificarMerma(merma.mermaId);
  } catch (error) {
    console.error('Error enviando notificación de merma:', error);
  }

  revalidatePath('/busy/mermas');
  return merma;
});

export const updateMermaAction = withAction(async (input: UpdateMermaInput, user: AuthenticatedUser) => {
  const parsed = updateMermaSchema.parse(input);
  const { mermaId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const mermaActual = await prisma.merma.findFirst({
    where: { mermaId, tenantId },
    select: { mermaId: true, productoId: true, cantidad: true, tenantId: true },
  });
  if (!mermaActual) throw new ActionError('Merma no encontrada', 'NOT_FOUND');

  const productoId = data.productoId ?? mermaActual.productoId;
  const cantidad = data.cantidad ?? mermaActual.cantidad;

  if (productoId !== mermaActual.productoId || cantidad !== mermaActual.cantidad) {
    if (productoId !== mermaActual.productoId || cantidad > mermaActual.cantidad) {
      const producto = await prisma.producto.findFirst({
        where: { id: productoId, tenantId },
        select: { id: true, stock: true },
      });
      if (!producto) throw new ActionError('Producto no encontrado', 'NOT_FOUND');

      const cantidadAdicional = productoId !== mermaActual.productoId ? cantidad : cantidad - mermaActual.cantidad;
      if (producto.stock < cantidadAdicional) {
        throw new ActionError('Stock insuficiente', 'STOCK_INSUFICIENTE');
      }
    }

    const [merma] = await prisma.$transaction([
      prisma.merma.update({
        where: { mermaId },
        data: { productoId, cantidad, motivo: data.motivo ?? undefined },
        include: MERMA_INCLUDE,
      }),
      ...(productoId !== mermaActual.productoId
        ? [
            prisma.producto.update({
              where: { id: mermaActual.productoId },
              data: { stock: { increment: mermaActual.cantidad } },
            }),
            prisma.producto.update({
              where: { id: productoId },
              data: { stock: { decrement: cantidad } },
            }),
          ]
        : [
            prisma.producto.update({
              where: { id: mermaActual.productoId },
              data: { stock: { increment: mermaActual.cantidad - cantidad } },
            }),
          ]),
    ]);

    revalidatePath('/busy/mermas');
    return merma;
  }

  const merma = await prisma.merma.update({
    where: { mermaId },
    data: { motivo: data.motivo ?? undefined },
    include: MERMA_INCLUDE,
  });

  revalidatePath('/busy/mermas');
  return merma;
});

export const deleteMermaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const merma = await prisma.merma.findFirst({
    where: { mermaId: id, tenantId },
    select: { mermaId: true, productoId: true, cantidad: true },
  });
  if (!merma) throw new ActionError('Merma no encontrada', 'NOT_FOUND');

  await prisma.$transaction([
    prisma.merma.delete({ where: { mermaId: id } }),
    prisma.producto.update({
      where: { id: merma.productoId },
      data: { stock: { increment: merma.cantidad } },
    }),
  ]);

  revalidatePath('/busy/mermas');
  return { id, eliminado: true };
});

export const getMermaStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const totalMermas = await prisma.merma.count({ where: { tenantId } });

  const fechaInicio = new Date();
  fechaInicio.setMonth(fechaInicio.getMonth() - 6);

  const mermasPorMes = await prisma.$queryRaw<{ mes: Date; total: number }[]>`
    SELECT 
      DATE_TRUNC('month', "createdAt") as mes,
      SUM("cantidad") as total
    FROM "Merma"
    WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${fechaInicio}
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY mes ASC
  `;

  return {
    totalMermas,
    mermasPorMes: mermasPorMes.map((item) => ({
      mes: new Date(item.mes).toISOString().slice(0, 7),
      total: Number(item.total),
    })),
  };
});
