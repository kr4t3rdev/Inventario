/**
 * @description Server Actions para ventas de servicios.
 *
 * @module features/venta-servicios/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireFeature, requireManagerRole } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { ventaServicioLegacySchema, ventaMixtaSchema, updateVentaServicioSchema } from './schemas';
import type { VentaServicioInput, VentaMixtaInput, VentaServicioUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';

const VENTA_SERVICIO_INCLUDE = {
  servicio: true,
  cliente: true,
} as const;

/**
 * @description Valida que todos los servicios referenciados pertenezcan al tenant
 * y devuelve su snapshot de moneda para persistirlo en la venta.
 * @param {string} tenantId - Tenant del usuario autenticado.
 * @param {string[]} servicioIds - IDs de servicios a validar.
 * @throws {ActionError} NOT_FOUND si algún servicio no pertenece al tenant.
 * @returns {Promise<Map<string, { moneda: string }>>} Moneda por servicioId.
 */
async function assertServiciosDelTenant(
  tenantId: string,
  servicioIds: string[],
): Promise<Map<string, { moneda: string }>> {
  const uniqueIds = [...new Set(servicioIds)];
  const found = await prisma.servicios.findMany({
    where: { tenantId, servicioId: { in: uniqueIds } },
    select: { servicioId: true, moneda: true },
  });
  if (found.length !== uniqueIds.length) {
    throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  }
  return new Map(found.map((s) => [s.servicioId, { moneda: s.moneda }]));
}

/**
 * @description Valida que el cliente referenciado pertenezca al tenant.
 * @param {string} tenantId - Tenant del usuario autenticado.
 * @param {string | null | undefined} clienteId - ID del cliente (opcional).
 * @throws {ActionError} NOT_FOUND si el cliente no pertenece al tenant.
 */
async function assertClienteDelTenant(tenantId: string, clienteId?: string | null): Promise<void> {
  if (!clienteId) return;
  const cliente = await prisma.cliente.findFirst({
    where: { clienteId, tenantId },
    select: { clienteId: true },
  });
  if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
}

export const getVentaServiciosAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'ver servicios');
  return prisma.ventaServicios.findMany({
    where: { tenantId },
    include: VENTA_SERVICIO_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
});

export const getVentaServicioByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'ver servicios');
  const venta = await prisma.ventaServicios.findFirst({
    where: { ventaServicioId: id, tenantId },
    include: VENTA_SERVICIO_INCLUDE,
  });
  if (!venta) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');
  return venta;
});

export const createVentaServicioAction = withAction(withPeriodValidation(
  () => new Date(),
  async (input: VentaServicioInput | VentaMixtaInput, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'crear servicios');

  // Detectar modo: mixto (con lineas) vs legacy (single servicio)
  if ('lineas' in input && Array.isArray(input.lineas)) {
    const payload = ventaMixtaSchema.parse(input);

    const lineasServicio = payload.lineas.filter((l) => l.tipoLinea === 'SERVICIO');
    const lineasProducto = payload.lineas.filter((l) => l.tipoLinea === 'PRODUCTO');

    if (lineasProducto.length > 0) {
      throw new ActionError('Las líneas de producto deben registrarse por /api/ventas', 'PRODUCT_LINE_NOT_SUPPORTED_IN_THIS_ENDPOINT');
    }

    const serviciosMonedas = await assertServiciosDelTenant(tenantId, lineasServicio.map((l) => l.servicioId!));
    await assertClienteDelTenant(tenantId, payload.clienteId);

    const created = await prisma.$transaction(
      lineasServicio.map((linea) =>
        prisma.ventaServicios.create({
          data: {
            tenantId,
            servicioId: linea.servicioId!,
            cantidad: linea.cantidad,
            costo: linea.costo ?? 0,
            total: linea.cantidad * linea.precioUnitario,
            moneda: serviciosMonedas.get(linea.servicioId!)!.moneda,
            precioUnitario: linea.precioUnitario,
            observaciones: linea.observaciones ?? payload.observaciones ?? null,
            clienteId: payload.clienteId ?? null,
          },
        })
      )
    );

    revalidatePath('/busy/venta-servicios');
    return {
      mode: 'MIXED_LINES' as const,
      lineasProcesadas: created.length,
      lineasProductoPendientes: lineasProducto.length,
      ventasServicios: created,
    };
  }

  // Legacy mode (single servicio)
  const data = ventaServicioLegacySchema.parse(input);

  const serviciosMonedas = await assertServiciosDelTenant(tenantId, [data.servicioId]);
  const monedaServicio = serviciosMonedas.get(data.servicioId)!.moneda;
  await assertClienteDelTenant(tenantId, data.clienteId);

  const resultado = await prisma.$transaction(async (tx) => {
    const ventaServicio = await tx.ventaServicios.create({
      data: {
        tenantId,
        servicioId: data.servicioId,
        cantidad: data.cantidad,
        costo: data.costo ?? 0,
        total: data.cantidad * data.precioUnitario,
        moneda: monedaServicio,
        precioUnitario: data.precioUnitario,
        observaciones: data.observaciones ?? null,
        clienteId: data.clienteId ?? null,
      },
    });

    let allocationsResult: any[] = [];
    if (data.anticipos && data.anticipos.length > 0) {
      const tipoPagoDefault = await tx.tipoPago.findFirst({
        where: { isActive: true, tenantId },
        orderBy: { createdAt: 'asc' },
      });
      const cuentaDefault = await tx.cuentaBancaria.findFirst({
        where: { isActive: true, tenantId },
        orderBy: { createdAt: 'asc' },
      });

      allocationsResult = await applyAnticipoAllocations(tx, data.anticipos, {
        documentoDestinoId: ventaServicio.ventaServicioId,
        contexto: 'FACTURA_DIRECTA',
        usuarioId: user.userId || 'system',
        observaciones: `Anticipo aplicado a venta de servicio ${ventaServicio.ventaServicioId}`,
      });

      for (const alloc of allocationsResult) {
        const anticipo = await tx.anticipo.findUnique({
          where: { anticipoId: alloc.anticipoId },
          select: { tipo: true, moneda: true, cuentaOrigenId: true, tipoPagoOrigenId: true, clienteId: true },
        });

        const cuentaId = anticipo?.cuentaOrigenId || cuentaDefault?.cuentaId;
        const tipoPagoId = anticipo?.tipoPagoOrigenId || tipoPagoDefault?.tipoId;
        if (!cuentaId || !tipoPagoId) {
          throw new ActionError(
            'Configura una cuenta bancaria y un tipo de pago antes de aplicar anticipos',
            'VALIDATION_ERROR',
          );
        }

        // La fila refleja la moneda real del dinero movido (la del anticipo),
        // no la del servicio: el dinero del anticipo vive en anticipo.moneda.
        const monedaAnticipo = anticipo?.moneda ?? monedaServicio;

        // Para moneda distinta de la funcional del tenant hay que resolver la
        // tasa de cambio; si no hay, la fila queda invisible a los lectores
        // (provenanceLegacy/excluded), así que se rechaza antes de escribir.
        const policy = await tx.tenantAccountingPolicy.findUnique({
          where: { tenantId },
          select: { functionalCurrencyCode: true },
        });
        const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase() ?? 'CUP';

        let tasaCambio: number | undefined;
        let tasaEffectiveAt: Date | undefined;
        let tasaFxCatalogId: string | undefined;
        if (monedaAnticipo.trim().toUpperCase() !== monedaFuncional) {
          const tasa = await exchangeRateProvider.getRateAsOf({
            sourceCurrency: monedaAnticipo.trim().toUpperCase(),
            targetCurrency: monedaFuncional,
            boundaryAt: new Date(),
          });
          if (!tasa) {
            throw new ActionError(
              `No hay tasa de cambio publicada para ${monedaAnticipo} → ${monedaFuncional}; no se puede registrar la reconciliación`,
              'VALIDATION_ERROR',
            );
          }
          tasaCambio = tasa.tasa;
          tasaEffectiveAt = tasa.fechaVigencia;
          tasaFxCatalogId = tasa.tasaId;
        }

        await tx.reconciliacionServicio.create({
          data: {
            tenantId,
            ventaServicioId: ventaServicio.ventaServicioId,
            cuentaId,
            tipoPagoId,
            monto: alloc.montoAplicado,
            moneda: monedaAnticipo,
            ...buildPersistedAccountingAmount(
              alloc.montoAplicado,
              monedaAnticipo,
              tasaCambio,
              tasaEffectiveAt,
              tasaFxCatalogId,
            ),
            observaciones: `Cobro anticipado en servicio ${ventaServicio.ventaServicioId}`,
            reconciliadoPor: user.userId || 'system',
          },
        });

        // Espejo del flujo manual: tracking de conversión para la moneda extranjera.
        if (tasaCambio !== undefined) {
          await tx.transaccionMoneda.create({
            data: {
              tipoTransaccion: 'servicio',
              referenciaId: ventaServicio.ventaServicioId,
              monedaId: monedaAnticipo,
              montoOriginal: alloc.montoAplicado,
              tasaCambio,
              montoConvertido: alloc.montoAplicado * tasaCambio,
            },
          });
        }
      }
    }

    return { ventaServicio, allocationsResult };
  });

  revalidatePath('/busy/venta-servicios');
  return resultado;
}));

export const updateVentaServicioAction = withAction(async (input: VentaServicioUpdateInput, user: AuthenticatedUser) => {
  const parsed = updateVentaServicioSchema.parse(input);
  const { ventaServicioId, ...data } = parsed;
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'editar servicios');
  requireManagerRole(user, 'editar ventas de servicios');

  const existing = await prisma.ventaServicios.findFirst({
    where: { ventaServicioId, tenantId },
    select: { ventaServicioId: true, cantidad: true, total: true, precioUnitario: true },
  });
  if (!existing) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');

  const updateData: Record<string, unknown> = {};
  if (data.cantidad !== undefined) {
    updateData.cantidad = data.cantidad;
    // El total no se acepta del cliente: al cambiar la cantidad se recalcula
    // con el precio unitario persistido (o derivado del registro legacy).
    if (data.cantidad !== existing.cantidad) {
      const precioUnitario = existing.precioUnitario
        ?? (existing.cantidad > 0 ? Math.round(existing.total / existing.cantidad) : 0);
      updateData.total = precioUnitario * data.cantidad;
    }
  }
  if (data.costo !== undefined) updateData.costo = data.costo;
  if (data.observaciones !== undefined) updateData.observaciones = data.observaciones;
  if (data.clienteId !== undefined) updateData.clienteId = data.clienteId;

  const updated = await prisma.ventaServicios.update({
    where: { ventaServicioId },
    data: updateData,
  });

  revalidatePath('/busy/venta-servicios');
  return updated;
});

export const deleteVentaServicioAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'eliminar servicios');
  requireManagerRole(user, 'eliminar ventas de servicios');
  const existing = await prisma.ventaServicios.findFirst({
    where: { ventaServicioId: id, tenantId },
    select: { ventaServicioId: true },
  });
  if (!existing) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');

  // Guarded deletion: las reconciliaciones contables referencian la venta con
  // FK restrict; bloquear antes de intentar el delete.
  const reconciliacionesCount = await prisma.reconciliacionServicio.count({
    where: { ventaServicioId: id },
  });
  if (reconciliacionesCount > 0) {
    throw new ActionError(
      `No se puede eliminar la venta: tiene ${reconciliacionesCount} reconciliación(es) asociada(s)`,
      'HAS_REFERENCES',
    );
  }

  await prisma.ventaServicios.delete({ where: { ventaServicioId: id } });
  revalidatePath('/busy/venta-servicios');
  return { id, eliminado: true };
});
