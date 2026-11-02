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
import { normalizeTipoVencimiento } from '@/features/ventas/services/facturacion-workflow';
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
import { calcularTotalesOferta, recalcularMontosOferta } from './lib/totales-oferta';
import { resolverItemsOferta } from './lib/resolver-items-oferta';
import { lockOferta } from './lib/oferta-lock';
import { exigirLimiteCredito, lockCreditoCliente } from '@/features/crm/services/credito-enforcement';
import { AuditLogService } from '@/lib/services/audit-log-service';
import type { Prisma } from '@/generated/prisma';

function serializeOferta(oferta: unknown): Oferta {
  return JSON.parse(JSON.stringify(oferta)) as Oferta;
}

/**
 * @description Distingue la causa de un claim condicional fallido sobre una
 * oferta. La expiración perezosa usa un claim sin advisory lock, así que la
 * oferta puede haber vencido entre la lectura y la escritura final: en ese
 * caso se marca VENCIDA y se informa como vencida; cualquier otro cambio de
 * estado es una transición concurrente.
 * @param {Prisma.TransactionClient} tx - Transacción donde falló el claim.
 * @param {string} tenantId - Tenant de la oferta.
 * @param {string} ofertaId - Oferta cuyo claim falló.
 * @returns {Promise<'OFERTA_VENCIDA' | 'CAMBIO_ESTADO'>} Causa del fallo.
 */
async function releerCausaDeClaimFallido(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ofertaId: string,
): Promise<'OFERTA_VENCIDA' | 'CAMBIO_ESTADO'> {
  const latest = await tx.oferta.findFirst({
    where: { id: ofertaId, tenantId },
    select: { estado: true, fechaVencimiento: true },
  });
  if (!latest) return 'CAMBIO_ESTADO';
  if (latest.estado === 'VENCIDA') return 'OFERTA_VENCIDA';
  if (
    latest.estado === 'PENDIENTE'
    && latest.fechaVencimiento
    && latest.fechaVencimiento < new Date()
  ) {
    await tx.oferta.updateMany({
      where: { id: ofertaId, tenantId, estado: 'PENDIENTE' },
      data: { estado: 'VENCIDA' },
    });
    return 'OFERTA_VENCIDA';
  }
  return 'CAMBIO_ESTADO';
}

export const getOfertasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);
  // La expiración perezosa se dispara dentro del servicio de lectura.
  const ofertas = await listOfertasForTenant(tenantId);
  return ofertas.map(serializeOferta);
});

export const getOfertaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);
  // La expiración perezosa se dispara dentro del servicio de lectura.
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

  // La cadena completa (cliente > default del tenant > base) vive en
  // resolverItemsOferta, compartida con ventas (LP-1.2/LP-1.3).
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
  const { ofertaId } = parsed;
  const tenantId = requireTenant(user);

  // Toque de módulo (E-2): una PENDIENTE vencida se marca VENCIDA antes de
  // leerse, por lo que un detalle obsoleto ya no puede aceptarla.
  await expirarOfertasVencidas(tenantId);

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

    const oferta = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Serializa con facturar/convertir: nadie puede snapshotear los ítems
      // mientras se reemplazan, y viceversa.
      await lockOferta(tx, tenantId, existing.id);
      const fresh = await tx.oferta.findFirst({ where: { id: ofertaId, tenantId } });
      if (!fresh) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
      if (fresh.estado !== 'PENDIENTE') {
        throw new ActionError('Solo se pueden editar los ítems de una oferta en estado PENDIENTE', 'ITEMS_NO_EDITABLES');
      }
      const ahora = new Date();
      if (fresh.fechaVencimiento && fresh.fechaVencimiento < ahora) {
        // Venció mientras se editaba: se marca VENCIDA en la misma
        // transacción y la edición se aborta.
        await tx.oferta.updateMany({
          where: { id: fresh.id, tenantId, estado: 'PENDIENTE' },
          data: { estado: 'VENCIDA' },
        });
        throw new ActionError('La oferta ya venció y sus ítems ya no son editables', 'OFERTA_VENCIDA');
      }
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
      const claim = await tx.oferta.updateMany({
        where: {
          id: existing.id, tenantId, estado: 'PENDIENTE',
          OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gte: new Date() } }],
        },
        data: {
          subtotal: totales.subtotal,
          impuestos: totales.impuestos,
          total: totales.total,
          ...(parsed.estado !== undefined && { estado: parsed.estado }),
          ...(parsed.observaciones !== undefined && { observaciones: parsed.observaciones }),
        },
      });
      // La expiración perezosa usa un claim sin advisory lock. Nunca se debe
      // restaurar PENDIENTE si ganó entre la lectura y la escritura final.
      if (claim.count !== 1) {
        const causa = await releerCausaDeClaimFallido(tx, tenantId, existing.id);
        if (causa === 'OFERTA_VENCIDA') {
          throw new ActionError('La oferta ya venció y sus ítems ya no son editables', 'OFERTA_VENCIDA');
        }
        throw new ActionError('La oferta cambió de estado durante la edición', 'ITEMS_NO_EDITABLES');
      }
      return tx.oferta.findFirst({ where: { id: existing.id, tenantId }, include: OFERTA_INCLUDE });
    });
    revalidatePath('/busy/ofertas');
    return serializeOferta(oferta);
  }

  if (parsed.estado !== undefined && parsed.estado !== existing.estado) {
    const destino = parsed.estado;
    const actualizada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Comparte la barrera con edición, facturación y conversión. La matriz
      // se valida contra la lectura fresca, nunca contra el estado anterior.
      await lockOferta(tx, tenantId, ofertaId);
      const actual = await tx.oferta.findFirst({ where: { id: ofertaId, tenantId } });
      if (!actual) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
      const ahora = new Date();
      if (actual.estado === 'PENDIENTE' && actual.fechaVencimiento && actual.fechaVencimiento < ahora) {
        throw new ActionError(`La oferta ya venció y no puede pasar a ${parsed.estado}.`, 'OFERTA_VENCIDA');
      }
      if (!transicionPermitida(actual.estado, destino)) {
        throw new ActionError(
          `La oferta en estado ${actual.estado} no puede pasar a ${parsed.estado}.`,
          'ESTADO_TRANSICION_INVALIDA',
        );
      }
      const claim = await tx.oferta.updateMany({
        where: {
          id: ofertaId, tenantId, estado: actual.estado,
          OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gte: ahora } }],
        },
        data: {
          estado: parsed.estado,
          ...(parsed.observaciones !== undefined && { observaciones: parsed.observaciones }),
        },
      });
      if (claim.count !== 1) {
        const causa = await releerCausaDeClaimFallido(tx, tenantId, ofertaId);
        if (causa === 'OFERTA_VENCIDA') {
          throw new ActionError(
            'La oferta ya venció y no puede cambiar de estado',
            'OFERTA_VENCIDA',
          );
        }
        throw new ActionError('El estado de la oferta cambió concurrentemente.', 'ESTADO_TRANSICION_INVALIDA');
      }
      return tx.oferta.findFirst({ where: { id: ofertaId, tenantId }, include: OFERTA_INCLUDE });
    });
    revalidatePath('/busy/ofertas');
    return serializeOferta(actualizada);
  }

  // H-5: los impuestos declarados sin replacement de ítems también se aplican:
  // el total se recalcula en el servidor sobre el subtotal persistido. Solo es
  // editable mientras la oferta está PENDIENTE (misma regla que los ítems).
  if (parsed.impuestos !== undefined) {
    const impuestosDeclarados = parsed.impuestos;
    const actualizada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockOferta(tx, tenantId, ofertaId);
      const actual = await tx.oferta.findFirst({ where: { id: ofertaId, tenantId } });
      if (!actual) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
      if (actual.estado !== 'PENDIENTE') {
        throw new ActionError(
          'Solo se pueden editar los montos de una oferta en estado PENDIENTE',
          'MONTOS_NO_EDITABLES',
        );
      }
      const ahora = new Date();
      if (actual.fechaVencimiento && actual.fechaVencimiento < ahora) {
        await tx.oferta.updateMany({
          where: { id: ofertaId, tenantId, estado: 'PENDIENTE' },
          data: { estado: 'VENCIDA' },
        });
        throw new ActionError('La oferta ya venció y sus montos ya no son editables', 'OFERTA_VENCIDA');
      }
      const recalculo = recalcularMontosOferta(Number(actual.subtotal ?? 0), impuestosDeclarados);
      if (!recalculo.ok) throw new ActionError(recalculo.message, recalculo.code);
      const claim = await tx.oferta.updateMany({
        where: {
          id: ofertaId, tenantId, estado: 'PENDIENTE',
          OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gte: ahora } }],
        },
        data: {
          impuestos: recalculo.impuestos,
          total: recalculo.total,
          ...(parsed.observaciones !== undefined && { observaciones: parsed.observaciones }),
        },
      });
      if (claim.count !== 1) {
        const causa = await releerCausaDeClaimFallido(tx, tenantId, ofertaId);
        if (causa === 'OFERTA_VENCIDA') {
          throw new ActionError('La oferta ya venció y sus montos ya no son editables', 'OFERTA_VENCIDA');
        }
        throw new ActionError('La oferta cambió de estado durante la edición', 'CONFLICT');
      }
      return tx.oferta.findFirst({ where: { id: ofertaId, tenantId }, include: OFERTA_INCLUDE });
    });
    revalidatePath('/busy/ofertas');
    return serializeOferta(actualizada);
  }

  // Solo observaciones (sin transición de estado): permitido en cualquier estado.
  const oferta = await prisma.oferta.update({
    where: { id: ofertaId },
    data: { ...(parsed.observaciones !== undefined && { observaciones: parsed.observaciones }) },
    include: OFERTA_INCLUDE,
  });

  revalidatePath('/busy/ofertas');
  return serializeOferta(oferta);
});

export const deleteOfertaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'ofertas', 'gestionar ofertas');
  const tenantId = requireTenant(user);
  // Toque de módulo (E-2): una PENDIENTE vencida se marca VENCIDA antes de
  // leerse, para que no se pueda eliminar como si siguiera vigente.
  await expirarOfertasVencidas(tenantId);

  const eliminada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Serializa con la facturación, la conversión y la edición de ítems: sin
    // el lock, una facturación concurrente podía crear la factura justo
    // antes del borrado y dejar el documento huérfano.
    await lockOferta(tx, tenantId, id);
    const actual = await tx.oferta.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true },
    });
    if (!actual) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
    if (actual.estado === 'FACTURADA') {
      throw new ActionError('No se puede eliminar una oferta facturada', 'ESTADO_NO_ELIMINABLE');
    }
    // Una oferta con una venta viva vinculada no se puede eliminar: la venta
    // (y su factura) quedarían sin oferta y sin posibilidad de rehacerlas.
    const ventaViva = await tx.venta.findFirst({
      where: { ofertaId: id, tenantId, deletedAt: null },
      select: { ventaId: true },
    });
    if (ventaViva) {
      throw new ActionError(
        'No se puede eliminar una oferta con una venta vinculada',
        'OFERTA_CON_VENTA_VINCULADA',
      );
    }
    // Claim: solo se borra si el estado sigue siendo el releído bajo lock.
    const borrada = await tx.oferta.deleteMany({
      where: { id, tenantId, estado: actual.estado },
    });
    if (borrada.count !== 1) {
      throw new ActionError(
        'La oferta cambió de estado; recarga la página e inténtalo de nuevo',
        'CONFLICT',
      );
    }
    return actual.id;
  });

  revalidatePath('/busy/ofertas');
  return { id: eliminada, eliminado: true };
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
  await expirarOfertasVencidas(tenantId);

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
  const requestedMaturity = normalizeTipoVencimiento(
    parsed.tipoVencimiento || (parsed.fechaVencimiento ? 'fecha' : undefined),
  );
  if (requestedMaturity !== 'contra_pago') {
    requireFeature(user, 'cuentas-cobrar', 'crear facturas de oferta con saldo pendiente');
  }
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

  const resultado = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Serializa con la edición de ítems y la conversión a pedido: el snapshot
    // de la venta se toma bajo el mismo lock que usan los demás writers,
    // sobre una lectura fresca del estado y los ítems.
    await lockOferta(tx, tenantId, oferta.id);
    const fresh = await tx.oferta.findFirst({
      where: { id: oferta.id, tenantId },
      include: { items: { include: { producto: true, servicio: true } }, cliente: true },
    });
    if (!fresh) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');
    if (fresh.estado === 'FACTURADA') throw new ActionError('La oferta ya fue facturada', 'VALIDATION_ERROR');
    if (fresh.estado === 'RECHAZADA') throw new ActionError('No se puede facturar una oferta rechazada', 'VALIDATION_ERROR');
    if (fresh.estado === 'VENCIDA' || (fresh.estado === 'PENDIENTE'
      && fresh.fechaVencimiento && fresh.fechaVencimiento < new Date())) {
      throw new ActionError('No se puede facturar una oferta vencida', 'VALIDATION_ERROR');
    }

    // C-2: con vencimiento distinto de contra_pago el workflow crea una CxC
    // por el total de la oferta: es deuda nueva del cliente y, por tanto, pasa
    // por el mismo enforcement de tope que el resto de writers de deuda (venta
    // de servicios, facturación de productos, POS). El anticipo aplicado a la
    // factura reduce la exposición porque la CxC nace por el total y el
    // anticipo la cancela; sin anticipo se evalúa el total completo.
    const totalOferta = Math.max(Number(fresh.total ?? 0), 0);
    const anticipoAplicado = parsed.anticipoCobroId ? totalOferta : 0;
    const montoCreditoRequerido = requestedMaturity !== 'contra_pago'
      ? Math.max(totalOferta - anticipoAplicado, 0)
      : 0;
    if (montoCreditoRequerido > 0) {
      // Lock de crédito del cliente: la evaluación se serializa contra otras
      // ventas y facturaciones concurrentes del mismo cliente.
      await lockCreditoCliente(tx, tenantId, fresh.clienteId);
      const resCredito = await exigirLimiteCredito({
        client: tx,
        tenantId,
        clienteId: fresh.clienteId,
        montoRequerido: montoCreditoRequerido,
        user,
      });
      if (resCredito.overrideUsado) {
        await AuditLogService.logStrict(
          {
            accion: 'EXECUTE',
            entidad: 'OFERTA',
            entidadId: fresh.id,
            usuarioId: user.userId,
            detalles: {
              tipo: 'CREDITO_OVERRIDE',
              clienteId: fresh.clienteId,
              limiteCredito: resCredito.limiteCredito,
              saldoVivo: resCredito.saldoVivo,
              montoRequerido: resCredito.montoEvaluado,
            },
          },
          tx,
        );
      }
    }

    const workflow = await facturarOfertaWorkflow(tx, {
      tenantId,
      ofertaId: fresh.id,
      clienteId: fresh.clienteId,
      puntoDeVentaId: parsed.puntoDeVentaId,
      turnoId,
      items: fresh.items.filter((item) => item.productoId).map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        total: item.total,
      })),
      servicios: fresh.items.filter((item) => item.servicioId).map((item) => ({
        servicioId: item.servicioId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        total: item.total,
        moneda: item.servicio?.moneda ?? 'CUP',
      })),
      subtotal: fresh.subtotal,
      impuestos: fresh.impuestos,
      total: fresh.total,
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
        anticipoId: parsed.anticipoCobroId, montoAplicado: Number(fresh.total)
      }], {
        tenantId,
        documentoDestinoId: workflow.facturaId,
        contexto: 'FACTURA_OFERTA',
        usuarioId: user.userId,
        observaciones: `Anticipo aplicado a facturación de oferta ${fresh.id}`,
      });
    }

    // Claim condicional (anti-carrera): solo se marca FACTURADA si el estado
    // sigue siendo el releído bajo lock; si otro writer lo movió, la venta se
    // revierte con la transacción.
    const marcada = await tx.oferta.updateMany({
      where: { id: fresh.id, tenantId, estado: fresh.estado },
      data: { estado: 'FACTURADA' },
    });
    if (marcada.count !== 1) {
      throw new ActionError(
        'La oferta cambió de estado mientras se facturaba; recarga la página e inténtalo de nuevo.',
        'VALIDATION_ERROR',
      );
    }

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
