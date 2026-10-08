/**
 * @description Server Actions para compras de productos.
 *
 * @module features/compras-productos/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { calcularPrecioCostoCompra } from '@/lib/inventory-cost-utils';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento } from '@/features/inventario/movimientos';
import { getStockTotalProducto } from '@/lib/services/stock-ubicacion-queries';
import { recordCostChange, CostChangeReason } from '@/lib/cost-history-utils';
import { hasUnrevertedAnticipoExecution } from '@/lib/services/anticipos-guards';
import { FORMA_PAGO_ANTICIPO_PAGO } from '@/lib/constants/anticipos';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoCompraCredito } from '@/features/contabilidad-formal/lib/event-builders';
import { reverseFormalEntries } from '@/features/contabilidad-formal/services/reversal-service';
import { getRequiredTenantAccountingPolicy } from '@/features/contabilidad/services/tenant-accounting-policy-service';
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow';
import { resolveTenantInventoryCostValuation } from '@/lib/services/inventory-cost-valuation';
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
  requireFeature(user, 'compras', 'registrar compras de productos');
  requirePermission(user, 'compras.compras.gestionar', 'registrar compras de productos');

  if (parsed.claveIdempotencia) {
    const existente = await prisma.compraDocumento.findFirst({
      where: { tenantId, claveIdempotencia: parsed.claveIdempotencia },
      include: COMPRA_INCLUDE,
    });
    if (existente) return existente;
  }

  const proveedor = await prisma.vendor.findFirst({ where: { vendorId: parsed.proveedorId, tenantId } });
  if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
  if (parsed.ordenCompraId) {
    requireFeature(user, 'ordenes-compra', 'facturar órdenes de compra');
  }

  const productos = new Map<string, any>();
  const agregados = new Map<string, { cantidad: number; costoTotal: number }>();
  for (const item of parsed.items) {
    if (!productos.has(item.productoId)) {
      const producto = await prisma.producto.findFirst({
        where: { id: item.productoId, tenantId },
      });
      if (!producto) {
        throw new ActionError(`Producto ${item.productoId} no encontrado`, 'NOT_FOUND');
      }
      productos.set(item.productoId, producto);
    }
    const actual = agregados.get(item.productoId) ?? { cantidad: 0, costoTotal: 0 };
    actual.cantidad += item.cantidad;
    actual.costoTotal += item.cantidad * item.precioCosto;
    agregados.set(item.productoId, actual);
  }

  const total = parsed.items.reduce((sum, item) => sum + item.precioCosto * item.cantidad, 0);
  const fechaCompra = new Date();
  const fechaTasa = parsed.fechaTasa ? new Date(parsed.fechaTasa) : null;
  if (fechaTasa && Number.isNaN(fechaTasa.getTime())) {
    throw new ActionError('La fecha efectiva de la tasa no es válida', 'VALIDATION_ERROR');
  }
  try {
    const resultado = await prisma.$transaction(async (tx: any) => {
      const accountingPolicy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const effectiveAt = parsed.moneda === 'CUP' ? fechaCompra : fechaTasa;
      let valuation;
      try {
        valuation = await resolveTenantInventoryCostValuation(tx, {
          amount: total,
          sourceCurrency: parsed.moneda,
          functionalCurrency: accountingPolicy.functionalCurrencyCode,
          exchangeRateToCup: parsed.tasaCambio,
          effectiveAt,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('COST_FX_RATE_MISSING')) {
          throw new ActionError('Falta evidencia FX para valorar el inventario en moneda funcional', 'FX_INSUFICIENTE');
        }
        throw error;
      }
      const conversion = {
        montoConvertido: valuation.amount.toNumber(),
        tasaCambio: valuation.exchangeRate.toNumber(),
        fxEvidence: {
          functionalCurrency: valuation.evidence.functionalCurrency,
          ...(valuation.evidence.rateEffectiveAt
            ? { rateEffectiveAt: new Date(valuation.evidence.rateEffectiveAt) }
            : {}),
          fxProvenanceKind: valuation.evidence.fxProvenanceKind,
          fxProvenanceSource: valuation.evidence.fxProvenanceSource,
          fxCatalogRateId: valuation.evidence.fxCatalogRateId,
          fxEvidenceFingerprint: valuation.evidence.fxEvidenceFingerprint,
          fxEvidenceVersion: valuation.evidence.fxEvidenceVersion,
        },
      };
      let ordenVinculada: any = null;
      const preciosOc = new Map<string, number>();

      if (parsed.ordenCompraId) {
        // Un UPDATE neutro toma el lock de la fila y serializa facturas y
        // recepciones concurrentes antes de verificar cantidades disponibles.
        const locked = await tx.ordenCompra.updateMany({
          where: { id: parsed.ordenCompraId, tenantId },
          data: { updatedAt: new Date() },
        });
        if (locked.count === 0) {
          throw new ActionError('Orden de compra no encontrada', 'NOT_FOUND');
        }

        ordenVinculada = await tx.ordenCompra.findFirst({
          where: { id: parsed.ordenCompraId, tenantId },
          include: { items: { include: { recepciones: true } } },
        });
        if (!ordenVinculada) {
          throw new ActionError('Orden de compra no encontrada', 'NOT_FOUND');
        }
        if (!['PARCIAL', 'RECIBIDA'].includes(ordenVinculada.estado)) {
          throw new ActionError(
            'La orden debe tener al menos una recepción antes de facturarse',
            'ORDEN_SIN_RECEPCION',
          );
        }
        if (ordenVinculada.proveedorId !== parsed.proveedorId) {
          throw new ActionError('El proveedor no coincide con la orden de compra', 'VALIDATION_ERROR');
        }

        const facturadoPorProducto = new Map<string, number>();
        const facturasPrevias = await tx.compraDocumento.findMany({
          where: { ordenCompraId: parsed.ordenCompraId, tenantId, deletedAt: null, estado: { not: 'ANULADA' } },
          select: { items: { select: { productoId: true, cantidad: true } } },
        });
        for (const factura of facturasPrevias) {
          for (const linea of factura.items) {
            facturadoPorProducto.set(
              linea.productoId,
              (facturadoPorProducto.get(linea.productoId) ?? 0) + linea.cantidad,
            );
          }
        }

        for (const [productoId, solicitado] of agregados) {
          const ordenItems = ordenVinculada.items.filter(
            (orderItem: any) => orderItem.productoId === productoId,
          );
          let recibido = 0;
          let costoRecibido = 0;
          for (const orderItem of ordenItems) {
            const recibidoLinea = orderItem.recepciones.reduce(
              (sum: number, recepcion: any) => sum + recepcion.cantidad,
              0,
            );
            recibido += recibidoLinea;
            costoRecibido += recibidoLinea * orderItem.precioUnitario;
          }
          const disponible = recibido - (facturadoPorProducto.get(productoId) ?? 0);
          if (ordenItems.length === 0 || solicitado.cantidad > disponible) {
            const nombre = productos.get(productoId)?.nombre ?? productoId;
            throw new ActionError(
              `La factura excede la cantidad pendiente para ${nombre} (disponible: ${Math.max(disponible, 0)})`,
              'FACTURA_EXCEDE_RECEPCION',
            );
          }
          preciosOc.set(productoId, recibido > 0 ? costoRecibido / recibido : 0);
        }
      }

      const ajustes = new Map<string, any>();
      for (const [productoId, agregado] of agregados) {
        const producto = productos.get(productoId);
        const stockAntes = await getStockTotalProducto(tx, { productoId });
        const precioFactura = (agregado.costoTotal / agregado.cantidad) * conversion.tasaCambio;
        const nuevoPrecioCosto = ordenVinculada
          ? {
              precioCostoNuevo: stockAntes > 0
                ? Math.round(
                    producto.precioCosto +
                      ((precioFactura - (preciosOc.get(productoId) ?? precioFactura)) *
                        Math.min(agregado.cantidad, stockAntes)) /
                        stockAntes,
                  )
                : producto.precioCosto,
              metodoCosto: 'AJUSTE_FACTURA',
            }
          : calcularPrecioCostoCompra({
              stockAntes,
              precioCostoActual: producto.precioCosto,
              cantidadCompra: agregado.cantidad,
              costoUnitario: precioFactura,
            });
        ajustes.set(productoId, { producto, stockAntes, nuevoPrecioCosto, ...agregado });
      }

      const compra = await tx.compraDocumento.create({
        data: {
          tenantId,
          proveedorId: parsed.proveedorId,
          numeroFactura: parsed.numeroFactura || '',
          facturaUrl: parsed.facturaUrl || '',
          formaPago: parsed.formaPago,
          moneda: parsed.moneda,
          tasaCambio: conversion.tasaCambio,
          montoConvertido: conversion.montoConvertido,
          ...conversion.fxEvidence,
          estado: parsed.estado,
          total,
          descripcion: parsed.descripcionCompra || null,
          ordenCompraId: parsed.ordenCompraId,
          claveIdempotencia: parsed.claveIdempotencia || null,
          fechaCompra,
          tipoOperacion: 'REGULAR',
        },
      });

      for (const item of parsed.items) {
        await tx.compraDocumentoItem.create({
          data: {
            tenantId,
            compraDocumentoId: compra.compraDocumentoId,
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioCosto,
            totalLinea: item.precioCosto * item.cantidad,
          },
        });
      }

      const compraCompleta = await tx.compraDocumento.findUnique({
        where: { compraDocumentoId: compra.compraDocumentoId },
        include: COMPRA_INCLUDE,
      });

      for (const ajuste of ajustes.values()) {
        await tx.producto.update({
          where: { id: ajuste.producto.id },
          data: { precioCosto: ajuste.nuevoPrecioCosto.precioCostoNuevo },
        });

        if (ajuste.nuevoPrecioCosto.precioCostoNuevo !== ajuste.producto.precioCosto) {
          try {
            await recordCostChange(tx, {
              productoId: ajuste.producto.id,
              oldPrecioCosto: ajuste.producto.precioCosto,
              newPrecioCosto: ajuste.nuevoPrecioCosto.precioCostoNuevo,
              oldPrecioVenta: ajuste.producto.precioVenta,
              newPrecioVenta: ajuste.producto.precioVenta,
              reason: CostChangeReason.RESTOCK,
              changedBy: user.userId,
              notes: `Compra x${ajuste.cantidad} - Factura ${parsed.numeroFactura || 'N/A'}`,
            });
          } catch (error) {
            console.error('Error registrando cost history (no bloqueante):', error);
          }
        }
      }

      // Una factura vinculada documenta lo recibido y no crea otra entrada.
      for (const [idx, item] of parsed.items.entries()) {
        const producto = productos.get(item.productoId);
      if (!parsed.ordenCompraId) {
        await upsertStockUbicacion(tx, {
            tenantId,
            productoId: item.productoId,
            tipoUbicacion: 'almacen',
            ubicacionId: producto.almacenId,
            modo: 'increment',
            delta: item.cantidad,
        });

        await registrarMovimiento(tx, {
          tenantId,
            productoId: item.productoId,
          tipoOrigen: 'COMPRA',
          origenId: compra.compraDocumentoId,
          tipoUbicacion: 'almacen',
            ubicacionId: producto.almacenId,
          cantidad: item.cantidad,
            costoUnitario: item.precioCosto,
          secuencia: `ITEM-${idx}`,
          creadoPorId: user.userId,
        });
      }
      }

      let cxpAnticipoId: string | undefined;
      if (parsed.formaPago === 'PAGO_COMPLETO' || parsed.formaPago === 'PAGO_PARCIAL' ||
        parsed.formaPago === FORMA_PAGO_ANTICIPO_PAGO) {
      const now = new Date();
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const primeraLinea = parsed.items[0];

      const gastoCompra = await tx.gastoCompra.create({
        data: {
          tenantId,
            productoId: primeraLinea.productoId,
          vendorId: parsed.proveedorId,
            cantidad: parsed.items.reduce((sum, item) => sum + item.cantidad, 0),
            precioUnitario: Math.round(
              total / parsed.items.reduce((sum, item) => sum + item.cantidad, 0),
            ),
          total,
          fechaCompra: now,
          descripcion: `Compra #${compra.compraDocumentoId}`,
          periodo,
          numeroFactura: parsed.numeroFactura || undefined,
        },
      });

      if (parsed.formaPago === 'PAGO_COMPLETO') {
        await applyPagoGastoWorkflow(tx, {
          tipoGasto: 'compra',
          referenciaId: gastoCompra.gastoCompraId,
          reconciliadoPor: user.userId,
          descripcion: `Compra pagada ${parsed.numeroFactura || compra.compraDocumentoId}`,
          monto: total,
          moneda: parsed.moneda,
          functionalCurrency: conversion.fxEvidence.functionalCurrency,
          tenantId,
          tasaCambio: conversion.tasaCambio,
          tasaCambioCuenta: parsed.tasaCambio,
          periodo,
          estado: 'PAGADA',
          gastoCompraId: gastoCompra.gastoCompraId,
          cuentaId: parsed.cuentaId,
          tipoPagoId: parsed.tipoPagoId,
          fechaPago: fechaTasa ?? now,
        });
      }

      await tx.compraDocumento.update({
        where: { compraDocumentoId: compra.compraDocumentoId },
        data: { gastoCompraId: gastoCompra.gastoCompraId },
      });

      if (parsed.formaPago === 'PAGO_PARCIAL' || parsed.formaPago === FORMA_PAGO_ANTICIPO_PAGO) {
        const cxp = await tx.cuentaPorPagar.create({
          data: {
            tenantId,
            numeroFactura: parsed.numeroFactura || '',
            gastoCompraId: gastoCompra.gastoCompraId,
            montoDeuda: total,
            saldoPendiente: total,
            moneda: parsed.moneda,
            fxSnapshot: {
              originalAmount: String(total), originalCurrency: parsed.moneda.trim().toUpperCase(),
              functionalAmount: String(compra.montoConvertido ?? total),
              functionalCurrency: compra.functionalCurrency ?? 'CUP',
              exchangeRate: String(compra.tasaCambio ?? 1),
              rateEffectiveAt: compra.rateEffectiveAt?.toISOString() ?? '',
              fxProvenanceKind: compra.fxProvenanceKind ?? 'SAME_CURRENCY',
              fxProvenanceSource: compra.fxProvenanceSource ?? 'compra-documento',
              fxCatalogRateId: compra.fxCatalogRateId ?? null,
              fxEvidenceFingerprint: compra.fxEvidenceFingerprint,
              fxEvidenceVersion: compra.fxEvidenceVersion ?? 2,
            },
            estado: 'PENDIENTE',
            tipo: 'compra',
            proveedorId: parsed.proveedorId,
            proveedorNombre: proveedor.nombre,
          },
        });
        if (parsed.formaPago === FORMA_PAGO_ANTICIPO_PAGO) {
          cxpAnticipoId = cxp.cuentaPorPagarId;
        }

        await tx.compraDocumento.update({
          where: { compraDocumentoId: compra.compraDocumentoId },
          data: { cuentaPorPagarId: cxp.cuentaPorPagarId },
        });

        // Capa de contabilidad formal (CTA-1): compra a crédito → inventario vs CxP.
        await postEvento(
          tx,
          { tenantId, userId: user.userId },
          buildEventoCompraCredito({
            compraId: compra.compraDocumentoId,
            monto: total,
            moneda: parsed.moneda,
            montoFuncional: Number(compra.montoConvertido),
            tasaCambio: compra.tasaCambio == null ? null : Number(compra.tasaCambio),
            fxEvidenceFingerprint: compra.fxEvidenceFingerprint ?? null,
            monedaFuncionalCodigo: compra.functionalCurrency ?? 'CUP',
            descripcion: `Compra a crédito ${parsed.numeroFactura || compra.compraDocumentoId}`,
            fecha: compra.fechaCompra,
            referencia: parsed.numeroFactura || undefined,
          }),
        );
      }
      }

      if (parsed.formaPago === FORMA_PAGO_ANTICIPO_PAGO && parsed.anticipoPagoId) {
      const hasAnticipo = await hasUnrevertedAnticipoExecution(tx, parsed.idempotencyKey!);
      if (!hasAnticipo) {
        await applyAnticipoAllocations(tx, [{ anticipoId: parsed.anticipoPagoId, montoAplicado: total }], {
          tenantId,
          documentoDestinoId: compra.compraDocumentoId, contexto: 'COMPRA_PRODUCTO',
          idempotencyKey: parsed.idempotencyKey,
          usuarioId: user.userId, observaciones: `Pago de compra ${compra.compraDocumentoId}`,
          proveedorId: parsed.proveedorId, monedaDocumento: parsed.moneda,
          monedaFuncionalDocumento: compra.functionalCurrency ?? 'CUP',
          montoFuncionalDocumento: compra.montoConvertido ?? total,
        });
        if (!cxpAnticipoId) {
          throw new ActionError('La compra no conserva su obligación bruta', 'VALIDATION_ERROR');
        }
        await tx.cuentaPorPagar.updateMany({
          where: { cuentaPorPagarId: cxpAnticipoId, tenantId },
          data: { montoPagado: total, saldoPendiente: 0, estado: 'PAGADA' },
        });
      }
      }

      return compraCompleta;
    });

    revalidatePath('/busy/compras-productos');
    return resultado;
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002' && parsed.claveIdempotencia) {
      const existente = await prisma.compraDocumento.findFirst({
        where: { tenantId, claveIdempotencia: parsed.claveIdempotencia },
        include: COMPRA_INCLUDE,
      });
      if (existente) return existente;
    }
    throw error;
  }
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
        assertFormaPagoTransitionAllowed(existing, data.formaPago ?? '');
      }
      assertCompraEstadoCompatible(data.formaPago ?? existing.formaPago, data.estado, existing.estado);

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
  assertCompraEstadoCompatible(existing.formaPago, data.estado, existing.estado);

  const updated = await prisma.compraDocumento.update({
    where: { compraDocumentoId },
    data: updateData,
    include: COMPRA_INCLUDE,
  });

  revalidatePath('/busy/compras-productos');
  return updated;
});

/**
 * @description Valida un cambio de forma de pago sin revertir efectos financieros.
 * @param {Awaited<ReturnType<typeof prisma.compraDocumento.findFirst>> & { cuentaPorPagar: any }} compra - Compra existente.
 * @param {string} nuevaFormaPago - Forma de pago solicitada.
 * @returns {void} No retorna si el cambio no produce inconsistencias.
 */
function assertFormaPagoTransitionAllowed(
  compra: Awaited<ReturnType<typeof prisma.compraDocumento.findFirst>> & { cuentaPorPagar: any },
  nuevaFormaPago: string,
): void {
  const oldFormaPago = compra.formaPago;

  if (oldFormaPago === FORMA_PAGO_ANTICIPO_PAGO || nuevaFormaPago === FORMA_PAGO_ANTICIPO_PAGO) {
    throw new ActionError(
      'No se puede cambiar desde/hacia ANTICIPO_PAGO porque la reconciliación de anticipos no está implementada. Anule la compra y cree una nueva.',
      'ANTICIPO_RECONCILIATION_NOT_IMPLEMENTED',
    );
  }

  if (oldFormaPago === 'PAGO_PARCIAL' && nuevaFormaPago === 'PAGO_COMPLETO'
    && compra.cuentaPorPagar
    && Number(compra.cuentaPorPagar.saldoPendiente) < Number(compra.cuentaPorPagar.montoDeuda)) {
    throw new ActionError(
      'La cuenta por pagar ya tiene pagos parciales. Revierta los pagos desde Contabilidad primero.',
      'CXP_HAS_PAYMENTS',
    );
  }

  if (oldFormaPago === 'PAGO_COMPLETO' || nuevaFormaPago === 'PAGO_COMPLETO') {
    throw new ActionError(
      'No se puede cambiar la forma de pago porque requiere registrar o revertir el movimiento bancario desde Contabilidad.',
      'FORMA_PAGO_RECONCILIATION_NOT_IMPLEMENTED',
    );
  }
}

/**
 * @description Evita cambiar el estado pagado sin que coincida con la forma de pago.
 * @param {string} formaPago - Forma de pago vigente o solicitada.
 * @param {string | undefined} nuevoEstado - Estado solicitado.
 * @param {string | undefined} estadoActual - Estado persistido.
 * @returns {void} No retorna si el cambio es compatible.
 */
function assertCompraEstadoCompatible(
  formaPago: string,
  nuevoEstado: string | undefined,
  estadoActual: string | undefined,
): void {
  if (!nuevoEstado || nuevoEstado === estadoActual) return;
  const estadoEsperado = formaPago === 'PAGO_COMPLETO'
    ? 'PAGADA'
    : formaPago === 'PAGO_PARCIAL'
      ? 'PENDIENTE'
      : null;
  if (estadoEsperado && nuevoEstado !== estadoEsperado) {
    throw new ActionError(
      'El estado de la compra no puede cambiarse sin registrar o revertir el pago correspondiente desde Contabilidad.',
      'COMPRA_ESTADO_RECONCILIATION_NOT_IMPLEMENTED',
    );
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

  if ((compra.items?.length ?? 0) > 0 && compra.estado !== 'ANULADA') {
    throw new ActionError(
      'No se puede eliminar la compra porque ya impactó inventario. Use una anulación o reversión en lugar de borrar.',
      'HAS_INVENTORY_IMPACT'
    );
  }

  const deleted = await prisma.compraDocumento.updateMany({
    where: { compraDocumentoId: id, tenantId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (deleted.count !== 1) {
    throw new ActionError('La compra ya fue eliminada', 'VALIDATION_ERROR');
  }

  revalidatePath('/busy/compras-productos');
  return { id, eliminado: true };
});

const anularCompraSchema = z.object({
  id: z.string().min(1),
  motivo: z.string().max(500).optional(),
});

/**
 * @description Anula una compra de productos: revierte stock y kardex (las
 * ligadas a orden de compra no, su stock lo movió la recepción), elimina la
 * CxP sin pagos, deja el gasto como borrado lógico y marca el documento como
 * ANULADA. Las anuladas no alimentan FIFO ni el pendiente de facturar por OC.
 *
 * Limitación documentada: el precios de costo ponderado del producto no se
 * recalcula hacia atrás (el kardex registra la reversa con el costo original).
 *
 * @param {{ id: string; motivo?: string }} input - Compra a anular y motivo opcional.
 * @returns {{ id: string; estado: 'ANULADA' }} Documento anulado.
 */
export const anularCompraProductoAction = withAction(async (input: { id: string; motivo?: string }, user: AuthenticatedUser) => {
  const parsed = anularCompraSchema.parse(input);
  const tenantId = requireTenant(user);

  const compra = await prisma.compraDocumento.findFirst({
    where: { compraDocumentoId: parsed.id, tenantId, deletedAt: null },
    include: {
      items: {
        include: { producto: { select: { id: true, almacenId: true, nombre: true } } },
      },
      cuentaPorPagar: {
        include: {
          pagos: { select: { pagoCuentaPorPagarId: true } },
          reconciliaciones: { select: { reconciliacionId: true } },
        },
      },
      gastoCompra: { include: { reconciliaciones: { select: { reconciliacionId: true } } } },
    },
  });
  if (!compra) throw new ActionError('Compra no encontrada', 'NOT_FOUND');
  if (compra.estado === 'ANULADA') {
    throw new ActionError('La compra ya está anulada', 'VALIDATION_ERROR');
  }

  const anticipoMovimiento = await prisma.anticipoMovimiento.findFirst({
    where: {
      documentoDestinoId: parsed.id,
      contexto: 'COMPRA_PRODUCTO',
      anticipo: { tenantId },
    },
  });
  if (anticipoMovimiento) {
    throw new ActionError(
      'No se puede anular la compra porque tiene anticipo aplicado. Revierta el anticipo primero.',
      'HAS_IMPACT'
    );
  }

  const resultado = await prisma.$transaction(async (tx: any) => {
    // CAS: marcar ANULADA primero evita que dos anulaciones concurrentes
    // reviertan el stock dos veces.
    const marcada = await tx.compraDocumento.updateMany({
      where: { compraDocumentoId: compra.compraDocumentoId, tenantId, deletedAt: null, estado: { not: 'ANULADA' } },
      data: {
        estado: 'ANULADA',
        gastoCompraId: null,
        cuentaPorPagarId: null,
        updatedById: user.userId,
        ...(parsed.motivo
          ? { descripcion: `${compra.descripcion ? compra.descripcion + ' — ' : ''}Anulada: ${parsed.motivo}` }
          : {}),
      },
    });
    if (marcada.count !== 1) {
      throw new ActionError('La compra ya está anulada', 'VALIDATION_ERROR');
    }

    await reverseFormalEntries(tx, { tenantId, userId: user.userId }, [
      { tipo: 'compra_documento', id: compra.compraDocumentoId },
    ]);

    if (compra.cuentaPorPagar) {
      const cxp = compra.cuentaPorPagar;
      const tienePagos =
        cxp.pagos.length > 0 ||
        (cxp.reconciliaciones?.length ?? 0) > 0 ||
        Number(cxp.montoPagado ?? 0) > 0;
      if (tienePagos) {
        throw new ActionError(
          'No se puede anular la compra porque la cuenta por pagar tiene pagos registrados. Revierta los pagos desde Contabilidad primero.',
          'CXP_HAS_PAYMENTS'
        );
      }
      // Sin pagos la CxP es solo un pasivo pendiente: se elimina.
      await tx.cuentaPorPagar.delete({ where: { cuentaPorPagarId: cxp.cuentaPorPagarId } });
    }

    if (compra.gastoCompra) {
      if ((compra.gastoCompra.reconciliaciones?.length ?? 0) > 0) {
        throw new ActionError(
          'No se puede anular la compra porque el gasto está reconciliado. Revise la reconciliación primero.',
          'HAS_IMPACT'
        );
      }
      await tx.gastoCompra.update({
        where: { gastoCompraId: compra.gastoCompra.gastoCompraId },
        data: { deletedAt: new Date() },
      });
    }

    if (!compra.ordenCompraId) {
      for (const [idx, item] of compra.items.entries()) {
        if (!item.producto?.almacenId) continue;
        await upsertStockUbicacion(tx, {
          tenantId,
          productoId: item.productoId,
          tipoUbicacion: 'almacen',
          ubicacionId: item.producto.almacenId,
          modo: 'increment',
          delta: -item.cantidad,
        });
        await registrarMovimiento(tx, {
          tenantId,
          productoId: item.productoId,
          tipoOrigen: 'AJUSTE',
          origenId: compra.compraDocumentoId,
          tipoUbicacion: 'almacen',
          ubicacionId: item.producto.almacenId,
          cantidad: -item.cantidad,
          costoUnitario: item.precioUnitario,
          secuencia: `ANULACION-ITEM-${idx}`,
          creadoPorId: user.userId,
        });
      }
    }

    return { id: compra.compraDocumentoId, estado: 'ANULADA' };
  });

  revalidatePath('/busy/compras-productos');
  return resultado;
});
