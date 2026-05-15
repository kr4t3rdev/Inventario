/**
 * @description Server Actions para Exchange/Monedas/Tasas.
 */
'use server';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getMonedasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  // Moneda is a global system table, not tenant-scoped
  return await prisma.moneda.findMany({ orderBy: { nombre: 'asc' } });
});

export const getTasasActualesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  // TasaCambio is a global system table, not tenant-scoped
  const monedas = await prisma.moneda.findMany();
  const monedaPrincipal = monedas.find(m => m.esPrincipal) || monedas[0];
  const tasas = await prisma.tasaCambio.findMany({
    orderBy: { fechaVigencia: 'desc' },
    take: 50,
  });
  return { monedaPrincipal, tasas };
});

export const convertMoneyAction = withAction(async (input: { monto: number; monedaOrigen: string; monedaDestino: string }, user: AuthenticatedUser) => {
  // TasaCambio is a global system table, not tenant-scoped
  const tasa = await prisma.tasaCambio.findFirst({
    where: { monedaOrigenId: input.monedaOrigen, monedaDestino: input.monedaDestino },
    orderBy: { fechaVigencia: 'desc' },
  });
  if (!tasa) return { montoConvertido: input.monto, tasaUsada: 1 };
  return { montoConvertido: input.monto * Number(tasa.tasa), tasaUsada: Number(tasa.tasa) };
});

export const createMonedaAction = withAction(async (input: { codigo: string; nombre: string; simbolo: string; esPrincipal?: boolean }, user: AuthenticatedUser) => {
  const existing = await prisma.moneda.findUnique({ where: { codigo: input.codigo.toUpperCase() } });
  if (existing) throw new Error('Ya existe una moneda con ese código');

  return prisma.moneda.create({
    data: {
      codigo: input.codigo.toUpperCase(),
      nombre: input.nombre,
      simbolo: input.simbolo,
      esPrincipal: input.esPrincipal ?? false,
      isActive: true,
    }
  });
});

export const updateMonedaAction = withAction(async (input: { codigo: string; nombre?: string; simbolo?: string; esPrincipal?: boolean; isActive?: boolean }, user: AuthenticatedUser) => {
  const { codigo, ...data } = input;
  const existing = await prisma.moneda.findUnique({ where: { codigo } });
  if (!existing) throw new Error('Moneda no encontrada');

  return prisma.moneda.update({ where: { codigo }, data });
});

export const updateTasaCambioAction = withAction(async (input: { monedaOrigenId: string; monedaDestino: string; tasa: number }, user: AuthenticatedUser) => {
  const { monedaOrigenId, monedaDestino, tasa } = input;

  const monedaExiste = await prisma.moneda.findUnique({ where: { codigo: monedaOrigenId } });
  if (!monedaExiste) throw new Error('Moneda origen no encontrada');

  const tasaExistente = await prisma.tasaCambio.findFirst({
    where: { monedaOrigenId, monedaDestino },
    orderBy: { fechaVigencia: 'desc' },
  });

  if (tasaExistente && Number(tasaExistente.tasa) === tasa) {
    return tasaExistente;
  }

  return prisma.tasaCambio.create({
    data: {
      monedaOrigenId,
      monedaDestino,
      tasa,
      fechaVigencia: new Date(),
    }
  });
});

export const getHistorialTasasAction = withAction(async (params: { monedaOrigen?: string; fechaDesde?: string; fechaHasta?: string; busqueda?: string; pagina?: number; limite?: number } = {}, user: AuthenticatedUser) => {
  const where: any = {};
  if (params.monedaOrigen) where.monedaOrigenId = params.monedaOrigen;
  if (params.fechaDesde || params.fechaHasta) {
    where.fechaVigencia = {};
    if (params.fechaDesde) where.fechaVigencia.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) where.fechaVigencia.lte = new Date(params.fechaHasta);
  }

  const page = params.pagina || 1;
  const limit = params.limite || 20;
  const skip = (page - 1) * limit;

  const [tasas, total] = await Promise.all([
    prisma.tasaCambio.findMany({
      where,
      orderBy: { fechaVigencia: 'desc' },
      skip,
      take: limit,
    }),
    prisma.tasaCambio.count({ where }),
  ]);

  return { tasas, total };
});
