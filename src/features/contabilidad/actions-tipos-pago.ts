/**
 * @description Server Actions para Tipos de Pago.
 */
'use server';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getTiposPagoAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const data = await prisma.tipoPago.findMany({
  // @ts-expect-error
    where: { tenantId },
    orderBy: { nombre: 'asc' },
  });
  return { data };
});
