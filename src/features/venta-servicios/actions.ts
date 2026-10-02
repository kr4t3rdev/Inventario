/**
 * @description Server Actions para ventas de servicios.
 *
 * @module features/venta-servicios/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { ventaServicioLegacySchema, ventaMixtaSchema, updateVentaServicioSchema } from './schemas';
import type { VentaServicioInput, VentaMixtaInput, VentaServicioUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import { Prisma } from '@/generated/prisma';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoVentaServicioCredito } from '@/features/contabilidad-formal/lib/event-builders';
import { auditarCreditoOverride, validarCreditoOrigen } from '@/features/ventas/services/credito-override';

const VENTA_SERVICIO_INCLUDE = {
  servicio: true,
  cliente: true,
} as const;

/**
 * @description Valida que todos los servicios referenciados pertenezcan al tenant
 * y devuelve su snapshot de moneda y precio para persistirlo en la venta.
 * @param {string} tenantId - Tenant del usuario autenticado.
 * @param {string[]} servicioIds - IDs de servicios a validar.
 * @throws {ActionError} NOT_FOUND si algún servicio no pertenece al tenant.
 * @returns {Promise<Map<string, { moneda: string; precio: number }>>} Moneda y precio por servicioId.
 */
async function assertServiciosDelTenant(
  tenantId: string,
  servicioIds: string[],
): Promise<Map<string, { moneda: string; precio: number }>> {
  const uniqueIds = [...new Set(servicioIds)];
  const found = await prisma.servicios.findMany({
    where: { tenantId, servicioId: { in: uniqueIds } },
    select: { servicioId: true, moneda: true, precio: true },
  });
  if (found.length !== uniqueIds.length) {
    throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  }
  return new Map(found.map((s) => [s.servicioId, { moneda: s.moneda, precio: s.precio }]));
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

/**
 * @description Resuelve la moneda funcional configurada para el tenant sin aplicar valores por defecto.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional activo.
 * @param {string} tenantId - Tenant propietario de la política.
 * @returns {Promise<string>} Código de moneda funcional normalizado.
 */
async function requireFunctionalCurrency(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const policy = await tx.tenantAccountingPolicy.findUnique({
    where: { tenantId },
    select: { functionalCurrencyCode: true },
  });
  const currency = policy?.functionalCurrencyCode?.trim().toUpperCase();
  if (!currency) {
    throw new ActionError(
      'El tenant no tiene moneda funcional configurada para valorar la cuenta por cobrar',
      'FX_INSUFICIENTE',
    );
  }
  return currency;
}

/**
 * @description Valora una CxC de servicio desde su moneda original y tasa histórica exacta.
 * @param {object} params - Transacción, tenant, monto y moneda fuente.
 * @returns {Promise<ReturnType<typeof buildAppliedFxEvidenceExact>>} Valoración con evidencia FX.
 */
async function valueServiceReceivable(params: {
  tx: Prisma.TransactionClient;
  amount: number;
  originalCurrency: string;
  functionalCurrency: string;
}) {
  const originalCurrency = params.originalCurrency.trim().toUpperCase();
  const rate = originalCurrency === params.functionalCurrency
    ? null
    : await exchangeRateProvider.getRateAsOfExact({
        sourceCurrency: originalCurrency,
        targetCurrency: params.functionalCurrency,
        boundaryAt: new Date(),
        client: params.tx,
      });
  if (originalCurrency !== params.functionalCurrency && !rate) {
    throw new ActionError(
      `No hay tasa de cambio publicada para ${originalCurrency} → ${params.functionalCurrency}; no se puede registrar la cuenta por cobrar`,
      'FX_INSUFICIENTE',
    );
  }
  if (
    rate &&
    (!rate.tasa.mul('10000000000').isInteger() ||
      !rate.tasa.lt('10000000000'))
  ) {
    throw new ActionError(
      'La tasa de cambio excede la precisión que puede conservar la cuenta por cobrar',
      'FX_INSUFICIENTE',
    );
  }
  try {
    return buildAppliedFxEvidenceExact({
      originalAmount: String(params.amount),
      originalCurrency,
      functionalCurrency: params.functionalCurrency,
      exchangeRate: rate?.tasa,
      rateEffectiveAt: rate?.fechaVigencia,
      source: 'service-credit-cxc',
      fxCatalogRateId: rate?.tasaId,
      fxProvenanceKind: rate ? 'CATALOG_RATE' : undefined,
    });
  } catch (error) {
    if (error instanceof ActionError) throw error;
    throw new ActionError(
      error instanceof Error ? error.message : 'No fue posible valorar la cuenta por cobrar',
      'FX_INSUFICIENTE',
    );
  }
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
  requirePermission(user, 'ventas.venta.registrar', 'crear ventas de servicios');

  // Detectar modo: mixto (con lineas) vs legacy (single servicio)
  if ('lineas' in input && Array.isArray(input.lineas)) {
    const payload = ventaMixtaSchema.parse(input);

    const lineasServicio = payload.lineas.filter((l) => l.tipoLinea === 'SERVICIO');
    const lineasProducto = payload.lineas.filter((l) => l.tipoLinea === 'PRODUCTO');

    if (lineasProducto.length > 0) {
      throw new ActionError('Las líneas de producto deben registrarse por /api/ventas', 'PRODUCT_LINE_NOT_SUPPORTED_IN_THIS_ENDPOINT');
    }
    if (payload.condicionPago === 'CREDITO' && !payload.clienteId) {
      throw new ActionError('Una venta a crédito requiere un cliente (quien queda debe el dinero)', 'VALIDATION_ERROR');
    }

    const fechaVencimiento = payload.fechaVencimiento ? new Date(payload.fechaVencimiento) : null;
    if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
      throw new ActionError('La fecha de vencimiento no es válida', 'VALIDATION_ERROR');
    }

    const serviciosMonedas = await assertServiciosDelTenant(tenantId, lineasServicio.map((l) => l.servicioId!));
    await assertClienteDelTenant(tenantId, payload.clienteId);

    const created = await prisma.$transaction(async (tx) => {
      const montoCredito = lineasServicio.reduce((total, linea) =>
        total + linea.cantidad * serviciosMonedas.get(linea.servicioId!)!.precio, 0,
      );
      const credito = payload.condicionPago === 'CREDITO' && payload.clienteId
        ? await validarCreditoOrigen({
            tx,
            user,
            tenantId,
            clienteId: payload.clienteId,
            moneda: serviciosMonedas.get(lineasServicio[0].servicioId!)!.moneda,
            montoNuevo: montoCredito,
            permiso: 'ventas.servicios.credito-override',
            solicitarCreditoOverride: payload.solicitarCreditoOverride,
            motivoCreditoOverride: payload.motivoCreditoOverride,
          })
        : null;
      const ventas = await Promise.all(lineasServicio.map((linea) => {
        const catalogo = serviciosMonedas.get(linea.servicioId!)!;
        const precioUnitario = catalogo.precio;
        return tx.ventaServicios.create({
          data: {
            tenantId,
            servicioId: linea.servicioId!,
            cantidad: linea.cantidad,
            costo: linea.costo ?? 0,
            total: linea.cantidad * precioUnitario,
            moneda: catalogo.moneda,
            precioUnitario,
            observaciones: linea.observaciones ?? payload.observaciones ?? null,
            clienteId: payload.clienteId ?? null,
            condicionPago: payload.condicionPago,
          },
        });
      }));

      // B-06: crédito en modo mixto → una CxC por línea (cada fila es una venta).
      if (payload.condicionPago === 'CREDITO') {
        const functionalCurrency = await requireFunctionalCurrency(tx, tenantId);
        for (const [index, venta] of ventas.entries()) {
          const monedaOriginal = serviciosMonedas.get(lineasServicio[index].servicioId!)!.moneda;
          const valoracion = await valueServiceReceivable({
            tx,
            amount: venta.total,
            originalCurrency: monedaOriginal,
            functionalCurrency,
          });
          await tx.cuentaPorCobrar.create({
            data: {
              tenantId,
              ventaServicioId: venta.ventaServicioId,
              clienteId: payload.clienteId!,
              montoDeuda: venta.total,
              monedaOriginal: valoracion.evidence.originalCurrency,
              montoOriginal: venta.total,
              montoDeudaFuncional: valoracion.montoConvertido,
              montoPagadoFuncional: null,
              monedaFuncional: valoracion.evidence.functionalCurrency,
              tasaCambio: valoracion.tasaCambio,
              rateEffectiveAt: valoracion.rateEffectiveAt,
              fxProvenanceKind: valoracion.evidence.fxProvenanceKind,
              fxProvenanceSource: valoracion.evidence.fxProvenanceSource,
              fxCatalogRateId: valoracion.evidence.fxCatalogRateId,
              fxEvidenceFingerprint: valoracion.evidence.fxEvidenceFingerprint,
              fxEvidenceVersion: valoracion.evidence.fxEvidenceVersion,
              estado: 'PENDIENTE',
              tipoCuenta: 'VENTA_SERVICIO',
              fechaVencimiento,
            },
          });
          await postEvento(tx, { tenantId, userId: user.userId },
            buildEventoVentaServicioCredito({
              ventaServicioId: venta.ventaServicioId, fecha: venta.createdAt,
              valoracion: { monto: venta.total, moneda: valoracion.evidence.originalCurrency,
                montoFuncional: valoracion.montoConvertido,
                monedaFuncionalCodigo: valoracion.evidence.functionalCurrency,
                tasaCambio: valoracion.tasaCambio,
                fxEvidenceFingerprint: valoracion.evidence.fxEvidenceFingerprint },
            }));
        }
        if (credito) await auditarCreditoOverride({
          tx, user, decision: credito, tenantId, clienteId: payload.clienteId!,
          origen: 'VENTA_SERVICIO', origenId: ventas.map((venta) => venta.ventaServicioId).join(','),
          montoNuevo: montoCredito,
        });
      }

      return ventas;
    });

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
  const catalogoServicio = serviciosMonedas.get(data.servicioId)!;
  const monedaServicio = catalogoServicio.moneda;
  const precioUnitario = catalogoServicio.precio;
  await assertClienteDelTenant(tenantId, data.clienteId);

  if (data.condicionPago === 'CREDITO' && !data.clienteId) {
    throw new ActionError('Una venta a crédito requiere un cliente (quien queda debe el dinero)', 'VALIDATION_ERROR');
  }
  const fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
  if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
    throw new ActionError('La fecha de vencimiento no es válida', 'VALIDATION_ERROR');
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const ventaTotal = data.cantidad * precioUnitario;
    const credito = data.condicionPago === 'CREDITO' && data.clienteId
      ? await validarCreditoOrigen({
          tx,
          user,
          tenantId,
          clienteId: data.clienteId,
          moneda: monedaServicio,
            montoNuevo: Math.max(ventaTotal - (data.anticipos ?? [])
              .reduce((sum, allocation) => sum + allocation.montoAplicado, 0), 0),
          permiso: 'ventas.servicios.credito-override',
          solicitarCreditoOverride: data.solicitarCreditoOverride,
          motivoCreditoOverride: data.motivoCreditoOverride,
        })
      : null;
    const ventaServicio = await tx.ventaServicios.create({
      data: {
        tenantId,
        servicioId: data.servicioId,
        cantidad: data.cantidad,
        costo: data.costo ?? 0,
        total: ventaTotal,
        moneda: monedaServicio,
        precioUnitario,
        observaciones: data.observaciones ?? null,
        clienteId: data.clienteId ?? null,
        condicionPago: data.condicionPago,
      },
    });

    let allocationsResult: any[] = [];
    // B-06: venta a crédito → devengo bruto (ingreso + CxC por el TOTAL) y el
    // anticipo aplicado reduce la CxC (tratamiento confirmado filas 25/26).
    if (data.condicionPago === 'CREDITO' || data.anticipos?.length) {
      if (!data.clienteId) {
        throw new ActionError('La aplicación de anticipos requiere cliente', 'VALIDATION_ERROR');
      }
      const cobradoAnticipo = (data.anticipos ?? []).reduce(
        (suma, a) => suma + a.montoAplicado, 0);
      if (cobradoAnticipo > ventaTotal) {
        throw new ActionError('Los anticipos exceden el total de la venta', 'VALIDATION_ERROR');
      }
      const snapshotOriginalVerificable = true;
      let valoracionCxC: ReturnType<typeof buildAppliedFxEvidenceExact> | null = null;
      if (snapshotOriginalVerificable) {
        const functionalCurrency = await requireFunctionalCurrency(tx, tenantId);
        valoracionCxC = await valueServiceReceivable({
          tx,
          amount: ventaTotal,
          originalCurrency: monedaServicio,
          functionalCurrency,
        });
      }
      const estadoCxC: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' =
        ventaTotal - cobradoAnticipo <= 0.01 ? 'PAGADA'
          : cobradoAnticipo > 0 ? 'PARCIAL' : 'PENDIENTE';
      const cxc = await tx.cuentaPorCobrar.create({
        data: {
          tenantId,
          ventaServicioId: ventaServicio.ventaServicioId,
          clienteId: data.clienteId!,
          montoDeuda: ventaTotal,
          montoPagado: 0,
          monedaOriginal: snapshotOriginalVerificable
            ? valoracionCxC?.evidence.originalCurrency ?? null
            : null,
          montoOriginal: snapshotOriginalVerificable ? ventaTotal : null,
          montoDeudaFuncional: valoracionCxC?.montoConvertido ?? null,
          montoPagadoFuncional: 0,
          monedaFuncional: valoracionCxC?.evidence.functionalCurrency ?? null,
          tasaCambio: valoracionCxC?.tasaCambio ?? null,
          rateEffectiveAt: valoracionCxC?.rateEffectiveAt ?? null,
          fxProvenanceKind: valoracionCxC?.evidence.fxProvenanceKind ?? null,
          fxProvenanceSource: valoracionCxC?.evidence.fxProvenanceSource ?? null,
          fxCatalogRateId: valoracionCxC?.evidence.fxCatalogRateId ?? null,
          fxEvidenceFingerprint: valoracionCxC?.evidence.fxEvidenceFingerprint ?? null,
          fxEvidenceVersion: valoracionCxC?.evidence.fxEvidenceVersion ?? null,
          estado: 'PENDIENTE',
          tipoCuenta: 'VENTA_SERVICIO',
          fechaVencimiento,
        },
      });
      // Devengo bruto del documento: ingreso total contra la CxC total.
      await postEvento(
        tx,
        { tenantId, userId: user.userId },
        buildEventoVentaServicioCredito({
          ventaServicioId: ventaServicio.ventaServicioId,
          valoracion: {
            monto: ventaTotal,
            moneda: valoracionCxC!.evidence.originalCurrency,
            montoFuncional: valoracionCxC!.montoConvertido,
            monedaFuncionalCodigo: valoracionCxC!.evidence.functionalCurrency,
            tasaCambio: valoracionCxC!.tasaCambio,
            fxEvidenceFingerprint: valoracionCxC!.evidence.fxEvidenceFingerprint,
          },
          fecha: ventaServicio.createdAt,
        }),
      );
      if (data.anticipos?.length) {
        allocationsResult = await applyAnticipoAllocations(tx, data.anticipos, {
          tenantId, documentoDestinoId: ventaServicio.ventaServicioId,
          contexto: 'FACTURA_DIRECTA', usuarioId: user.userId,
          clienteId: data.clienteId,
          monedaDocumento: monedaServicio,
          tasaDocumento: valoracionCxC!.tasaCambio.toString(),
        });
        const montoPagadoFuncional = new Prisma.Decimal(valoracionCxC!.montoConvertido)
          .mul(cobradoAnticipo).div(ventaTotal)
          .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
        const cxcAplicada = await tx.cuentaPorCobrar.updateMany({
          where: { id: cxc.id, tenantId },
          data: { montoPagado: cobradoAnticipo, montoPagadoFuncional,
            estado: estadoCxC },
        });
        if (cxcAplicada.count !== 1) {
          throw new ActionError('Cuenta por cobrar no encontrada', 'NOT_FOUND');
        }
        await tx.cuentaPorCobrar.updateMany({
          where: { id: cxc.id, tenantId },
          data: {
            montoPagado: cobradoAnticipo,
            montoPagadoFuncional: new Prisma.Decimal(cobradoAnticipo)
              .mul(valoracionCxC!.tasaCambio),
            estado: estadoCxC,
          },
        });
        if (estadoCxC === 'PAGADA') {
          await tx.ventaServicios.updateMany({
            where: { ventaServicioId: ventaServicio.ventaServicioId, tenantId },
            data: { reconciliado: true },
          });
        }
      }
      if (credito) await auditarCreditoOverride({
        tx, user, decision: credito, tenantId, clienteId: data.clienteId!,
        origen: 'VENTA_SERVICIO', origenId: cxc.id, montoNuevo: ventaTotal - cobradoAnticipo,
      });
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
  requirePermission(user, 'ventas.servicios.editar', 'editar ventas de servicios');

  const existing = await prisma.ventaServicios.findFirst({
    where: { ventaServicioId, tenantId },
    select: { ventaServicioId: true, cantidad: true, total: true, precioUnitario: true, clienteId: true },
  });
  if (!existing) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');

  // Barrera fail-closed: cambiar el total vía cantidad o reasignar el cliente de una
  // venta con CxC vinculada desalinearía la exposición del cupo común sin ajuste de
  // la cuenta en la misma transacción. Mientras esa mutación no migre a mover la CxC
  // en una sola tx, se rechaza en servidor antes de escribir.
  const cambiaTotalVigente = data.cantidad !== undefined && data.cantidad !== existing.cantidad;
  const cambiaCliente = data.clienteId !== undefined && data.clienteId !== existing.clienteId;
  if (cambiaTotalVigente || cambiaCliente) {
    const cxcVinculada = await prisma.cuentaPorCobrar.findFirst({
      where: { ventaServicioId, tenantId },
      select: { id: true },
    });
    if (cxcVinculada) {
      throw new ActionError(
        'La venta de servicio tiene una cuenta por cobrar vinculada. Ajusta o anula la cuenta por cobrar antes de cambiar la cantidad o el cliente.',
        'CXC_VINCULADA',
      );
    }
  }

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
  requirePermission(user, 'ventas.servicios.eliminar', 'eliminar ventas de servicios');
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
