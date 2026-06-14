import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import { createVentaSchema, anularVentaSchema } from '@/features/ventas/schemas';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { getOrCreateTurnoActivo } from '@/features/turnos-pos';
import { VENTA_SELECT } from '@/features/ventas/services/venta-read-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { AnularVentaInput, CreateVentaInput } from '@/features/ventas/schemas';

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
    const totalVenta = subtotalVenta - (parsed.descuento ?? 0);
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
            cargoTransporte: 0,
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
        items: {
          select: {
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

    await prisma.$transaction(async (tx) => {
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

      await tx.venta.update({
        where: { ventaId: parsed.ventaId },
        data: {
          deletedAt: new Date(),
          observaciones: parsed.motivo ? `ANULADA: ${parsed.motivo}` : 'ANULADA',
        },
      });
    });

    return { ventaId: parsed.ventaId, anulada: true };
  },
};
