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
