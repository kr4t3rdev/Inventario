import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import {
  hasFeature,
  hasPermission,
  requireFeature,
  requirePermission,
  requireTenant,
} from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento } from '@/features/inventario/movimientos';
import { restaurarAllocacionesFifo } from '@/lib/services/fifo-allocation';
import { createAnticipoDevolucion } from '@/lib/services/anticipos-workflow';
import {
  calcularMontosDevolucion,
  resolverTratamientoFinanciero,
} from '@/features/ventas/services/devolucion-calculo';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { registrarDevolucionSchema } from '@/features/ventas/schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { RegistrarDevolucionInput } from '@/features/ventas/schemas';

const VENTA_DEVOLUCION_SELECT = {
  ventaId: true,
  tenantId: true,
  estado: true,
  deletedAt: true,
  puntoDeVentaId: true,
  clienteId: true,
  descuento: true,
  total: true,
  factura: { select: { idFactura: true, tasaCambio: true } },
  items: {
    select: {
      id: true,
      productoId: true,
      cantidad: true,
      precioUnitario: true,
      total: true,
      producto: {
        select: { almacenId: true, precioCosto: true, tenantId: true },
      },
    },
  },
} as const;

type VentaParaDevolucion = Prisma.VentaGetPayload<{
  select: typeof VENTA_DEVOLUCION_SELECT;
}>;

export interface ResultadoDevolucion {
  devolucionId: string;
  notaCreditoId: string | null;
  total: number;
  aplicadoCxc: number;
  saldoFavor: number;
  reembolso: number;
  repetida?: boolean;
}

/**
 * @description Guarda de admisión de la devolución: la venta debe existir en el
 * tenant, estar activa y con mercancía efectivamente entregada (PVE).
 * @param {VentaParaDevolucion | null} venta - Venta cargada con tenant.
 * @param {string} tenantId - Tenant activo.
 */
function assertVentaDevolvible(
  venta: VentaParaDevolucion | null,
  tenantId: string,
): asserts venta is VentaParaDevolucion {
  if (!venta || venta.tenantId !== tenantId) {
    throw new ActionError('Venta no encontrada', 'NOT_FOUND');
  }
  if (venta.deletedAt || venta.estado === 'ANULADA') {
    throw new ActionError('La venta está anulada.', 'VALIDATION_ERROR');
  }
  if (venta.estado !== 'ENTREGADA' && venta.estado !== 'FACTURADA') {
    throw new ActionError(
      'Solo se pueden devolver ventas entregadas o facturadas.',
      'DEVOLUCION_NO_APLICA',
    );
  }
}

/**
 * @description Servicio transaccional de devoluciones de venta (DNC).
 */
export const DevolucionVentaService = {
  /**
   * @description Registra una devolución parcial o total: reintegra stock a la
   * ubicación origen, restaura allocations FIFO (costo ponderado), emite la
   * nota de crédito con serie NC- (si el plan factura) y aplica la cascada
   * financiera (CxC → saldo a favor / reembolso). Idempotente por clave.
   * @param {object} params - Input validado y usuario autenticado.
   * @returns {Promise<ResultadoDevolucion>} Resumen de la devolución.
   */
  async registrar({
    input,
    user,
  }: {
    input: RegistrarDevolucionInput;
    user: AuthenticatedUser;
  }): Promise<ResultadoDevolucion> {
    requireFeature(user, 'ventas-pos', 'registrar devoluciones');
    requirePermission(user, 'ventas.devolucion.registrar', 'registrar devoluciones');
    const tenantId = requireTenant(user);
    const parsed = registrarDevolucionSchema.parse(input);

    // Replay seguro: misma clave → devolver la devolución existente (sin efectos).
    // La clave está ligada a la venta: reutilizarla para otra venta es conflicto.
    const existente = await prisma.devolucionVenta.findFirst({
      where: { tenantId, idempotencyKey: parsed.idempotencyKey },
      select: {
        devolucionId: true,
        ventaId: true,
        facturaNotaCreditoId: true,
        total: true,
        montoAplicadoCxc: true,
        montoSaldoFavor: true,
        montoReembolsado: true,
      },
    });
    if (existente) {
      if (existente.ventaId !== parsed.ventaId) {
        throw new ActionError(
          'La clave de idempotencia ya fue usada para otra venta.',
          'IDEMPOTENCIA_CONFLICTO',
        );
      }
      return {
        devolucionId: existente.devolucionId,
        notaCreditoId: existente.facturaNotaCreditoId,
        total: existente.total,
        aplicadoCxc: existente.montoAplicadoCxc,
        saldoFavor: existente.montoSaldoFavor,
        reembolso: existente.montoReembolsado,
        repetida: true,
      };
    }

    const venta = await prisma.venta.findUnique({
      where: { ventaId: parsed.ventaId },
      select: VENTA_DEVOLUCION_SELECT,
    });
    assertVentaDevolvible(venta, tenantId);

    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "ventaId" FROM "Venta"
          WHERE "ventaId" = ${parsed.ventaId} AND "tenantId" = ${tenantId}
          FOR UPDATE
        `;

        const actual = await tx.venta.findUnique({
          where: { ventaId: parsed.ventaId },
          select: VENTA_DEVOLUCION_SELECT,
        });
        assertVentaDevolvible(actual, tenantId);

        // Devoluciones previas activas (para disponibilidad por ítem).
        const previas = await tx.devolucionVentaItem.findMany({
          where: {
            devolucion: { tenantId, ventaId: parsed.ventaId, estado: 'REGISTRADA' },
          },
          select: { ventaItemId: true, cantidad: true },
        });

        const descuentoYaDevuelto = await tx.devolucionVenta.aggregate({
          where: { tenantId, ventaId: parsed.ventaId, estado: 'REGISTRADA' },
          _sum: { descuento: true },
        });

        const montos = calcularMontosDevolucion({
          itemsVenta: actual.items,
          descuentoVenta: actual.descuento ?? 0,
          descuentoYaDevuelto: descuentoYaDevuelto._sum.descuento ?? 0,
          devolucionesPrevias: previas,
          seleccion: parsed.items,
        });

        const tasaCambio = actual.factura?.tasaCambio != null
          ? Number(actual.factura.tasaCambio)
          : 1;

        // 1) Persistir la devolución con sus líneas.
        const devolucion = await tx.devolucionVenta.create({
          data: {
            tenantId,
            ventaId: actual.ventaId,
            estado: 'REGISTRADA',
            motivo: parsed.motivo,
            subtotal: montos.subtotal,
            descuento: montos.descuento,
            total: montos.total,
            moneda: 'CUP',
            tasaCambio,
            idempotencyKey: parsed.idempotencyKey,
            createdById: user.userId,
          },
        });

        // 2) Efectos de inventario por línea (stock, kardex, FIFO parcial).
        const ventaItemPorId = new Map(actual.items.map((i) => [i.id, i]));
        for (const [idx, item] of montos.items.entries()) {
          const origen = ventaItemPorId.get(item.ventaItemId);
          if (!origen) {
            throw new ActionError(
              `El ítem ${item.ventaItemId} no pertenece a la venta.`,
              'ITEM_NO_PERTENECE',
            );
          }
          const { restaurado, costoTotal } = await restaurarAllocacionesFifo(tx, {
            tenantId,
            ventaItemId: item.ventaItemId,
            cantidad: item.cantidad,
          });
          const costoUnitario =
            restaurado > 0
              ? Math.round(costoTotal / restaurado)
              : origen.producto.precioCosto;

          const ubicacion = actual.puntoDeVentaId
            ? { tipoUbicacion: 'punto_venta' as const, ubicacionId: actual.puntoDeVentaId }
            : origen.producto.almacenId
              ? { tipoUbicacion: 'almacen' as const, ubicacionId: origen.producto.almacenId }
              : null;
          if (!ubicacion) {
            throw new ActionError(
              'No se pudo determinar la ubicación donde entra la mercancía devuelta.',
              'UBICACION_INVALIDA',
            );
          }

          await tx.devolucionVentaItem.create({
            data: {
              devolucionId: devolucion.devolucionId,
              ventaItemId: item.ventaItemId,
              productoId: origen.productoId,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              total: item.total,
              costoUnitarioDevolucion: costoUnitario,
              tipoUbicacion: ubicacion.tipoUbicacion,
              ubicacionId: ubicacion.ubicacionId,
            },
          });

          await upsertStockUbicacion(tx, {
            tenantId: origen.producto.tenantId ?? tenantId,
            productoId: origen.productoId,
            tipoUbicacion: ubicacion.tipoUbicacion,
            ubicacionId: ubicacion.ubicacionId,
            modo: 'increment',
            delta: item.cantidad,
          });
            await registrarMovimiento(tx, {
              tenantId,
              productoId: origen.productoId,
              tipoOrigen: 'VENTA',
              origenId: devolucion.devolucionId,
              tipoUbicacion: ubicacion.tipoUbicacion,
              ubicacionId: ubicacion.ubicacionId,
              cantidad: item.cantidad,
              costoUnitario,
              secuencia: `ITEM-${idx}`,
              creadoPorId: user.userId,
            });
        }

        // 3) Nota de crédito (solo con feature de facturación y cliente,
        //    evaluado con la lectura post-lock de la venta).
        let notaCreditoId: string | null = null;
        const clienteNc = actual.clienteId;
        const emitirNc = hasFeature(user, 'facturacion') && clienteNc != null;
        if (emitirNc && clienteNc) {
          // upsert como ordena el design: dos NC simultáneas del mismo tenant no
          // compiten por crear la serie (evita el P2002 del find-then-create).
          const serie = await tx.serieFacturacion.upsert({
            where: { tenantId_prefijo: { tenantId, prefijo: 'NC' } },
            create: {
              tenantId,
              prefijo: 'NC',
              descripcion: 'Notas de crédito',
              consecutivo: 1,
              esPorDefecto: false,
            },
            update: {},
          });
          const updatedSerie = await tx.serieFacturacion.update({
            where: { serieId: serie.serieId },
            data: { consecutivo: { increment: 1 } },
          });
          const numeroFactura = `NC-${String(updatedSerie.consecutivo - 1).padStart(6, '0')}`;

          const notaCredito = await tx.factura.create({
            data: {
              tenantId,
              serieId: serie.serieId,
              numeroConsecutivo: updatedSerie.consecutivo - 1,
              numeroFactura,
              tipoDocumento: 'NOTA_CREDITO',
              clienteId: clienteNc,
              subtotal: montos.subtotal,
              descuento: montos.descuento,
              total: montos.total,
              tasaCambio,
              estado: 'PAGADA',
              observaciones: `Nota de crédito por devolución de la venta ${actual.ventaId}`,
              creadoPor: user.userId || 'sistema',
            },
          });
          notaCreditoId = notaCredito.idFactura;
        }

        // 4) Cascada financiera.
        const cuentasPorCobrar = await tx.cuentaPorCobrar.findMany({
          where: {
            tenantId,
            estado: { not: 'ANULADA' },
            OR: [
              { facturaId: parsed.ventaId },
              ...(actual.factura?.idFactura
                ? [{ facturaId: actual.factura.idFactura }]
                : []),
            ],
          },
          select: { id: true, montoDeuda: true, montoPagado: true },
          orderBy: { createdAt: 'asc' },
        });
        const saldoCxc = cuentasPorCobrar.reduce(
          (sum, c) => sum + Math.max(Number(c.montoDeuda) - Number(c.montoPagado), 0),
          0,
        );

        const turnoAbierto = await tx.turnoPuntoVenta.findFirst({
          where: {
            tenantId,
            puntoDeVentaId: actual.puntoDeVentaId,
            estado: 'ABIERTO',
          },
          select: { id: true },
        });

        const finanzas = resolverTratamientoFinanciero({
          total: montos.total,
          saldoCxc,
          preferencia: parsed.preferenciaFinanciera,
          hayTurnoAbierto: turnoAbierto != null,
          puedeReembolsar: hasPermission(user, 'ventas.devolucion.reembolso'),
          hayCliente: actual.clienteId != null,
        });

        // 4a) Reducción de CxC (montoPagado += aplicado; montoDeuda intacto).
        let pendienteCxc = finanzas.aplicadoCxc;
        for (const cxc of cuentasPorCobrar) {
          if (pendienteCxc <= 0) break;
          const saldo = Math.max(Number(cxc.montoDeuda) - Number(cxc.montoPagado), 0);
          const aplicar = Math.min(pendienteCxc, saldo);
          if (aplicar <= 0) continue;
          const nuevoPagado = Number(cxc.montoPagado) + aplicar;
          await tx.cuentaPorCobrar.update({
            where: { id: cxc.id },
            data: {
              montoPagado: nuevoPagado,
              estado: nuevoPagado >= Number(cxc.montoDeuda) ? 'PAGADA' : 'PARCIAL',
            },
          });
          pendienteCxc -= aplicar;
        }

        // 4b) Saldo a favor como anticipo ligado a la NC.
        let anticipoId: string | null = null;
        if (finanzas.saldoFavor > 0) {
          const anticipo = await createAnticipoDevolucion(tx, {
            tenantId,
            clienteId: actual.clienteId,
            monto: finanzas.saldoFavor,
            moneda: 'CUP',
            facturaId: notaCreditoId,
            devolucionId: devolucion.devolucionId,
            usuarioId: user.userId,
          });
          anticipoId = anticipo.anticipoId;
        }

        await tx.devolucionVenta.update({
          where: { devolucionId: devolucion.devolucionId },
          data: {
            facturaNotaCreditoId: notaCreditoId,
            anticipoId,
            turnoReembolsoId: finanzas.reembolso > 0 ? turnoAbierto?.id ?? null : null,
            montoAplicadoCxc: finanzas.aplicadoCxc,
            montoSaldoFavor: finanzas.saldoFavor,
            montoReembolsado: finanzas.reembolso,
          },
        });

        await AuditLogService.logStrict(
          {
            accion: 'EXECUTE',
            entidad: 'VENTA',
            entidadId: parsed.ventaId,
            usuarioId: user.userId,
            detalles: {
              tipo: 'DEVOLUCION_REGISTRADA',
              devolucionId: devolucion.devolucionId,
              notaCreditoId,
              total: montos.total,
              aplicadoCxc: finanzas.aplicadoCxc,
              saldoFavor: finanzas.saldoFavor,
              reembolso: finanzas.reembolso,
              items: montos.items.length,
            },
          },
          tx,
        );

        return {
          devolucionId: devolucion.devolucionId,
          notaCreditoId,
          total: montos.total,
          aplicadoCxc: finanzas.aplicadoCxc,
          saldoFavor: finanzas.saldoFavor,
          reembolso: finanzas.reembolso,
        } satisfies ResultadoDevolucion;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },
};
