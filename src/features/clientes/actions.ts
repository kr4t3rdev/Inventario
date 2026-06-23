/**
 * @description Server Actions para el feature de Clientes.
 *
 * @module features/clientes/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { replaceOwnerAsset } from '@/lib/upload/cloudinary-admin';
import { clienteSchema, clienteUpdateSchema } from './schemas';
import type { ClienteInput, ClienteUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const CLIENTE_SELECT = {
  clienteId: true,
  nombre: true,
  direccion: true,
  telefono: true,
  logoUrl: true,
  numeroCuentaCUP: true,
  numeroCuentaUSD: true,
  numeroContrato: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const getClientesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'clientes', 'gestionar clientes');
  const tenantId = requireTenant(user);
  return prisma.cliente.findMany({
    where: { tenantId },
    select: CLIENTE_SELECT,
    orderBy: { createdAt: 'desc' },
  });
});

export const getClienteByIdAction = withAction(async (clienteId: string, user: AuthenticatedUser) => {
  requireFeature(user, 'clientes', 'gestionar clientes');
  const tenantId = requireTenant(user);
  const cliente = await prisma.cliente.findFirst({
    where: { clienteId, tenantId },
    select: CLIENTE_SELECT,
  });
  if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
  return cliente;
});

export const createClienteAction = withAction(async (input: ClienteInput, user: AuthenticatedUser) => {
  requireFeature(user, 'clientes', 'gestionar clientes');
  const parsed = clienteSchema.parse(input);
  const tenantId = requireTenant(user);
  const cliente = await prisma.cliente.create({
    data: { nombre: parsed.nombre, direccion: parsed.direccion ?? null, telefono: parsed.telefono ?? null, logoUrl: parsed.logoUrl ?? null, numeroCuentaCUP: parsed.numeroCuentaCUP ?? null, numeroCuentaUSD: parsed.numeroCuentaUSD ?? null, numeroContrato: parsed.numeroContrato ?? null, tenantId },
    select: CLIENTE_SELECT,
  });

  if (parsed.logoAsset) {
    await replaceOwnerAsset({
      tenantId,
      ownerType: 'cliente',
      ownerId: cliente.clienteId,
      slot: 'logo',
      asset: parsed.logoAsset,
    });
  }

  revalidatePath('/busy/cliente');
  return cliente;
});

export const updateClienteAction = withAction(async (input: ClienteUpdateInput, user: AuthenticatedUser) => {
  requireFeature(user, 'clientes', 'gestionar clientes');
  const parsed = clienteUpdateSchema.parse(input);
  const { clienteId, logoAsset, ...data } = parsed;
  const tenantId = requireTenant(user);
  const existing = await prisma.cliente.findFirst({ where: { clienteId, tenantId }, select: { clienteId: true } });
  if (!existing) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
  const cliente = await prisma.cliente.update({
    where: { clienteId },
    data: { ...(data.nombre !== undefined && { nombre: data.nombre }), ...(data.direccion !== undefined && { direccion: data.direccion }), ...(data.telefono !== undefined && { telefono: data.telefono }), ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }), ...(data.numeroCuentaCUP !== undefined && { numeroCuentaCUP: data.numeroCuentaCUP }), ...(data.numeroCuentaUSD !== undefined && { numeroCuentaUSD: data.numeroCuentaUSD }), ...(data.numeroContrato !== undefined && { numeroContrato: data.numeroContrato }) },
    select: CLIENTE_SELECT,
  });

  if (logoAsset) {
    await replaceOwnerAsset({
      tenantId,
      ownerType: 'cliente',
      ownerId: cliente.clienteId,
      slot: 'logo',
      asset: logoAsset,
    });
  }

  revalidatePath('/busy/cliente');
  return cliente;
});

export const deleteClienteAction = withAction(async (clienteId: string, user: AuthenticatedUser) => {
  requireFeature(user, 'clientes', 'gestionar clientes');
  const tenantId = requireTenant(user);
  const existing = await prisma.cliente.findFirst({ where: { clienteId, tenantId }, select: { clienteId: true } });
  if (!existing) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
  await prisma.cliente.delete({ where: { clienteId } });
  revalidatePath('/busy/cliente');
  return { id: clienteId, eliminado: true };
});
