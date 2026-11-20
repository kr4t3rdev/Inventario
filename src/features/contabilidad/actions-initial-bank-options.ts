'use server';

import { z } from 'zod';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import { hasFeature, requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { getRequiredTenantAccountingPolicy } from './services/tenant-accounting-policy-service';

const inputSchema = z.object({}).strict();

/**
 * @description Consulta opciones de tesorería autorizadas para una apertura manual.
 * @param input - Objeto vacío: el tenant procede exclusivamente de la sesión.
 * @param user - Usuario autenticado por withAction.
 * @returns Roles contables, monedas permitidas y moneda funcional del tenant.
 */
export const getInitialBankOptionsAction = withAction(
  async (input: z.input<typeof inputSchema>, user: AuthenticatedUser) => {
    inputSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'contabilidad', 'consultar opciones de apertura contable');
    const policy = await getRequiredTenantAccountingPolicy(tenantId);
    const multiMoneda = hasFeature(user, 'multi-moneda');
    const [roles, monedas] = await Promise.all([
      prisma.cuentaRolTenant.findMany({
        where: {
          tenantId,
          rol: { in: ['BANCOS', 'CAJA_PRINCIPAL'] },
          cuenta: { activa: true, aceptaMovimiento: true, tipo: 'ACTIVO' },
        },
        select: {
          rol: true,
          cuenta: { select: { cuentaContableId: true, codigo: true, nombre: true } },
        },
      }),
      prisma.moneda.findMany({
        where: { isActive: true, ...(!multiMoneda ? { codigo: policy.functionalCurrencyCode } : {}) },
        select: { codigo: true, nombre: true },
        orderBy: { codigo: 'asc' },
      }),
    ]);
    return {
      roles: roles.map(({ rol, cuenta }) => ({ rol, ...cuenta })),
      monedas,
      monedaFuncional: policy.functionalCurrencyCode,
      multiMoneda,
    };
  },
);
