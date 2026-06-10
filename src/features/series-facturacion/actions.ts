'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { serieSchema, serieUpdateSchema } from './schemas';
import type { SerieInput, SerieUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getSeriesFacturacionAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'series-facturacion', 'gestionar series de facturación');
  const tenantId = requireTenant(user);
  return prisma.serieFacturacion.findMany({
    where: { tenantId },
    orderBy: { esPorDefecto: 'desc' },
    include: { _count: { select: { facturas: true } } },
  });
});

export const createSerieFacturacionAction = withAction(async (input: SerieInput, user: AuthenticatedUser) => {
  requireFeature(user, 'series-facturacion', 'gestionar series de facturación');
  const parsed = serieSchema.parse(input);
  const tenantId = requireTenant(user);
  const exists = await prisma.serieFacturacion.findFirst({ where: { prefijo: parsed.prefijo, tenantId } });
  if (exists) throw new ActionError(`Ya existe una serie con el prefijo '${parsed.prefijo}'`, 'DUPLICATE');
  if (parsed.esPorDefecto) {
    await prisma.serieFacturacion.updateMany({ where: { esPorDefecto: true, tenantId }, data: { esPorDefecto: false } });
  }
  const serie = await prisma.serieFacturacion.create({ data: { ...parsed, tenantId } });
  revalidatePath('/busy/configuracion/series-facturacion');
  return serie;
});

export const updateSerieFacturacionAction = withAction(async (input: SerieUpdateInput, user: AuthenticatedUser) => {
  requireFeature(user, 'series-facturacion', 'gestionar series de facturación');
  const parsed = serieUpdateSchema.parse(input);
  const { serieId, ...data } = parsed;
  const tenantId = requireTenant(user);
  const existing = await prisma.serieFacturacion.findFirst({ where: { serieId, tenantId } });
  if (!existing) throw new ActionError('Serie no encontrada', 'NOT_FOUND');
  if (data.prefijo && data.prefijo !== existing.prefijo) {
    const dupe = await prisma.serieFacturacion.findFirst({ where: { prefijo: data.prefijo, tenantId } });
    if (dupe) throw new ActionError(`Ya existe una serie con el prefijo '${data.prefijo}'`, 'DUPLICATE');
  }
  if (data.esPorDefecto) {
    await prisma.serieFacturacion.updateMany({ where: { esPorDefecto: true, tenantId, serieId: { not: serieId } }, data: { esPorDefecto: false } });
  }
  const serie = await prisma.serieFacturacion.update({ where: { serieId }, data });
  revalidatePath('/busy/configuracion/series-facturacion');
  return serie;
});

export const deleteSerieFacturacionAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'series-facturacion', 'gestionar series de facturación');
  const tenantId = requireTenant(user);
  const existing = await prisma.serieFacturacion.findFirst({ where: { serieId: id, tenantId } });
  if (!existing) throw new ActionError('Serie no encontrada', 'NOT_FOUND');
  await prisma.serieFacturacion.delete({ where: { serieId: id } });
  revalidatePath('/busy/configuracion/series-facturacion');
  return { id, eliminado: true };
});
