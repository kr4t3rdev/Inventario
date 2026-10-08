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
import type { AnticipoAllocationResult } from '@/lib/services/anticipos-workflow.types';
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

type VentaServicioRow = {
  ventaServicioId: string;
  tenantId?: string;
  servicioId: string;
  cantidad: number;
  costo?: number | null;
  total: number;
  moneda?: string | null;
  precioUnitario?: number | null;
  observaciones?: string | null;
  clienteId?: string | null;
  condicionPago?: string | null;
  idempotencyKey?: string | null;
  createdAt?: Date;
  [key: string]: unknown;
};

type VentaServicioResult = {
  mode: 'LEGACY';
  ventaServicio: unknown;
  allocationsResult: AnticipoAllocationResult[];
  replayed?: boolean;
};

/** Ordena recursivamente objetos para que el hash no dependa del orden de sus claves. */
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

/** Calcula la huella completa del request, incluyendo todas las líneas y su cardinalidad. */
function hashIdempotencyPayload(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

/**
 * El modelo de VentaServicios solo dispone de una columna de clave. Se guarda
 * la clave del cliente como prefijo y la huella como sufijo para poder detectar
 * conflictos sin inventar una columna adicional ni perder la clave original.
 */
function persistedIdempotencyKey(key: string, hash: string, index?: number): string {
  return `${key}:${hash}${index === undefined ? '' : `:${index}`}`;
}

function extractPersistedHash(storedKey: string | null | undefined, key: string): string | null {
  if (!storedKey?.startsWith(`${key}:`)) return null;
  const suffix = storedKey.slice(key.length + 1).split(':')[0];
  return /^[0-9a-f]{64}$/i.test(suffix) ? suffix : null;
}

function conflictIdempotency(): never {
  throw new ActionError(
    'La clave de idempotencia ya fue usada con datos diferentes',
    'IDEMPOTENCY_CONFLICT',
  );
}

function normalizedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function legacyPayloadForHash(input: VentaServicioInput) {
  return {
    mode: 'LEGACY',
    servicioId: input.servicioId,
    cantidad: input.cantidad,
    costo: input.costo ?? 0,
    observaciones: input.observaciones ?? null,
    clienteId: input.clienteId ?? null,
    anticipos: input.anticipos ?? [],
    condicionPago: input.condicionPago ?? 'CONTADO',
    fechaVencimiento: normalizedDate(input.fechaVencimiento),
    solicitarCreditoOverride: input.solicitarCreditoOverride ?? false,
    motivoCreditoOverride: input.motivoCreditoOverride ?? null,
  };
}

function mixedPayloadForHash(input: VentaMixtaInput) {
  return {
    mode: 'MIXED_LINES',
    clienteId: input.clienteId ?? null,
    observaciones: input.observaciones ?? null,
    condicionPago: input.condicionPago ?? 'CONTADO',
    fechaVencimiento: normalizedDate(input.fechaVencimiento),
    solicitarCreditoOverride: input.solicitarCreditoOverride ?? false,
    motivoCreditoOverride: input.motivoCreditoOverride ?? null,
    // No deduplicar ni ordenar: la cardinalidad y el orden de las líneas son
    // parte del contrato de idempotencia.
    lineas: input.lineas.map((linea) => ({
      tipoLinea: linea.tipoLinea,
      servicioId: linea.servicioId ?? null,
      productoId: linea.productoId ?? null,
      cantidad: linea.cantidad,
      costo: linea.costo ?? 0,
      observaciones: linea.observaciones ?? null,
    })),
  };
}

function sameLegacyPersistedPayload(row: VentaServicioRow, input: VentaServicioInput): boolean {
  const expected = legacyPayloadForHash(input);
  return (row.servicioId === undefined || row.servicioId === expected.servicioId) &&
    (row.cantidad === undefined || row.cantidad === expected.cantidad) &&
    (row.costo === undefined || row.costo === expected.costo) &&
    (row.observaciones === undefined || (row.observaciones ?? null) === expected.observaciones) &&
    (row.clienteId === undefined || (row.clienteId ?? null) === expected.clienteId) &&
    (row.condicionPago === undefined || (row.condicionPago ?? 'CONTADO') === expected.condicionPago);
}

function sameMixedPersistedPayload(
  rows: VentaServicioRow[],
  input: VentaMixtaInput,
): boolean {
  const serviceLines = input.lineas.filter((linea) => linea.tipoLinea === 'SERVICIO');
  if (rows.length !== serviceLines.length) return false;
  return rows.every((row, index) => {
    const line = serviceLines[index];
    return (row.servicioId === undefined || row.servicioId === line.servicioId) &&
      (row.cantidad === undefined || row.cantidad === line.cantidad) &&
      (row.costo === undefined || row.costo === (line.costo ?? 0)) &&
      (row.observaciones === undefined ||
        (row.observaciones ?? null) === (line.observaciones ?? input.observaciones ?? null)) &&
      (row.clienteId === undefined || (row.clienteId ?? null) === (input.clienteId ?? null)) &&
      (row.condicionPago === undefined ||
        (row.condicionPago ?? 'CONTADO') === (input.condicionPago ?? 'CONTADO'));
  });
}

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

/**
 * @description Reconstruye el resultado visible de aplicación de anticipos desde
 * los movimientos persistidos para que el replay idempotente devuelva el mismo
 * contrato sin volver a ejecutar efectos.
 * @param {string} tenantId - Tenant propietario de la venta y los anticipos.
 * @param {string} ventaServicioId - Documento destino registrado en AnticipoMovimiento.
 * @returns {Promise<AnticipoAllocationResult[]>} Resultado estable para el replay.
 */
async function reconstructAnticipoAllocationsResult(
  tenantId: string,
  ventaServicioId: string,
): Promise<AnticipoAllocationResult[]> {
  const movimientos = await prisma.anticipoMovimiento.findMany({
    where: {
      documentoDestinoId: ventaServicioId,
      contexto: 'FACTURA_DIRECTA',
      tipoMovimiento: 'EJECUCION',
      anticipo: { tenantId },
    },
    orderBy: [{ createdAt: 'asc' }, { movimientoId: 'asc' }],
    select: {
      anticipoId: true,
      movimientoId: true,
      monto: true,
      saldoDespues: true,
    },
  });

  return movimientos.map((movimiento) => ({
    anticipoId: movimiento.anticipoId,
    movimientoId: movimiento.movimientoId,
    montoAplicado: new Prisma.Decimal(movimiento.monto).toNumber(),
    saldoRestante: new Prisma.Decimal(movimiento.saldoDespues).toNumber(),
  }));
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

    // Idempotencia: si el cliente provee clave, un reintento devuelve las ventas
    // existentes en lugar de duplicar.
    const idempotencyKey = payload.idempotencyKey?.trim() || null;
    const idempotencyHash = idempotencyKey
      ? hashIdempotencyPayload(mixedPayloadForHash(payload))
      : null;
    if (idempotencyKey && idempotencyHash) {
      const existentes = await prisma.ventaServicios.findMany({
        where: {
          tenantId,
          OR: [
            { idempotencyKey },
            { idempotencyKey: { startsWith: `${idempotencyKey}:` } },
          ],
        },
        orderBy: { idempotencyKey: 'asc' },
      }) as VentaServicioRow[];
      if (existentes.length > 0) {
        const storedHashes = existentes.map((row) =>
          extractPersistedHash(row.idempotencyKey, idempotencyKey));
        const samePayload = storedHashes.every((storedHash) => storedHash === idempotencyHash) ||
          (storedHashes.some((storedHash) => storedHash === null) &&
            sameMixedPersistedPayload(existentes, payload));
        if (!samePayload) conflictIdempotency();
        return {
          mode: 'MIXED_LINES' as const,
          lineasProcesadas: existentes.length,
          lineasProductoPendientes: payload.lineas.filter((linea) => linea.tipoLinea === 'PRODUCTO').length,
          ventasServicios: existentes,
          replayed: true,
        };
      }
    }

    let created: any[];
    try {
      created = await prisma.$transaction(async (tx) => {
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
      const ventas = await Promise.all(lineasServicio.map((linea, idx) => {
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
            // Sufijo por índice para que multi-línea no viole el unique constraint
            idempotencyKey: idempotencyKey && idempotencyHash
              ? persistedIdempotencyKey(idempotencyKey, idempotencyHash, idx)
              : null,
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
    } catch (error: any) {
      // Carrera concurrente con la misma clave: el unique constraint hace fallar
      // a los perdedores con P2002; devolver las ventas ganadoras.
      if (idempotencyKey && error?.code === 'P2002') {
        const ganadoras = await prisma.ventaServicios.findMany({
          where: {
            tenantId,
            OR: [
              { idempotencyKey },
              { idempotencyKey: { startsWith: `${idempotencyKey}:` } },
            ],
          },
          orderBy: { idempotencyKey: 'asc' },
        }) as VentaServicioRow[];
        if (ganadoras.length > 0) {
          const storedHashes = ganadoras.map((row) =>
            extractPersistedHash(row.idempotencyKey, idempotencyKey));
          if (idempotencyHash &&
            !storedHashes.every((storedHash) => storedHash === idempotencyHash) &&
            !(storedHashes.some((storedHash) => storedHash === null) &&
              sameMixedPersistedPayload(ganadoras, payload))) {
            conflictIdempotency();
          }
          return {
            mode: 'MIXED_LINES' as const,
            lineasProcesadas: ganadoras.length,
            lineasProductoPendientes: lineasProducto.length,
            ventasServicios: ganadoras,
            replayed: true,
          };
        }
      }
      throw error;
    }

    revalidatePath('/busy/venta-servicios');
    return {
      mode: 'MIXED_LINES' as const,
      lineasProcesadas: created.length,
      lineasProductoPendientes: lineasProducto.length,
      ventasServicios: created,
      replayed: false,
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
  const idempotencyHash = idempotencyKey
    ? hashIdempotencyPayload(legacyPayloadForHash(data))
    : null;
  if (idempotencyKey && idempotencyHash) {
    const existentes = await prisma.ventaServicios.findMany({
      where: {
        tenantId,
        OR: [
          { idempotencyKey },
          { idempotencyKey: { startsWith: `${idempotencyKey}:` } },
        ],
      },
      orderBy: { idempotencyKey: 'asc' },
    }) as VentaServicioRow[];
    if (existentes.length > 0) {
      if (existentes.length !== 1) conflictIdempotency();
      const storedHash = extractPersistedHash(existentes[0].idempotencyKey, idempotencyKey);
      if (storedHash !== idempotencyHash &&
        !(storedHash === null && sameLegacyPersistedPayload(existentes[0], data))) {
        conflictIdempotency();
      }
      return {
        mode: 'LEGACY' as const,
        ventaServicio: existentes[0],
        allocationsResult: await reconstructAnticipoAllocationsResult(
          tenantId,
          existentes[0].ventaServicioId,
        ),
        replayed: true,
      } satisfies VentaServicioResult;
    }
  }

  try {
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
        idempotencyKey: idempotencyKey && idempotencyHash
          ? persistedIdempotencyKey(idempotencyKey, idempotencyHash)
          : null,
      },
    });

    let allocationsResult: AnticipoAllocationResult[] = [];
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
        const montoPagadoFuncional = new Prisma.Decimal(valoracionCxC!.montoConvertido)
          .mul(cobradoAnticipo).div(ventaTotal)
          .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
        allocationsResult = await applyAnticipoAllocations(tx, data.anticipos, {
          tenantId, documentoDestinoId: ventaServicio.ventaServicioId,
          contexto: 'FACTURA_DIRECTA', usuarioId: user.userId,
          clienteId: data.clienteId,
          monedaDocumento: monedaServicio,
          monedaFuncionalDocumento: valoracionCxC!.evidence.functionalCurrency,
          montoFuncionalDocumento: montoPagadoFuncional,
        });
        const cxcAplicada = await tx.cuentaPorCobrar.updateMany({
          where: { id: cxc.id, tenantId },
          data: { montoPagado: cobradoAnticipo, montoPagadoFuncional,
            estado: estadoCxC },
        });
        if (cxcAplicada.count !== 1) {
          throw new ActionError('Cuenta por cobrar no encontrada', 'NOT_FOUND');
        }
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
  return {
    mode: 'LEGACY' as const,
    ventaServicio: resultado.ventaServicio,
    allocationsResult: resultado.allocationsResult,
    replayed: false,
  } satisfies VentaServicioResult;
  } catch (error: any) {
    if (idempotencyKey && error?.code === 'P2002') {
      const ganadoras = await prisma.ventaServicios.findMany({
        where: {
          tenantId,
          OR: [
            { idempotencyKey },
            { idempotencyKey: { startsWith: `${idempotencyKey}:` } },
          ],
        },
        orderBy: { idempotencyKey: 'asc' },
      }) as VentaServicioRow[];
      if (ganadoras.length === 1) {
        const storedHash = extractPersistedHash(ganadoras[0].idempotencyKey, idempotencyKey);
        if (storedHash !== idempotencyHash &&
          !(storedHash === null && sameLegacyPersistedPayload(ganadoras[0], data))) {
          conflictIdempotency();
        }
        return {
          mode: 'LEGACY' as const,
          ventaServicio: ganadoras[0],
          allocationsResult: await reconstructAnticipoAllocationsResult(
            tenantId,
            ganadoras[0].ventaServicioId,
          ),
          replayed: true,
        } satisfies VentaServicioResult;
      }
    }
    throw error;
  }
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
