/**
 * @description Server Actions para Exchange/Monedas/Tasas.
 */
'use server';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getMonedasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  // @ts-expect-error
  const data = await prisma.moneda.findMany({ where: { tenantId }, orderBy: { nombre: 'asc' } });
  return { data, success: true };
});

export const getTasasActualesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  // @ts-expect-error
  const monedas = await prisma.moneda.findMany({ where: { tenantId } });
  const monedaPrincipal = monedas.find(m => m.esPrincipal) || monedas[0];
  const tasas = await prisma.tasaCambio.findMany({
  // @ts-expect-error
    where: { tenantId },
    orderBy: { fechaVigencia: 'desc' },
    take: 50,
  });
  return { data: { monedaPrincipal, tasas } };
});

export const convertMoneyAction = withAction(async (input: { monto: number; monedaOrigen: string; monedaDestino: string }, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const tasa = await prisma.tasaCambio.findFirst({
  // @ts-expect-error
    where: { monedaOrigenId: input.monedaOrigen, monedaDestino: input.monedaDestino, tenantId },
    orderBy: { fechaVigencia: 'desc' },
  });
  if (!tasa) return { montoConvertido: input.monto, tasaUsada: 1 };
  return { montoConvertido: input.monto * Number(tasa.tasa), tasaUsada: Number(tasa.tasa) };
});
