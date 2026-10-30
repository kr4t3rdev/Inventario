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
import { exigirLimiteCredito, lockCreditoCliente } from '@/features/crm/services/credito-enforcement';
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
import { buildPersistedAccountingAmount, lockDocumentoServicio } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { guardAccountingWriteInTransaction } from '@/features/contabilidad/services/period-close-write-guard';
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
  // C-6: la factura emitida viaja al historial para que la UI pueda deshabilitar
  // el botón "Facturar" de ventas ya facturadas.
  factura: { select: { idFactura: true, numeroFactura: true } },
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

      await guardAccountingWriteInTransaction({
        client: tx,
        tenantId,
        businessDate: new Date(),
        actorId: user.userId,
      });
      await validateServiceSalePeriod(undefined, user);

      // C-2: el tope se evalúa dentro de la transacción con el lock de crédito
      // del cliente (dos ventas concurrentes no aprueban sobre el mismo
      // saldo); el override (ventas.venta.credito-override) se audita cuando
      // las filas ya existen, en esta misma transacción.
      let creditoOverrideMixto: CreditoOverrideInfo | null = null;
      if (payload.condicionPago === 'CREDITO') {
        await lockCreditoCliente(tx, tenantId, payload.clienteId!);
        const totalVentaMixto = lineasServicio.reduce(
          (suma, linea) => suma + linea.cantidad * serviciosMonedas.get(linea.servicioId!)!.precio,
          0,
        );
        const res = await exigirLimiteCredito({
          client: tx,
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
      // mitad deja cero filas de ambas.
      const created = await Promise.all(lineasServicio.map((linea, index) => {
        const catalogo = serviciosMonedas.get(linea.servicioId!)!;
        const precioUnitario = catalogo.precio;
        return tx.ventaServicios.create({
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
            idempotencyKey: idempotencyKey && fingerprint
              ? persistedIdempotencyKey(idempotencyKey, fingerprint, index)
              : null,
          },
        });
      }));

      // B-06: crédito en modo mixto → una CxC por línea (cada fila es una
      // venta); la atomicidad impide dejar una venta mixta parcial o duplicar
      // los efectos del crédito en un replay.
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
        if (creditoOverrideMixto) {
          await AuditLogService.logStrict(
            {
              accion: 'EXECUTE',
              entidad: 'VENTA_SERVICIO',
              entidadId: created[0]?.ventaServicioId ?? '',
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
      return { created, replayed: false };
    });
    const created = transactionResult.created;

    revalidatePath('/busy/servicios');
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

    await guardAccountingWriteInTransaction({
      client: tx,
      tenantId,
      businessDate: new Date(),
      actorId: user.userId,
    });
    await validateServiceSalePeriod(undefined, user);
    const ventaTotal = data.cantidad * precioUnitario;

    // C-2: el tope se evalúa sobre el remanente estimado (total − anticipos)
    // dentro de la transacción, con el lock de crédito del cliente; el
    // override se audita en esta misma transacción.
    let creditoOverrideLegacy: CreditoOverrideInfo | null = null;
    if (data.condicionPago === 'CREDITO') {
      await lockCreditoCliente(tx, tenantId, data.clienteId!);
      const estimadoAnticipos = (data.anticipos ?? []).reduce(
        (suma, a) => suma + Number(a.montoAplicado || 0),
        0,
      );
      const res = await exigirLimiteCredito({
        client: tx,
        tenantId,
        clienteId: data.clienteId!,
        montoRequerido: Math.max(ventaTotal - estimadoAnticipos, 0),
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
        idempotencyKey: idempotencyKey && fingerprint
          ? persistedIdempotencyKey(idempotencyKey, fingerprint)
          : null,
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

    return { ventaServicio, allocationsResult, replayed: false };
  });

  if (!resultado.replayed) revalidatePath('/busy/servicios');
  return resultado;
};

export const createVentaServicioAction = withAction<
  VentaServicioInput | VentaMixtaInput,
  Awaited<ReturnType<typeof createVentaServicioHandler>>
>(createVentaServicioHandler);

/**
 * @description Actualiza una venta de servicio en una única transacción
 * interactiva: la venta, su CxC activa y la existencia de factura se leen
 * dentro de la transacción y todo cambio de deuda o de cliente se valida
 * contra el tope de crédito con el lock del cliente evaluado (C-2/C-4).
 * @param {VentaServicioUpdateInput} input - Campos editables de la venta.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Venta actualizada.
 * @throws {ActionError} NOT_FOUND, HAS_REFERENCES, VENTA_FACTURADA_INMUTABLE,
 * CXC_PAGADA, CREDITO_EXCEDIDO, CXC_ESTADO_CAMBIO, VALIDATION_ERROR.
 */
export const updateVentaServicioAction = withAction(async (input: VentaServicioUpdateInput, user: AuthenticatedUser) => {
  const parsed = updateVentaServicioSchema.parse(input);
  const { ventaServicioId, ...data } = parsed;
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'editar servicios');
  requirePermission(user, 'ventas.servicios.editar', 'editar ventas de servicios');

  if (data.clienteId) {
    await assertClienteDelTenant(tenantId, data.clienteId);
  }

  // Lock order: tenant contable → documento → cliente. The immutable period
  // anchor is read first; the row is then re-read after the document lock.
  const updated = await prisma.$transaction(async (tx) => {
    const periodAnchor = await tx.ventaServicios.findFirst({
      where: { ventaServicioId, tenantId },
      select: { createdAt: true },
    });
    if (!periodAnchor) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');
    await guardAccountingWriteInTransaction({
      client: tx,
      tenantId,
      businessDate: periodAnchor.createdAt,
      actorId: user.userId,
    });
    await lockDocumentoServicio(tx, ventaServicioId);

    const existing = await tx.ventaServicios.findFirst({
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
    const cxcActiva = await tx.cuentaPorCobrar.findFirst({
      where: { ventaServicioId, estado: { not: 'ANULADA' } },
      select: { id: true, estado: true, montoDeuda: true, clienteId: true },
    });

    const cambiaCantidad = data.cantidad !== undefined && data.cantidad !== existing.cantidad;
    let nuevoTotal = existing.total;
    if (cambiaCantidad) {
      const reconciliacionesCount = await tx.reconciliacionServicio.count({
        where: { ventaServicioId },
      });
      if (reconciliacionesCount > 0) {
        throw new ActionError(
          `No se puede modificar la venta: tiene ${reconciliacionesCount} cobro(s) reconciliado(s) y el total debe mantenerse`,
          'HAS_REFERENCES',
        );
      }
      // El total no se acepta del cliente: al cambiar la cantidad se recalcula
      // con el precio unitario persistido (o derivado del registro legacy).
      const precioUnitario = existing.precioUnitario
        ?? (existing.cantidad > 0 ? Math.round(existing.total / existing.cantidad) : 0);
      nuevoTotal = precioUnitario * data.cantidad!;
    }
    const cambiaTotal = nuevoTotal !== existing.total;
    const cambiaCliente = data.clienteId !== undefined && data.clienteId !== existing.clienteId;

    // C-6: con factura emitida el documento es inmutable — cambiar cantidad o
    // cliente dejaría venta, deuda y factura financieramente inconsistentes.
    if (cambiaCantidad || cambiaCliente) {
      const facturaEmitida = await tx.factura.findFirst({
        where: { ventaServicioId },
        select: { idFactura: true },
      });
      if (facturaEmitida) {
        throw new ActionError(
          'No se puede modificar una venta con factura emitida; anula primero la factura',
          'VENTA_FACTURADA_INMUTABLE',
        );
      }
    }

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

    // C-2: toda deuda nueva o trasladada se valida contra el tope dentro de la
    // transacción, con el lock de crédito del cliente evaluado:
    // - mismo cliente y nuevo total: la CxC propia sale del saldo vivo y se
    //   exige el nuevo total (un decrecimiento pasa solo);
    // - cambio de cliente: se exige la deuda resultante (nueva si cambia el
    //   total, la vigente si no) al cliente destino, cuyo saldo no la incluye.
    let creditoOverrideUpdate: CreditoOverrideInfo | null = null;
    const evaluaTope = cxcActiva && (cambiaCliente ? Boolean(data.clienteId) : cambiaTotal);
    if (evaluaTope) {
      const clienteEvaluar = cambiaCliente ? data.clienteId! : existing.clienteId!;
      await lockCreditoCliente(tx, tenantId, clienteEvaluar);
      const montoRequerido = cambiaCliente
        ? (cambiaTotal ? nuevoTotal : Number(cxcActiva.montoDeuda))
        : nuevoTotal;
      const res = await exigirLimiteCredito({
        client: tx,
        tenantId,
        clienteId: clienteEvaluar,
        montoRequerido,
        cuentaExcluidaId: cambiaCliente ? undefined : cxcActiva.id,
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

    const row = await tx.ventaServicios.update({
      where: { ventaServicioId },
      data: updateData,
    });

    if (cxcActiva && cambiaTotal) {
      // Claim de estado: solo se ajusta la deuda si la CxC sigue editable.
      const claim = await tx.cuentaPorCobrar.updateMany({
        where: { id: cxcActiva.id, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
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
      // Claim de estado: la CxC sigue viva (no anulada) al moverla de cliente.
      const claim = await tx.cuentaPorCobrar.updateMany({
        where: { id: cxcActiva.id, estado: { not: 'ANULADA' } },
        data: { clienteId: data.clienteId },
      });
      if (claim.count !== 1) {
        throw new ActionError(
          'La cuenta por cobrar cambió de estado durante la operación; reintenta',
          'CXC_ESTADO_CAMBIO',
        );
      }
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
    select: { id: true },
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
 * La venta, su factura previa y su CxC se leen dentro de la transacción bajo el
 * lock del documento (compartido con el cobro): facturar y cobrar
 * concurrentes se serializan y ninguno opera sobre un estado obsoleto. Si la
 * venta ya está cobrada (`reconciliado`), la factura nace PAGADA y la CxC
 * pendiente se cierra en la misma transacción.
 * @param {FacturarVentaServicioInput} input - Venta a facturar y vencimiento opcional.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Factura emitida.
 * @throws {ActionError} NOT_FOUND, FACTURA_REQUIERE_CLIENTE, VENTA_YA_FACTURADA, CXC_ESTADO_CAMBIO.
 */
export const facturarVentaServicioAction = withAction(async (input: FacturarVentaServicioInput, user: AuthenticatedUser) => {
  const parsed = facturarVentaServicioSchema.parse(input);
  const tenantId = requireTenant(user);
  requireFeature(user, 'servicios', 'facturar servicios');
  requireFeature(user, 'facturacion', 'facturar servicios');
  requireFeature(user, 'ventas-factura', 'facturar servicios');
  requirePermission(user, 'ventas.servicios.facturar', 'facturar ventas de servicios');

  const fechaVencimiento = parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null;
  if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
    throw new ActionError('La fecha de vencimiento no es válida', 'VALIDATION_ERROR');
  }

  const factura = await prisma.$transaction(async (tx) => {
    // Lock compartido con el cobro (`cerrarDocumentoServicio`): facturación,
    // cobro y anulación de la misma venta se serializan.
    await lockDocumentoServicio(tx, parsed.ventaServicioId);

    const venta = await tx.ventaServicios.findFirst({
      where: { ventaServicioId: parsed.ventaServicioId, tenantId },
      select: { ventaServicioId: true, clienteId: true, total: true, reconciliado: true },
    });
    if (!venta) throw new ActionError('Venta de servicio no encontrada', 'NOT_FOUND');
    if (!venta.clienteId) {
      throw new ActionError(
        'La venta no tiene cliente asociado; no se puede facturar',
        'FACTURA_REQUIERE_CLIENTE',
      );
    }
    // Capturar tras el guard: el narrowing no sobrevive dentro del callback de la tx.
    const clienteIdFactura = venta.clienteId;

    const facturaPrevista = await tx.factura.findFirst({
      where: { ventaServicioId: venta.ventaServicioId },
      select: { idFactura: true },
    });
    if (facturaPrevista) {
      throw new ActionError('La venta ya tiene una factura asociada', 'VENTA_YA_FACTURADA');
    }

    const { serieId, numeroConsecutivo, numeroFactura } = await resolverSerieYNumero(tx, tenantId);
    const doc = await tx.factura.create({
      data: {
        tenantId,
        serieId,
        numeroConsecutivo,
        numeroFactura,
        tipoDocumento: 'FACTURA',
        ventaServicioId: venta.ventaServicioId,
        clienteId: clienteIdFactura,
        subtotal: venta.total,
        descuento: 0,
        total: venta.total,
        estado: venta.reconciliado ? 'PAGADA' : 'PENDIENTE',
        creadoPor: user.userId || 'sistema',
        fechaVencimiento,
      },
    });

    // Claim de estado: solo se toca la CxC viva (PENDIENTE/PARCIAL); una CxC
    // anulada o pagada concurrentemente no se resurrecta ni se sobre-escribe.
    const cxc = await tx.cuentaPorCobrar.findFirst({
      where: { ventaServicioId: venta.ventaServicioId, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      select: { id: true, montoDeuda: true },
    });
    if (cxc) {
      if (venta.reconciliado) {
        // Cobrada sin documento: el documento nace pagado y la deuda se cierra.
        const claim = await tx.cuentaPorCobrar.updateMany({
          where: { id: cxc.id, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
          data: { estado: 'PAGADA', montoPagado: cxc.montoDeuda },
        });
        if (claim.count !== 1) {
          throw new ActionError(
            'La cuenta por cobrar cambió de estado durante la operación; reintenta',
            'CXC_ESTADO_CAMBIO',
          );
        }
      } else {
        // Deuda viva: solo se enlaza el documento, el monto no cambia.
        const claim = await tx.cuentaPorCobrar.updateMany({
          where: { id: cxc.id, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
          data: { facturaId: doc.idFactura, numeroFactura, fechaVencimiento },
        });
        if (claim.count !== 1) {
          throw new ActionError(
            'La cuenta por cobrar cambió de estado durante la operación; reintenta',
            'CXC_ESTADO_CAMBIO',
          );
        }
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
