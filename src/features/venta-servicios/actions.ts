/**
 * @description Server Actions para ventas de servicios.
 *
 * @module features/venta-servicios/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { createHash } from 'node:crypto';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow';
import { ventaServicioLegacySchema, ventaMixtaSchema, updateVentaServicioSchema } from './schemas';
import type { VentaServicioInput, VentaMixtaInput, VentaServicioUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { Prisma } from '@/generated/prisma';

type IdempotencyTx = Prisma.TransactionClient;
type IdempotencyRow = {
  ventaServicioId: string;
  idempotencyKey: string | null;
  [key: string]: unknown;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function payloadFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function persistedIdempotencyPrefix(key: string): string {
  const base = `v2:${Buffer.from(key, 'utf16le').toString('base64url')}:`;
  const padding = 'x'.repeat(Math.max(0, 141 - base.length - 1));
  return `${base}${padding}:`;
}

function persistedIdempotencyKey(key: string, hash: string, index?: number): string {
  return `${persistedIdempotencyPrefix(key)}${hash}${index === undefined ? '' : `:${index}`}`;
}

function belongsToIdempotencyKey(storedKey: string | null, key: string): boolean {
  if (!storedKey) return false;
  const prefix = persistedIdempotencyPrefix(key);
  if (!storedKey.startsWith(prefix)) return false;
  return /^[0-9a-f]{64}(?::\d+)?$/i.test(storedKey.slice(prefix.length));
}

function fingerprintFromStoredKey(storedKey: string | null, key: string): string | null {
  if (!belongsToIdempotencyKey(storedKey, key)) return null;
  return storedKey!.slice(persistedIdempotencyPrefix(key).length).split(':')[0];
}

function lineIndexFromStoredKey(storedKey: string | null, key: string): number {
  const suffix = storedKey?.slice(persistedIdempotencyPrefix(key).length) ?? '';
  const index = suffix.split(':')[1];
  return index === undefined ? 0 : Number(index);
}

function idempotencyConflict(): never {
  throw new ActionError(
    'La clave de idempotencia ya fue usada con datos diferentes',
    'IDEMPOTENCY_CONFLICT',
  );
}

const validateServiceSalePeriod = withPeriodValidation<void>(
  () => new Date(),
  async () => undefined,
);

async function lockIdempotencyKey(
  tx: IdempotencyTx,
  tenantId: string,
  key: string,
): Promise<void> {
  const lockIdentity = JSON.stringify([tenantId, key]);
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))
  `;
}

async function findIdempotentVentas(
  tx: IdempotencyTx,
  tenantId: string,
  key: string,
): Promise<IdempotencyRow[]> {
  const prefix = persistedIdempotencyPrefix(key);
  const rows = await tx.ventaServicios.findMany({
    where: { tenantId, idempotencyKey: { startsWith: prefix } },
    orderBy: { idempotencyKey: 'asc' },
  });
  return rows.filter((row) => belongsToIdempotencyKey(row.idempotencyKey, key));
}

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

const createVentaServicioHandler = async (
  input: VentaServicioInput | VentaMixtaInput,
  user: AuthenticatedUser,
) => {
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
    const idempotencyKey = payload.idempotencyKey?.trim() || null;
    const fingerprint = idempotencyKey
      ? payloadFingerprint({
          mode: 'MIXED_LINES',
          clienteId: payload.clienteId ?? null,
          observaciones: payload.observaciones ?? null,
          condicionPago: payload.condicionPago,
          fechaVencimiento: fechaVencimiento?.toISOString() ?? null,
          lineas: payload.lineas.map((linea) => ({
            tipoLinea: linea.tipoLinea,
            servicioId: linea.servicioId ?? null,
            productoId: linea.productoId ?? null,
            cantidad: linea.cantidad,
            costo: linea.costo ?? 0,
            observaciones: linea.observaciones ?? null,
          })),
        })
      : null;

    const transactionResult = await prisma.$transaction(async (tx) => {
      if (idempotencyKey && fingerprint) {
        await lockIdempotencyKey(tx, tenantId, idempotencyKey);
        const existing = await findIdempotentVentas(tx, tenantId, idempotencyKey);
        if (existing.length > 0) {
          const storedHashes = existing.map((row) =>
            fingerprintFromStoredKey(row.idempotencyKey, idempotencyKey));
          const indexedRows = existing
            .map((row) => ({ row, index: lineIndexFromStoredKey(row.idempotencyKey, idempotencyKey) }))
            .sort((left, right) => left.index - right.index);
          const storedIndexes = indexedRows.map(({ index }) => index);
          const expectedIndexes = lineasServicio.map((_, index) => index);
          if (storedHashes.some((hash) => hash !== fingerprint) ||
            storedIndexes.length !== expectedIndexes.length ||
            storedIndexes.some((index, position) => index !== expectedIndexes[position])) {
            idempotencyConflict();
          }
          return { created: indexedRows.map(({ row }) => row), replayed: true };
        }
      }

      await validateServiceSalePeriod(undefined, user);
      const created = await Promise.all(lineasServicio.map((linea, index) => {
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
            idempotencyKey: idempotencyKey && fingerprint
              ? persistedIdempotencyKey(idempotencyKey, fingerprint, index)
              : null,
          },
        });
      }));

      // Keep all sale rows and their receivables atomic so replay cannot leave
      // a partial mixed sale or duplicate credit side effects.
      if (payload.condicionPago === 'CREDITO') {
        for (const venta of created) {
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
      }
      return { created, replayed: false };
    });
    const created = transactionResult.created;

    revalidatePath('/busy/venta-servicios');
    return {
      mode: 'MIXED_LINES' as const,
      lineasProcesadas: created.length,
      lineasProductoPendientes: lineasProducto.length,
      ventasServicios: created,
      replayed: transactionResult.replayed,
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

  const idempotencyKey = data.idempotencyKey?.trim() || null;
  const fingerprint = idempotencyKey
    ? payloadFingerprint({
        mode: 'LEGACY',
        servicioId: data.servicioId,
        cantidad: data.cantidad,
        costo: data.costo ?? 0,
        observaciones: data.observaciones ?? null,
        clienteId: data.clienteId ?? null,
        anticipos: data.anticipos ?? [],
        condicionPago: data.condicionPago,
        fechaVencimiento: fechaVencimiento?.toISOString() ?? null,
      })
    : null;

  const resultado = await prisma.$transaction(async (tx) => {
    if (idempotencyKey && fingerprint) {
      await lockIdempotencyKey(tx, tenantId, idempotencyKey);
      const existing = await findIdempotentVentas(tx, tenantId, idempotencyKey);
      if (existing.length > 0) {
        if (existing.length !== 1 ||
          fingerprintFromStoredKey(existing[0].idempotencyKey, idempotencyKey) !== fingerprint) {
          idempotencyConflict();
        }
        return { ventaServicio: existing[0], allocationsResult: [], replayed: true };
      }
    }

    await validateServiceSalePeriod(undefined, user);
    const ventaTotal = data.cantidad * precioUnitario;
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
        idempotencyKey: idempotencyKey && fingerprint
          ? persistedIdempotencyKey(idempotencyKey, fingerprint)
          : null,
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

    return { ventaServicio, allocationsResult, replayed: false };
  });

  if (!resultado.replayed) revalidatePath('/busy/venta-servicios');
  return resultado;
};

export const createVentaServicioAction = withAction<
  VentaServicioInput | VentaMixtaInput,
  Awaited<ReturnType<typeof createVentaServicioHandler>>
>(createVentaServicioHandler);

export const updateVentaServicioAction = withAction(async (input: VentaServicioUpdateInput, user: AuthenticatedUser) => {
  const parsed = updateVentaServicioSchema.parse(input);
  const { ventaServicioId, ...data } = parsed;
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'editar servicios');
  requirePermission(user, 'ventas.servicios.editar', 'editar ventas de servicios');

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
