import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { hasPermission, requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento } from '@/features/inventario/movimientos';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import { createVentaSchema } from '@/features/ventas/schemas';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { resolvePrecioVenta, type PrecioVentaFuente } from '@/features/ventas/services/precio-venta-resolver';
import { getOrCreateTurnoActivo } from '@/features/turnos-pos';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { VENTA_SELECT } from '@/features/ventas/services/venta-read-service';
import { VentaLifecycleService } from '@/features/ventas/services/venta-lifecycle-service';
import { validarCobro } from '@/features/ventas/services/pos-vuelto-calcu';
import {
	saldoVivoCliente,
	superaLimiteCredito,
} from '@/features/crm/services/credito-calculo';
import { exigirLimiteCredito, lockCreditoCliente } from '@/features/crm/services/credito-enforcement';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { AnularVentaInput, CreateVentaInput } from '@/features/ventas/schemas';

/** Detalle de un precio aplicado distinto al resuelto (permiso ventas.precio.override). */
type PriceOverrideDetalle = {
  productoId: string;
  nombre: string;
  precioEsperado: number;
  precioAplicado: number;
  fuente: PrecioVentaFuente;
};

/**
 * @description Descuenta el stock por item, registra el kardex de salida y
 * aplica las allocations FIFO (efectos de la entrega de una venta).
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {object} params - Datos de la entrega: tenant, venta, punto de venta
 * (o almacén por item), líneas y usuario que ejecuta.
 * @returns {Promise<void>} No devuelve valor; aborta la transacción si el
 * stock es insuficiente o el registro está inconsistente.
 */
async function aplicarEfectosInventario(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    ventaId: string;
    puntoDeVentaId?: string | null;
    itemsData: { productoId: string; cantidad: number; precioUnitario: number; total: number }[];
    userId: string;
  },
) {
  const { tenantId, ventaId, puntoDeVentaId, itemsData, userId } = params;
  for (const [itemIdx, item] of itemsData.entries()) {
    const producto = await tx.producto.findUnique({
      where: { id: item.productoId },
      select: {
        id: true,
        nombre: true,
        stock: true,
        precioCosto: true,
        almacenId: true,
        tenantId: true,
      },
    });

    if (!producto) {
      throw new ActionError(`Producto con ID ${item.productoId} no encontrado`, 'NOT_FOUND');
    }

    if (puntoDeVentaId) {
      const stockPV = await tx.stockUbicacion.findUnique({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: item.productoId,
            tipoUbicacion: 'punto_venta',
            ubicacionId: puntoDeVentaId,
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

    if (puntoDeVentaId) {
      await upsertStockUbicacion(tx, {
        tenantId: producto.tenantId,
        productoId: item.productoId,
        tipoUbicacion: 'punto_venta',
        ubicacionId: puntoDeVentaId,
        modo: 'increment',
        delta: -item.cantidad,
      });
      await registrarMovimiento(tx, {
        tenantId,
        productoId: item.productoId,
        tipoOrigen: 'VENTA',
        origenId: ventaId,
        tipoUbicacion: 'punto_venta',
        ubicacionId: puntoDeVentaId,
        cantidad: -item.cantidad,
        costoUnitario: producto.precioCosto,
        secuencia: `ITEM-${itemIdx}`,
        creadoPorId: userId,
      });
    } else if (producto.almacenId) {
      await upsertStockUbicacion(tx, {
        productoId: item.productoId,
        tipoUbicacion: 'almacen',
        ubicacionId: producto.almacenId,
        modo: 'increment',
        delta: -item.cantidad,
      });
      await registrarMovimiento(tx, {
        tenantId,
        productoId: item.productoId,
        tipoOrigen: 'VENTA',
        origenId: ventaId,
        tipoUbicacion: 'almacen',
        ubicacionId: producto.almacenId,
        cantidad: -item.cantidad,
        costoUnitario: producto.precioCosto,
        secuencia: `ITEM-${itemIdx}`,
        creadoPorId: userId,
      });
    }
  }

  await allocateFifoForSale(tx, tenantId, ventaId);
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
    requirePermission(user, 'ventas.venta.registrar', 'registrar ventas');
    const parsed = createVentaSchema.parse(input);
    const tenantId = requireTenant(user);
    const hasFacturacion = user.planFeatures?.facturacion === true;

    const requestedMaturity = parsed.tipoVencimiento
      ?? (parsed.fechaVencimiento ? 'fecha' : null);
    if (!parsed.modoPedido && parsed.clienteId && hasFacturacion && requestedMaturity &&
      requestedMaturity !== 'contra_pago') {
      requireFeature(user, 'cuentas-cobrar', 'crear facturas con saldo pendiente');
    }

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

    // ── Resolución server-side de precios (LP-0 + LP-1.2): el precioUnitario
    // del payload nunca se persiste tal cual; se valida contra la cadena
    // cliente > PV > default del tenant > base antes de abrir la transacción.
    const puntoVenta = await prisma.puntoDeVenta.findFirst({
      where: { pvId: parsed.puntoDeVentaId, tenantId },
      select: { pvId: true, listaPrecioId: true },
    });
    if (!puntoVenta) {
      throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');
    }

    // Lista marcada como default del tenant: fallback intermedio (H3/LP-1.2).
    const listaDefault = await prisma.listaPrecio.findFirst({
      where: { tenantId, esDefault: true },
      select: { id: true },
    });
    const defaultListaId = listaDefault?.id ?? null;

    let clienteListaId: string | null = null;
    let clienteLimiteCredito: number | null = null;
    if (parsed.clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { clienteId: parsed.clienteId, tenantId },
        select: { listaPrecioId: true, limiteCredito: true },
      });
      if (!cliente) {
        throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
      }
      clienteListaId = cliente.listaPrecioId;
      clienteLimiteCredito = cliente.limiteCredito;
    }
    const productoIds = [...new Set(parsed.items.map((item) => item.productoId))];
    const productosParaPrecio = await prisma.producto.findMany({
      where: { id: { in: productoIds }, tenantId },
      select: {
        id: true,
        nombre: true,
        precioVenta: true,
        precios: { select: { listaPrecioId: true, precio: true } },
      },
    });
    const productoPrecioMap = new Map(productosParaPrecio.map((p) => [p.id, p]));

    const puedeOverridePrecio = hasPermission(user, 'ventas.precio.override');
    const overrides: PriceOverrideDetalle[] = [];

    const itemsData = parsed.items.map((item) => {
      const producto = productoPrecioMap.get(item.productoId);
      if (!producto) {
        throw new ActionError(
          `Producto con ID ${item.productoId} no encontrado`,
          'NOT_FOUND',
        );
      }
      const { precio, fuente } = resolvePrecioVenta({
        precioBase: producto.precioVenta,
        precios: producto.precios,
        pvListaId: puntoVenta.listaPrecioId,
        clienteListaId,
        defaultListaId,
      });
      if (precio !== item.precioUnitario) {
        if (!puedeOverridePrecio) {
          throw new ActionError(
            `El precio de "${producto.nombre}" no coincide con el vigente (${precio}). Recarga los productos e inténtalo de nuevo.`,
            'PRICE_MISMATCH',
          );
        }
        overrides.push({
          productoId: producto.id,
          nombre: producto.nombre,
          precioEsperado: precio,
          precioAplicado: item.precioUnitario,
          fuente,
        });
      }
      return {
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        total: item.cantidad * item.precioUnitario,
      };
    });

    const subtotalVenta = itemsData.reduce((sum, item) => sum + item.total, 0);
    const cargoTransporte = parsed.cargoTransporte ?? 0;
    const totalVenta = subtotalVenta - (parsed.descuento ?? 0) + cargoTransporte;
    const totalCantidad = itemsData.reduce((sum, item) => sum + item.cantidad, 0);
    // CRM-T2: una venta al crédito exige que el tope del cliente la cubra; con
    // permiso de override solo deja rastro (el AuditLog real se escribe dentro
    // de la transacción posterior).
    let creditoOverrideUsado = false;
    let montoCreditoRequerido = 0;
    const montoCreditoSolicitado = parsed.montoCredito ?? 0;
    const usaCredito = parsed.metodoPago === 'CREDITO' || montoCreditoSolicitado > 0;
    if (usaCredito && parsed.modoPedido !== true && parsed.clienteId && clienteLimiteCredito != null) {
      const cuentasVivas = await prisma.cuentaPorCobrar.findMany({
        where: {
          tenantId,
          clienteId: parsed.clienteId,
          estado: { not: 'ANULADA' },
        },
        select: { montoDeuda: true, montoPagado: true, estado: true },
      });
      const saldoVivo = saldoVivoCliente(
        cuentasVivas.map((c) => ({
          montoDeuda: Number(c.montoDeuda),
          montoPagado: Number(c.montoPagado),
          estado: c.estado,
        })),
      );
      const requerido =
        montoCreditoSolicitado ||
        (parsed.metodoPago === 'CREDITO' ? Math.max(totalVenta, 0) : 0);
      montoCreditoRequerido = requerido;
      if (
        superaLimiteCredito({
          saldoVivo,
          montoRequerido: requerido,
          limiteCredito: clienteLimiteCredito,
        })
      ) {
        if (!hasPermission(user, 'ventas.venta.credito-override')) {
          throw new ActionError(
            `La venta a crédito supera el límite del cliente. Saldo: ${saldoVivo}, requerido: ${requerido}, límite: ${clienteLimiteCredito}. Solicita override al manager.`,
            'CREDITO_EXCEDIDO',
          );
        }
        creditoOverrideUsado = true;
      }
    }

    const esPedido = parsed.modoPedido === true;

    // VC: defensa de la invariante del recibido (el schema Zod ya la valida) y
    // derivación del vuelto desde el recibido (server es la fuente de verdad).
    const cobro = validarCobro({
      metodoPago: parsed.metodoPago ?? null,
      montoEfectivo: parsed.montoEfectivo ?? 0,
      montoRecibidoEfectivo: parsed.montoRecibidoEfectivo ?? null,
    });
    if (!cobro.ok) {
      throw new ActionError(
        'El efectivo recibido no alcanza la porción en efectivo de la venta.',
        'RECIBIDO_INSUFICIENTE',
      );
    }
    const cambioDerivado = esPedido ? null : cobro.cambio;

    return prisma.$transaction(async (tx) => {
      // CRM-T2/B4: re-validación del tope DENTRO de la transacción con el lock
      // de crédito del cliente — el saldo leído antes de abrir la transacción
      // pudo quedar obsoleto frente a otro crédito concurrente del mismo
      // cliente (venta de servicios, facturación, edición de deuda). El
      // resultado con lock es el que se audita como override.
      if (usaCredito && parsed.modoPedido !== true && parsed.clienteId && montoCreditoRequerido > 0) {
        await lockCreditoCliente(tx, tenantId, parsed.clienteId);
        const resCredito = await exigirLimiteCredito({
          client: tx,
          tenantId,
          clienteId: parsed.clienteId,
          montoRequerido: montoCreditoRequerido,
          user,
        });
        creditoOverrideUsado = resCredito.overrideUsado;
      }

      let serie: any = null;
      let numeroConsecutivo = 0;
      let numeroFactura = '';

      if (hasFacturacion && !esPedido) {
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
          // PVE: el pedido nace sin pago; el cobro se define al facturar.
          estado: esPedido
            ? 'PEDIDO'
            : hasFacturacion && parsed.clienteId
              ? 'FACTURADA'
              : 'ENTREGADA',
          metodoPago: esPedido ? null : (parsed.metodoPago ?? null),
          montoEfectivo: esPedido ? null : (parsed.montoEfectivo ?? null),
          montoTarjeta: esPedido ? null : (parsed.montoTarjeta ?? null),
          montoTransferencia: esPedido ? null : (parsed.montoTransferencia ?? null),
          montoCredito: esPedido ? null : (parsed.montoCredito ?? null),
          // VC: vuelto documentado — el servidor deriva el cambio desde el
          // recibido (única fuente de verdad; el cliente no lo impone).
          montoRecibidoEfectivo: esPedido
            ? null
            : (parsed.montoRecibidoEfectivo ?? null),
          cambioDevuelto: esPedido ? null : cambioDerivado,
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

      // CRM-T2: se persiste evidencia del override dentro de la transacción.
      if (creditoOverrideUsado) {
        await AuditLogService.logStrict(
          {
            accion: 'EXECUTE',
            entidad: 'VENTA',
            entidadId: venta.ventaId,
            usuarioId: user.userId,
            detalles: {
              tipo: 'CREDITO_OVERRIDE',
              clienteId: parsed.clienteId,
              limiteCredito: clienteLimiteCredito,
              montoRequerido: montoCreditoRequerido,
            },
          },
          tx,
        );
      }

      if (overrides.length > 0) {
        await AuditLogService.logStrict(
          {
            accion: 'EXECUTE',
            entidad: 'VENTA',
            entidadId: venta.ventaId,
            usuarioId: user.userId,
            detalles: {
              tipo: 'PRICE_OVERRIDE',
              items: overrides,
            },
          },
          tx,
        );
      }

      if (!esPedido) {
        await aplicarEfectosInventario(tx, {
          tenantId,
          ventaId: venta.ventaId,
          puntoDeVentaId: parsed.puntoDeVentaId,
          itemsData,
          userId: user.userId,
        });
      }

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
    requirePermission(user, 'ventas.venta.editar', 'editar ventas');
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
   * @description Anula una venta aplicando la reversión según su estado del ciclo
   * de vida (PEDIDO sin efectos; ENTREGADA/FACTURADA con reversión completa).
   * Delega en VentaLifecycleService.anularVentaPorEstado (PVE).
   */
  async cancel({
    input,
    user,
  }: {
    input: AnularVentaInput;
    user: AuthenticatedUser;
  }) {
    return VentaLifecycleService.anularVentaPorEstado({
      ventaId: input.ventaId,
      motivo: input.motivo,
      user,
    });
  },
};
