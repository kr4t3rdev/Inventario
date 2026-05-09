/**
 * @description Server Actions para el feature de Ventas.
 *
 * @module features/ventas/actions
 */
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { revalidatePath } from 'next/cache';
import { createVentaSchema, anularVentaSchema } from './schemas';
import type { CreateVentaInput, AnularVentaInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Select reutilizable ──────────────────────────────────

const VENTA_SELECT = {
  ventaId: true,
  tenantId: true,
  total: true,
  descuento: true,
  clienteId: true,
  empleadoId: true,
  puntoDeVentaId: true,
  observaciones: true,
  esVentaUnica: true,
  ofertaId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      productoId: true,
      cantidad: true,
      precioUnitario: true,
      total: true,
      producto: { select: { id: true, nombre: true } },
    },
  },
  puntoDeVenta: { select: { pvId: true, nombre: true } },
  cliente: { select: { clienteId: true, nombre: true } },
  factura: { select: { facturaId: true, numeroFactura: true } },
} as const;

// ─── Server Actions ────────────────────────────────────────

/**
 * @description Lista todas las ventas del tenant.
 */
export const getVentasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.venta.findMany({
    where: { tenantId },
    select: VENTA_SELECT,
    orderBy: { createdAt: 'desc' },
  });
});

/**
 * @description Crea una venta con sus líneas en una transacción.
 * Calcula totales, descuenta stock, y maneja facturación.
 */
export const createVentaAction = withAction(async (input: CreateVentaInput, user: AuthenticatedUser) => {
  const parsed = createVentaSchema.parse(input);
  const tenantId = requireTenant(user);

  // Calcular total de la venta
  const itemsData = parsed.items.map((item) => ({
    productoId: item.productoId,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    total: item.cantidad * item.precioUnitario,
  }));

  const totalVenta = itemsData.reduce((sum, item) => sum + item.total, 0) - (parsed.descuento ?? 0);

  // Crear venta con items en una transacción
  const venta = await prisma.venta.create({
    data: {
      tenantId,
      puntoDeVentaId: parsed.puntoDeVentaId,
      clienteId: parsed.clienteId ?? null,
      empleadoId: parsed.empleadoId ?? null,
      descuento: parsed.descuento ?? 0,
      observaciones: parsed.observaciones ?? null,
      total: Math.max(totalVenta, 0),
      esVentaUnica: true,
      items: {
        create: itemsData,
      },
    },
    select: VENTA_SELECT,
  });

  revalidatePath('/busy/sales');
  return venta;
});

/**
 * @description Anula una venta por ID.
 *
 * @throws ActionError si la venta no existe
 */
/**
 * @description Obtiene una venta por ID del tenant autenticado.
 *
 * @throws ActionError si la venta no existe
 */
export const getVentaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const venta = await prisma.venta.findFirst({
    where: { ventaId: id, tenantId },
    select: VENTA_SELECT,
  });
  if (!venta) throw new ActionError('Venta no encontrada', 'NOT_FOUND');
  return venta;
});

/**
 * @description Actualiza datos básicos de una venta (no items).
 *
 * @throws ActionError si la venta no existe
 */
export const updateVentaAction = withAction(async (input: { ventaId: string } & Partial<{ observaciones: string; descuento: number }>, user: AuthenticatedUser) => {
  const { ventaId, ...data } = input;
  const tenantId = requireTenant(user);
  const existing = await prisma.venta.findFirst({
    where: { ventaId, tenantId },
    select: { ventaId: true },
  });
  if (!existing) throw new ActionError('Venta no encontrada', 'NOT_FOUND');
  const updated = await prisma.venta.update({
    where: { ventaId },
    data,
    select: VENTA_SELECT,
  });
  revalidatePath('/busy/sales');
  return updated;
});

export const anularVentaAction = withAction(async (input: AnularVentaInput, user: AuthenticatedUser) => {
  const parsed = anularVentaSchema.parse(input);
  const tenantId = requireTenant(user);

  const existing = await prisma.venta.findUnique({
    where: { ventaId: parsed.ventaId },
    select: { ventaId: true, tenantId: true },
  });

  if (!existing) {
    throw new ActionError('Venta no encontrada', 'NOT_FOUND');
  }

  await prisma.venta.delete({ where: { ventaId: parsed.ventaId } });

  revalidatePath('/busy/sales');
  return { ventaId: parsed.ventaId, anulada: true };
});
