/**
 * @description Server Actions para compras de servicios.
 *
 * @module features/compras-servicios/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { guardAccountingWriteInTransaction } from '@/features/contabilidad/services/period-close-write-guard';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { createCompraServicioSchema, updateCompraServicioSchema } from './schemas';
import type { CreateCompraServicioInput, UpdateCompraServicioInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { reverseExpenseEffects } from '@/features/gastosDE/reversal';
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';

const COMPRA_SERVICIO_INCLUDE = {
  servicio: true,
  proveedor: true,
} as const;

export const getComprasServiciosAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'ver servicios recibidos');
  return prisma.compraServicio.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: COMPRA_SERVICIO_INCLUDE,
  });
});

export const getCompraServicioByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'ver servicios recibidos');
  const compra = await prisma.compraServicio.findFirst({
    where: { compraServicioId: id, tenantId },
    include: COMPRA_SERVICIO_INCLUDE,
  });
  if (!compra) throw new ActionError('Servicio recibido no encontrado', 'NOT_FOUND');
  return compra;
});

export const createCompraServicioAction = withAction(withPeriodValidation(
  (input) => (input as any).fechaServicio ? new Date((input as any).fechaServicio) : new Date(),
  async (input: CreateCompraServicioInput, user: AuthenticatedUser) => {
  requireFeature(user, 'servicios', 'registrar servicios recibidos');
  requirePermission(user, 'compras.servicios.crear', 'registrar servicios recibidos');
  const parsed = createCompraServicioSchema.parse(input);
  const tenantId = requireTenant(user);

  // Verificar servicio (scoped al tenant)
  const servicio = await prisma.servicios.findFirst({
    where: { servicioId: parsed.servicioId, tenantId },
  });
  if (!servicio) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');

  // Verificar proveedor si se especificó (scoped al tenant)
  if (parsed.proveedorId) {
    const proveedor = await prisma.vendor.findFirst({
      where: { vendorId: parsed.proveedorId, tenantId },
    });
    if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
  }

  const total = parsed.costoUnitario * parsed.cantidad;
  const fechaServicio = parsed.fechaServicio ? new Date(parsed.fechaServicio) : new Date();
  const fechaVencimiento = parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null;

  if (Number.isNaN(fechaServicio.getTime())) {
    throw new ActionError('Fecha de servicio inválida', 'VALIDATION_ERROR');
  }
  if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
    throw new ActionError('Fecha de vencimiento inválida', 'VALIDATION_ERROR');
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const createdAt = new Date();
    await guardAccountingWriteInTransaction({
      client: tx,
      tenantId,
      businessDate: createdAt,
      actorId: user.userId,
    });
    const compraServicio = await tx.compraServicio.create({
      data: {
        tenantId,
        servicioId: parsed.servicioId,
        proveedorId: parsed.proveedorId || null,
        numeroFactura: parsed.numeroFactura || null,
        costoUnitario: parsed.costoUnitario,
        cantidad: parsed.cantidad,
        total,
        moneda: servicio.moneda,
        formaPago: parsed.formaPago,
        estado: parsed.estado,
        descripcion: parsed.descripcion || null,
        fechaServicio,
        createdAt,
        fechaVencimiento,
      },
      include: COMPRA_SERVICIO_INCLUDE,
    });
    let compraServicioResultado = compraServicio;

    let allocationsResult: Awaited<ReturnType<typeof applyAnticipoAllocations>> = [];
    if (parsed.anticipos && parsed.anticipos.length > 0) {
      const tipoPagoDefault = await tx.tipoPago.findFirst({
        where: { isActive: true, tenantId },
        orderBy: { createdAt: 'asc' },
      });
      const cuentaDefault = await tx.cuentaBancaria.findFirst({
        where: { isActive: true, tenantId },
        orderBy: { createdAt: 'asc' },
      });

      allocationsResult = await applyAnticipoAllocations(tx, parsed.anticipos, {
        tenantId,
        documentoDestinoId: compraServicio.compraServicioId,
        contexto: 'COMPRA_SERVICIO',
        usuarioId: user.userId || 'system',
        observaciones: `Anticipo aplicado a servicio recibido ${compraServicio.compraServicioId}`,
      });

      const policy = await tx.tenantAccountingPolicy.findUnique({
        where: { tenantId },
        select: { functionalCurrencyCode: true },
      });
      const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase() ?? 'CUP';
      const fechaPago = new Date();
      const tasasCambio = new Map<
        string,
        { tasaId: string; tasa: number; fechaVigencia: Date }
      >();

      /**
       * @description Retrieves and caches a published conversion rate into the functional currency.
       * @param {string} monedaOrigen - Currency to convert.
       * @returns {Promise<{tasaId: string; tasa: number; fechaVigencia: Date} | null>} Rate or null for CUP-equivalent amounts.
       */
      const getTasaFuncional = async (monedaOrigen: string, boundaryAt: Date) => {
        const monedaNormalizada = monedaOrigen.trim().toUpperCase();
        if (monedaNormalizada === monedaFuncional) return null;
        const cacheKey = `${monedaNormalizada}:${boundaryAt.toISOString()}`;
        const tasaExistente = tasasCambio.get(cacheKey);
        if (tasaExistente) return tasaExistente;
        const tasa = await exchangeRateProvider.getRateAsOf({
          sourceCurrency: monedaNormalizada,
          targetCurrency: monedaFuncional,
          boundaryAt,
          client: tx,
        });
        if (!tasa) {
          throw new ActionError(
            `No hay tasa de cambio publicada para ${monedaNormalizada} → ${monedaFuncional}; no se puede registrar la reconciliación`,
            'VALIDATION_ERROR',
          );
        }
        tasasCambio.set(cacheKey, tasa);
        return tasa;
      };

      const monedaServicio = servicio.moneda.trim().toUpperCase();
      const tasaServicio = await getTasaFuncional(monedaServicio, fechaServicio);
      const totalFuncional = total * (tasaServicio?.tasa ?? 1);
      type AnticipoAllocationSource = Pick<
        NonNullable<Awaited<ReturnType<typeof tx.anticipo.findUnique>>>,
        'tipo' | 'moneda' | 'cuentaOrigenId' | 'tipoPagoOrigenId' | 'proveedorId'
      >;
      const allocationsPreparadas: Array<{
        alloc: (typeof allocationsResult)[number];
        anticipo: AnticipoAllocationSource | null;
        monedaAnticipo: string;
        tasa: { tasaId: string; tasa: number; fechaVigencia: Date } | null;
      }> = [];

      for (const alloc of allocationsResult) {
        const anticipo = await tx.anticipo.findUnique({
          where: { anticipoId: alloc.anticipoId },
          select: { tipo: true, moneda: true, cuentaOrigenId: true, tipoPagoOrigenId: true, proveedorId: true },
        });

        if (
          (!anticipo?.cuentaOrigenId && !cuentaDefault?.cuentaId) ||
          (!anticipo?.tipoPagoOrigenId && !tipoPagoDefault?.tipoId)
        ) {
          throw new ActionError(
            'Configura una cuenta bancaria y un tipo de pago antes de aplicar anticipos',
            'VALIDATION_ERROR',
          );
        }
        const monedaAnticipo = anticipo?.moneda ?? servicio.moneda;
        const tasa = await getTasaFuncional(monedaAnticipo, fechaPago);
        allocationsPreparadas.push({ alloc, anticipo, monedaAnticipo, tasa });
      }

      const anticipoTotalFuncional = allocationsPreparadas.reduce(
        (sum, allocation) => sum +
          Number(allocation.alloc.montoAplicado) * (allocation.tasa?.tasa ?? 1),
        0,
      );
      const estadoPagoAplicado: 'PAGADA' | 'PARCIAL' =
        anticipoTotalFuncional >= totalFuncional - 0.01 ? 'PAGADA' : 'PARCIAL';

      await tx.compraServicio.updateMany({
        where: { compraServicioId: compraServicio.compraServicioId, tenantId },
        data: { estado: estadoPagoAplicado },
      });
      compraServicioResultado = { ...compraServicio, estado: estadoPagoAplicado };

      for (const { alloc, anticipo, monedaAnticipo, tasa } of allocationsPreparadas) {
        const cuentaId = anticipo?.cuentaOrigenId || cuentaDefault?.cuentaId;
        const tipoPagoId = anticipo?.tipoPagoOrigenId || tipoPagoDefault?.tipoId;
        if (!cuentaId || !tipoPagoId) {
          throw new ActionError(
            'Configura una cuenta bancaria y un tipo de pago antes de aplicar anticipos',
            'VALIDATION_ERROR',
          );
        }

        await tx.reconciliacionGasto.create({
          data: {
            tenantId,
            tipoGasto: 'servicio',
            referenciaId: compraServicio.compraServicioId,
            cuentaId: cuentaId,
            tipoPagoId: tipoPagoId,
            monto: alloc.montoAplicado,
            estado: estadoPagoAplicado,
            moneda: monedaAnticipo,
            ...buildPersistedAccountingAmount(
              alloc.montoAplicado,
              monedaAnticipo,
              tasa?.tasa,
              tasa?.fechaVigencia,
              tasa?.tasaId,
              monedaFuncional,
            ),
            descripcion: `Pago anticipado de servicio ${compraServicio.compraServicioId}`,
            reconciliadoPor: user.userId || 'system',
          },
        });

        // Espejo del flujo manual: tracking de conversión para la moneda extranjera.
        if (tasa) {
          await tx.transaccionMoneda.create({
            data: {
              tenantId,
              tipoTransaccion: 'servicio_egreso',
              referenciaId: compraServicio.compraServicioId,
              monedaId: monedaAnticipo,
              montoOriginal: alloc.montoAplicado,
              tasaCambio: tasa.tasa,
              montoConvertido: alloc.montoAplicado * tasa.tasa,
            },
          });
        }
      }
    }

    return { compraServicio: compraServicioResultado, allocationsResult };
  });

  revalidatePath('/busy/compras-servicios');
  return resultado;
}));

export const updateCompraServicioAction = withAction(async (input: UpdateCompraServicioInput, user: AuthenticatedUser) => {
  requireFeature(user, 'servicios', 'editar servicios recibidos');
  requirePermission(user, 'compras.servicios.editar', 'editar servicios recibidos');
  const parsed = updateCompraServicioSchema.parse(input);
  const { compraServicioId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.compraServicio.findFirst({
    where: { compraServicioId, tenantId },
    select: { compraServicioId: true, costoUnitario: true, cantidad: true, createdAt: true },
  });
  if (!existing) throw new ActionError('Servicio recibido no encontrado', 'NOT_FOUND');

  const updateData: Record<string, unknown> = {};
  if (typeof data.numeroFactura !== 'undefined') updateData.numeroFactura = data.numeroFactura || null;
  if (typeof data.descripcion !== 'undefined') updateData.descripcion = data.descripcion || null;
  if (typeof data.formaPago !== 'undefined') updateData.formaPago = data.formaPago;
  if (typeof data.estado !== 'undefined') updateData.estado = data.estado;
  if (typeof data.costoUnitario !== 'undefined') updateData.costoUnitario = Number(data.costoUnitario);
  if (typeof data.cantidad !== 'undefined') updateData.cantidad = Number(data.cantidad);
  if (typeof data.proveedorId !== 'undefined') updateData.proveedorId = data.proveedorId || null;
  if (typeof data.fechaServicio !== 'undefined') updateData.fechaServicio = data.fechaServicio ? new Date(data.fechaServicio) : undefined;
  if (typeof data.fechaVencimiento !== 'undefined') updateData.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;

  // Si cambian cantidad o costo unitario, el total debe recalcularse para no
  // dejar inconsistencias contables.
  if (typeof data.costoUnitario !== 'undefined' || typeof data.cantidad !== 'undefined') {
    const costo = typeof data.costoUnitario !== 'undefined' ? Number(data.costoUnitario) : existing.costoUnitario;
    const cantidad = typeof data.cantidad !== 'undefined' ? Number(data.cantidad) : existing.cantidad;
    updateData.total = costo * cantidad;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ActionError('No hay campos para actualizar', 'VALIDATION_ERROR');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await guardAccountingWriteInTransaction({
      client: tx,
      tenantId,
      businessDate: existing.createdAt,
      actorId: user.userId,
    });
    return tx.compraServicio.update({
      where: { compraServicioId },
      data: updateData,
      include: COMPRA_SERVICIO_INCLUDE,
    });
  });

  revalidatePath('/busy/compras-servicios');
  return updated;
});

export const deleteCompraServicioAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'eliminar servicios recibidos');
  requirePermission(user, 'compras.servicios.eliminar', 'eliminar servicios recibidos');

  await prisma.$transaction(async (tx) => {
    const existing = await tx.compraServicio.findUnique({
      where: { compraServicioId: id },
      select: { compraServicioId: true, tenantId: true, createdAt: true },
    });
    if (!existing || existing.tenantId !== tenantId) {
      throw new ActionError('Servicio recibido no encontrado', 'NOT_FOUND');
    }
    await guardAccountingWriteInTransaction({
      client: tx,
      tenantId,
      businessDate: existing.createdAt,
      actorId: user.userId,
    });
    await tx.$queryRaw`SELECT 1 FROM "CompraServicio" WHERE "compraServicioId" = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;

    // `estado` es un campo de estado persistido que provee un claim atómico
    // mientras corre la reversión. La transacción revierte el marcador ante fallo.
    const claimedForDeletion = await tx.compraServicio.updateMany({
      where: { compraServicioId: id, tenantId, estado: { not: 'ELIMINANDO' } },
      data: { estado: 'ELIMINANDO' },
    });
    if (claimedForDeletion.count !== 1) {
      throw new ActionError('El servicio recibido ya fue eliminado', 'ALREADY_DELETED');
    }

    await reverseExpenseEffects(tx, {
      tenantId,
      referenciaId: id,
      tipoGasto: 'servicio',
      usuarioId: user.userId,
      anticipoContext: true,
    });

    // Un escritor de reconciliación pudo iniciar tras la primera lectura.
    // Re-verificar justo antes de borrar la fuente; cualquier fila tardía aborta
    // la transacción completa para que no se confirme una reversión parcial.
    const lateReconciliation = await tx.reconciliacionGasto.findFirst({
      where: { tenantId, tipoGasto: 'servicio', referenciaId: id },
      select: { reconciliacionId: true },
    });
    if (lateReconciliation) {
      throw new ActionError(
        'No se puede eliminar el servicio mientras se registra un pago concurrente',
        'CONCURRENT_RECONCILIATION',
      );
    }

    await tx.compraServicio.deleteMany({ where: { compraServicioId: id, tenantId } });
  });
  revalidatePath('/busy/compras-servicios');
  return { id, eliminado: true };
});
