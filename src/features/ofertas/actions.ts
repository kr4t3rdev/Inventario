/**
 * @description Server Actions para ofertas.
 *
 * @module features/ofertas/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { convertirOfertaAPedido } from './services/convertir-oferta-pedido';
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
import { crearOfertaConNumero } from './lib/numero-oferta-generator';
import { expirarOfertasVencidas } from './services/expiracion-ofertas-service';
import { transicionPermitida } from './lib/transiciones-estado';
import { calcularTotalesOferta } from './lib/totales-oferta';
import { resolverItemsOferta } from './lib/resolver-items-oferta';

function serializeOferta(oferta: unknown): Oferta {
  return JSON.parse(JSON.stringify(oferta)) as Oferta;
}

export const getOfertasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);
  await expirarOfertasVencidas(tenantId);
  const ofertas = await listOfertasForTenant(tenantId);
  return ofertas.map(serializeOferta);
});

export const getOfertaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);
  await expirarOfertasVencidas(tenantId);
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

  const resolvedItems = await resolverItemsOferta(tenantId, parsed.items, cliente.listaPrecioId);

  const totales = calcularTotalesOferta(
    resolvedItems.map((item) => ({ cantidad: item.cantidad, precioUnitario: item.precioUnitario })),
    parsed.impuestos ?? 0,
  );
  if (!totales.ok) throw new ActionError(totales.message, totales.code);

  const oferta = await crearOfertaConNumero({
    tenantId,
    buildData: (numeroOferta) => ({
      tenantId,
      numeroOferta,
      clienteId: parsed.clienteId,
      fechaVencimiento: parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null,
      estado: 'PENDIENTE' as const,
      subtotal: totales.subtotal,
      impuestos: totales.impuestos,
      total: totales.total,
      observaciones: parsed.observaciones || null,
      items: {
        create: totales.lineas.map((linea, idx) => ({
          productoId: resolvedItems[idx].productoId,
          servicioId: resolvedItems[idx].servicioId,
          cantidad: linea.cantidad,
          precioUnitario: linea.precioUnitario,
          total: linea.total,
        })),
      },
    }),
    create: (data) => prisma.oferta.create({ data, include: OFERTA_INCLUDE }),
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
  where: { id: ofertaId, tenantId },
  include: { cliente: true },
  });
  if (!existing) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');

  if (parsed.estado !== undefined && parsed.estado !== existing.estado) {
    if (!transicionPermitida(existing.estado, parsed.estado)) {
      throw new ActionError(
        `La oferta en estado ${existing.estado} no puede pasar a ${parsed.estado}.`,
        'ESTADO_TRANSICION_INVALIDA',
      );
    }
  }

  if (parsed.items !== undefined) {
    if (existing.estado !== 'PENDIENTE') {
      throw new ActionError('Solo se pueden editar los ítems de una oferta en estado PENDIENTE', 'ITEMS_NO_EDITABLES');
    }
    const resolvedItems = await resolverItemsOferta(tenantId, parsed.items, existing.cliente?.listaPrecioId ?? null);
    const impuestosDeclarados = parsed.impuestos ?? Number(existing.impuestos ?? 0);
    const totales = calcularTotalesOferta(
      resolvedItems.map((item) => ({ cantidad: item.cantidad, precioUnitario: item.precioUnitario })),
      impuestosDeclarados,
    );
    if (!totales.ok) throw new ActionError(totales.message, totales.code);

    const oferta = await prisma.$transaction(async (tx: any) => {
      await tx.ofertaItem.deleteMany({ where: { ofertaId: existing.id } });
      await tx.ofertaItem.createMany({
        data: totales.lineas.map((linea, idx) => ({
          ofertaId: existing.id,
          productoId: resolvedItems[idx].productoId,
          servicioId: resolvedItems[idx].servicioId,
          cantidad: linea.cantidad,
          precioUnitario: linea.precioUnitario,
          total: linea.total,
        })),
      });
      return tx.oferta.update({
        where: { id: existing.id },
        data: {
          subtotal: totales.subtotal,
          impuestos: totales.impuestos,
          total: totales.total,
          ...(parsed.estado !== undefined && { estado: parsed.estado }),
          ...(parsed.observaciones !== undefined && { observaciones: parsed.observaciones }),
        },
        include: OFERTA_INCLUDE,
      });
    });
    revalidatePath('/busy/ofertas');
    return serializeOferta(oferta);
  }

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
  if (existing.estado === 'FACTURADA') {
    throw new ActionError('No se puede eliminar una oferta facturada', 'ESTADO_NO_ELIMINABLE');
  }

  await prisma.oferta.delete({ where: { id: id } });
  revalidatePath('/busy/ofertas');
  return { id, eliminado: true };
});

/**
 * @description Duplica una oferta del tenant: número nuevo vía generador con
 * reintento, estado PENDIENTE, ítems re-resueltos a precio vigente y totales
 * recalculados en servidor. La fechaVencimiento se conserva solo si sigue
 * futura; los impuestos declarados se conservan y se revalidan.
 */
export const duplicarOfertaAction = withAction(async (ofertaId: string, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);

  const original = await prisma.oferta.findFirst({
    where: { id: ofertaId, tenantId },
    include: { items: true, cliente: true },
  });
  if (!original) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');

  const resolvedItems = await resolverItemsOferta(
    tenantId,
    original.items.map((item) => ({
      productoId: item.productoId ?? undefined,
      servicioId: item.servicioId ?? undefined,
      cantidad: item.cantidad,
    })),
    original.cliente?.listaPrecioId ?? null,
  );

  const totales = calcularTotalesOferta(
    resolvedItems.map((item) => ({ cantidad: item.cantidad, precioUnitario: item.precioUnitario })),
    Number(original.impuestos ?? 0),
  );
  if (!totales.ok) {
    throw new ActionError(`No se pudo duplicar la oferta: ${totales.message}`, totales.code);
  }

  const fechaVencimiento =
    original.fechaVencimiento && new Date(original.fechaVencimiento) > new Date()
      ? new Date(original.fechaVencimiento)
      : null;

  const duplicada = await crearOfertaConNumero({
    tenantId,
    buildData: (numeroOferta) => ({
      tenantId,
      numeroOferta,
      clienteId: original.clienteId,
      fechaVencimiento,
      estado: 'PENDIENTE' as const,
      subtotal: totales.subtotal,
      impuestos: totales.impuestos,
      total: totales.total,
      observaciones: original.observaciones || null,
      items: {
        create: totales.lineas.map((linea, idx) => ({
          productoId: resolvedItems[idx].productoId,
          servicioId: resolvedItems[idx].servicioId,
          cantidad: linea.cantidad,
          precioUnitario: linea.precioUnitario,
          total: linea.total,
        })),
      },
    }),
    create: (data) => prisma.oferta.create({ data, include: OFERTA_INCLUDE }),
  });

  revalidatePath('/busy/ofertas');
  return serializeOferta(duplicada);
});

export const facturarOfertaAction = withAction(async (input: FacturarOfertaInput, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const parsed = facturarOfertaSchema.parse(input);
  const tenantId = requireTenant(user);
  await expirarOfertasVencidas(tenantId);

  const oferta = await prisma.oferta.findFirst({
    where: { id: parsed.ofertaId, tenantId },
    include: { items: { include: { producto: true, servicio: true } }, cliente: true },
  });
  if (!oferta) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
  if (oferta.estado === 'FACTURADA') throw new ActionError('La oferta ya fue facturada', 'VALIDATION_ERROR');
  if (oferta.estado === 'RECHAZADA') throw new ActionError('No se puede facturar una oferta rechazada', 'VALIDATION_ERROR');
  if (oferta.estado === 'VENCIDA') throw new ActionError('No se puede facturar una oferta vencida', 'VALIDATION_ERROR');

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

/**
 * @description Convierte una oferta (PENDIENTE/ACEPTADA) en un pedido de venta
 * (PVE): crea la venta en estado PEDIDO sin efectos de stock ni factura.
 * Idempotente; requiere la feature ventas-pedidos del plan.
 */
export const convertirOfertaAPedidoAction = withAction(
  async (
    input: { ofertaId: string; puntoDeVentaId: string },
    user: AuthenticatedUser,
  ) => {
    requireFeature(user, 'ofertas', 'gestionar ofertas');
    requireFeature(user, 'ventas-pedidos', 'convertir ofertas a pedidos');
    requirePermission(user, 'ventas.ofertas.gestionar', 'convertir ofertas');
    requirePermission(user, 'ventas.pedido.gestionar', 'crear pedidos de venta');
    const tenantId = requireTenant(user);
    await expirarOfertasVencidas(tenantId);

    const result = await convertirOfertaAPedido({
      ofertaId: input.ofertaId,
      puntoDeVentaId: input.puntoDeVentaId,
      tenantId,
      usuarioId: user.userId,
    });

    revalidatePath('/busy/ofertas');
    revalidatePath('/busy/sales');
    return result;
  },
);
