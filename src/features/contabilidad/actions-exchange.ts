'use server';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getMonedasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'multi-moneda', 'consultar monedas');
  // Moneda is a global system table, not tenant-scoped
  return await prisma.moneda.findMany({ orderBy: { nombre: 'asc' } });
});

export const getTasasActualesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'multi-moneda', 'consultar tasas de cambio');
  // TasaCambio is a global system table, not tenant-scoped
  const monedas = await prisma.moneda.findMany();
  const monedaPrincipal = monedas.find(m => m.esPrincipal) || monedas[0];
  const tasasRaw = await prisma.tasaCambio.findMany({
    orderBy: { fechaVigencia: 'desc' },
    take: 50,
  });
  const tasas = JSON.parse(JSON.stringify(tasasRaw));
  return { monedaPrincipal, tasas };
});

export const convertMoneyAction = withAction(async (input: { monto: number; monedaOrigen: string; monedaDestino: string }, user: AuthenticatedUser) => {
  requireFeature(user, 'multi-moneda', 'convertir monedas');
  // TasaCambio is a global system table, not tenant-scoped
  const tasa = await prisma.tasaCambio.findFirst({
    where: { monedaOrigenId: input.monedaOrigen, monedaDestino: input.monedaDestino },
    orderBy: { fechaVigencia: 'desc' },
  });
  if (!tasa) return { montoConvertido: input.monto, tasaUsada: 1 };
  return { montoConvertido: input.monto * Number(tasa.tasa), tasaUsada: Number(tasa.tasa) };
});

export const createMonedaAction = withAction(async (input: { codigo: string; nombre: string; simbolo: string; esPrincipal?: boolean }, user: AuthenticatedUser) => {
  requireFeature(user, 'multi-moneda', 'crear monedas');
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
  requireFeature(user, 'multi-moneda', 'editar monedas');
  const { codigo, ...data } = input;
  const existing = await prisma.moneda.findUnique({ where: { codigo } });
  if (!existing) throw new Error('Moneda no encontrada');

  return prisma.moneda.update({ where: { codigo }, data });
});

export const updateTasaCambioAction = withAction(async (input: { monedaOrigenId: string; monedaDestino: string; tasa: number }, user: AuthenticatedUser) => {
  requireFeature(user, 'multi-moneda', 'actualizar tasas de cambio');
  const { monedaOrigenId, monedaDestino, tasa } = input;

  const monedaExiste = await prisma.moneda.findUnique({ where: { codigo: monedaOrigenId } });
  if (!monedaExiste) throw new Error('Moneda origen no encontrada');

  const tasaExistenteRaw = await prisma.tasaCambio.findFirst({
    where: { monedaOrigenId, monedaDestino },
    orderBy: { fechaVigencia: 'desc' },
  });

  if (tasaExistenteRaw && Number(tasaExistenteRaw.tasa) === tasa) {
    return JSON.parse(JSON.stringify(tasaExistenteRaw));
  }

  const nuevo = await prisma.tasaCambio.create({
    data: {
      monedaOrigenId,
      monedaDestino,
      tasa,
      fechaVigencia: new Date(),
    }
  });
  return JSON.parse(JSON.stringify(nuevo));
});

export const getHistorialTasasAction = withAction(async (params: { monedaOrigen?: string; fechaDesde?: string; fechaHasta?: string; busqueda?: string; pagina?: number; limite?: number } = {}, user: AuthenticatedUser) => {
  requireFeature(user, 'multi-moneda', 'consultar historial de tasas');
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

  const [tasasRaw, total] = await Promise.all([
    prisma.tasaCambio.findMany({
      where,
      orderBy: { fechaVigencia: 'desc' },
      skip,
      take: limit,
    }),
    prisma.tasaCambio.count({ where }),
  ]);

  const tasas = JSON.parse(JSON.stringify(tasasRaw));
  return { tasas, total };
});
