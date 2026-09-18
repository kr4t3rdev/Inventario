import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import {
  applyFacturacionCobroWorkflow,
  type TipoVencimientoFactura,
} from '@/features/ventas/services/facturacion-workflow';

interface OfertaProductoItem {
  productoId: string | null;
  cantidad: number;
  precioUnitario: Prisma.Decimal | number;
  total: Prisma.Decimal | number;
}

interface OfertaServicioItem {
  servicioId: string | null;
  cantidad: number;
  precioUnitario: Prisma.Decimal | number;
  total: Prisma.Decimal | number;
  moneda: string;
}

interface FacturarOfertaWorkflowParams {
  tenantId: string;
  ofertaId: string;
  clienteId: string;
  puntoDeVentaId: string;
  turnoId?: string | null;
  serieId?: string | null;
  empleadoId?: string | null;
  observaciones?: string | null;
  cargoTransporte?: number;
  tipoVencimiento?: string | null;
  fechaVencimiento?: string | null;
  cuentaBancariaId?: string | null;
  usuarioId: string;
  subtotal: Prisma.Decimal | number;
  impuestos: Prisma.Decimal | number;
  total: Prisma.Decimal | number;
  items: OfertaProductoItem[];
  servicios?: OfertaServicioItem[];
}

export interface FacturarOfertaWorkflowResult {
  ventaId: string;
  facturaId: string;
  tipoVencimiento: TipoVencimientoFactura;
  reconciliacionId: string | null;
}

/**
 * @description Resuelve la serie de facturación a usar al facturar una oferta.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {string} tenantId - Tenant activo.
 * @param {string | null | undefined} serieId - Serie solicitada opcionalmente por la UI.
 * @returns {Promise<{ serieId: string; prefijo: string; consecutivo: number }>} Serie seleccionada.
 */
async function resolveSerieFacturacion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  serieId?: string | null,
): Promise<{ serieId: string; prefijo: string; consecutivo: number }> {
  let serie = serieId
    ? await tx.serieFacturacion.findFirst({
        where: { serieId, tenantId, activa: true },
        select: { serieId: true, prefijo: true, consecutivo: true },
      })
    : null;

  if (!serie) {
    serie = await tx.serieFacturacion.findFirst({
      where: { tenantId, esPorDefecto: true, activa: true },
      select: { serieId: true, prefijo: true, consecutivo: true },
    });
  }

  if (!serie) {
    serie = await tx.serieFacturacion.findFirst({
      where: { tenantId, activa: true },
      orderBy: { createdAt: 'asc' },
      select: { serieId: true, prefijo: true, consecutivo: true },
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
      select: { serieId: true, prefijo: true, consecutivo: true },
    });
  }

  return serie;
}

/**
 * @description Factura una oferta creando la venta, descontando stock de productos e emitiendo la factura.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {FacturarOfertaWorkflowParams} params - Datos tipados de la oferta a facturar.
 * @returns {Promise<FacturarOfertaWorkflowResult>} IDs y resultado del workflow de cobro.
 */
export async function facturarOfertaWorkflow(
  tx: Prisma.TransactionClient,
  params: FacturarOfertaWorkflowParams,
): Promise<FacturarOfertaWorkflowResult> {
  const serie = await resolveSerieFacturacion(tx, params.tenantId, params.serieId);

  const updatedSerie = await tx.serieFacturacion.update({
    where: { serieId: serie.serieId },
    data: { consecutivo: { increment: 1 } },
    select: { consecutivo: true },
  });

  const numeroConsecutivo = updatedSerie.consecutivo - 1;
  const numeroFactura = `${serie.prefijo}-${String(numeroConsecutivo).padStart(6, '0')}`;
  const total = Math.max(Number(params.total), 0);
  const subtotal = Number(params.subtotal);
  const impuestos = Number(params.impuestos);
  const cargoTransporte = Number(params.cargoTransporte ?? 0);
  const totalCantidad = params.items.reduce((sum, item) => sum + Number(item.cantidad ?? 0), 0);

  const venta = await tx.venta.create({
    data: {
      tenantId: params.tenantId,
      puntoDeVentaId: params.puntoDeVentaId,
      clienteId: params.clienteId,
      empleadoId: params.empleadoId ?? null,
      turnoId: params.turnoId ?? null,
      observaciones: params.observaciones ?? null,
      total,
      cantidad: totalCantidad,
      esVentaUnica: true,
      ofertaId: params.ofertaId,
      items: {
        create: params.items.map((item) => ({
          productoId: item.productoId as string,
          cantidad: item.cantidad,
          precioUnitario: Number(item.precioUnitario),
          total: Number(item.total),
        })),
      },
    },
    select: { ventaId: true },
  });

  for (const item of params.servicios ?? []) {
    if (!item.servicioId) continue;
    const servicio = await tx.servicios.findFirst({
      where: { servicioId: item.servicioId, tenantId: params.tenantId },
      select: { servicioId: true, moneda: true, nombre: true },
    });
    if (!servicio) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
    await tx.ventaServicios.create({
      data: {
        tenantId: params.tenantId,
        servicioId: item.servicioId,
        clienteId: params.clienteId,
        cantidad: item.cantidad,
        precioUnitario: Number(item.precioUnitario),
        total: Number(item.total),
        moneda: servicio.moneda ?? item.moneda,
        ventaId: venta.ventaId,
      },
    });
  }

  for (const item of params.items) {
    if (!item.productoId) {
      continue;
    }

    const producto = await tx.producto.findUnique({
      where: { id: item.productoId },
      select: { id: true, nombre: true, tenantId: true },
    });

    if (!producto || producto.tenantId !== params.tenantId) {
      throw new ActionError(`Producto con ID ${item.productoId} no encontrado`, 'NOT_FOUND');
    }

    const stockPV = await tx.stockUbicacion.findUnique({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId: item.productoId,
          tipoUbicacion: 'punto_venta',
          ubicacionId: params.puntoDeVentaId,
        },
      },
      select: { cantidadDisponible: true },
    });

    if (!stockPV) {
      throw new ActionError(
        `El producto "${producto.nombre}" no tiene registro de stock en este punto de venta.`,
        'STOCK_INCONSISTENTE',
      );
    }

    if (stockPV.cantidadDisponible < item.cantidad) {
      throw new ActionError(
        `Stock insuficiente en el punto de venta. Disponible: ${stockPV.cantidadDisponible}, solicitado: ${item.cantidad}`,
        'STOCK_INSUFICIENTE',
      );
    }

    await upsertStockUbicacion(tx, {
      tenantId: params.tenantId,
      productoId: item.productoId,
      tipoUbicacion: 'punto_venta',
      ubicacionId: params.puntoDeVentaId,
      modo: 'increment',
      delta: -item.cantidad,
    });
  }

  await allocateFifoForSale(tx, params.tenantId, venta.ventaId);

  const factura = await tx.factura.create({
    data: {
      tenantId: params.tenantId,
      serieId: serie.serieId,
      numeroConsecutivo,
      numeroFactura,
      tipoDocumento: 'FACTURA',
      ventaId: venta.ventaId,
      clienteId: params.clienteId,
      subtotal,
      impuestos,
      descuento: 0,
      cargoTransporte,
      total,
      estado: 'PENDIENTE',
      creadoPor: params.usuarioId,
      fechaVencimiento: params.fechaVencimiento ? new Date(params.fechaVencimiento) : null,
      cuentaBancariaId: params.cuentaBancariaId ?? null,
    },
    select: { idFactura: true },
  });

  const workflow = await applyFacturacionCobroWorkflow(tx, {
    ventaId: venta.ventaId,
    facturaId: factura.idFactura,
    clienteId: params.clienteId,
    montoTotal: total,
    usuarioId: params.usuarioId,
    tenantId: params.tenantId,
    observaciones: params.observaciones,
    tipoVencimiento: params.tipoVencimiento,
    fechaVencimiento: params.fechaVencimiento,
    cuentaBancariaId: params.cuentaBancariaId,
  });

  return {
    ventaId: venta.ventaId,
    facturaId: factura.idFactura,
    tipoVencimiento: workflow.tipoVencimiento,
    reconciliacionId: workflow.reconciliacionId,
  };
}
