/**
 * @description Server Actions para ofertas.
 *
 * @module features/ofertas/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { getOrCreateTurnoActivo } from '@/features/turnos-pos';
import { ofertaSchema, ofertaUpdateSchema, facturarOfertaSchema } from './schemas';
import { facturarOfertaWorkflow } from './services/facturar-oferta-workflow';
import {
  getOfertaForTenant,
  listOfertasForTenant,
  OFERTA_INCLUDE,
} from './services/oferta-read-service';
import type { OfertaInput, OfertaUpdateInput, FacturarOfertaInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { Oferta } from '@/app/models/model';
import { getPrecioEfectivo } from '@/lib/types/pricing';

function serializeOferta(oferta: unknown): Oferta {
  return JSON.parse(JSON.stringify(oferta)) as Oferta;
}

export const getOfertasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);
  const ofertas = await listOfertasForTenant(tenantId);
  return ofertas.map(serializeOferta);
});

export const getOfertaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);
  const oferta = await getOfertaForTenant(id, tenantId);
  if (!oferta) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
  return serializeOferta(oferta);
});

export const createOfertaAction = withAction(async (input: OfertaInput, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const parsed = ofertaSchema.parse(input);
  const tenantId = requireTenant(user);

  // Validar cliente
  const cliente = await prisma.cliente.findFirst({
    where: { clienteId: parsed.clienteId, tenantId },
    select: { clienteId: true, listaPrecioId: true },
  });
  if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');

  const resolvedItems = await Promise.all(parsed.items.map(async (item) => {
    if (item.productoId) {
      const producto = await prisma.producto.findFirst({
        where: { id: item.productoId, tenantId },
        include: { precios: true },
      });
      if (!producto) throw new ActionError('Producto no encontrado', 'NOT_FOUND');
      const precioUnitario = getPrecioEfectivo(producto, cliente.listaPrecioId);
      return { ...item, precioUnitario, total: item.cantidad * precioUnitario };
    }

    const servicio = await prisma.servicios.findFirst({
      where: { servicioId: item.servicioId, tenantId },
    });
    if (!servicio) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
    return { ...item, precioUnitario: servicio.precio, total: item.cantidad * servicio.precio };
  }));
  const subtotal = resolvedItems.reduce((sum, item) => sum + item.total, 0);
  const impuestos = parsed.impuestos ?? 0;

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
      subtotal,
      impuestos,
      total: subtotal + impuestos,
      observaciones: parsed.observaciones || null,
      items: {
        create: resolvedItems.map((item) => ({
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
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const parsed = ofertaUpdateSchema.parse(input);
  const { ofertaId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.oferta.findFirst({
  where: { id: ofertaId, tenantId }
  });
  if (!existing) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');

  const oferta = await prisma.oferta.update({
    where: { id: ofertaId },
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
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);
  const existing = await prisma.oferta.findFirst({ where: { id: id, tenantId } });
  if (!existing) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');

  await prisma.oferta.delete({ where: { id: id } });
  revalidatePath('/busy/ofertas');
  return { id, eliminado: true };
});

export const facturarOfertaAction = withAction(async (input: FacturarOfertaInput, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const parsed = facturarOfertaSchema.parse(input);
  const tenantId = requireTenant(user);

  const oferta = await prisma.oferta.findFirst({
    where: { id: parsed.ofertaId, tenantId },
    include: { items: { include: { producto: true, servicio: true } }, cliente: true },
  });
  if (!oferta) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
  if (oferta.estado === 'FACTURADA') throw new ActionError('La oferta ya fue facturada', 'VALIDATION_ERROR');
  if (oferta.estado === 'RECHAZADA') throw new ActionError('No se puede facturar una oferta rechazada', 'VALIDATION_ERROR');

  const turnoResult = await getOrCreateTurnoActivo({
    puntoDeVentaId: parsed.puntoDeVentaId,
    empleadoId: parsed.empleadoId,
  });
  if (!turnoResult.success) {
    throw new ActionError(turnoResult.error.message, turnoResult.error.code ?? 'VALIDATION_ERROR');
  }
  const turnoId = turnoResult.data.turnoId;

  const resultado = await prisma.$transaction(async (tx: any) => {
    const workflow = await facturarOfertaWorkflow(tx, {
      tenantId,
      ofertaId: oferta.id,
      clienteId: oferta.clienteId,
      puntoDeVentaId: parsed.puntoDeVentaId,
      turnoId,
       items: oferta.items.filter((item) => item.productoId).map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        total: item.total,
       })),
       servicios: oferta.items.filter((item) => item.servicioId).map((item) => ({
         servicioId: item.servicioId,
         cantidad: item.cantidad,
         precioUnitario: item.precioUnitario,
         total: item.total,
         moneda: item.servicio?.moneda ?? 'CUP',
       })),
      subtotal: oferta.subtotal,
      impuestos: oferta.impuestos,
      total: oferta.total,
      empleadoId: parsed.empleadoId || null,
      observaciones: parsed.observaciones || null,
      cargoTransporte: parsed.cargoTransporte || 0,
      serieId: parsed.serieId || null,
      tipoVencimiento: parsed.tipoVencimiento || null,
      fechaVencimiento: parsed.fechaVencimiento || null,
      cuentaBancariaId: parsed.cuentaBancariaId || null,
      usuarioId: user.userId,
    });

    // Anticipo
    if (parsed.anticipoCobroId && parsed.idempotencyKey) {
      await applyAnticipoAllocations(tx, [{
      anticipoId: parsed.anticipoCobroId, montoAplicado: Number(oferta.total)
      }], {
        tenantId,
        documentoDestinoId: workflow.facturaId,
        contexto: 'FACTURA_OFERTA',
        usuarioId: user.userId,
        observaciones: `Anticipo aplicado a facturación de oferta ${oferta.id}`,
      });
    }

    // Marcar oferta como facturada
    await tx.oferta.update({
      where: { id: oferta.id },
      data: { estado: 'FACTURADA' },
    });

    return workflow;
  });

  revalidatePath('/busy/ofertas');
  return resultado;
});
