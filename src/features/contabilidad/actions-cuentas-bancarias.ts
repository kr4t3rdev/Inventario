/**
 * @description Server Actions para Cuentas Bancarias.
 * Reemplazan el uso de contabilidadApi (RTK Query) para operaciones CRUD.
 *
 * @module features/contabilidad/actions-cuentas-bancarias
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Schemas ───────────────────────────────────────────────

const createSchema = z.object({
  nombreBanco: z.string().min(1, 'El nombre del banco es requerido'),
  numeroCuenta: z.string().min(1, 'El número de cuenta es requerido'),
  tipoCuenta: z.string().min(1, 'El tipo de cuenta es requerido'),
  saldo: z.coerce.number().default(0),
  moneda: z.string().min(1, 'La moneda es requerida'),
});

const updateSchema = z.object({
  cuentaId: z.string().min(1),
  nombreBanco: z.string().optional(),
  numeroCuenta: z.string().optional(),
  tipoCuenta: z.string().optional(),
  saldo: z.coerce.number().optional(),
  moneda: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Select ────────────────────────────────────────────────

const CUENTA_SELECT = {
  cuentaId: true,
  nombreBanco: true,
  numeroCuenta: true,
  tipoCuenta: true,
  saldo: true,
  moneda: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── Server Actions ────────────────────────────────────────

export const getCuentasBancariasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { tenantId },
    select: CUENTA_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  return { cuentas };
});

export const getCuentaBancariaByIdAction = withAction(async (cuentaId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { cuentaId, tenantId },
    select: CUENTA_SELECT,
  });
  if (!cuenta) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
  return cuenta;
});

export const createCuentaBancariaAction = withAction(async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  const parsed = createSchema.parse(input);
  const tenantId = requireTenant(user);
  const cuenta = await prisma.cuentaBancaria.create({
  // @ts-expect-error
    data: {
      nombreBanco: parsed.nombreBanco,
      numeroCuenta: parsed.numeroCuenta,
      tipoCuenta: parsed.tipoCuenta,
      saldo: parsed.saldo,
      moneda: parsed.moneda,
      tenantId,
    },
    select: CUENTA_SELECT,
  });
  revalidatePath('/busy/contabilidad/cuentas');
  return cuenta;
});

export const updateCuentaBancariaAction = withAction(async (input: z.infer<typeof updateSchema>, user: AuthenticatedUser) => {
  const parsed = updateSchema.parse(input);
  const { cuentaId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.cuentaBancaria.findFirst({
    where: { cuentaId, tenantId },
    select: { cuentaId: true },
  });
  if (!existing) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');

  const cuenta = await prisma.cuentaBancaria.update({
    where: { cuentaId },
    data: {
      ...(data.nombreBanco !== undefined && { nombreBanco: data.nombreBanco }),
      ...(data.numeroCuenta !== undefined && { numeroCuenta: data.numeroCuenta }),
      ...(data.tipoCuenta !== undefined && { tipoCuenta: data.tipoCuenta }),
      ...(data.saldo !== undefined && { saldo: data.saldo }),
      ...(data.moneda !== undefined && { moneda: data.moneda }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: CUENTA_SELECT,
  });
  revalidatePath('/busy/contabilidad/cuentas');
  return cuenta;
});

export const deleteCuentaBancariaAction = withAction(async (cuentaId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.cuentaBancaria.findFirst({
    where: { cuentaId, tenantId },
    select: { cuentaId: true },
  });
  if (!existing) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');

  await prisma.cuentaBancaria.delete({ where: { cuentaId } });
  revalidatePath('/busy/contabilidad/cuentas');
  return { id: cuentaId, eliminado: true };
});
