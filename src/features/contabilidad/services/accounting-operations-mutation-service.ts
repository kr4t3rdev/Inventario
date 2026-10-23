import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { resolveCrossQuote } from '@/features/contabilidad/domain/fx-cross-quote';
import type { CrossQuoteResolution } from '@/features/contabilidad/domain/fx-cross-quote';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { getRequiredTenantAccountingPolicy } from './tenant-accounting-policy-service';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import {
  buildEventoAjusteBancario,
  buildEventoDeudaRecibida,
  buildEventoInyeccionCapital,
  buildEventoPagoDeudaCapital,
  buildEventoTransferenciaBancaria,
} from '@/features/contabilidad-formal/lib/event-builders';

/**
 * @description Serializa payloads de idempotencia con claves ordenadas y decimales exactos.
 * @param {unknown} value - Valor que se incluirá en la comparación idempotente.
 * @returns {string} Representación estable para comparar sin conversiones a Number.
 */
function canonicalIdempotencyValue(value: unknown): string {
  if (value == null) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value instanceof Prisma.Decimal) return JSON.stringify(value.toFixed());
  if (typeof value === 'number') return JSON.stringify(new Prisma.Decimal(value).toFixed());
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalIdempotencyValue).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalIdempotencyValue(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * @description Compara decimales persistidos y de entrada sin perder precisión.
 * @param {unknown} left - Valor persistido.
 * @param {unknown} right - Valor recibido.
 * @param {string | null} defaultValue - Valor equivalente cuando ambos representan una omisión.
 * @returns {boolean} Si ambos importes/tasas son contablemente iguales.
 */
function sameIdempotencyDecimal(
  left: unknown,
  right: unknown,
  defaultValue: string | null = null,
): boolean {
  const leftValue = left == null ? defaultValue : left;
  const rightValue = right == null ? defaultValue : right;
  if (leftValue == null || rightValue == null) return leftValue == null && rightValue == null;
  try {
    return new Prisma.Decimal(leftValue as Prisma.Decimal.Value).eq(
      new Prisma.Decimal(rightValue as Prisma.Decimal.Value),
    );
  } catch {
    return canonicalIdempotencyValue(leftValue) === canonicalIdempotencyValue(rightValue);
  }
}

/**
 * @description Compara fechas solo cuando el cliente las declaró explícitamente.
 * @param {Date | null | undefined} persisted - Fecha guardada.
 * @param {Date | undefined} supplied - Fecha enviada por el cliente.
 * @returns {boolean} Si no hay fecha declarada o ambas fechas coinciden exactamente.
 */
function sameSuppliedDate(
  persisted: Date | null | undefined,
  supplied: Date | undefined,
): boolean {
  return supplied === undefined
    ? true
    : persisted != null && persisted.getTime() === supplied.getTime();
}

/**
 * @description Fingerprints every normalized field that changes a capital injection or its record.
 * @param {z.infer<typeof createCapitalInjectionSchema>} parsed - Validated capital request.
 * @returns {string} Stable SHA-256 payload fingerprint.
 */
function capitalInjectionPayloadFingerprint(
  parsed: z.infer<typeof createCapitalInjectionSchema>,
): string {
  const isDebt = parsed.tipo === 'DEUDA_EXTERNA';
  const payload = {
    montoRecibido: new Prisma.Decimal(parsed.montoRecibido),
    moneda: parsed.moneda,
    tipo: parsed.tipo,
    cuentaId: parsed.cuentaId,
    descripcion: parsed.descripcion ?? null,
    socio: isDebt ? null : parsed.socio ?? null,
    entidadPrestamista: isDebt ? parsed.entidadPrestamista ?? null : null,
    tasaInteres: isDebt ? new Prisma.Decimal(parsed.tasaInteres ?? 0) : null,
    tasaCambio: parsed.tasaCambio === undefined
      ? null
      : new Prisma.Decimal(parsed.tasaCambio),
    plazoMeses: isDebt ? parsed.plazoMeses ?? null : null,
    fechaInicioPago: isDebt ? parsed.fechaInicioPago ?? null : null,
    fechaOperacion: parsed.fechaOperacion ?? null,
  };
  return createHash('sha256')
    .update(canonicalIdempotencyValue(payload), 'utf8')
    .digest('hex');
}

/**
 * @description Checks only the tenant-scoped capital idempotency unique constraint.
 * @param {unknown} error - Error thrown by Prisma.
 * @returns {boolean} Whether this is the key uniqueness race for capital injection.
 */
function isCapitalInjectionIdempotencyUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaError = error as { code?: unknown; meta?: { target?: unknown } };
  if (prismaError.code !== 'P2002') return false;
  const target = prismaError.meta?.target;
  if (Array.isArray(target)) {
    return target.includes('tenantId') && target.includes('idempotencyKey');
  }
  return typeof target === 'string' &&
    target.includes('InyeccionCapital_tenantId_idempotencyKey_key');
}

/**
 * @description Creates a conflict error for a key already bound to another payload.
 * @returns {ActionError} Explicit idempotency conflict.
 */
function capitalInjectionIdempotencyConflict(): ActionError {
  return new ActionError(
    'La clave de idempotencia ya fue usada con datos diferentes',
    'IDEMPOTENCY_CONFLICT',
  );
}

/**
 * @description Matches a pre-fingerprint injection only when its persisted identity is provable.
 * @param {Record<string, unknown>} existing - Legacy row bound to the tenant key.
 * @param {z.infer<typeof createCapitalInjectionSchema>} parsed - Normalized retry input.
 * @returns {boolean} Whether every persisted, behavior-affecting input matches.
 */
function matchesLegacyCapitalInjection(
  existing: Record<string, unknown>,
  parsed: z.infer<typeof createCapitalInjectionSchema>,
): boolean {
  const isDebt = parsed.tipo === 'DEUDA_EXTERNA';
  const expectedInterest = isDebt ? new Prisma.Decimal(parsed.tasaInteres ?? 0) : null;
  const expectedInterestAmount = isDebt
    ? new Prisma.Decimal(parsed.montoRecibido)
        .mul(expectedInterest!.div(100))
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : null;
  const expectedDebtTotal = isDebt
    ? new Prisma.Decimal(parsed.montoRecibido).add(expectedInterestAmount!)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : null;
  const operationDateMatches = parsed.fechaOperacion !== undefined &&
    existing.fechaRegistro instanceof Date &&
    existing.fechaRegistro.getTime() === parsed.fechaOperacion.getTime();
  const optionalDateMatches = (persisted: unknown, supplied: Date | undefined) =>
    supplied === undefined
      ? persisted == null
      : persisted instanceof Date && persisted.getTime() === supplied.getTime();
  const rateMatches = parsed.tasaCambio === undefined
    ? existing.tasaCambio == null
    : sameIdempotencyDecimal(existing.tasaCambio, parsed.tasaCambio);

  return existing.tipo === parsed.tipo &&
    sameIdempotencyDecimal(existing.montoRecibido, parsed.montoRecibido) &&
    typeof existing.moneda === 'string' && existing.moneda.trim().toUpperCase() === parsed.moneda &&
    existing.cuentaId === parsed.cuentaId &&
    (existing.descripcion ?? null) === (parsed.descripcion ?? null) &&
    (existing.socio ?? null) === (isDebt ? null : parsed.socio ?? null) &&
    (existing.entidadPrestamista ?? null) === (isDebt ? parsed.entidadPrestamista ?? null : null) &&
    sameIdempotencyDecimal(existing.tasaInteres, expectedInterest) &&
    sameIdempotencyDecimal(existing.montoInteres, expectedInterestAmount) &&
    sameIdempotencyDecimal(existing.montoTotalDeuda, expectedDebtTotal) &&
    (existing.plazoMeses ?? null) === (isDebt ? parsed.plazoMeses ?? null : null) &&
    optionalDateMatches(existing.fechaInicioPago, isDebt ? parsed.fechaInicioPago : undefined) &&
    rateMatches &&
    operationDateMatches;
}

/**
 * @description Verifies a current or legacy keyed row against a normalized capital request.
 * @param {Record<string, unknown>} existing - Persisted idempotent record.
 * @param {z.infer<typeof createCapitalInjectionSchema>} parsed - Normalized request.
 * @param {string} fingerprint - Current request fingerprint.
 * @returns {void} Throws an explicit conflict when identity cannot be proven.
 */
function assertCapitalInjectionReplayMatches(
  existing: Record<string, unknown>,
  parsed: z.infer<typeof createCapitalInjectionSchema>,
  fingerprint: string,
): void {
  const persistedFingerprint = existing.payloadFingerprint;
  const matches = typeof persistedFingerprint === 'string'
    ? persistedFingerprint === fingerprint
    : matchesLegacyCapitalInjection(existing, parsed);
  if (!matches) throw capitalInjectionIdempotencyConflict();
}

const validateBankTransferSchema = z.object({
  cuentaOrigenId: z.string().min(1, 'Cuenta origen es requerida'),
  cuentaDestinoId: z.string().min(1, 'Cuenta destino es requerida'),
  monto: z.number().positive('El monto debe ser positivo'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  descripcion: z.string().optional(),
});

const createBankTransferSchema = z.object({
  cuentaOrigenId: z.string().min(1, 'Cuenta origen es requerida'),
  cuentaDestinoId: z.string().min(1, 'Cuenta destino es requerida'),
  montoOrigen: z.number().positive('El monto debe ser positivo'),
  montoDestino: z.number().positive('El monto debe ser positivo').optional(),
  motivo: z.string().min(1, 'El motivo es requerido'),
  descripcion: z.string().optional(),
  tasaCambio: z.number().positive().optional(),
  monedaPrincipal: z.string().optional(),
});

const createBankAdjustmentSchema = z.object({
  cuentaId: z.string().min(1, 'ID de cuenta es requerido'),
  tipo: z.enum(['ingreso', 'egreso']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  moneda: z.string().min(1, 'Moneda es requerida').default('CUP'),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  motivo: z.string().min(1, 'Motivo es obligatorio'),
  tasaCambio: z.number().positive().optional(),
  fechaOperacion: z.coerce.date().optional(),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
});

/**
 * @description Compares the persisted adjustment with every behavior-affecting retry field.
 * @param {Record<string, unknown>} existing - Existing adjustment bound to the idempotency key.
 * @param {z.infer<typeof createBankAdjustmentSchema>} parsed - Normalized retry input.
 * @returns {boolean} Whether the request is an exact idempotent replay.
 */
function matchesBankAdjustmentReplay(
  existing: Record<string, unknown>,
  parsed: z.infer<typeof createBankAdjustmentSchema>,
): boolean {
  return existing.tipo === parsed.tipo &&
    sameIdempotencyDecimal(existing.monto, parsed.monto) &&
    typeof existing.moneda === 'string' &&
    existing.moneda.trim().toUpperCase() === parsed.moneda.trim().toUpperCase() &&
    existing.cuentaId === parsed.cuentaId &&
    sameIdempotencyDecimal(existing.tasaCambio, parsed.tasaCambio, '1') &&
    existing.descripcion === parsed.descripcion &&
    existing.motivo === parsed.motivo &&
    sameSuppliedDate(existing.fechaOperacion as Date | null | undefined, parsed.fechaOperacion);
}

/**
 * @description Produces the established conflict when a key is reused with different input.
 * @returns {ActionError} Explicit idempotency conflict.
 */
function bankAdjustmentIdempotencyConflict(): ActionError {
  return new ActionError(
    'La clave de idempotencia ya fue usada con datos diferentes',
    'IDEMPOTENCY_CONFLICT',
  );
}

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const createCapitalInjectionSchema = z.object({
  montoRecibido: z.coerce.number().positive(),
  moneda: z.string().trim().min(1).default('CUP').transform((value) => value.toUpperCase()),
  tipo: z.enum(['CAPITAL_SOCIAL', 'DEUDA_EXTERNA']),
  cuentaId: z.string().min(1),
  descripcion: optionalText,
  socio: optionalText,
  entidadPrestamista: optionalText,
  tasaInteres: z.coerce.number().min(0).optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  plazoMeses: z.coerce.number().int().positive().optional(),
  fechaInicioPago: z.coerce.date().optional(),
  fechaOperacion: z.coerce.date().optional(),
  idempotencyKey: z.string().trim().min(1).max(64),
}).superRefine((input, ctx) => {
  if (input.tipo === 'CAPITAL_SOCIAL' && !input.socio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['socio'],
      message: 'El nombre del socio es requerido para Capital Social',
    });
  }
  if (input.tipo === 'DEUDA_EXTERNA' && !input.entidadPrestamista) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['entidadPrestamista'],
      message: 'La entidad prestamista es requerida para Deuda Externa',
    });
  }
});

const registerCapitalPaymentSchema = z.object({
  inyeccionId: z.string().min(1),
  monto: z.coerce.number().positive(),
  cuentaBancariaId: z.string().min(1),
  tipoPagoId: z.string().min(1),
  moneda: z.string().trim().min(1).optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  fechaOperacion: z.coerce.date().optional(),
  observaciones: z.string().optional(),
});

/**
 * @description Shared mutation service for accounting operations used by web and mobile adapters.
 */
export const AccountingOperationsMutationService = {
  async validateBankTransfer(input: z.infer<typeof validateBankTransferSchema>) {
    const parsed = validateBankTransferSchema.parse(input);

    if (parsed.cuentaOrigenId === parsed.cuentaDestinoId) {
      throw new ActionError('La cuenta origen y destino deben ser diferentes', 'VALIDATION_ERROR');
    }

    const [cuentaOrigen, cuentaDestino] = await Promise.all([
      prisma.cuentaBancaria.findUnique({
        where: { cuentaId: parsed.cuentaOrigenId },
        select: {
          cuentaId: true,
          nombreBanco: true,
          numeroCuenta: true,
          saldo: true,
          moneda: true,
          isActive: true,
        },
      }),
      prisma.cuentaBancaria.findUnique({
        where: { cuentaId: parsed.cuentaDestinoId },
        select: {
          cuentaId: true,
          nombreBanco: true,
          numeroCuenta: true,
          saldo: true,
          moneda: true,
          isActive: true,
        },
      }),
    ]);

    if (!cuentaOrigen) {
      throw new ActionError('Cuenta origen no encontrada', 'NOT_FOUND');
    }
    if (!cuentaOrigen.isActive) {
      throw new ActionError('La cuenta origen no está activa', 'VALIDATION_ERROR');
    }
    if (!cuentaDestino) {
      throw new ActionError('Cuenta destino no encontrada', 'NOT_FOUND');
    }
    if (!cuentaDestino.isActive) {
      throw new ActionError('La cuenta destino no está activa', 'VALIDATION_ERROR');
    }

    const advertencias: string[] = [];
    const saldoNumerico = Number(cuentaOrigen.saldo);
    const saldoSuficiente = saldoNumerico >= parsed.monto;

    if (!saldoSuficiente) {
      advertencias.push(
        `Saldo insuficiente. Disponible: ${saldoNumerico} ${cuentaOrigen.moneda}`,
      );
    }

    const saldoRestante = saldoNumerico - parsed.monto;
    const porcentajeRestante = (saldoRestante / saldoNumerico) * 100;
    if (porcentajeRestante < 20 && saldoRestante > 0) {
      advertencias.push(
        `El saldo restante será bajo: ${saldoRestante.toFixed(2)} ${cuentaOrigen.moneda}`,
      );
    }

    if (cuentaOrigen.moneda !== cuentaDestino.moneda) {
      advertencias.push('Esta transferencia requiere confirmación de tasa de cambio');
    }

    return { saldoSuficiente, advertencias };
  },

  async createBankTransfer({
    input,
    user,
  }: {
    input: z.infer<typeof createBankTransferSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = createBankTransferSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'transferencias-bancarias', 'registrar transferencias bancarias');
    requirePermission(user, 'financiero.contabilidad.acceder', 'registrar transferencias bancarias');

    if (parsed.cuentaOrigenId === parsed.cuentaDestinoId) {
      throw new ActionError('La cuenta origen y destino deben ser diferentes', 'VALIDATION_ERROR');
    }

    const [cuentaOrigen, cuentaDestino] = await Promise.all([
      prisma.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaOrigenId, tenantId, isActive: true },
      }),
      prisma.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaDestinoId, tenantId, isActive: true },
      }),
    ]);

    if (!cuentaOrigen) {
      throw new ActionError('Cuenta origen no encontrada', 'NOT_FOUND');
    }
    if (!cuentaDestino) {
      throw new ActionError('Cuenta destino no encontrada', 'NOT_FOUND');
    }
    if (!cuentaOrigen.isActive) {
      throw new ActionError('La cuenta origen no está activa', 'VALIDATION_ERROR');
    }
    if (!cuentaDestino.isActive) {
      throw new ActionError('La cuenta destino no está activa', 'VALIDATION_ERROR');
    }
    if (new Prisma.Decimal(cuentaOrigen.saldo).lt(new Prisma.Decimal(parsed.montoOrigen))) {
      throw new ActionError('Saldo insuficiente en la cuenta origen', 'VALIDATION_ERROR');
    }

    const monedaOrigen = cuentaOrigen.moneda.trim().toUpperCase();
    const monedaDestino = cuentaDestino.moneda.trim().toUpperCase();
    const fechaTransferencia = new Date();
    // La política funcional y la conversión se resuelven dentro de la transacción,
    // después del lock del tenant (la moneda funcional solo se conoce tras leerla).

    // Idempotencia (C3/G2): si el cliente provee numeroComprobante, se usa como clave.
    let numeroComprobante = (input as { numeroComprobante?: string }).numeroComprobante?.trim();
    if (!numeroComprobante) {
      const lastTransferencia = await prisma.transferenciaBancaria.findFirst({
        where: { tenantId },
        orderBy: { numeroComprobante: 'desc' },
        select: { numeroComprobante: true },
      });

      let nextNumber = 1;
      if (lastTransferencia?.numeroComprobante) {
        const lastNumber = Number.parseInt(lastTransferencia.numeroComprobante.replace(/\D/g, ''), 10);
        nextNumber = lastNumber + 1;
      }
      numeroComprobante = `TRF-${nextNumber.toString().padStart(6, '0')}`;
    }

    const transferencia = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const monedaFuncional = policy.functionalCurrencyCode.trim().toUpperCase();
      // FX-4: par cruzado (ninguna pata es la funcional). La cotización se resuelve
      // del catálogo de tasas; no se acepta tasa manual para este caso.
      const esCruzada =
        monedaOrigen !== monedaDestino &&
        monedaOrigen !== monedaFuncional &&
        monedaDestino !== monedaFuncional;
      if (esCruzada && parsed.tasaCambio != null) {
        throw new ActionError(
          'La cotización cruzada se resuelve del catálogo de tasas; no se acepta tasa manual',
          'FX_INSUFICIENTE',
        );
      }
      if (monedaOrigen !== monedaDestino && !esCruzada && parsed.tasaCambio == null) {
        throw new ActionError('Tasa de cambio requerida para la transferencia', 'FX_INSUFICIENTE');
      }
      let crossQuote: CrossQuoteResolution | null = null;
      if (esCruzada) {
        crossQuote = await resolveCrossQuote({
          client: tx,
          from: monedaOrigen,
          to: monedaDestino,
          functionalCurrency: monedaFuncional,
          at: fechaTransferencia,
        });
        if (!crossQuote || !crossQuote.functionalLeg) {
          throw new ActionError(
            'La transferencia entre dos monedas extranjeras requiere una cotización cruzada persistida',
            'FX_INSUFICIENTE',
          );
        }
      }
      const pataFuncional = esCruzada ? crossQuote!.functionalLeg! : null;
      const conversion = buildPersistedAccountingAmount(
        parsed.montoOrigen,
        monedaOrigen,
        monedaOrigen === monedaFuncional
          ? undefined
          : esCruzada
            ? pataFuncional!.rate
            : parsed.tasaCambio,
        esCruzada ? pataFuncional!.rateEffectiveAt : fechaTransferencia,
        esCruzada ? pataFuncional!.catalogRateId : undefined,
        monedaFuncional,
        esCruzada
          ? {
              fxProvenanceKind: 'CATALOG_RATE',
              crossQuote: {
                rate: crossQuote!.rate.toFixed(),
                fromCurrency: monedaOrigen,
                toCurrency: monedaDestino,
                kind: crossQuote!.kind,
                catalogRateIds: crossQuote!.catalogRateIds,
                rateEffectiveAt: crossQuote!.rateEffectiveAt.toISOString(),
              },
            }
          : undefined,
      );
      if (!conversion.fxEvidence || conversion.montoConvertido == null) {
        throw new ActionError('Falta evidencia FX funcional para la transferencia', 'FX_INSUFICIENTE');
      }
      // Aritmética decimal exacta: la pata extranjera de una transferencia funcional→extranjera
      // se deriva por división y se redondea a 4 decimales (escala de las columnas de cuenta);
      // la pata destino de un par cruzado se deriva por multiplicación con la tasa cruzada.
      const montoOrigenDecimal = new Prisma.Decimal(parsed.montoOrigen);
      const tasaParaDivision = parsed.tasaCambio != null ? new Prisma.Decimal(parsed.tasaCambio) : null;
      const montoDestino =
        monedaOrigen === monedaDestino
          ? montoOrigenDecimal
          : monedaDestino === monedaFuncional
            ? (conversion.montoConvertido as Prisma.Decimal)
            : esCruzada
              ? montoOrigenDecimal
                  .mul(crossQuote!.rate)
                  .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
              : montoOrigenDecimal
                .div(tasaParaDivision as Prisma.Decimal)
                .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      if (parsed.montoDestino != null) {
        const diferenciaDestino = new Prisma.Decimal(parsed.montoDestino).sub(montoDestino).abs();
        if (diferenciaDestino.gt('0.0001')) {
          throw new ActionError(
            'El monto destino no coincide con la tasa aplicada a la transferencia',
            'VALIDATION_ERROR',
          );
        }
      }
      const tasaCambioFinal = esCruzada ? crossQuote!.rate : (tasaParaDivision ?? conversion.tasaCambio);
      const debitoOrigen = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: parsed.cuentaOrigenId, tenantId, isActive: true,
          saldo: { gte: montoOrigenDecimal.toNumber() },
        },
        data: { saldo: { decrement: montoOrigenDecimal.toNumber() } },
      });
      if (debitoOrigen.count !== 1) {
        throw new ActionError('Cuenta origen no disponible o saldo insuficiente', 'VALIDATION_ERROR');
      }
      const creditoDestino = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: parsed.cuentaDestinoId, tenantId, isActive: true },
        data: { saldo: { increment: montoDestino.toNumber() } },
      });
      if (creditoDestino.count !== 1) {
        throw new ActionError('Cuenta destino no disponible', 'VALIDATION_ERROR');
      }

      const creada = await tx.transferenciaBancaria.create({
        data: {
          numeroComprobante,
          cuentaOrigen: { connect: { cuentaId: parsed.cuentaOrigenId } },
          cuentaDestino: { connect: { cuentaId: parsed.cuentaDestinoId } },
          tenant: { connect: { tenantId } },
          montoOrigen: montoOrigenDecimal,
          monedaOrigen,
          montoDestino,
          monedaDestino,
          tasaCambio: tasaCambioFinal,
          montoConvertido: conversion.montoConvertido,
          ...conversion.fxEvidence,
          fechaTransferencia,
          motivo: parsed.motivo,
          descripcion: parsed.descripcion,
          comprobanteGenerado: true,
        },
        include: {
          cuentaOrigen: {
            select: { nombreBanco: true, numeroCuenta: true, moneda: true },
          },
          cuentaDestino: {
            select: { nombreBanco: true, numeroCuenta: true, moneda: true },
          },
        },
      });

      // Capa de contabilidad formal (CTA-1): la transferencia mueve tesorería
      // entre cuentas del mismo tenant (mismo rubro bancario, dos lados).
      await postEvento(
        tx,
        { tenantId, userId: user.userId },
        buildEventoTransferenciaBancaria({
          transferenciaId: creada.transferenciaId,
          montoOrigen: montoOrigenDecimal,
          monedaOrigen,
          montoDestino,
          monedaDestino,
          tasaCambio: conversion.tasaCambio,
          montoFuncional: conversion.montoConvertido,
          monedaFuncionalCodigo: creada.functionalCurrency ?? 'CUP',
          fxEvidenceFingerprint: creada.fxEvidenceFingerprint ?? null,
          fecha: creada.fechaTransferencia,
          referencia: numeroComprobante,
          descripcion: parsed.motivo,
        }),
      );

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'TRANSFERENCIA',
        entidadId: creada.transferenciaId,
        usuarioId: user.userId,
        detalles: {
          numeroComprobante: creada.numeroComprobante,
          cuentaOrigen: creada.cuentaOrigen.nombreBanco,
          cuentaDestino: creada.cuentaDestino.nombreBanco,
          montoOrigen: Number(creada.montoOrigen),
          monedaOrigen: creada.monedaOrigen,
          montoDestino: Number(creada.montoDestino),
          monedaDestino: creada.monedaDestino,
          motivo: creada.motivo,
        },
      }, tx);

      return creada;
    });

    return {
      transferencia: {
        ...transferencia,
        montoOrigen: Number(transferencia.montoOrigen),
        montoDestino: Number(transferencia.montoDestino),
        tasaCambio: transferencia.tasaCambio ? Number(transferencia.tasaCambio) : null,
      },
      numeroComprobante,
    };
  },

  async createBankAdjustment({
    input,
    user,
  }: {
    input: z.infer<typeof createBankAdjustmentSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = createBankAdjustmentSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'contabilidad', 'crear ajustes bancarios');
    requirePermission(user, 'financiero.contabilidad.acceder', 'crear ajustes bancarios');

    const montoAjuste = parsed.tipo === 'ingreso'
      ? new Prisma.Decimal(parsed.monto)
      : new Prisma.Decimal(parsed.monto).neg();
    const fechaOperacion = parsed.fechaOperacion ?? new Date();

    // Idempotencia: si el cliente provee clave, un reintento con el mismo payload
    // devuelve el ajuste existente en lugar de duplicar ajuste, movimiento de saldo
    // y asiento. Si el payload difiere, se rechaza con 409 (conflicto de clave).
    const idempotencyKey = parsed.idempotencyKey?.trim() || null;

    const resultado = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      // La comprobación debe ocurrir después de adquirir el lock y dentro de
      // la transacción. Así, el perdedor de una carrera observa el registro
      // confirmado y nunca intenta duplicar el asiento/saldo.
      if (idempotencyKey) {
        const existente = await tx.ajusteBancario.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        });
        if (existente) {
          if (!matchesBankAdjustmentReplay(
            existente as unknown as Record<string, unknown>,
            parsed,
          )) {
            throw bankAdjustmentIdempotencyConflict();
          }

          const cuentaExistente = await tx.cuentaBancaria.findFirst({
            where: { cuentaId: existente.cuentaId, tenantId },
            select: { saldo: true },
          });
          const saldoNuevo = new Prisma.Decimal(cuentaExistente?.saldo ?? 0);
          const saldoAnterior = saldoNuevo.sub(montoAjuste);
          return {
            ajuste: existente,
            saldoAnterior: saldoAnterior.toNumber(),
            saldoNuevo: saldoNuevo.toNumber(),
            advertenciaSaldoNegativo: saldoNuevo.lt(0),
            message: 'Ajuste bancario ya registrado (reintento idempotente)',
          };
        }
      }

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaId, tenantId, isActive: true },
      });
      if (!cuenta) {
        throw new ActionError('Cuenta bancaria no encontrada', 'CUENTA_NO_ENCONTRADA');
      }
      if (!cuenta.isActive) {
        throw new ActionError('La cuenta bancaria está inactiva', 'CUENTA_INACTIVA');
      }
      if (cuenta.moneda.toUpperCase() !== parsed.moneda.toUpperCase()) {
        throw new ActionError('La moneda del ajuste debe coincidir con la cuenta bancaria', 'VALIDATION_ERROR');
      }

      const nuevoSaldo = new Prisma.Decimal(cuenta.saldo).add(montoAjuste);
      const saldoNegativo = nuevoSaldo.lt(0);
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const monedaFuncional = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        parsed.monto,
        parsed.moneda,
        parsed.tasaCambio,
        fechaOperacion,
        undefined,
        monedaFuncional,
      );
      if (!conversion.fxEvidence || conversion.montoConvertido == null) {
        throw new ActionError('Falta evidencia de conversión para el ajuste', 'FX_INSUFICIENTE');
      }
      const ajuste = await tx.ajusteBancario.create({
        data: {
          cuentaBancaria: { connect: { cuentaId: parsed.cuentaId } },
          idempotencyKey,
          tipo: parsed.tipo,
           monto: parsed.monto,
           moneda: parsed.moneda,
           tasaCambio: conversion.tasaCambio,
           montoConvertido: conversion.montoConvertido,
           ...conversion.fxEvidence,
           descripcion: parsed.descripcion,
          motivo: parsed.motivo,
          realizadoPor: user.userId,
           fechaOperacion,
          tenant: { connect: { tenantId } },
        },
      });

      const saldoActualizado = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: parsed.cuentaId, tenantId, isActive: true },
        data: { saldo: { increment: montoAjuste.toNumber() } },
      });
      if (saldoActualizado.count !== 1) {
        throw new ActionError('Cuenta bancaria no encontrada', 'CUENTA_NO_ENCONTRADA');
      }

      // Capa de contabilidad formal (CTA-1): ajuste bancario manual.
      await postEvento(
        tx,
        { tenantId, userId: user.userId },
        buildEventoAjusteBancario({
          ajusteId: ajuste.ajusteId,
          tipo: parsed.tipo,
          valoracion: {
            monto: ajuste.monto,
            moneda: ajuste.moneda,
            montoFuncional: ajuste.montoConvertido ?? undefined,
            monedaFuncionalCodigo: ajuste.functionalCurrency ?? 'CUP',
            tasaCambio: ajuste.tasaCambio,
            fxEvidenceFingerprint: ajuste.fxEvidenceFingerprint ?? null,
          },
          descripcion: parsed.descripcion ?? undefined,
          fecha: ajuste.fechaOperacion ?? fechaOperacion,
        }),
      );

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'AJUSTE_BANCARIO',
        entidadId: ajuste.ajusteId,
        usuarioId: user.userId,
        detalles: {
          tipo: parsed.tipo,
          monto: parsed.monto,
          moneda: parsed.moneda,
          cuenta: cuenta.nombreBanco,
          motivo: parsed.motivo,
          saldoAnterior: Number(cuenta.saldo),
          saldoNuevo: nuevoSaldo.toNumber(),
        },
      }, tx);

      return {
        ajuste,
        saldoAnterior: Number(cuenta.saldo),
        saldoNuevo: nuevoSaldo.toNumber(),
        advertenciaSaldoNegativo: saldoNegativo,
        message: saldoNegativo
          ? 'Ajuste creado exitosamente. ADVERTENCIA: El saldo de la cuenta es negativo.'
          : 'Ajuste bancario creado exitosamente',
      };
    });

    return resultado;
  },

  /**
   * @description Resolves a tenant-scoped exact retry before the period-write guard.
   * @param {Object} params - Request and authenticated actor.
   * @returns {Promise<unknown | null>} Existing result or null when the key is unused.
   */
  async findBankAdjustmentReplay({
    input,
    user,
  }: {
    input: z.input<typeof createBankAdjustmentSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = createBankAdjustmentSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'contabilidad', 'crear ajustes bancarios');
    requirePermission(user, 'financiero.contabilidad.acceder', 'crear ajustes bancarios');
    const idempotencyKey = parsed.idempotencyKey?.trim();
    if (!idempotencyKey) return null;

    return prisma.$transaction(async (tx: any) => {
      // Use the same tenant lock as the writer so a retry waits for any in-flight
      // keyed create and observes its committed row before the period gate decides.
      await acquireAccountingTenantLock(tx, tenantId);
      const existing = await tx.ajusteBancario.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (!existing) return null;
      if (!matchesBankAdjustmentReplay(
        existing as unknown as Record<string, unknown>,
        parsed,
      )) {
        throw bankAdjustmentIdempotencyConflict();
      }

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: existing.cuentaId, tenantId },
        select: { saldo: true },
      });
      const saldoNuevo = new Prisma.Decimal(cuenta?.saldo ?? 0);
      const montoAjuste = parsed.tipo === 'ingreso'
        ? new Prisma.Decimal(parsed.monto)
        : new Prisma.Decimal(parsed.monto).neg();
      return {
        ajuste: existing,
        saldoAnterior: saldoNuevo.sub(montoAjuste).toNumber(),
        saldoNuevo: saldoNuevo.toNumber(),
        advertenciaSaldoNegativo: saldoNuevo.lt(0),
        message: 'Ajuste bancario ya registrado (reintento idempotente)',
      };
    });
  },

  async createCapitalInjection({
    input,
    user,
  }: {
    input: z.input<typeof createCapitalInjectionSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = createCapitalInjectionSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'inyeccion-capital', 'registrar inyecciones de capital');
    requirePermission(user, 'financiero.contabilidad.acceder', 'registrar inyecciones de capital');

    const idempotencyKey = parsed.idempotencyKey;
    const payloadFingerprint = capitalInjectionPayloadFingerprint(parsed);

    const inyeccion = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      // Lookup idempotente bajo el mismo lock que protege el saldo y el asiento.
      // Esto evita que el perdedor de dos requests simultáneos vea un snapshot
      // vacío y termine en P2002 después de haber ejecutado efectos parciales.
      const existente = await tx.inyeccionCapital.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (existente) {
        assertCapitalInjectionReplayMatches(
          existente as Record<string, unknown>,
          parsed,
          payloadFingerprint,
        );
        return existente;
      }

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaId, tenantId },
        select: {
          cuentaId: true,
          saldo: true,
          moneda: true,
          isActive: true,
          tipoCuenta: true,
        },
      });

      if (!cuenta) {
        throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
      }
      if (!cuenta.isActive) {
        throw new ActionError('La cuenta bancaria está inactiva', 'VALIDATION_ERROR');
      }
      if (cuenta.moneda.toUpperCase() !== parsed.moneda) {
        throw new ActionError(
          'La moneda de la inyección debe coincidir con la moneda de la cuenta',
          'VALIDATION_ERROR',
        );
      }

      const fechaOperacion = parsed.fechaOperacion ?? new Date();
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const monedaFuncional = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        new Prisma.Decimal(parsed.montoRecibido),
        parsed.moneda,
        parsed.tasaCambio,
        fechaOperacion,
        undefined,
        monedaFuncional,
      );
      if (!conversion.fxEvidence || conversion.montoConvertido == null) {
        throw new ActionError('Falta evidencia de conversión para el aporte', 'FX_INSUFICIENTE');
      }

      const isDebt = parsed.tipo === 'DEUDA_EXTERNA';
      const montoRecibidoDecimal = new Prisma.Decimal(parsed.montoRecibido);
      const montoInteres = isDebt
        ? montoRecibidoDecimal
            .mul(new Prisma.Decimal(parsed.tasaInteres ?? 0).div(100))
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : null;
      const montoTotalDeuda = isDebt
        ? montoRecibidoDecimal
            .add(montoInteres as Prisma.Decimal)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : null;

      const created = await tx.inyeccionCapital.create({
        data: {
          tenantId,
          idempotencyKey,
          payloadFingerprint,
          montoRecibido: montoRecibidoDecimal,
          moneda: parsed.moneda,
          tasaCambio: conversion.tasaCambio,
          montoConvertido: conversion.montoConvertido,
          ...conversion.fxEvidence,
          tipo: parsed.tipo,
          cuentaId: parsed.cuentaId,
          descripcion: parsed.descripcion,
          socio: isDebt ? null : parsed.socio,
          entidadPrestamista: isDebt ? parsed.entidadPrestamista : null,
          tasaInteres: isDebt ? parsed.tasaInteres ?? 0 : null,
          montoInteres,
          montoTotalDeuda,
          saldoPendiente: montoTotalDeuda,
          plazoMeses: isDebt ? parsed.plazoMeses : null,
          fechaInicioPago: isDebt ? parsed.fechaInicioPago : null,
          fechaRegistro: fechaOperacion,
          estado: isDebt ? 'ACTIVA' : null,
        },
      });

      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaId },
        data: { saldo: { increment: montoRecibidoDecimal.toNumber() } },
      });

      // Capa de contabilidad formal (CTA-1): aporte propio sube capital social;
      // deuda externa sube deudas recibidas (mismo dinero entrando a caja).
      const valoracionCapital = {
        monto: created.montoRecibido,
        moneda: created.moneda,
        montoFuncional: created.montoConvertido ?? undefined,
        monedaFuncionalCodigo: created.functionalCurrency ?? 'CUP',
        tasaCambio: created.tasaCambio,
        fxEvidenceFingerprint: created.fxEvidenceFingerprint ?? null,
      };
      await postEvento(
        tx,
        { tenantId, userId: user.userId },
        isDebt
          ? buildEventoDeudaRecibida({
              deudaId: created.id,
              valoracion: valoracionCapital,
              tipoCuenta: cuenta.tipoCuenta,
              fecha: created.fechaRegistro,
              descripcion: parsed.descripcion ?? undefined,
            })
          : buildEventoInyeccionCapital({
              inyeccionId: created.id,
              valoracion: valoracionCapital,
              tipoCuenta: cuenta.tipoCuenta,
              fecha: created.fechaRegistro,
              descripcion: parsed.descripcion ?? undefined,
            }),
      );

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'INYECCION_CAPITAL',
        entidadId: created.id,
        usuarioId: user.userId,
        detalles: {
          montoRecibido: parsed.montoRecibido,
          moneda: parsed.moneda,
          tipo: parsed.tipo,
          cuentaId: parsed.cuentaId,
        },
      }, tx);

      return created;
    }).catch(async (error: unknown) => {
      if (!isCapitalInjectionIdempotencyUniqueViolation(error)) throw error;

      // The tenant lock is the normal race barrier; this unique-index recovery
      // protects callers that race outside that serialization path as well.
      const existente = await prisma.inyeccionCapital.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (!existente) throw error;
      assertCapitalInjectionReplayMatches(
        existente as unknown as Record<string, unknown>,
        parsed,
        payloadFingerprint,
      );
      return existente;
    });

    return inyeccion;
  },

  /**
   * @description Returns an exact existing retry without entering the period-write gate.
   * @param {Object} params - Request and authenticated actor.
   * @returns {Promise<unknown | null>} Existing injection or null when the key is unused.
   */
  async findCapitalInjectionReplay({
    input,
    user,
  }: {
    input: z.input<typeof createCapitalInjectionSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = createCapitalInjectionSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'inyeccion-capital', 'registrar inyecciones de capital');
    requirePermission(user, 'financiero.contabilidad.acceder', 'registrar inyecciones de capital');
    const fingerprint = capitalInjectionPayloadFingerprint(parsed);
    const existing = await prisma.inyeccionCapital.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: parsed.idempotencyKey,
        },
      },
    });
    if (!existing) return null;

    assertCapitalInjectionReplayMatches(
      existing as unknown as Record<string, unknown>,
      parsed,
      fingerprint,
    );
    return existing;
  },

  async registerCapitalPayment({
    input,
    user,
  }: {
    input: z.infer<typeof registerCapitalPaymentSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = registerCapitalPaymentSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'inyeccion-capital', 'registrar pagos de deuda de capital');
    requirePermission(user, 'financiero.contabilidad.acceder', 'registrar pagos de deuda de capital');

    const pago = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      // InyeccionCapital tiene tenantId propio (AS-05 ola 3); se busca también por cuenta bancaria como defensa.
      const inyeccion = await tx.inyeccionCapital.findFirst({
        where: { id: parsed.inyeccionId, cuentaBancaria: { tenantId } },
        select: { id: true, tipo: true, moneda: true, saldoPendiente: true, pagos: { select: { id: true } } },
      });

      if (!inyeccion) {
        throw new ActionError('Inyección de capital no encontrada', 'NOT_FOUND');
      }
      if (inyeccion.tipo !== 'DEUDA_EXTERNA') {
        throw new ActionError('Solo las deudas externas admiten pagos', 'VALIDATION_ERROR');
      }

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaBancariaId, tenantId },
        select: { cuentaId: true, isActive: true, moneda: true, tipoCuenta: true },
      });
      if (!cuenta) {
        throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
      }
      if (!cuenta.isActive) {
        throw new ActionError('La cuenta bancaria está inactiva', 'VALIDATION_ERROR');
      }

      const monedaPago = (parsed.moneda ?? cuenta.moneda).toUpperCase();
      if (monedaPago !== cuenta.moneda.toUpperCase()) {
        throw new ActionError('La moneda del pago debe coincidir con la cuenta bancaria', 'VALIDATION_ERROR');
      }
      const monedaDeuda = (inyeccion.moneda ?? 'CUP').toUpperCase();
      if (monedaPago !== monedaDeuda) {
        throw new ActionError('La moneda del pago debe coincidir con la moneda de la deuda', 'VALIDATION_ERROR');
      }

      const montoPagoDecimal = new Prisma.Decimal(parsed.monto);
      const saldoPendiente = new Prisma.Decimal(inyeccion.saldoPendiente ?? 0);
      if (montoPagoDecimal.gt(saldoPendiente)) {
        throw new ActionError('El pago excede el saldo pendiente de la deuda', 'VALIDATION_ERROR');
      }
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const monedaFuncional = policy.functionalCurrencyCode.trim().toUpperCase();
      const fechaPago = parsed.fechaOperacion ?? new Date();
      const conversion = buildPersistedAccountingAmount(
        montoPagoDecimal, monedaPago, parsed.tasaCambio, fechaPago, undefined, monedaFuncional,
      );
      if (!conversion.fxEvidence || conversion.montoConvertido == null) {
        throw new ActionError('Falta evidencia de conversión para el pago de capital', 'FX_INSUFICIENTE');
      }

      // PagoDeuda no tiene columna de tipo de pago: se acepta `tipoPagoId` para
      // mantener el contrato web/móvil, pero sólo se persisten las columnas reales.
      const created = await tx.pagoDeuda.create({
        data: {
          tenantId,
          inyeccionId: parsed.inyeccionId,
          montoPagado: montoPagoDecimal,
          moneda: monedaPago,
          tasaCambio: conversion.tasaCambio,
          montoConvertido: conversion.montoConvertido,
          ...conversion.fxEvidence,
          fechaPago,
          cuentaId: parsed.cuentaBancariaId,
          numeroCuota: inyeccion.pagos.length + 1,
          observaciones: parsed.observaciones,
        },
      });

      const saldoActualizado = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: parsed.cuentaBancariaId, tenantId, isActive: true },
        data: { saldo: { decrement: montoPagoDecimal.toNumber() } },
      });
      if (saldoActualizado.count !== 1) {
        throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
      }

      await tx.inyeccionCapital.update({
        where: { id: parsed.inyeccionId },
        data: {
          saldoPendiente: { decrement: montoPagoDecimal },
          ...(montoPagoDecimal.gte(saldoPendiente) ? { estado: 'PAGADA' as const } : {}),
        },
      });

      // Capa de contabilidad formal (CTA-1): pago de deuda de capital.
      await postEvento(
        tx,
        { tenantId, userId: user.userId },
        buildEventoPagoDeudaCapital({
          pagoDeudaId: created.id,
          valoracion: {
            monto: created.montoPagado,
            moneda: created.moneda,
            montoFuncional: created.montoConvertido ?? undefined,
            monedaFuncionalCodigo: created.functionalCurrency ?? 'CUP',
            tasaCambio: created.tasaCambio,
            fxEvidenceFingerprint: created.fxEvidenceFingerprint ?? null,
          },
          tipoCuenta: cuenta.tipoCuenta,
          fecha: created.fechaPago,
          descripcion: parsed.observaciones ?? undefined,
        }),
      );

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PAGO_DEUDA',
        entidadId: created.id,
        usuarioId: user.userId,
        detalles: { inyeccionId: parsed.inyeccionId, monto: parsed.monto, cuentaId: parsed.cuentaBancariaId },
      }, tx);

      return created;
    });

    return pago;
  },
};
