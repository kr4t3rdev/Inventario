/**
 * @description Server Actions para compras de productos.
 *
 * @module features/compras-productos/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { calcularPrecioCostoCompra } from '@/lib/inventory-cost-utils';
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { hasUnrevertedAnticipoExecution } from '@/lib/services/anticipos-guards';
import { FORMA_PAGO_ANTICIPO_PAGO } from '@/lib/constants/anticipos';
import { createCompraProductoSchema, updateCompraProductoSchema } from './schemas';
import type { CreateCompraProductoInput, UpdateCompraProductoInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const COMPRA_INCLUDE = {
  proveedor: { select: { vendorId: true, nombre: true } },
  items: { include: { producto: { select: { id: true, nombre: true } } } },
} as const;

export const getComprasProductosAction = withAction(async (
  input: {
    search?: string; tipoOperacion?: string; estado?: string; formaPago?: string;
    proveedorId?: string; fechaDesde?: string; fechaHasta?: string;
    montoMin?: number; montoMax?: number; page?: number; limit?: number;
  } = {},
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);
  const page = input.page || 1;
  const limit = input.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, any> = { tenantId, deletedAt: null };
  if (input.tipoOperacion) where.tipoOperacion = input.tipoOperacion;
  if (input.estado) where.estado = input.estado;
  if (input.formaPago) where.formaPago = input.formaPago;
  if (input.proveedorId) where.proveedorId = input.proveedorId;
  if (input.fechaDesde || input.fechaHasta) {
    where.fechaCompra = {};
    if (input.fechaDesde) where.fechaCompra.gte = new Date(input.fechaDesde);
    if (input.fechaHasta) where.fechaCompra.lte = new Date(input.fechaHasta);
  }
  if (input.montoMin !== undefined || input.montoMax !== undefined) {
    where.total = {};
    if (input.montoMin !== undefined) where.total.gte = input.montoMin;
    if (input.montoMax !== undefined) where.total.lte = input.montoMax;
  }
  if (input.search) {
    where.OR = [
      { numeroFactura: { contains: input.search, mode: 'insensitive' } },
      { items: { some: { producto: { nombre: { contains: input.search, mode: 'insensitive' } } } } },
      { proveedor: { nombre: { contains: input.search, mode: 'insensitive' } } },
    ];
  }

  const [compras, total] = await Promise.all([
    prisma.compraDocumento.findMany({ where, include: COMPRA_INCLUDE, orderBy: { fechaCompra: 'desc' }, skip, take: limit }),
    prisma.compraDocumento.count({ where }),
  ]);

  return { compras, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
});

export const getCompraProductoByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const compra = await prisma.compraDocumento.findFirst({
    where: { compraDocumentoId: id, tenantId, deletedAt: null },
  // @ts-expect-error
    include: { ...COMPRA_INCLUDE, pagoGastos: true },
  });
  if (!compra) throw new ActionError('Compra no encontrada', 'NOT_FOUND');
  return compra;
});

export const createCompraProductoAction = withAction(async (input: CreateCompraProductoInput, user: AuthenticatedUser) => {
  const parsed = createCompraProductoSchema.parse(input);
  const tenantId = requireTenant(user);

  // Validar proveedor
  const proveedor = await prisma.vendor.findFirst({ where: { vendorId: parsed.proveedorId, tenantId } });
  if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');

  // Validar productos
  // @ts-expect-error
  const items = [];
  for (const item of parsed.items) {
    const producto = await prisma.producto.findFirst({ where: { id: item.productoId, tenantId } });
    if (!producto) throw new ActionError(`Producto ${item.productoId} no encontrado`, 'NOT_FOUND');

  // @ts-expect-error
    const nuevoPrecioCosto = calcularPrecioCostoCompra(producto, item.cantidad, item.precioCosto);

    items.push({ producto, cantidad: item.cantidad, precioCosto: item.precioCosto, nuevoPrecioCosto });
  }

  const total = items.reduce((sum, i) => sum + i.precioCosto * i.cantidad, 0);

  const resultado = await prisma.$transaction(async (tx: any) => {
    const compra = await tx.compraDocumento.create({
      data: {
        tenantId, proveedorId: parsed.proveedorId, numeroFactura: parsed.numeroFactura || '',
        facturaUrl: parsed.facturaUrl || '', formaPago: parsed.formaPago,
        estado: parsed.estado, total, descripcion: parsed.descripcionCompra || null,
        fechaCompra: new Date(), fechaVencimiento: parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null,
        tipoOperacion: 'REGULAR',
        items: {
  // @ts-expect-error
          create: items.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad, precioCosto: i.precioCosto, total: i.precioCosto * i.cantidad })),
        },
      },
      include: COMPRA_INCLUDE,
    });

    // Actualizar stock y precios
  // @ts-expect-error
    for (const item of items) {
      await tx.producto.update({
        where: { id: item.producto.id },
        data: {
          stock: { increment: item.cantidad },
          precioCosto: item.nuevoPrecioCosto,
        },
      });

      await upsertStockUbicacion(tx, {
        productoId: item.producto.id, tipoUbicacion: 'almacen',
        ubicacionId: item.producto.almacenId, modo: 'increment', delta: item.cantidad,
      });
    }

    // Pago workflow
    if (parsed.formaPago === 'PAGO_COMPLETO') {
      await applyPagoGastoWorkflow(tx, {
  // @ts-expect-error
        tenantId, compraDocumentoId: compra.compraDocumentoId, total,
        proveedorId: parsed.proveedorId, usuarioId: user.userId,
      });
    }

    // Anticipo
    if (parsed.formaPago === FORMA_PAGO_ANTICIPO_PAGO && parsed.anticipoPagoId) {
      const hasAnticipo = await hasUnrevertedAnticipoExecution(tx, parsed.idempotencyKey!);
      if (!hasAnticipo) {
        await applyAnticipoAllocations(tx, [{ anticipoId: parsed.anticipoPagoId, montoAplicado: total }], {
          documentoDestinoId: compra.compraDocumentoId, contexto: 'COMPRA_PRODUCTO',
          usuarioId: user.userId, observaciones: `Pago de compra ${compra.compraDocumentoId}`,
        });
      }
    }

    return compra;
  });

  revalidatePath('/busy/compras-productos');
  return resultado;
});

export const updateCompraProductoAction = withAction(async (input: UpdateCompraProductoInput, user: AuthenticatedUser) => {
  const parsed = updateCompraProductoSchema.parse(input);
  const { compraDocumentoId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.compraDocumento.findFirst({ where: { compraDocumentoId, tenantId } });
  if (!existing) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

  const updateData: Record<string, any> = {};
  if (data.numeroFactura !== undefined) updateData.numeroFactura = data.numeroFactura;
  if (data.facturaUrl !== undefined) updateData.facturaUrl = data.facturaUrl;
  if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
  if (data.formaPago !== undefined) updateData.formaPago = data.formaPago;
  if (data.estado !== undefined) updateData.estado = data.estado;

  const updated = await prisma.compraDocumento.update({
    where: { compraDocumentoId },
    data: updateData,
    include: COMPRA_INCLUDE,
  });

  revalidatePath('/busy/compras-productos');
  return updated;
});

export const deleteCompraProductoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const compra = await prisma.compraDocumento.findFirst({ where: { compraDocumentoId: id, tenantId } });
  if (!compra) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

  // Soft delete
  await prisma.compraDocumento.update({
    where: { compraDocumentoId: id },
    data: { deletedAt: new Date() },
  });

  revalidatePath('/busy/compras-productos');
  return { id, eliminado: true };
});
