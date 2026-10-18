/**
 * @description Server Actions para el feature de Clientes.
 *
 * @module features/clientes/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { replaceOwnerAsset } from '@/lib/upload/cloudinary-admin';
import { lockCreditoCliente } from '@/features/crm/services/credito-enforcement';
import { clienteSchema, clienteUpdateSchema, limiteCreditoSchema } from './schemas';
import type { ClienteInput, ClienteUpdateInput, LimiteCreditoInput } from './schemas';
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
  listaPrecioId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Valida que la lista de precios pertenezca al tenant cuando se asigna a un cliente.
 * @param {string} tenantId - Tenant del usuario autenticado.
 * @param {object} user - Usuario autenticado (para el gate del feature).
 * @param {string | null | undefined} listaPrecioId - Lista a validar (opcional).
 * @throws {ActionError} NOT_FOUND si la lista no pertenece al tenant.
 */
async function assertListaPrecioDelTenant(
  tenantId: string,
  user: AuthenticatedUser,
  listaPrecioId?: string | null,
): Promise<void> {
  if (!listaPrecioId) return;
  requireFeature(user, 'listas-precios', 'asignar lista de precios a un cliente');
  const lista = await prisma.listaPrecio.findFirst({
    where: { id: listaPrecioId, tenantId },
    select: { id: true },
  });
  if (!lista) throw new ActionError('Lista de precios no encontrada', 'NOT_FOUND');
}

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
  await assertListaPrecioDelTenant(tenantId, user, parsed.listaPrecioId);
  const cliente = await prisma.cliente.create({
    data: { nombre: parsed.nombre, direccion: parsed.direccion ?? null, telefono: parsed.telefono ?? null, logoUrl: parsed.logoUrl ?? null, numeroCuentaCUP: parsed.numeroCuentaCUP ?? null, numeroCuentaUSD: parsed.numeroCuentaUSD ?? null, numeroContrato: parsed.numeroContrato ?? null, listaPrecioId: parsed.listaPrecioId ?? null, tenantId },
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
  const { clienteId, logoAsset, listaPrecioId, ...data } = parsed;
  const tenantId = requireTenant(user);
  const existing = await prisma.cliente.findFirst({ where: { clienteId, tenantId }, select: { clienteId: true } });
  if (!existing) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
  await assertListaPrecioDelTenant(tenantId, user, listaPrecioId);
  const cliente = await prisma.cliente.update({
    where: { clienteId },
    data: { ...(data.nombre !== undefined && { nombre: data.nombre }), ...(data.direccion !== undefined && { direccion: data.direccion }), ...(data.telefono !== undefined && { telefono: data.telefono }), ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }), ...(data.numeroCuentaCUP !== undefined && { numeroCuentaCUP: data.numeroCuentaCUP }), ...(data.numeroCuentaUSD !== undefined && { numeroCuentaUSD: data.numeroCuentaUSD }), ...(data.numeroContrato !== undefined && { numeroContrato: data.numeroContrato }), ...(listaPrecioId !== undefined && { listaPrecioId: listaPrecioId ?? null }) },
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

/**
 * @description Actualiza el límite de crédito de un cliente (C-1). Política
 * financiera sensible: requiere el permiso `operaciones.clientes.limite-credito`
 * y audita valorAnterior → valorNuevo dentro de la misma transacción. La
 * lectura del valor anterior corre dentro de la transacción bajo el lock de
 * crédito del cliente (compartido con todos los writers de deuda): dos ediciones
 * concurrentes no auditan el mismo valorAnterior y ninguna evalúa un tope que
 * ya cambió.
 * @param {LimiteCreditoInput} input - ID del cliente y nuevo límite (null = sin tope).
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Cliente actualizado con su límite.
 * @throws {ActionError} AUTH_REQUIRED, VALIDATION_ERROR, FORBIDDEN o NOT_FOUND.
 */
export const updateLimiteCreditoClienteAction = withAction(async (input: LimiteCreditoInput, user: AuthenticatedUser) => {
  requireFeature(user, 'clientes', 'gestionar clientes');
  const parsed = limiteCreditoSchema.parse(input);
  const tenantId = requireTenant(user);
  requirePermission(user, 'operaciones.clientes.limite-credito', 'editar el límite de crédito del cliente');

  const actualizado = await prisma.$transaction(async (tx) => {
    // Lock de crédito del cliente: serializa contra ventas/ediciones de deuda
    // que evalúan el tope, y garantiza que valorAnterior sea el vigente.
    await lockCreditoCliente(tx, tenantId, parsed.clienteId);
    const cliente = await tx.cliente.findFirst({
      where: { clienteId: parsed.clienteId, tenantId },
      select: { clienteId: true, limiteCredito: true },
    });
    if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');

    const row = await tx.cliente.update({
      where: { clienteId: parsed.clienteId },
      data: { limiteCredito: parsed.limiteCredito },
      select: { clienteId: true, limiteCredito: true },
    });
    await AuditLogService.logStrict(
      {
        accion: 'UPDATE',
        entidad: 'CLIENTE',
        entidadId: parsed.clienteId,
        usuarioId: user.userId,
        detalles: {
          tipo: 'LIMITE_CREDITO_ACTUALIZADO',
          valorAnterior: cliente.limiteCredito,
          valorNuevo: parsed.limiteCredito,
        },
      },
      tx,
    );
    return row;
  });

  revalidatePath('/busy/cliente');
  return actualizado;
});
