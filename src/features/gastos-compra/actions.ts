'use server';
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { statsSchema } from './schemas';
import type { StatsInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getGastosCompraAction = withAction(async (filters: { periodo?: string; tipoOperacion?: string; includeRestock?: string } = {}, _user: AuthenticatedUser) => {
  const where: any = {};
  if (filters.periodo) where.periodo = filters.periodo;
  if (filters.tipoOperacion === 'restock') where.descripcion = { contains: 'Restock' };
  else if (filters.tipoOperacion === 'regular') where.descripcion = { not: { contains: 'Restock' } };
  if (filters.includeRestock === 'false') where.descripcion = { not: { contains: 'Restock' } };
  else if (filters.includeRestock === 'true') where.descripcion = { contains: 'Restock' };
  const data = await prisma.gastoCompra.findMany({ where, include: { producto: { include: { categoria: true, unidad: true } }, vendor: true }, orderBy: { createdAt: 'desc' } });
  return data.map((g: any) => ({ ...g, isRestock: g.descripcion?.includes('Restock') || false, tipoOperacion: g.descripcion?.includes('Restock') ? 'restock' : 'regular' }));
});

export const getGastoCompraStatsAction = withAction(async (input: StatsInput, _user: AuthenticatedUser) => {
  const p = statsSchema.parse(input);
  const where: any = {};
  if (p.periodo) where.periodo = p.periodo;
  if (p.fechaDesde || p.fechaHasta) {
    where.createdAt = {};
    if (p.fechaDesde) where.createdAt.gte = new Date(p.fechaDesde);
    if (p.fechaHasta) where.createdAt.lte = new Date(p.fechaHasta);
  }
  const gastos = await prisma.gastoCompra.findMany({ where, include: { vendor: true } });
  const total = gastos.reduce((s: number, g: any) => s + g.total, 0);
  return { total, count: gastos.length, gastos };
});

export const getGastoCompraByIdAction = withAction(async (id: number, _user: AuthenticatedUser) => {
  const g = await prisma.gastoCompra.findUnique({ where: { id }, include: { producto: { include: { categoria: true, unidad: true } }, vendor: true } });
  return g;
});
