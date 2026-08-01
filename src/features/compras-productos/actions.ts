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
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { getStockTotalProducto } from '@/lib/services/stock-ubicacion-queries';
import { recordCostChange, CostChangeReason } from '@/lib/cost-history-utils';
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
    include: {
      // @ts-expect-error Prisma include typing omits pagoGastos in this composite helper include.
      ...COMPRA_INCLUDE, pagoGastos: true
    },
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
  // @ts-expect-error items se infiere como never[] sin anotación explícita en este flujo incremental.
  const items = [];
  for (const item of parsed.items) {
    const producto = await prisma.producto.findFirst({ where: { id: item.productoId, tenantId } });
    if (!producto) throw new ActionError(`Producto ${item.productoId} no encontrado`, 'NOT_FOUND');
    const stockAntes = await getStockTotalProducto(prisma, {
      productoId: item.productoId,
    });

    const nuevoPrecioCosto = calcularPrecioCostoCompra({
      stockAntes,
      precioCostoActual: producto.precioCosto,
      cantidadCompra: item.cantidad,
      costoUnitario: item.precioCosto,
    });

    items.push({ producto, cantidad: item.cantidad, precioCosto: item.precioCosto, nuevoPrecioCosto });
  }

  const total = items.reduce((sum, i) => sum + i.precioCosto * i.cantidad, 0);

  const resultado = await prisma.$transaction(async (tx: any) => {
    const compra = await tx.compraDocumento.create({
      data: {
        tenantId, proveedorId: parsed.proveedorId, numeroFactura: parsed.numeroFactura || '',
        facturaUrl: parsed.facturaUrl || '', formaPago: parsed.formaPago,
        estado: parsed.estado, total, descripcion: parsed.descripcionCompra || null,
        fechaCompra: new Date(),
        tipoOperacion: 'REGULAR',
        items: {
          create: items.map((i) => ({
          tenantId, productoId: i.producto.id, cantidad: i.cantidad, precioUnitario: i.precioCosto, totalLinea: i.precioCosto * i.cantidad
          })),
        },
      },
      include: COMPRA_INCLUDE,
    });

    // Actualizar stock y precios
    // @ts-expect-error item se infiere como any en el array incremental usado para la transacción.
    for (const item of items) {
      const oldPrecioCosto = item.producto.precioCosto;

      await tx.producto.update({
        where: { id: item.producto.id },
        data: {
          precioCosto: item.nuevoPrecioCosto.precioCostoNuevo,
        },
      });

      await upsertStockUbicacion(tx, {
        tenantId, productoId: item.producto.id, tipoUbicacion: 'almacen',
        ubicacionId: item.producto.almacenId, modo: 'increment', delta: item.cantidad,
      });

      // Registrar cambio de costo en historial
      if (item.nuevoPrecioCosto.precioCostoNuevo !== oldPrecioCosto) {
        try {
          await recordCostChange(
            // @ts-expect-error - tx es compatible con PrismaClient
            tx,
            {
              productoId: item.producto.id,
              oldPrecioCosto,
              newPrecioCosto: item.nuevoPrecioCosto.precioCostoNuevo,
              oldPrecioVenta: item.producto.precioVenta,
              newPrecioVenta: item.producto.precioVenta,
              reason: CostChangeReason.RESTOCK,
              changedBy: user.userId || 'system',
              notes: `Compra x${item.cantidad} - Factura ${parsed.numeroFactura || 'N/A'}`,
            },
          )
        } catch (_chErr) {
          console.error('Error registrando cost history (no bloqueante):', _chErr);
        }
      }
    }

    // ── Crear GastoCompra (registro contable del gasto) ──
    // Se crea para PAGO_COMPLETO y PAGO_PARCIAL.
    // La reconciliación (ReconciliacionGasto) se hace desde Contabilidad.
    if (parsed.formaPago === 'PAGO_COMPLETO' || parsed.formaPago === 'PAGO_PARCIAL') {
      const now = new Date();
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const gastoCompra = await tx.gastoCompra.create({
        data: {
          tenantId,
          productoId: items[0].producto.id,
          vendorId: parsed.proveedorId,
          cantidad: items.reduce((s, i) => s + i.cantidad, 0),
          precioUnitario: Math.round(total / items.reduce((s, i) => s + i.cantidad, 0)),
          total,
          fechaCompra: now,
          descripcion: `Compra #${compra.compraDocumentoId}`,
          periodo,
          numeroFactura: parsed.numeroFactura || undefined,
        },
      });

      // Vincular el GastoCompra al CompraDocumento
      await tx.compraDocumento.update({
        where: { compraDocumentoId: compra.compraDocumentoId },
        data: { gastoCompraId: gastoCompra.gastoCompraId },
      });

      // ── PAGO_PARCIAL: Crear CuentaPorPagar (con gastoCompraId linkeado) ──
      if (parsed.formaPago === 'PAGO_PARCIAL') {
        const cxp = await tx.cuentaPorPagar.create({
          data: {
            tenantId,
            numeroFactura: parsed.numeroFactura || '',
            gastoCompraId: gastoCompra.gastoCompraId,
            montoDeuda: total,
            saldoPendiente: total,
            moneda: 'CUP',
            estado: 'PENDIENTE',
            tipo: 'compra',
            proveedorId: parsed.proveedorId,
            proveedorNombre: proveedor.nombre,
          },
        });

        await tx.compraDocumento.update({
          where: { compraDocumentoId: compra.compraDocumentoId },
          data: { cuentaPorPagarId: cxp.cuentaPorPagarId },
        });
      }
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

  const updateData: Record<string, any> = {};
  if (data.numeroFactura !== undefined) updateData.numeroFactura = data.numeroFactura;
  if (data.facturaUrl !== undefined) updateData.facturaUrl = data.facturaUrl;
  if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
  if (data.formaPago !== undefined) updateData.formaPago = data.formaPago;
  if (data.estado !== undefined) updateData.estado = data.estado;

  if (data.formaPago !== undefined) {
    const updated = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.compraDocumento.findFirst({
        where: { compraDocumentoId, tenantId },
        include: { cuentaPorPagar: true },
      });
      if (!existing) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

      if (data.formaPago !== existing.formaPago) {
        await reconcileFormaPago(tx, existing, data.formaPago);
      }

      return tx.compraDocumento.update({
        where: { compraDocumentoId },
        data: updateData,
        include: COMPRA_INCLUDE,
      });
    });

    revalidatePath('/busy/compras-productos');
    return updated;
  }

  const existing = await prisma.compraDocumento.findFirst({
    where: { compraDocumentoId, tenantId },
  });
  if (!existing) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

  const updated = await prisma.compraDocumento.update({
    where: { compraDocumentoId },
    data: updateData,
    include: COMPRA_INCLUDE,
  });

  revalidatePath('/busy/compras-productos');
  return updated;
});

/**
 * @description Reconcilia entidades contables al cambiar formaPago de una compra.
 */
async function reconcileFormaPago(
  tx: any,
  compra: Awaited<ReturnType<typeof prisma.compraDocumento.findFirst>> & { cuentaPorPagar: any },
  nuevaFormaPago: string,
): Promise<void> {
  const oldFormaPago = compra.formaPago;

  if (oldFormaPago === FORMA_PAGO_ANTICIPO_PAGO || nuevaFormaPago === FORMA_PAGO_ANTICIPO_PAGO) {
    throw new ActionError(
      'No se puede cambiar desde/hacia ANTICIPO_PAGO porque la reconciliación de anticipos no está implementada. Anule la compra y cree una nueva.',
      'ANTICIPO_RECONCILIATION_NOT_IMPLEMENTED',
    );
  }

  if (oldFormaPago === 'PAGO_PARCIAL' && nuevaFormaPago === 'PAGO_COMPLETO') {
    if (!compra.cuentaPorPagarId || !compra.cuentaPorPagar) {
      throw new ActionError(
        'La compra no tiene cuenta por pagar asociada pero la forma de pago es PAGO_PARCIAL. Inconsistencia de datos.',
        'DATA_INCONSISTENCY',
      );
    }

    const cxp = compra.cuentaPorPagar;
    if (Number(cxp.saldoPendiente) < Number(cxp.montoDeuda)) {
      throw new ActionError(
        'No se puede cambiar la forma de pago porque la cuenta por pagar tiene pagos parciales aplicados. Revierta los pagos desde Contabilidad primero.',
        'CXP_HAS_PAYMENTS',
      );
    }

    await tx.cuentaPorPagar.delete({
      where: { cuentaPorPagarId: compra.cuentaPorPagarId },
    });

    await tx.compraDocumento.update({
      where: { compraDocumentoId: compra.compraDocumentoId },
      data: { cuentaPorPagarId: null },
    });
  }

  if (oldFormaPago === 'PAGO_COMPLETO' && nuevaFormaPago === 'PAGO_PARCIAL') {
    if (compra.cuentaPorPagarId) {
      throw new ActionError(
        'La compra ya tiene cuenta por pagar asociada pero la forma de pago es PAGO_COMPLETO. Inconsistencia de datos.',
        'DATA_INCONSISTENCY',
      );
    }

    const cxp = await tx.cuentaPorPagar.create({
      data: {
        tenantId: compra.tenantId,
        numeroFactura: compra.numeroFactura || '',
        gastoCompraId: compra.gastoCompraId || undefined,
        montoDeuda: compra.total,
        saldoPendiente: compra.total,
        moneda: 'CUP',
        estado: 'PENDIENTE',
        tipo: 'compra',
        proveedorId: compra.proveedorId,
      },
    });

    await tx.compraDocumento.update({
      where: { compraDocumentoId: compra.compraDocumentoId },
      data: { cuentaPorPagarId: cxp.cuentaPorPagarId },
    });
  }
}

export const deleteCompraProductoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const compra = await prisma.compraDocumento.findFirst({
    where: { compraDocumentoId: id, tenantId, deletedAt: null },
    include: {
      cuentaPorPagar: true,
      items: { select: { compraDocumentoItemId: true } },
    },
  });
  if (!compra) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

  if (compra.gastoCompraId) {
    throw new ActionError(
      'No se puede eliminar la compra porque tiene gasto contable asociado. Revierta el gasto desde Contabilidad primero.',
      'HAS_IMPACT'
    );
  }

  if (compra.cuentaPorPagarId) {
    throw new ActionError(
      'No se puede eliminar la compra porque tiene cuenta por pagar asociada. Revierta la cuenta desde Contabilidad primero.',
      'HAS_IMPACT'
    );
  }

  const anticipoMovimiento = await prisma.anticipoMovimiento.findFirst({
    where: {
      documentoDestinoId: id,
      contexto: 'COMPRA_PRODUCTO',
      anticipo: { tenantId },
    },
  });

  if (anticipoMovimiento) {
    throw new ActionError(
      'No se puede eliminar la compra porque tiene anticipo aplicado. Revierta el anticipo primero.',
      'HAS_IMPACT'
    );
  }

  if ((compra.items?.length ?? 0) > 0) {
    throw new ActionError(
      'No se puede eliminar la compra porque ya impactó inventario. Use una anulación o reversión en lugar de borrar.',
      'HAS_INVENTORY_IMPACT'
    );
  }

  await prisma.compraDocumento.update({
    where: { compraDocumentoId: id },
    data: { deletedAt: new Date() },
  });

  revalidatePath('/busy/compras-productos');
  return { id, eliminado: true };
});
