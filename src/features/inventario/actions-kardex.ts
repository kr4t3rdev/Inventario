'use server';

import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { getKardex, type StockMoveLineStore } from './movimientos';

const kardexInputSchema = z.object({
  productoId: z.string().min(1, 'El producto es obligatorio para el kardex'),
  tipoUbicacion: z.enum(['almacen', 'punto_venta']).optional(),
  ubicacionId: z.string().min(1).optional(),
  fechaDesde: z.coerce.date().optional(),
  fechaHasta: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type KardexInput = z.infer<typeof kardexInputSchema>;

/**
 * @description Obtiene el kardex paginado del tenant autenticado con saldo
 * acumulado, incluyendo saldo de apertura cuando hay fecha de corte.
 * @param {KardexInput} input - Filtros; `productoId` es obligatorio.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Movimientos con saldo, saldo inicial y total.
 */
export const getKardexAction = withAction(
  async (input: KardexInput, user: AuthenticatedUser) => {
    const filtros = kardexInputSchema.parse(input);
    const tenantId = requireTenant(user);
    return getKardex(prisma as unknown as StockMoveLineStore, {
      tenantId,
      ...filtros,
    });
  },
);
