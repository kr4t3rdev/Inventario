import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import { createVentaSchema, anularVentaSchema } from '@/features/ventas/schemas';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { getOrCreateTurnoActivo } from '@/features/turnos-pos';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { VENTA_SELECT } from '@/features/ventas/services/venta-read-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { AnularVentaInput, CreateVentaInput } from '@/features/ventas/schemas';

function hasClosedPeriodEffects(venta: {
  turno?: { estado: string; arqueos?: readonly unknown[] } | null;
}): boolean {
  return (
    (venta.turno != null && venta.turno.estado !== 'ABIERTO') ||
    (venta.turno?.arqueos?.length ?? 0) > 0
  );
}

type ReconciliationForReversal = {
  cuentaId: string;
  moneda: string;
  monto: unknown;
};

/**
 * @description Reverses bank balances using the amount already persisted by reconciliation.
 * No exchange-rate conversion is performed during a sale cancellation.
 */
async function reverseReconciliations(
  tx: Prisma.TransactionClient,
  reconciliaciones: readonly ReconciliationForReversal[],
  tenantId: string,
) {
  const grouped = new Map<string, { cuentaId: string; moneda: string; monto: number }>();

  for (const reconciliacion of reconciliaciones) {
    // Reverse the exact amount added to the bank balance; do not recalculate FX.
    const monto = Number(reconciliacion.monto);
    if (!Number.isFinite(monto) || monto < 0) {
      throw new ActionError('Monto de reconciliación inválido', 'VALIDATION_ERROR');
    }
    if (monto === 0) continue;

    const key = `${reconciliacion.cuentaId}:${reconciliacion.moneda}`;
    const current = grouped.get(key);
    grouped.set(key, {
      cuentaId: reconciliacion.cuentaId,
      moneda: reconciliacion.moneda,
      monto: (current?.monto ?? 0) + monto,
    });
  }

  for (const reversal of grouped.values()) {
    // The conditional update is the lock/guard that prevents a concurrent operation
    // from driving the account below zero. A failed update aborts the whole transaction.
    const updated = await tx.cuentaBancaria.updateMany({
      where: {
        cuentaId: reversal.cuentaId,
        tenantId,
        saldo: { gte: reversal.monto },
      },
      data: { saldo: { decrement: reversal.monto } },
    });

    if (updated.count !== 1) {
      throw new ActionError(
        `Saldo insuficiente para revertir la reconciliación en ${reversal.cuentaId}`,
        'SALDO_INSUFICIENTE',
      );
    }
  }
}

/**
 * @description Shared sales mutation service for web and mobile adapters.
 */
export const VentaMutationService = {
  /**
   * @description Creates a sale with its items and stock effects.
   */
  async create({
    input,
    user,
  }: {
    input: CreateVentaInput;
    user: AuthenticatedUser;
  }) {
    requireFeature(user, 'ventas-pos', 'realizar ventas');
    const parsed = createVentaSchema.parse(input);
    const tenantId = requireTenant(user);
    const hasFacturacion = user.planFeatures?.facturacion === true;

    if (parsed.clienteId && !hasFacturacion) {
      throw new ActionError(
        'Tu plan no incluye facturación. Para vincular clientes a ventas, actualiza tu plan.',
        'FEATURE_NOT_AVAILABLE',
      );
    }

    // ventas-factura: gate específico para ventas que generan factura
    if (parsed.clienteId) {
      requireFeature(user, 'ventas-factura', 'generar factura desde ventas');
    }

    let turnoId: string | null = parsed.turnoId ?? null;
    if (!turnoId) {
      const turnoResult = await getOrCreateTurnoActivo({
        puntoDeVentaId: parsed.puntoDeVentaId,
        empleadoId: parsed.empleadoId,
      });
      if (turnoResult.success) {
        turnoId = turnoResult.data.turnoId;
      }
    }

    const itemsData = parsed.items.map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      total: item.cantidad * item.precioUnitario,
    }));

    const subtotalVenta = itemsData.reduce((sum, item) => sum + item.total, 0);
    const cargoTransporte = parsed.cargoTransporte ?? 0;
    const totalVenta = subtotalVenta - (parsed.descuento ?? 0) + cargoTransporte;
    const totalCantidad = itemsData.reduce((sum, item) => sum + item.cantidad, 0);

    return prisma.$transaction(async (tx) => {
      let serie: any = null;
      let numeroConsecutivo = 0;
      let numeroFactura = '';

      if (hasFacturacion) {
        serie = await tx.serieFacturacion.findFirst({
          where: { tenantId, esPorDefecto: true },
        });

        if (!serie) {
          serie = await tx.serieFacturacion.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'asc' },
          });
        }

        if (!serie) {
          serie = await tx.serieFacturacion.create({
            data: {
              tenantId,
              prefijo: 'FV',
              descripcion: 'Facturas de Venta',
              consecutivo: 1,
              esPorDefecto: true,
            },
          });
        }

        const updatedSerie = await tx.serieFacturacion.update({
          where: { serieId: serie.serieId },
          data: { consecutivo: { increment: 1 } },
        });

        numeroConsecutivo = updatedSerie.consecutivo - 1;
        numeroFactura = `${serie.prefijo}-${String(numeroConsecutivo).padStart(6, '0')}`;
      }

      const venta = await tx.venta.create({
        data: {
          tenantId,
          puntoDeVentaId: parsed.puntoDeVentaId,
          clienteId: parsed.clienteId ?? null,
          empleadoId: parsed.empleadoId ?? null,
          turnoId,
          metodoPago: parsed.metodoPago ?? null,
          montoEfectivo: parsed.montoEfectivo ?? null,
          montoTarjeta: parsed.montoTarjeta ?? null,
          montoTransferencia: parsed.montoTransferencia ?? null,
          montoCredito: parsed.montoCredito ?? null,
          descuento: parsed.descuento ?? 0,
          observaciones: parsed.observaciones ?? null,
          total: Math.max(totalVenta, 0),
          cantidad: totalCantidad,
          esVentaUnica: true,
          items: {
            create: itemsData,
          },
        },
      });

      for (const item of itemsData) {
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
          select: {
            id: true,
            nombre: true,
            stock: true,
            almacenId: true,
            tenantId: true,
          },
        });

        if (!producto) {
          throw new ActionError(`Producto con ID ${item.productoId} no encontrado`, 'NOT_FOUND');
        }

        if (parsed.puntoDeVentaId) {
          const stockPV = await tx.stockUbicacion.findUnique({
            where: {
              productoId_tipoUbicacion_ubicacionId: {
                productoId: item.productoId,
                tipoUbicacion: 'punto_venta',
                ubicacionId: parsed.puntoDeVentaId,
              },
            },
            select: { cantidadDisponible: true },
          });

          if (stockPV === null) {
            throw new ActionError(
              `El producto "${producto.nombre}" no tiene registro de stock en este punto de venta. Complete el backfill de StockUbicacion antes de vender.`,
              'STOCK_INCONSISTENTE',
            );
          }

          if (stockPV.cantidadDisponible < item.cantidad) {
            throw new ActionError(
              `Stock insuficiente en el punto de venta. Disponible: ${stockPV.cantidadDisponible}, solicitado: ${item.cantidad}`,
              'STOCK_INSUFICIENTE',
            );
          }
        } else if (producto.almacenId) {
          const stockAlmacen = await tx.stockUbicacion.findUnique({
            where: {
              productoId_tipoUbicacion_ubicacionId: {
                productoId: item.productoId,
                tipoUbicacion: 'almacen',
                ubicacionId: producto.almacenId,
              },
            },
            select: { cantidadDisponible: true },
          });

          if (stockAlmacen === null) {
            throw new ActionError(
              `El producto "${producto.nombre}" no tiene registro de stock en su almacén. Complete el backfill de StockUbicacion antes de vender.`,
              'STOCK_INCONSISTENTE',
            );
          }

          if (stockAlmacen.cantidadDisponible < item.cantidad) {
            throw new ActionError(
              `Stock insuficiente en el almacén. Disponible: ${stockAlmacen.cantidadDisponible}, solicitado: ${item.cantidad}`,
              'STOCK_INSUFICIENTE',
            );
          }
        }

        if (parsed.puntoDeVentaId) {
          await upsertStockUbicacion(tx, {
            tenantId: producto.tenantId,
            productoId: item.productoId,
            tipoUbicacion: 'punto_venta',
            ubicacionId: parsed.puntoDeVentaId,
            modo: 'increment',
            delta: -item.cantidad,
          });
        } else if (producto.almacenId) {
          await upsertStockUbicacion(tx, {
            productoId: item.productoId,
            tipoUbicacion: 'almacen',
            ubicacionId: producto.almacenId,
            modo: 'increment',
            delta: -item.cantidad,
          });
        }
      }

      await allocateFifoForSale(tx, tenantId, venta.ventaId);

      if (hasFacturacion && parsed.clienteId && serie) {
        const factura = await tx.factura.create({
          data: {
            tenantId,
            serieId: serie.serieId,
            numeroConsecutivo,
            numeroFactura,
            tipoDocumento: 'FACTURA',
            ventaId: venta.ventaId,
            clienteId: parsed.clienteId,
            subtotal: subtotalVenta,
            descuento: parsed.descuento ?? 0,
            cargoTransporte,
            total: Math.max(totalVenta, 0),
            estado: 'PENDIENTE',
            creadoPor: user.userId || 'sistema',
            fechaVencimiento: parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null,
            cuentaBancariaId: parsed.cuentaBancariaId || null,
          },
        });

        if (parsed.tipoVencimiento || parsed.fechaVencimiento) {
          await applyFacturacionCobroWorkflow(tx, {
            ventaId: venta.ventaId,
            facturaId: factura.idFactura,
            clienteId: parsed.clienteId,
            montoTotal: Math.max(totalVenta, 0),
            usuarioId: user.userId || 'sistema',
            tenantId,
            observaciones: parsed.observaciones,
            tipoVencimiento: parsed.tipoVencimiento || undefined,
            fechaVencimiento: parsed.fechaVencimiento || undefined,
            cuentaBancariaId: parsed.cuentaBancariaId || undefined,
          });
        }
      }

      return venta;
    });
  },

  /**
   * @description Updates the basic mutable fields of a sale.
   */
  async update({
    input,
    user,
  }: {
    input: { ventaId: string } & Partial<{ observaciones: string; descuento: number }>;
    user: AuthenticatedUser;
  }) {
    requireFeature(user, 'ventas-pos', 'editar ventas');
    const { ventaId, ...data } = input;
    const tenantId = requireTenant(user);
    const existing = await prisma.venta.findFirst({
      where: { ventaId, tenantId, deletedAt: null },
      select: { ventaId: true },
    });

    if (!existing) {
      throw new ActionError('Venta no encontrada', 'NOT_FOUND');
    }

    return prisma.venta.update({
      where: { ventaId },
      data,
      select: VENTA_SELECT,
    });
  },

  /**
   * @description Cancels a sale and restores stock to the original source location.
   */
  async cancel({
    input,
    user,
  }: {
    input: AnularVentaInput;
    user: AuthenticatedUser;
  }) {
    requireFeature(user, 'ventas-pos', 'anular ventas');
    const parsed = anularVentaSchema.parse(input);
    const tenantId = requireTenant(user);

    const venta = await prisma.venta.findUnique({
      where: { ventaId: parsed.ventaId },
      select: {
        ventaId: true,
        tenantId: true,
        puntoDeVentaId: true,
        deletedAt: true,
        factura: { select: { idFactura: true, tenantId: true } },
        reconciliaciones: {
          select: {
            reconciliacionId: true,
            cuentaId: true,
            moneda: true,
            monto: true,
          },
        },
        turno: {
          select: {
            estado: true,
            arqueos: { select: { id: true }, take: 1 },
          },
        },
        items: {
          select: {
            id: true,
            productoId: true,
            cantidad: true,
            producto: {
              select: { id: true, almacenId: true, tenantId: true },
            },
          },
        },
      },
    });

    if (!venta || venta.tenantId !== tenantId) {
      throw new ActionError('Venta no encontrada', 'NOT_FOUND');
    }

    if (venta.deletedAt) {
      throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
    }

    if (hasClosedPeriodEffects(venta)) {
      throw new ActionError(
        'No se puede anular una venta de un turno cerrado o con arqueo.',
        'FINANCIAL_REVERSAL_REQUIRED',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "ventaId" FROM "Venta"
        WHERE "ventaId" = ${parsed.ventaId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
      const currentVenta = await tx.venta.findUnique({
        where: { ventaId: parsed.ventaId },
        select: {
          tenantId: true,
          deletedAt: true,
          factura: { select: { idFactura: true, tenantId: true } },
          reconciliaciones: {
            select: {
              reconciliacionId: true,
              cuentaId: true,
              moneda: true,
              monto: true,
            },
          },
          turno: {
            select: {
              estado: true,
              arqueos: { select: { id: true }, take: 1 },
            },
          },
        },
      });

      if (!currentVenta || currentVenta.tenantId !== tenantId) {
        throw new ActionError('Venta no encontrada', 'NOT_FOUND');
      }
      if (currentVenta.factura?.tenantId && currentVenta.factura.tenantId !== tenantId) {
        throw new ActionError('Venta no encontrada', 'NOT_FOUND');
      }
      if (currentVenta.deletedAt) {
        throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
      }
      if (hasClosedPeriodEffects(currentVenta)) {
        throw new ActionError(
          'No se puede anular una venta de un turno cerrado o con arqueo.',
          'FINANCIAL_REVERSAL_REQUIRED',
        );
      }

      // Claim the cancellation atomically before applying any side effects. If another
      // request already cancelled this sale, no stock or FIFO effect is applied twice.
      const cancelledAt = new Date();
      const marked = await tx.venta.updateMany({
        where: {
          ventaId: parsed.ventaId,
          tenantId,
          deletedAt: null,
        },
        data: {
          deletedAt: cancelledAt,
          observaciones: parsed.motivo ? `ANULADA: ${parsed.motivo}` : 'ANULADA',
        },
      });

      if (marked.count !== 1) {
        throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
      }

      let cuentasPorCobrarAnuladas = 0;
      if (currentVenta.factura?.idFactura) {
        await tx.factura.update({
          where: { idFactura: currentVenta.factura.idFactura },
          data: { estado: 'ANULADA' },
        });

      }

      const cuentasPorCobrar = await tx.cuentaPorCobrar.findMany({
        where: {
          tenantId,
          OR: [
            { facturaId: parsed.ventaId },
            ...(currentVenta.factura?.idFactura
              ? [{ facturaId: currentVenta.factura.idFactura }]
              : []),
          ],
        },
        select: { id: true },
      });

      if (cuentasPorCobrar.length > 0) {
        cuentasPorCobrarAnuladas = cuentasPorCobrar.length;
        await tx.cuentaPorCobrar.updateMany({
          where: {
            tenantId,
            id: { in: cuentasPorCobrar.map((cuenta) => cuenta.id) },
          },
          // Keep all monetary and transfer fields intact: cancellation is a
          // historical state transition, not a payment or deletion of debt.
          data: { estado: 'ANULADA' },
        });
      }

      const reconciliaciones = currentVenta.reconciliaciones ?? [];
      await reverseReconciliations(tx, reconciliaciones, tenantId);

      if (reconciliaciones.length > 0) {
        // ReconciliacionVenta has no annulled/reversed state. Once the exact bank
        // amounts are reversed, remove those active payment rows; the linked CxC
        // and its financial history remain untouched above.
        await tx.reconciliacionVenta.deleteMany({
          where: { tenantId, ventaId: parsed.ventaId },
        });
      }

      for (const item of venta.items) {
        if (venta.puntoDeVentaId) {
          await upsertStockUbicacion(tx, {
            tenantId: item.producto.tenantId,
            productoId: item.productoId,
            tipoUbicacion: 'punto_venta',
            ubicacionId: venta.puntoDeVentaId,
            modo: 'increment',
            delta: item.cantidad,
          });
        } else if (item.producto?.almacenId) {
          await upsertStockUbicacion(tx, {
            productoId: item.productoId,
            tipoUbicacion: 'almacen',
            ubicacionId: item.producto.almacenId,
            modo: 'increment',
            delta: item.cantidad,
          });
        }
      }

      await tx.purchaseAllocation.deleteMany({
        where: {
          tenantId,
          ventaItemId: { in: venta.items.map((item) => item.id) },
        },
      });

      await AuditLogService.logStrict(
        {
          accion: 'EXECUTE',
          entidad: 'VENTA',
          entidadId: parsed.ventaId,
          usuarioId: user.userId,
          detalles: {
            motivo: parsed.motivo ?? null,
            facturaAnulada: Boolean(currentVenta.factura?.idFactura),
            cuentasPorCobrarAnuladas,
            reconciliacionesRevertidas: reconciliaciones.length,
            stockItemsRestored: venta.items.length,
          },
        },
        tx,
      );
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return { ventaId: parsed.ventaId, anulada: true };
  },
};
