/**
 * @description Server Actions para ofertas.
 *
 * @module features/ofertas/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { ofertaSchema, ofertaUpdateSchema, facturarOfertaSchema } from './schemas';
import type { OfertaInput, OfertaUpdateInput, FacturarOfertaInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { Oferta } from '@/app/models/model';

const OFERTA_INCLUDE = {
  cliente: true,
  items: { include: { producto: true, servicio: true } },
} as const;

function serializeOferta(oferta: unknown): Oferta {
  return JSON.parse(JSON.stringify(oferta)) as Oferta;
}

export const getOfertasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const ofertas = await prisma.oferta.findMany({
    where: { tenantId },
    include: OFERTA_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  return ofertas.map(serializeOferta);
});

export const getOfertaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const oferta = await prisma.oferta.findFirst({
    where: { id, tenantId },
    include: OFERTA_INCLUDE,
  });
  if (!oferta) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
  return serializeOferta(oferta);
});

export const createOfertaAction = withAction(async (input: OfertaInput, user: AuthenticatedUser) => {
  const parsed = ofertaSchema.parse(input);
  const tenantId = requireTenant(user);

  // Validar cliente
  const cliente = await prisma.cliente.findFirst({ where: { clienteId: parsed.clienteId, tenantId } });
  if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');

  // Generar número de oferta secuencial por tenant
  const ultimaOferta = await prisma.oferta.findFirst({
    where: { tenantId },
    orderBy: { numeroOferta: 'desc' },
    select: { numeroOferta: true },
  });
  const nextNumber = ultimaOferta
    ? parseInt(ultimaOferta.numeroOferta.replace('OF-', ''), 10) + 1
    : 1;
  const numeroOferta = `OF-${String(nextNumber).padStart(6, '0')}`;

  const oferta = await prisma.oferta.create({
    data: {
      tenantId,
      numeroOferta,
      clienteId: parsed.clienteId,
      fechaVencimiento: parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null,
      estado: 'PENDIENTE',
      subtotal: parsed.subtotal,
      impuestos: parsed.impuestos,
      total: parsed.total,
      observaciones: parsed.observaciones || null,
      items: {
        create: parsed.items.map((item) => ({
          productoId: item.productoId || null,
          servicioId: item.servicioId || null,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          total: item.total,
        })),
      },
    },
    include: OFERTA_INCLUDE,
  });

  revalidatePath('/busy/ofertas');
  return serializeOferta(oferta);
});

export const updateOfertaAction = withAction(async (input: OfertaUpdateInput, user: AuthenticatedUser) => {
  const parsed = ofertaUpdateSchema.parse(input);
  const { ofertaId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.oferta.findFirst({
  // @ts-expect-error
  where: { ofertaId, tenantId }
  });
  if (!existing) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');

  const oferta = await prisma.oferta.update({
    where: {
  // @ts-expect-error
    ofertaId
    },
    data: {
      ...(data.estado !== undefined && { estado: data.estado }),
      ...(data.observaciones !== undefined && { observaciones: data.observaciones }),
    },
    include: OFERTA_INCLUDE,
  });

  revalidatePath('/busy/ofertas');
  return serializeOferta(oferta);
});

export const deleteOfertaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.oferta.findFirst({ where: { id: id, tenantId } });
  if (!existing) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');

  await prisma.oferta.delete({ where: { id: id } });
  revalidatePath('/busy/ofertas');
  return { id, eliminado: true };
});

export const facturarOfertaAction = withAction(async (input: FacturarOfertaInput, user: AuthenticatedUser) => {
  const parsed = facturarOfertaSchema.parse(input);
  const tenantId = requireTenant(user);

  const oferta = await prisma.oferta.findFirst({
    where: { id: parsed.ofertaId, tenantId },
    include: { items: { include: { producto: true, servicio: true } }, cliente: true },
  });
  if (!oferta) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
  if (oferta.estado === 'FACTURADA') throw new ActionError('La oferta ya fue facturada', 'VALIDATION_ERROR');
  if (oferta.estado === 'RECHAZADA') throw new ActionError('No se puede facturar una oferta rechazada', 'VALIDATION_ERROR');

  const resultado = await prisma.$transaction(async (tx: any) => {
    // Workflow de facturación
    const venta = await applyFacturacionCobroWorkflow(tx, {
      tenantId,
      clienteId: oferta.clienteId,
  // @ts-expect-error
      ofertaId: oferta.id,
      items: oferta.items.map((item) => ({
        productoId: item.productoId,
        servicioId: item.servicioId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        total: item.total,
      })),
      subtotal: oferta.subtotal,
      impuestos: oferta.impuestos,
      total: oferta.total,
      puntoDeVentaId: parsed.puntoDeVentaId,
      empleadoId: parsed.empleadoId || null,
      observaciones: parsed.observaciones || null,
      cargoTransporte: parsed.cargoTransporte || 0,
      serieId: parsed.serieId || null,
      usuarioId: user.userId,
    });

    // Anticipo
    if (parsed.anticipoCobroId && parsed.idempotencyKey) {
      await applyAnticipoAllocations(tx, [{
  // @ts-expect-error
      anticipoId: parsed.anticipoCobroId, montoAplicado: oferta.total
      }], {
  // @ts-expect-error
        documentoDestinoId: venta.ventaId,
        contexto: 'OFERTA_FACTURACION',
        usuarioId: user.userId,
        observaciones: `Anticipo aplicado a facturación de oferta ${oferta.id}`,
      });
    }

    // Marcar oferta como facturada
    await tx.oferta.update({
      where: { id: oferta.id },
      data: { estado: 'FACTURADA' },
    });

    return venta;
  });

  revalidatePath('/busy/ofertas');
  return resultado;
});
