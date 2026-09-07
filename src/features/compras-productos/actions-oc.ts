'use server';

import { revalidatePath } from 'next/cache';

import { registrarMovimiento } from '@/features/inventario/movimientos';
import { prisma } from '@/lib/prisma';
import { ActionError, withAction } from '@/lib/server-actions';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  createOrdenCompraSchema,
  registrarRecepcionSchema,
  type CreateOrdenCompraInput,
  type RegistrarRecepcionInput,
} from './schemas-oc';

const ORDEN_INCLUDE = {
  proveedor: { select: { vendorId: true, nombre: true } },
  items: {
    include: {
      producto: { select: { id: true, nombre: true, almacenId: true } },
    },
  },
  recepciones: { include: { items: true }, orderBy: { fecha: 'desc' as const } },
} as const;

/**
 * @description Lista órdenes de compra del tenant con sus líneas y recepciones.
 * @param {{ estado?: string; page?: number; limit?: number }} input - Filtros y paginación.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Órdenes paginadas.
 */
export const getOrdenesCompraAction = withAction(
  async (
    input: { estado?: string; page?: number; limit?: number } = {},
    user: AuthenticatedUser,
  ) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'ordenes-compra', 'órdenes de compra');
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const where: Record<string, unknown> = { tenantId };
    if (input.estado) where.estado = input.estado;

    const [items, total] = await Promise.all([
      prisma.ordenCompra.findMany({
        where,
        include: ORDEN_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ordenCompra.count({ where }),
    ]);
    return { items, total, page, limit };
  },
);

/**
 * @description Crea una orden de compra en estado BORRADOR y calcula su total.
 * @param {CreateOrdenCompraInput} input - Proveedor y líneas solicitadas.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Orden creada.
 */
export const createOrdenCompraAction = withAction(
  async (input: CreateOrdenCompraInput, user: AuthenticatedUser) => {
    const parsed = createOrdenCompraSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'ordenes-compra', 'crear órdenes de compra');

    const proveedor = await prisma.vendor.findFirst({
      where: { vendorId: parsed.proveedorId, tenantId },
      select: { vendorId: true },
    });
    if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');

    for (const item of parsed.items) {
      const producto = await prisma.producto.findFirst({
        where: { id: item.productoId, tenantId },
        select: { id: true },
      });
      if (!producto) {
        throw new ActionError(`Producto ${item.productoId} no encontrado`, 'NOT_FOUND');
      }
    }

    const total = parsed.items.reduce(
      (sum, item) => sum + item.cantidadPedida * item.precioUnitario,
      0,
    );
    const orden = await prisma.$transaction(async (tx) => {
      const created = await tx.ordenCompra.create({
        data: {
          tenantId,
          proveedorId: parsed.proveedorId,
          estado: 'BORRADOR',
          total,
        },
      });
      for (const item of parsed.items) {
        await tx.ordenCompraItem.create({
          data: {
            tenantId,
            ordenId: created.id,
            productoId: item.productoId,
            cantidadPedida: item.cantidadPedida,
            precioUnitario: item.precioUnitario,
          },
        });
      }
      return tx.ordenCompra.findUnique({
        where: { tenantId_id: { tenantId, id: created.id } },
        include: ORDEN_INCLUDE,
      });
    });

    revalidatePath('/busy/compras/ordenes');
    return orden;
  },
);

/**
 * @description Confirma una OC con al menos una línea para habilitar recepciones.
 * @param {string} ordenId - Identificador de la orden.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Orden confirmada.
 */
export const confirmarOrdenCompraAction = withAction(
  async (ordenId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'ordenes-compra', 'confirmar órdenes de compra');
    const orden = await prisma.ordenCompra.findFirst({
      where: { id: ordenId, tenantId },
      include: { items: true },
    });
    if (!orden) throw new ActionError('Orden de compra no encontrada', 'NOT_FOUND');
    if (orden.estado !== 'BORRADOR') {
      throw new ActionError('Solo se pueden confirmar órdenes en BORRADOR', 'ESTADO_INVALIDO');
    }
    if (orden.items.length === 0) {
      throw new ActionError('La orden debe incluir al menos una línea', 'SIN_LINEAS');
    }
    // Compare-and-set: evita que confirmaciones/cancelaciones concurrentes
    // se pisen entre sí; solo una transición puede ganar.
    const claimed = await prisma.ordenCompra.updateMany({
      where: { id: orden.id, tenantId, estado: 'BORRADOR' },
      data: { estado: 'CONFIRMADA' },
    });
    if (claimed.count === 0) {
      throw new ActionError('La orden ya no está en BORRADOR', 'ESTADO_INVALIDO');
    }
    const updated = await prisma.ordenCompra.findFirst({
      where: { id: orden.id, tenantId },
      include: ORDEN_INCLUDE,
    });
    revalidatePath('/busy/compras/ordenes');
    return updated;
  },
);

/**
 * @description Registra una recepción parcial o final, actualiza backorder,
 * stock materializado y kardex en una sola transacción.
 * @param {RegistrarRecepcionInput} input - Líneas y cantidades recibidas.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Recepción y nuevo estado de la OC.
 */
export const registrarRecepcionAction = withAction(
  async (input: RegistrarRecepcionInput, user: AuthenticatedUser) => {
    const parsed = registrarRecepcionSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'recepciones', 'recepciones de compra');

    // Idempotencia de negocio: un reintento con la misma clave devuelve la
    // recepción ya registrada sin duplicar stock ni kardex.
    if (parsed.claveIdempotencia) {
      const existente = await prisma.recepcion.findFirst({
        where: { tenantId, claveIdempotencia: parsed.claveIdempotencia },
        include: { orden: true },
      });
      if (existente) {
        return {
          recepcion: existente,
          orden: existente.orden,
          estado: existente.orden.estado,
          yaRegistrada: true,
        };
      }
    }

    let result;
    try {
      result = await prisma.$transaction(async (tx: any) => {
      const orden = await tx.ordenCompra.findFirst({
        where: { id: parsed.ordenId, tenantId },
        include: {
          items: { include: { producto: { select: { id: true, almacenId: true } } } },
        },
      });
      if (!orden) throw new ActionError('Orden de compra no encontrada', 'NOT_FOUND');
      if (!['CONFIRMADA', 'PARCIAL'].includes(orden.estado)) {
        throw new ActionError(
          'Solo se pueden recibir órdenes confirmadas o parciales',
          'ESTADO_INVALIDO',
        );
      }

      const orderItems = new Map(orden.items.map((item: any) => [item.id, item]));
      for (const inputItem of parsed.items) {
        const orderItem = orderItems.get(inputItem.ordenItemId);
        if (!orderItem) throw new ActionError('Línea de orden no encontrada', 'NOT_FOUND');
        const pendiente = orderItem.cantidadPedida - orderItem.cantidadRecibida;
        if (inputItem.cantidad > pendiente) {
          throw new ActionError(
            `La recepción excede el pendiente (${pendiente})`,
            'RECEPCION_EXCEDENTE',
          );
        }
      }

      const recepcion = await tx.recepcion.create({
        data: {
          tenantId,
          ordenId: orden.id,
          creadoPorId: user.userId,
          claveIdempotencia: parsed.claveIdempotencia || null,
        },
      });
      for (const inputItem of parsed.items) {
        const orderItem = orderItems.get(inputItem.ordenItemId);
        await tx.recepcionItem.create({
          data: {
            tenantId,
            recepcionId: recepcion.id,
            ordenItemId: inputItem.ordenItemId,
            productoId: orderItem.productoId,
            cantidad: inputItem.cantidad,
          },
        });
      }

      // Los incrementos se serializan por lock de fila en PostgreSQL; tras
      // cada incremento se relee la línea dentro de la transacción y, si el
      // acumulado excede lo pedido, se revierte todo el lote.
      const recibidasActualizadas = new Map<string, number>();
      for (const [index, inputItem] of parsed.items.entries()) {
        const orderItem = orderItems.get(inputItem.ordenItemId);
        const producto = orderItem.producto;
        await tx.ordenCompraItem.update({
          where: { id: orderItem.id },
          data: { cantidadRecibida: { increment: inputItem.cantidad } },
        });
        const linea = await tx.ordenCompraItem.findFirst({
          where: { id: orderItem.id, tenantId },
          select: { cantidadPedida: true, cantidadRecibida: true },
        });
        if (!linea || linea.cantidadRecibida > linea.cantidadPedida) {
          throw new ActionError(
            `La recepción excede el pendiente (${orderItem.cantidadPedida - orderItem.cantidadRecibida})`,
            'RECEPCION_EXCEDENTE',
          );
        }
        recibidasActualizadas.set(orderItem.id, linea.cantidadRecibida);
        await upsertStockUbicacion(tx, {
          tenantId,
          productoId: orderItem.productoId,
          tipoUbicacion: 'almacen',
          ubicacionId: producto.almacenId,
          modo: 'increment',
          delta: inputItem.cantidad,
        });
        await registrarMovimiento(tx, {
          tenantId,
          productoId: orderItem.productoId,
          tipoOrigen: 'COMPRA',
          origenId: recepcion.id,
          tipoUbicacion: 'almacen',
          ubicacionId: producto.almacenId,
          cantidad: inputItem.cantidad,
          costoUnitario: orderItem.precioUnitario,
          secuencia: `ITEM-${index}`,
          creadoPorId: user.userId,
        });
      }

      const finalizado = orden.items.every((item: any) => {
        const recibida = recibidasActualizadas.get(item.id) ?? item.cantidadRecibida;
        return recibida >= item.cantidadPedida;
      });
      const estado = finalizado ? 'RECIBIDA' : 'PARCIAL';
      // CAS: si la orden fue cancelada concurrentemente, se revierte la
      // recepción completa en lugar de dejar stock sin orden válida.
      const claimed = await tx.ordenCompra.updateMany({
        where: { id: orden.id, tenantId, estado: { in: ['CONFIRMADA', 'PARCIAL'] } },
        data: { estado },
      });
      if (claimed.count === 0) {
        throw new ActionError(
          'La orden cambió de estado mientras se registraba la recepción',
          'ESTADO_INVALIDO',
        );
      }
      const updated = await tx.ordenCompra.findFirst({
        where: { id: orden.id, tenantId },
      });
      return { recepcion, orden: updated, estado };
    });
    } catch (error: unknown) {
      // Concurrencia extrema: otro request con la misma clave ganó el UNIQUE.
      const code = (error as { code?: string })?.code;
      if (code === 'P2002' && parsed.claveIdempotencia) {
        const existente = await prisma.recepcion.findFirst({
          where: { tenantId, claveIdempotencia: parsed.claveIdempotencia },
          include: { orden: true },
        });
        if (existente) {
          return {
            recepcion: existente,
            orden: existente.orden,
            estado: existente.orden.estado,
            yaRegistrada: true,
          };
        }
      }
      throw error;
    }

    revalidatePath('/busy/compras/ordenes');
    revalidatePath('/busy/compras/recepciones');
    revalidatePath('/busy/inventario/kardex');
    return result;
  },
);

/**
 * @description Cancela una OC que aún conserva cantidades pendientes.
 * @param {string} ordenId - Identificador de la orden.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<unknown>} Orden cancelada.
 */
export const cancelarOrdenCompraAction = withAction(
  async (ordenId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'ordenes-compra', 'cancelar órdenes de compra');
    const orden = await prisma.ordenCompra.findFirst({
      where: { id: ordenId, tenantId },
      include: { items: true },
    });
    if (!orden) throw new ActionError('Orden de compra no encontrada', 'NOT_FOUND');
    if (['RECIBIDA', 'CANCELADA'].includes(orden.estado)) {
      throw new ActionError('La orden ya no tiene cantidades pendientes', 'ESTADO_INVALIDO');
    }
    // Compare-and-set: solo gana si el estado sigue siendo uno cancelable.
    const claimed = await prisma.ordenCompra.updateMany({
      where: { id: orden.id, tenantId, estado: { in: ['BORRADOR', 'CONFIRMADA', 'PARCIAL'] } },
      data: { estado: 'CANCELADA' },
    });
    if (claimed.count === 0) {
      throw new ActionError('La orden ya no tiene cantidades pendientes', 'ESTADO_INVALIDO');
    }
    const updated = await prisma.ordenCompra.findFirst({
      where: { id: orden.id, tenantId },
      include: ORDEN_INCLUDE,
    });
    revalidatePath('/busy/compras/ordenes');
    return updated;
  },
);
