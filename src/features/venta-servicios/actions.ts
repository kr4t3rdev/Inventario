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
import { exigirLimiteCredito } from '@/features/crm/services/credito-enforcement';
import { resolverSerieYNumero } from '@/features/ventas/services/serie-facturacion-service';
import { AuditLogService } from '@/lib/services/audit-log-service';
import {
  ventaServicioLegacySchema,
  ventaMixtaSchema,
  updateVentaServicioSchema,
  facturarVentaServicioSchema,
} from './schemas';
import type {
  VentaServicioInput,
  VentaMixtaInput,
  VentaServicioUpdateInput,
  FacturarVentaServicioInput,
} from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';

const VENTA_SERVICIO_INCLUDE = {
  servicio: true,
  cliente: true,
} as const;

/** Datos del override de límite de crédito listos para la auditoría. */
interface CreditoOverrideInfo {
  limiteCredito: number | null;
  saldoVivo: number;
  montoRequerido: number;
}

/**
 * @description Valida que todos los servicios referenciados pertenezcan al tenant
 * y devuelve su snapshot de moneda, precio y costo para persistirlo en la venta.
 * @param {string} tenantId - Tenant del usuario autenticado.
 * @param {string[]} servicioIds - IDs de servicios a validar.
 * @throws {ActionError} NOT_FOUND si algún servicio no pertenece al tenant.
 * @returns {Promise<Map<string, { moneda: string; precio: number; costo: number }>>} Snapshot por servicioId.
 */
async function assertServiciosDelTenant(
  tenantId: string,
  servicioIds: string[],
): Promise<Map<string, { moneda: string; precio: number; costo: number }>> {
  const uniqueIds = [...new Set(servicioIds)];
  const found = await prisma.servicios.findMany({
    where: { tenantId, servicioId: { in: uniqueIds } },
    select: { servicioId: true, moneda: true, precio: true, costo: true },
  });
  if (found.length !== uniqueIds.length) {
    throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  }
  return new Map(found.map((s) => [s.servicioId, { moneda: s.moneda, precio: s.precio, costo: s.costo }]));
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
    if (payload.condicionPago === 'CREDITO' && !payload.clienteId) {
      throw new ActionError('Una venta a crédito requiere un cliente (quien queda debe el dinero)', 'VALIDATION_ERROR');
    }

    const fechaVencimiento = payload.fechaVencimiento ? new Date(payload.fechaVencimiento) : null;
    if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
      throw new ActionError('La fecha de vencimiento no es válida', 'VALIDATION_ERROR');
    }

    const serviciosMonedas = await assertServiciosDelTenant(tenantId, lineasServicio.map((l) => l.servicioId!));
    await assertClienteDelTenant(tenantId, payload.clienteId);

    // C-2: la venta de servicios a crédito valida el tope del cliente antes de
    // escribir; el override (permiso ventas.venta.credito-override) se audita
    // cuando las filas ya existen.
    let creditoOverrideMixto: CreditoOverrideInfo | null = null;
    if (payload.condicionPago === 'CREDITO') {
      const totalVentaMixto = lineasServicio.reduce(
        (suma, linea) => suma + linea.cantidad * serviciosMonedas.get(linea.servicioId!)!.precio,
        0,
      );
      const res = await exigirLimiteCredito({
        client: prisma,
        tenantId,
        clienteId: payload.clienteId!,
        montoRequerido: totalVentaMixto,
        user,
      });
      if (res.overrideUsado) {
        creditoOverrideMixto = {
          limiteCredito: res.limiteCredito,
          saldoVivo: res.saldoVivo,
          montoRequerido: res.montoEvaluado,
        };
      }
    }

    // C-4: ventas y CxC se crean en UNA transacción interactiva — un fallo a
    // mitad deja cero filas de ambas; la auditoría de override vive aquí dentro.
    const created = await prisma.$transaction(async (tx) => {
      const rows: Array<{ ventaServicioId: string; total: number }> = [];
      for (const linea of lineasServicio) {
        const catalogo = serviciosMonedas.get(linea.servicioId!)!;
        const precioUnitario = catalogo.precio;
        const row = await tx.ventaServicios.create({
          data: {
            tenantId,
            servicioId: linea.servicioId!,
            cantidad: linea.cantidad,
            // C-3: el costo es el snapshot del catálogo; el payload no lo fija.
            costo: catalogo.costo,
            total: linea.cantidad * precioUnitario,
            moneda: catalogo.moneda,
            precioUnitario,
            observaciones: linea.observaciones ?? payload.observaciones ?? null,
            clienteId: payload.clienteId ?? null,
            condicionPago: payload.condicionPago,
          },
        });
        rows.push({ ventaServicioId: row.ventaServicioId, total: row.total });
      }

      // B-06: crédito en modo mixto → una CxC por línea (cada fila es una venta).
      if (payload.condicionPago === 'CREDITO') {
        for (const venta of rows) {
          await tx.cuentaPorCobrar.create({
            data: {
              tenantId,
              ventaServicioId: venta.ventaServicioId,
              clienteId: payload.clienteId!,
              montoDeuda: venta.total,
              estado: 'PENDIENTE',
              tipoCuenta: 'VENTA_SERVICIO',
              fechaVencimiento,
            },
          });
        }
        if (creditoOverrideMixto) {
          await AuditLogService.logStrict(
            {
              accion: 'EXECUTE',
              entidad: 'VENTA_SERVICIO',
              entidadId: rows[0]?.ventaServicioId ?? '',
              usuarioId: user.userId,
              detalles: {
                tipo: 'CREDITO_OVERRIDE',
                clienteId: payload.clienteId,
                ...creditoOverrideMixto,
              },
            },
            tx,
          );
        }
      }
      return rows;
    });

    revalidatePath('/busy/servicios');
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

  // C-2: el tope se evalúa sobre el remanente estimado (total − anticipos)
  // antes de abrir la transacción; el override se audita dentro de ella.
  const ventaTotalEstimado = data.cantidad * precioUnitario;
  let creditoOverrideLegacy: CreditoOverrideInfo | null = null;
  if (data.condicionPago === 'CREDITO') {
    const estimadoAnticipos = (data.anticipos ?? []).reduce(
      (suma, a) => suma + Number(a.montoAplicado || 0),
      0,
    );
    const res = await exigirLimiteCredito({
      client: prisma,
      tenantId,
      clienteId: data.clienteId!,
      montoRequerido: Math.max(ventaTotalEstimado - estimadoAnticipos, 0),
      user,
    });
    if (res.overrideUsado) {
      creditoOverrideLegacy = {
        limiteCredito: res.limiteCredito,
        saldoVivo: res.saldoVivo,
        montoRequerido: res.montoEvaluado,
      };
    }
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const ventaTotal = data.cantidad * precioUnitario;
    const ventaServicio = await tx.ventaServicios.create({
      data: {
        tenantId,
        servicioId: data.servicioId,
        cantidad: data.cantidad,
        // C-3: el costo es el snapshot del catálogo; el payload no lo fija.
        costo: catalogoServicio.costo,
        total: ventaTotal,
        moneda: monedaServicio,
        precioUnitario,
        observaciones: data.observaciones ?? null,
        clienteId: data.clienteId ?? null,
        condicionPago: data.condicionPago,
      },
    });

    if (creditoOverrideLegacy) {
      await AuditLogService.logStrict(
        {
          accion: 'EXECUTE',
          entidad: 'VENTA_SERVICIO',
          entidadId: ventaServicio.ventaServicioId,
          usuarioId: user.userId,
          detalles: {
            tipo: 'CREDITO_OVERRIDE',
            clienteId: data.clienteId,
            ...creditoOverrideLegacy,
          },
        },
        tx,
      );
    }

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
        tenantId,
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
              tenantId,
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

    // B-06: venta a crédito → cuenta por cobrar por el remanente tras anticipos.
    if (data.condicionPago === 'CREDITO') {
      const cobradoAnticipo = allocationsResult.reduce(
        (suma: number, a: { montoAplicado: number }) => suma + Number(a.montoAplicado || 0),
        0,
      );
      const remanente = ventaTotal - cobradoAnticipo;
      if (remanente > 0) {
        await tx.cuentaPorCobrar.create({
          data: {
            tenantId,
            ventaServicioId: ventaServicio.ventaServicioId,
            clienteId: data.clienteId!,
            montoDeuda: remanente,
            estado: 'PENDIENTE',
            tipoCuenta: 'VENTA_SERVICIO',
            fechaVencimiento,
          },
        });
      }
    }

    return { ventaServicio, allocationsResult };
  });

  revalidatePath('/busy/servicios');
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
    select: {
      ventaServicioId: true,
      cantidad: true,
      total: true,
      precioUnitario: true,
      clienteId: true,
      condicionPago: true,
    },
  });
  if (!existing) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');

  // C-4: la CxC activa de la venta acompaña cualquier cambio de deuda o cliente.
  const cxcActiva = await prisma.cuentaPorCobrar.findFirst({
    where: { ventaServicioId, estado: { not: 'ANULADA' } },
    select: { cuentaPorCobrarId: true, estado: true, montoDeuda: true, clienteId: true },
  });

  const cambiaCantidad = data.cantidad !== undefined && data.cantidad !== existing.cantidad;
  if (cambiaCantidad) {
    const reconciliacionesCount = await prisma.reconciliacionServicio.count({
      where: { ventaServicioId },
    });
    if (reconciliacionesCount > 0) {
      throw new ActionError(
        `No se puede modificar la venta: tiene ${reconciliacionesCount} cobro(s) reconciliado(s) y el total debe mantenerse`,
        'HAS_REFERENCES',
      );
    }
  }

  let nuevoTotal = existing.total;
  if (cambiaCantidad) {
    // El total no se acepta del cliente: al cambiar la cantidad se recalcula
    // con el precio unitario persistido (o derivado del registro legacy).
    const precioUnitario = existing.precioUnitario
      ?? (existing.cantidad > 0 ? Math.round(existing.total / existing.cantidad) : 0);
    nuevoTotal = precioUnitario * data.cantidad!;
  }
  const cambiaTotal = nuevoTotal !== existing.total;
  const cambiaCliente = data.clienteId !== undefined && data.clienteId !== existing.clienteId;

  if (cxcActiva && cambiaTotal && cxcActiva.estado === 'PAGADA') {
    throw new ActionError(
      'No se puede modificar la venta: su cuenta por cobrar ya está pagada',
      'CXC_PAGADA',
    );
  }
  if (cxcActiva && cambiaCliente && data.clienteId === null) {
    throw new ActionError(
      'No se puede quitar el cliente de una venta a crédito con cuenta por cobrar activa',
      'VALIDATION_ERROR',
    );
  }

  // Cambio de cliente con deuda activa: revalidar el tope del nuevo cliente
  // (la CxC propia pertenece al cliente anterior, no se descuenta de su saldo).
  let creditoOverrideUpdate: CreditoOverrideInfo | null = null;
  if (cxcActiva && cambiaCliente && data.clienteId) {
    await assertClienteDelTenant(tenantId, data.clienteId);
    const res = await exigirLimiteCredito({
      client: prisma,
      tenantId,
      clienteId: data.clienteId,
      montoRequerido: Number(cxcActiva.montoDeuda),
      user,
    });
    if (res.overrideUsado) {
      creditoOverrideUpdate = {
        limiteCredito: res.limiteCredito,
        saldoVivo: res.saldoVivo,
        montoRequerido: res.montoEvaluado,
      };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.cantidad !== undefined) updateData.cantidad = data.cantidad;
  if (cambiaTotal) updateData.total = nuevoTotal;
  // C-3: el costo no se acepta del payload; el snapshot de la venta es histórico.
  if (data.observaciones !== undefined) updateData.observaciones = data.observaciones;
  if (data.clienteId !== undefined) updateData.clienteId = data.clienteId;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.ventaServicios.update({
      where: { ventaServicioId },
      data: updateData,
    });

    if (cxcActiva && cambiaTotal) {
      // Claim de estado: solo se ajusta la deuda si la CxC sigue editable.
      const claim = await tx.cuentaPorCobrar.updateMany({
        where: { cuentaPorCobrarId: cxcActiva.cuentaPorCobrarId, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
        data: { montoDeuda: nuevoTotal },
      });
      if (claim.count !== 1) {
        throw new ActionError(
          'La cuenta por cobrar cambió de estado durante la operación; reintenta',
          'CXC_ESTADO_CAMBIO',
        );
      }
    }
    if (cxcActiva && cambiaCliente && data.clienteId) {
      await tx.cuentaPorCobrar.updateMany({
        where: { cuentaPorCobrarId: cxcActiva.cuentaPorCobrarId, estado: { not: 'ANULADA' } },
        data: { clienteId: data.clienteId },
      });
    }
    if (creditoOverrideUpdate) {
      await AuditLogService.logStrict(
        {
          accion: 'EXECUTE',
          entidad: 'VENTA_SERVICIO',
          entidadId: ventaServicioId,
          usuarioId: user.userId,
          detalles: {
            tipo: 'CREDITO_OVERRIDE',
            clienteId: data.clienteId,
            ...creditoOverrideUpdate,
          },
        },
        tx,
      );
    }
    return row;
  });

  revalidatePath('/busy/servicios');
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

  // C-6: con factura emitida la venta es documento fiscal; no se elimina.
  const facturasCount = await prisma.factura.count({
    where: { ventaServicioId: id },
  });
  if (facturasCount > 0) {
    throw new ActionError(
      'No se puede eliminar la venta: tiene una factura emitida; anula primero la factura',
      'VENTA_CON_FACTURA',
    );
  }

  // C-5: una CxC activa protege la venta del borrado — anularla es un acto
  // explícito y auditable, no un efecto colateral del delete.
  const cxcActiva = await prisma.cuentaPorCobrar.findFirst({
    where: { ventaServicioId: id, estado: { not: 'ANULADA' } },
    select: { cuentaPorCobrarId: true },
  });
  if (cxcActiva) {
    throw new ActionError(
      'No se puede eliminar la venta: tiene una cuenta por cobrar activa; anula primero la cuenta por cobrar',
      'VENTA_CON_CXC_ACTIVA',
    );
  }

  // C-5: con la FK en Restrict, las CxC ANULADA que aún referencien la venta
  // se eliminan junto a ella en la misma transacción.
  await prisma.$transaction(async (tx) => {
    await tx.cuentaPorCobrar.deleteMany({
      where: { ventaServicioId: id, estado: 'ANULADA' },
    });
    await tx.ventaServicios.delete({ where: { ventaServicioId: id } });
  });
  revalidatePath('/busy/servicios');
  return { id, eliminado: true };
});

/**
 * @description Emite el documento de factura para una venta de servicio (C-6).
 * Numeración compartida de SerieFacturacion; enlaza la CxC existente sin crear
 * deuda nueva (el tope de crédito ya fue validado al crear/actualizar la venta).
 * Si la venta ya está cobrada (`reconciliado`), la factura nace PAGADA y la CxC
 * pendiente se cierra en la misma transacción.
 * @param {FacturarVentaServicioInput} input - Venta a facturar y vencimiento opcional.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Factura emitida.
 * @throws {ActionError} NOT_FOUND, FACTURA_REQUIERE_CLIENTE, VENTA_YA_FACTURADA, FORBIDDEN.
 */
export const facturarVentaServicioAction = withAction(async (input: FacturarVentaServicioInput, user: AuthenticatedUser) => {
  const parsed = facturarVentaServicioSchema.parse(input);
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'facturar servicios');
  requireFeature(user, 'facturacion', 'facturar servicios');
  requireFeature(user, 'ventas-factura', 'facturar servicios');
  requirePermission(user, 'ventas.servicios.facturar', 'facturar ventas de servicios');

  const venta = await prisma.ventaServicios.findFirst({
    where: { ventaServicioId: parsed.ventaServicioId, tenantId },
    include: { factura: { select: { idFactura: true } } },
  });
  if (!venta) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');
  if (!venta.clienteId) {
    throw new ActionError(
      'La venta no tiene cliente asociado; no se puede facturar',
      'FACTURA_REQUIERE_CLIENTE',
    );
  }
  if (venta.factura?.idFactura) {
    throw new ActionError('La venta ya tiene una factura asociada', 'VENTA_YA_FACTURADA');
  }

  const fechaVencimiento = parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null;
  if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
    throw new ActionError('La fecha de vencimiento no es válida', 'VALIDATION_ERROR');
  }

  const factura = await prisma.$transaction(async (tx) => {
    const { serieId, numeroConsecutivo, numeroFactura } = await resolverSerieYNumero(tx, tenantId);
    const doc = await tx.factura.create({
      data: {
        tenantId,
        serieId,
        numeroConsecutivo,
        numeroFactura,
        tipoDocumento: 'FACTURA',
        ventaServicioId: venta.ventaServicioId,
        clienteId: venta.clienteId,
        subtotal: venta.total,
        descuento: 0,
        total: venta.total,
        estado: venta.reconciliado ? 'PAGADA' : 'PENDIENTE',
        creadoPor: user.userId || 'sistema',
        fechaVencimiento,
      },
    });

    const cxc = await tx.cuentaPorCobrar.findFirst({
      where: { ventaServicioId: venta.ventaServicioId },
      select: { cuentaPorCobrarId: true, estado: true, montoDeuda: true },
    });
    if (cxc && cxc.estado !== 'ANULADA') {
      if (venta.reconciliado && cxc.estado !== 'PAGADA') {
        // Cobrada sin documento: el documento nace pagado y la deuda se cierra.
        await tx.cuentaPorCobrar.update({
          where: { cuentaPorCobrarId: cxc.cuentaPorCobrarId },
          data: { estado: 'PAGADA', montoPagado: cxc.montoDeuda },
        });
      } else if (!venta.reconciliado && cxc.estado !== 'PAGADA') {
        // Deuda viva: solo se enlaza el documento, el monto no cambia.
        await tx.cuentaPorCobrar.update({
          where: { cuentaPorCobrarId: cxc.cuentaPorCobrarId },
          data: { facturaId: doc.idFactura, numeroFactura, fechaVencimiento },
        });
      }
    }

    await AuditLogService.logStrict(
      {
        accion: 'EXECUTE',
        entidad: 'VENTA_SERVICIO',
        entidadId: venta.ventaServicioId,
        usuarioId: user.userId,
        detalles: {
          tipo: 'VENTA_SERVICIO_FACTURADA',
          facturaId: doc.idFactura,
          numeroFactura,
          estado: doc.estado,
        },
      },
      tx,
    );
    return doc;
  });

  revalidatePath('/busy/servicios');
  return factura;
});
