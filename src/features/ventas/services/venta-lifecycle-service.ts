import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { getOrCreateTurnoActivo } from '@/features/turnos-pos';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento, revertirMovimientosDeOrigen } from '@/features/inventario/movimientos';
import { allocateFifoForSale } from '@/lib/services/fifo-allocation';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { anularVentaSchema, facturarVentaSchema } from '@/features/ventas/schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { FacturarVentaInput } from '@/features/ventas/schemas';

/**
 * @description Acumulado de reconciliaciones para su reversión bancaria.
 * Duplicado intencional del helper del mutation-service para no acoplar
 * ambos módulos en este change (se consolida si PVE-T3 lo amerita).
 */
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
 * @description Revierte saldos bancarios usando el monto persistido en la reconciliación.
 * No recalcula tipos de cambio (misma regla que la anulación clásica).
 */
async function reverseReconciliations(
  tx: Prisma.TransactionClient,
  reconciliaciones: readonly ReconciliationForReversal[],
  tenantId: string,
) {
  const grouped = new Map<string, { cuentaId: string; moneda: string; monto: number }>();

  for (const reconciliacion of reconciliaciones) {
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

const ANULAR_SELECT = {
  ventaId: true,
  tenantId: true,
  estado: true,
  puntoDeVentaId: true,
  deletedAt: true,
  factura: { select: { idFactura: true, tenantId: true } },
  reconciliaciones: {
    select: { reconciliacionId: true, cuentaId: true, moneda: true, monto: true },
  },
  turno: {
    select: { estado: true, arqueos: { select: { id: true }, take: 1 } },
  },
  items: {
    select: {
      id: true,
      productoId: true,
      cantidad: true,
      producto: { select: { id: true, almacenId: true, tenantId: true, precioCosto: true } },
    },
  },
} as const;

/**
 * @description Servicio de ciclo de vida del pedido de venta (PVE).
 * Transiciones: PEDIDO → ENTREGADA → FACTURADA, y cualquier estado → ANULADA.
 * Todas las transiciones se reclaman dentro de una transacción con un guard
 * condicionado al estado origen para tolerancia a dobles envíos.
 */
export const VentaLifecycleService = {
  /**
   * @description Entrega un pedido (PEDIDO → ENTREGADA): descuenta el stock,
   * registra el kardex y aplica las allocations FIFO.
   * @param {object} params - ventaId del pedido y usuario autenticado.
   * @returns {Promise<{ventaId: string, estado: 'ENTREGADA'}>} Estado alcanzado.
   */
  async entregarVenta({ ventaId, user }: { ventaId: string; user: AuthenticatedUser }) {
    requireFeature(user, 'ventas-pedidos', 'gestionar pedidos de venta');
    requirePermission(user, 'ventas.pedido.gestionar', 'entregar pedidos de venta');
    const tenantId = requireTenant(user);

    const venta = await prisma.venta.findUnique({
      where: { ventaId },
      select: ANULAR_SELECT,
    });
    if (!venta || venta.tenantId !== tenantId) {
      throw new ActionError('Venta no encontrada', 'NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      const current = await tx.venta.findUnique({
        where: { ventaId },
        select: { estado: true, deletedAt: true },
      });
      if (!current || current.deletedAt || current.estado !== 'PEDIDO') {
        throw new ActionError(
          'El pedido ya fue procesado o no está en estado PEDIDO.',
          'ESTADO_INVALIDO',
        );
      }

      // Validación de disponibilidad en el momento de la entrega (sin reserva).
      // Se guarda el costo leído dentro de la tx para que el kardex no derive.
      const costosEnTx = new Map<string, number>();
      for (const item of venta.items) {
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
          select: { id: true, nombre: true, tenantId: true, almacenId: true, precioCosto: true },
        });
        if (!producto || producto.tenantId !== tenantId) {
          throw new ActionError(
            `Producto con ID ${item.productoId} no encontrado`,
            'NOT_FOUND',
          );
        }
        costosEnTx.set(item.productoId, producto.precioCosto);
        const ubicacion = venta.puntoDeVentaId
          ? { tipoUbicacion: 'punto_venta' as const, ubicacionId: venta.puntoDeVentaId }
          : item.producto.almacenId
            ? { tipoUbicacion: 'almacen' as const, ubicacionId: item.producto.almacenId }
            : null;
        if (!ubicacion) continue;
        const stock = await tx.stockUbicacion.findUnique({
          where: {
            productoId_tipoUbicacion_ubicacionId: {
              productoId: item.productoId,
              tipoUbicacion: ubicacion.tipoUbicacion,
              ubicacionId: ubicacion.ubicacionId,
            },
          },
          select: { cantidadDisponible: true },
        });
        if (stock === null) {
          throw new ActionError(
            `El producto "${producto.nombre}" no tiene registro de stock en la ubicación de entrega.`,
            'STOCK_INCONSISTENTE',
          );
        }
        if (stock.cantidadDisponible < item.cantidad) {
          throw new ActionError(
            `Stock insuficiente para entregar. Disponible: ${stock.cantidadDisponible}, solicitado: ${item.cantidad}`,
            'STOCK_INSUFICIENTE',
          );
        }
      }

      const claimed = await tx.venta.updateMany({
        where: { ventaId, tenantId, estado: 'PEDIDO', deletedAt: null },
        data: { estado: 'ENTREGADA' },
      });
      if (claimed.count !== 1) {
        throw new ActionError(
          'El pedido ya fue procesado o no está en estado PEDIDO.',
          'ESTADO_INVALIDO',
        );
      }

      for (const [itemIdx, item] of venta.items.entries()) {
        const costoUnitario = costosEnTx.get(item.productoId) ?? item.producto.precioCosto;
        const ubicacion = venta.puntoDeVentaId
          ? { tipoUbicacion: 'punto_venta' as const, ubicacionId: venta.puntoDeVentaId }
          : item.producto.almacenId
            ? { tipoUbicacion: 'almacen' as const, ubicacionId: item.producto.almacenId }
            : null;
        if (!ubicacion) continue;
        await upsertStockUbicacion(tx, {
          tenantId,
          productoId: item.productoId,
          tipoUbicacion: ubicacion.tipoUbicacion,
          ubicacionId: ubicacion.ubicacionId,
          modo: 'increment',
          delta: -item.cantidad,
        });
        await registrarMovimiento(tx, {
          tenantId,
          productoId: item.productoId,
          tipoOrigen: 'VENTA',
          origenId: venta.ventaId,
          tipoUbicacion: ubicacion.tipoUbicacion,
          ubicacionId: ubicacion.ubicacionId,
          cantidad: -item.cantidad,
          costoUnitario,
          secuencia: `ITEM-${itemIdx}`,
          creadoPorId: user.userId,
        });
      }

      await allocateFifoForSale(tx, tenantId, ventaId);

      await AuditLogService.logStrict(
        {
          accion: 'EXECUTE',
          entidad: 'VENTA',
          entidadId: ventaId,
          usuarioId: user.userId,
          detalles: { tipo: 'PEDIDO_ENTREGADO', items: venta.items.length },
        },
        tx,
      );

      return { ventaId, estado: 'ENTREGADA' as const };
    });
  },

  /**
   * @description Factura una venta entregada (ENTREGADA → FACTURADA): crea la
   * Factura con serie del tenant y aplica el workflow de cobro (CxC/anticipos)
   * cuando hay vencimiento. Requiere las features de facturación del plan.
   * @param {object} params - ventaId, datos de cobro/facturación y usuario.
   * @returns {Promise<{ventaId: string, estado: 'FACTURADA', facturaId: string}>}
   */
  async facturarVenta({
    ventaId,
    input,
    user,
  }: {
    ventaId: string;
    input: FacturarVentaInput;
    user: AuthenticatedUser;
  }) {
    requireFeature(user, 'ventas-pedidos', 'facturar pedidos de venta');
    requireFeature(user, 'facturacion', 'facturar ventas');
    requireFeature(user, 'ventas-factura', 'generar factura desde ventas');
    requirePermission(user, 'ventas.pedido.gestionar', 'facturar pedidos de venta');
    const tenantId = requireTenant(user);
    const parsed = facturarVentaSchema.parse(input ?? {});

    const venta = await prisma.venta.findUnique({
      where: { ventaId },
      select: {
        ventaId: true,
        tenantId: true,
        estado: true,
        deletedAt: true,
        clienteId: true,
        total: true,
        descuento: true,
        observaciones: true,
        puntoDeVentaId: true,
        turnoId: true,
        turno: { select: { estado: true } },
        factura: { select: { idFactura: true } },
      },
    });
    if (!venta || venta.tenantId !== tenantId) {
      throw new ActionError('Venta no encontrada', 'NOT_FOUND');
    }
    if (venta.deletedAt) {
      throw new ActionError('La venta está anulada.', 'ESTADO_INVALIDO');
    }
    if (!venta.clienteId) {
      throw new ActionError(
        'La venta no tiene cliente asociado; no se puede facturar.',
        'CLIENTE_REQUERIDO',
      );
    }
    if (venta.factura?.idFactura) {
      throw new ActionError('La venta ya tiene una factura asociada.', 'ESTADO_INVALIDO');
    }
    // Invariante MIXTO idéntico al create: el desglose debe sumar el total.
    if (parsed.metodoPago === 'MIXTO') {
      const sumaMontos =
        (parsed.montoEfectivo ?? 0) +
        (parsed.montoTarjeta ?? 0) +
        (parsed.montoTransferencia ?? 0) +
        (parsed.montoCredito ?? 0);
      if (sumaMontos !== (venta.total ?? 0)) {
        throw new ActionError(
          'La suma de los montos desglosados debe ser igual al total de la venta',
          'VALIDATION_ERROR',
        );
      }
    }
    const clienteId = venta.clienteId;

    // El cobro se amarra al turno vigente AHORA (no al turno del pedido, que puede
    // estar cerrado). Se resuelve ANTES de abrir la transacción, como en el create
    // clásico, porque getOrCreateTurnoActivo usa el cliente global de Prisma. Si no
    // hay turno abierto y no se puede abrir uno, el cobro queda sin turno (igual que
    // una venta del flujo clásico sin turno); nunca se conserva un turno cerrado.
    let turnoCobroId: string | null =
      venta.turnoId && venta.turno?.estado === 'ABIERTO' ? venta.turnoId : null;
    if (!turnoCobroId) {
      const turnoActual = await getOrCreateTurnoActivo({
        puntoDeVentaId: venta.puntoDeVentaId,
      });
      if (turnoActual.success) {
        turnoCobroId = turnoActual.data.turnoId;
      }
    }

    return prisma.$transaction(async (tx) => {
      const current = await tx.venta.findUnique({
        where: { ventaId },
        select: { estado: true, deletedAt: true },
      });
      if (!current || current.deletedAt || current.estado !== 'ENTREGADA') {
        throw new ActionError(
          'Solo se puede facturar una venta en estado ENTREGADA.',
          'ESTADO_INVALIDO',
        );
      }

      let serie = await tx.serieFacturacion.findFirst({
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
      const numeroConsecutivo = updatedSerie.consecutivo - 1;
      const numeroFactura = `${serie.prefijo}-${String(numeroConsecutivo).padStart(6, '0')}`;

        const claimed = await tx.venta.updateMany({
          where: { ventaId, tenantId, estado: 'ENTREGADA', deletedAt: null },
          data: {
            estado: 'FACTURADA',
            turnoId: turnoCobroId ?? null,
            metodoPago: parsed.metodoPago ?? null,
            montoEfectivo: parsed.montoEfectivo ?? null,
            montoTarjeta: parsed.montoTarjeta ?? null,
            montoTransferencia: parsed.montoTransferencia ?? null,
            montoCredito: parsed.montoCredito ?? null,
          },
        });
      if (claimed.count !== 1) {
        throw new ActionError(
          'Solo se puede facturar una venta en estado ENTREGADA.',
          'ESTADO_INVALIDO',
        );
      }

      // El cargo por transporte no se persiste en Venta (MEDIA-2): si el pedido
      // lo requiriese, se agregará como columna de Venta en un change separado.
      const descuento = venta.descuento ?? 0;
      const totalVenta = venta.total ?? 0;
      const factura = await tx.factura.create({
        data: {
          tenantId,
          serieId: serie.serieId,
          numeroConsecutivo,
          numeroFactura,
          tipoDocumento: 'FACTURA',
          ventaId,
          clienteId,
          subtotal: totalVenta + descuento,
          descuento,
          total: Math.max(totalVenta, 0),
          estado: 'PENDIENTE',
          creadoPor: user.userId || 'sistema',
          fechaVencimiento: parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null,
          cuentaBancariaId: parsed.cuentaBancariaId || null,
        },
      });

      if (parsed.tipoVencimiento || parsed.fechaVencimiento) {
        await applyFacturacionCobroWorkflow(tx, {
          ventaId,
          facturaId: factura.idFactura,
          clienteId,
          montoTotal: Math.max(totalVenta, 0),
          usuarioId: user.userId || 'sistema',
          tenantId,
          observaciones: venta.observaciones,
          tipoVencimiento: parsed.tipoVencimiento || undefined,
          fechaVencimiento: parsed.fechaVencimiento || undefined,
          cuentaBancariaId: parsed.cuentaBancariaId || undefined,
        });
      }

      await AuditLogService.logStrict(
        {
          accion: 'EXECUTE',
          entidad: 'VENTA',
          entidadId: ventaId,
          usuarioId: user.userId,
          detalles: { tipo: 'PEDIDO_FACTURADO', facturaId: factura.idFactura, numeroFactura },
        },
        tx,
      );

      return { ventaId, estado: 'FACTURADA' as const, facturaId: factura.idFactura };
    });
  },

  /**
   * @description Anula una venta según su estado del ciclo de vida.
   * - PEDIDO: solo marca (nunca tuvo efectos de stock ni documentos).
   * - ENTREGADA/FACTURADA: reversión completa vigente (stock, kardex, FIFO,
   *   reconciliaciones, CxC y factura).
   * Siempre escribe estado=ANULADA y deletedAt en la misma transacción.
   * @param {object} params - ventaId, motivo opcional y usuario autenticado.
   * @returns {Promise<{ventaId: string, anulada: boolean}>} Resultado.
   */
  async anularVentaPorEstado({
    ventaId,
    motivo,
    user,
  }: {
    ventaId: string;
    motivo?: string | null;
    user: AuthenticatedUser;
  }) {
    requireFeature(user, 'ventas-pos', 'anular ventas');
    requirePermission(user, 'ventas.venta.anular', 'anular ventas');
    const parsed = anularVentaSchema.parse({ ventaId, motivo });
    const tenantId = requireTenant(user);

    const venta = await prisma.venta.findUnique({
      where: { ventaId: parsed.ventaId },
      select: ANULAR_SELECT,
    });

    if (!venta || venta.tenantId !== tenantId) {
      throw new ActionError('Venta no encontrada', 'NOT_FOUND');
    }
    if (venta.deletedAt) {
      throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
    }
    // La guarda de turno cerrado solo aplica cuando hubo efectos que revertir:
    // un PEDIDO nunca movió dinero ni stock, así que puede anularse después.
    if (venta.estado !== 'PEDIDO' && hasClosedPeriodEffects(venta)) {
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
        select: ANULAR_SELECT,
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
      if (currentVenta.estado !== 'PEDIDO' && hasClosedPeriodEffects(currentVenta)) {
        throw new ActionError(
          'No se puede anular una venta de un turno cerrado o con arqueo.',
          'FINANCIAL_REVERSAL_REQUIRED',
        );
      }

      // Reclamo atómico de la anulación: si otra operación la ganó, count != 1
      // y ningún efecto colateral se aplica dos veces.
      if (currentVenta.estado !== 'PEDIDO') {
        // DNC: una venta con devoluciones registradas no se anula (la reversión
        // total reintegraría dos veces las unidades ya devueltas); la devolución
        // al 100% cubre ese caso.
        const devolucionesActivas = await tx.devolucionVenta.count({
          where: {
            tenantId,
            ventaId: parsed.ventaId,
            estado: 'REGISTRADA',
          },
        });
        if (devolucionesActivas > 0) {
          throw new ActionError(
            'La venta tiene devoluciones registradas. Para revertirla por completo, complete la devolución del 100% en lugar de anularla.',
            'VENTA_CON_DEVOLUCIONES',
          );
        }
      }

      const marked = await tx.venta.updateMany({
        where: {
          ventaId: parsed.ventaId,
          tenantId,
          deletedAt: null,
        },
        data: {
          estado: 'ANULADA',
          deletedAt: new Date(),
          observaciones: parsed.motivo ? `ANULADA: ${parsed.motivo}` : 'ANULADA',
        },
      });

      if (marked.count !== 1) {
        throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
      }

      if (currentVenta.estado === 'PEDIDO') {
        // Un pedido nunca descontó stock ni generó documentos: solo se marca.
        await AuditLogService.logStrict(
          {
            accion: 'EXECUTE',
            entidad: 'VENTA',
            entidadId: parsed.ventaId,
            usuarioId: user.userId,
            detalles: { motivo: parsed.motivo ?? null, tipo: 'PEDIDO_ANULADO' },
          },
          tx,
        );
        return;
      }

      // ENTREGADA / FACTURADA: reversión completa (lógica histórica de anulación).
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
          data: { estado: 'ANULADA' },
        });
      }

      const reconciliaciones = currentVenta.reconciliaciones ?? [];
      await reverseReconciliations(tx, reconciliaciones, tenantId);

      if (reconciliaciones.length > 0) {
        await tx.reconciliacionVenta.deleteMany({
          where: { tenantId, ventaId: parsed.ventaId },
        });
      }

      for (const item of currentVenta.items) {
        if (currentVenta.puntoDeVentaId) {
          await upsertStockUbicacion(tx, {
            tenantId: item.producto.tenantId,
            productoId: item.productoId,
            tipoUbicacion: 'punto_venta',
            ubicacionId: currentVenta.puntoDeVentaId,
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

      // Reversión del kardex con el costo histórico de las líneas originales;
      // ventas legacy sin kardex se compensan con el costo actual del producto.
      const compensadas = await revertirMovimientosDeOrigen(tx, {
        tenantId,
        tipoOrigen: 'VENTA',
        origenId: venta.ventaId,
        creadoPorId: user.userId,
      });

      if (compensadas.length === 0) {
        for (const [itemIdx, item] of currentVenta.items.entries()) {
          const ubicacion = currentVenta.puntoDeVentaId
            ? { tipoUbicacion: 'punto_venta', ubicacionId: currentVenta.puntoDeVentaId }
            : item.producto?.almacenId
              ? { tipoUbicacion: 'almacen', ubicacionId: item.producto.almacenId }
              : null;
          if (!ubicacion) continue;
          await registrarMovimiento(tx, {
            tenantId,
            productoId: item.productoId,
            tipoOrigen: 'VENTA',
            origenId: venta.ventaId,
            tipoUbicacion: ubicacion.tipoUbicacion,
            ubicacionId: ubicacion.ubicacionId,
            cantidad: item.cantidad,
            costoUnitario: item.producto.precioCosto,
            secuencia: `REV-ITEM-${itemIdx}`,
            creadoPorId: user.userId,
          });
        }
      }

      await tx.purchaseAllocation.deleteMany({
        where: {
          tenantId,
          ventaItemId: { in: currentVenta.items.map((item) => item.id) },
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
            stockItemsRestored: currentVenta.items.length,
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
