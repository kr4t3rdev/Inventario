import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { createHash } from 'node:crypto';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

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

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const createCapitalInjectionSchema = z.object({
  montoRecibido: z.coerce.number().positive(),
  moneda: z.string().trim().min(1).default('CUP').transform((value) => value.toUpperCase()),
  tasaCambio: z.coerce.number().positive().optional(),
  tipo: z.enum(['CAPITAL_SOCIAL', 'DEUDA_EXTERNA']),
  cuentaId: z.string().min(1),
  descripcion: optionalText,
  socio: optionalText,
  entidadPrestamista: optionalText,
  tasaInteres: z.coerce.number().min(0).optional(),
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

/**
 * @description Serializes normalized values deterministically without losing decimal precision.
 * @param {unknown} value - Value participating in an idempotency identity.
 * @returns {string} Stable serialized representation.
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
 * @description Compares persisted and supplied decimal values exactly.
 * @param {unknown} left - Persisted value.
 * @param {unknown} right - Supplied value.
 * @param {string | null} defaultValue - Equivalent omission value.
 * @returns {boolean} Whether both values are numerically equal.
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
 * @description Matches a persisted bank adjustment against every relevant request field.
 * @param {Record<string, unknown>} existing - Existing adjustment.
 * @param {z.infer<typeof createBankAdjustmentSchema>} parsed - Normalized retry.
 * @returns {boolean} Whether the retry is exact.
 */
function matchesBankAdjustmentReplay(
  existing: Record<string, unknown>,
  parsed: z.infer<typeof createBankAdjustmentSchema>,
): boolean {
  const persistedFingerprint = existing.payloadFingerprint;
  if (typeof persistedFingerprint === 'string') {
    return persistedFingerprint === bankAdjustmentPayloadFingerprint(parsed);
  }

  // A legacy row without a fingerprint cannot prove an omitted-date request was exact.
  if (parsed.fechaOperacion === undefined) return false;
  return existing.tipo === parsed.tipo &&
    sameIdempotencyDecimal(existing.monto, parsed.monto) &&
    typeof existing.moneda === 'string' &&
    existing.moneda.trim().toUpperCase() === parsed.moneda.trim().toUpperCase() &&
    existing.cuentaId === parsed.cuentaId &&
    sameIdempotencyDecimal(
      existing.tasaCambio,
      parsed.moneda.trim().toUpperCase() === 'CUP' ? '1' : parsed.tasaCambio,
    ) &&
    existing.descripcion === parsed.descripcion &&
    existing.motivo === parsed.motivo &&
    (existing.fechaOperacion instanceof Date &&
      existing.fechaOperacion.getTime() === parsed.fechaOperacion.getTime());
}

/**
 * @description Fingerprints every normalized field supplied for a bank adjustment.
 * @param {z.infer<typeof createBankAdjustmentSchema>} parsed - Validated request.
 * @returns {string} SHA-256 request fingerprint.
 */
function bankAdjustmentPayloadFingerprint(
  parsed: z.infer<typeof createBankAdjustmentSchema>,
): string {
  return createHash('sha256').update(canonicalIdempotencyValue({
    cuentaId: parsed.cuentaId,
    tipo: parsed.tipo,
    monto: new Prisma.Decimal(parsed.monto),
    moneda: parsed.moneda.trim().toUpperCase(),
    tasaCambio: parsed.tasaCambio === undefined ? null : new Prisma.Decimal(parsed.tasaCambio),
    descripcion: parsed.descripcion,
    motivo: parsed.motivo,
    fechaOperacion: parsed.fechaOperacion ?? null,
  }), 'utf8').digest('hex');
}

/**
 * @description Creates the established error for a reused key with another payload.
 * @returns {ActionError} Idempotency conflict.
 */
function idempotencyConflict(): ActionError {
  return new ActionError(
    'La clave de idempotencia ya fue usada con datos diferentes',
    'IDEMPOTENCY_CONFLICT',
  );
}

/**
 * @description Fingerprints the complete normalized capital or external-debt request.
 * @param {z.infer<typeof createCapitalInjectionSchema>} parsed - Validated request.
 * @returns {string} SHA-256 request fingerprint.
 */
function capitalInjectionPayloadFingerprint(
  parsed: z.infer<typeof createCapitalInjectionSchema>,
): string {
  const isDebt = parsed.tipo === 'DEUDA_EXTERNA';
  return createHash('sha256').update(canonicalIdempotencyValue({
    montoRecibido: new Prisma.Decimal(parsed.montoRecibido),
    moneda: parsed.moneda,
    tipo: parsed.tipo,
    cuentaId: parsed.cuentaId,
    descripcion: parsed.descripcion ?? null,
    socio: isDebt ? null : parsed.socio ?? null,
    entidadPrestamista: isDebt ? parsed.entidadPrestamista ?? null : null,
    tasaInteres: isDebt ? new Prisma.Decimal(parsed.tasaInteres ?? 0) : null,
    tasaCambio: parsed.tasaCambio === undefined ? null : new Prisma.Decimal(parsed.tasaCambio),
    plazoMeses: isDebt ? parsed.plazoMeses ?? null : null,
    fechaInicioPago: isDebt ? parsed.fechaInicioPago ?? null : null,
    fechaOperacion: parsed.fechaOperacion ?? null,
  }), 'utf8').digest('hex');
}

/**
 * @description Checks whether a legacy keyed row exactly represents the supplied capital request.
 * @param {Record<string, unknown>} existing - Existing injection.
 * @param {z.infer<typeof createCapitalInjectionSchema>} parsed - Validated retry.
 * @returns {boolean} Whether persisted values prove an exact replay.
 */
function matchesLegacyCapitalInjection(
  existing: Record<string, unknown>,
  parsed: z.infer<typeof createCapitalInjectionSchema>,
): boolean {
  const isDebt = parsed.tipo === 'DEUDA_EXTERNA';
  const interest = isDebt ? new Prisma.Decimal(parsed.tasaInteres ?? 0) : null;
  const interestAmount = isDebt
    ? new Prisma.Decimal(parsed.montoRecibido)
        .mul(interest as Prisma.Decimal)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : null;
  const debtTotal = isDebt
    ? new Prisma.Decimal(parsed.montoRecibido)
        .add(interestAmount as Prisma.Decimal)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : null;
  const optionalDateMatches = (persisted: unknown, supplied: Date | undefined) =>
    supplied === undefined
      ? persisted == null
      : persisted instanceof Date && persisted.getTime() === supplied.getTime();
  return existing.tipo === parsed.tipo &&
    sameIdempotencyDecimal(existing.montoRecibido, parsed.montoRecibido) &&
    typeof existing.moneda === 'string' && existing.moneda.trim().toUpperCase() === parsed.moneda &&
    existing.cuentaId === parsed.cuentaId &&
    (existing.descripcion ?? null) === (parsed.descripcion ?? null) &&
    (existing.socio ?? null) === (isDebt ? null : parsed.socio ?? null) &&
    (existing.entidadPrestamista ?? null) === (isDebt ? parsed.entidadPrestamista ?? null : null) &&
    sameIdempotencyDecimal(existing.tasaInteres, interest) &&
    sameIdempotencyDecimal(existing.montoInteres, interestAmount) &&
    sameIdempotencyDecimal(existing.montoTotalDeuda, debtTotal) &&
    (existing.plazoMeses ?? null) === (isDebt ? parsed.plazoMeses ?? null : null) &&
    optionalDateMatches(existing.fechaInicioPago, isDebt ? parsed.fechaInicioPago : undefined) &&
    (parsed.tasaCambio === undefined
      ? existing.tasaCambio == null
      : sameIdempotencyDecimal(existing.tasaCambio, parsed.tasaCambio)) &&
    parsed.fechaOperacion !== undefined && existing.fechaRegistro instanceof Date &&
    existing.fechaRegistro.getTime() === parsed.fechaOperacion.getTime();
}

/**
 * @description Restricts unique-race recovery to the capital tenant/key constraint.
 * @param {unknown} error - Prisma error.
 * @returns {boolean} Whether the error is the expected idempotency P2002.
 */
function isCapitalIdempotencyUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaError = error as { code?: unknown; meta?: { target?: unknown } };
  if (prismaError.code !== 'P2002') return false;
  const target = prismaError.meta?.target;
  return Array.isArray(target)
    ? target.includes('tenantId') && target.includes('idempotencyKey')
    : typeof target === 'string' && target.includes('InyeccionCapital_tenantId_idempotencyKey_key');
}

/**
 * @description Ensures a persisted keyed capital operation matches the normalized retry payload.
 * @param {Record<string, unknown>} existing - Existing capital operation.
 * @param {z.infer<typeof createCapitalInjectionSchema>} parsed - Normalized retry.
 * @param {string} fingerprint - Current request fingerprint.
 * @returns {void} Throws when the original payload cannot be proven equal.
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
  if (!matches) throw idempotencyConflict();
}

const registerCapitalPaymentSchema = z.object({
  inyeccionId: z.string().min(1),
  monto: z.coerce.number().positive(),
  cuentaBancariaId: z.string().min(1),
  tipoPagoId: z.string().min(1),
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

    if (parsed.cuentaOrigenId === parsed.cuentaDestinoId) {
      throw new ActionError('La cuenta origen y destino deben ser diferentes', 'VALIDATION_ERROR');
    }

    const [cuentaOrigen, cuentaDestino] = await Promise.all([
      prisma.cuentaBancaria.findUnique({ where: { cuentaId: parsed.cuentaOrigenId } }),
      prisma.cuentaBancaria.findUnique({ where: { cuentaId: parsed.cuentaDestinoId } }),
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
    if (Number(cuentaOrigen.saldo) < parsed.montoOrigen) {
      throw new ActionError('Saldo insuficiente en la cuenta origen', 'VALIDATION_ERROR');
    }

    let montoDestino = parsed.montoDestino || parsed.montoOrigen;
    let tasaCambioFinal = parsed.tasaCambio;

    if (cuentaOrigen.moneda !== cuentaDestino.moneda || cuentaDestino.moneda !== 'CUP') {
      if (!parsed.tasaCambio) {
        throw new ActionError(
          'Tasa de cambio requerida para transferencias entre diferentes monedas',
          'VALIDATION_ERROR',
        );
      }
      montoDestino = parsed.montoOrigen * parsed.tasaCambio;
      tasaCambioFinal = parsed.tasaCambio;
    }

    const lastTransferencia = await prisma.transferenciaBancaria.findFirst({
      orderBy: { numeroComprobante: 'desc' },
      select: { numeroComprobante: true },
    });

    let nextNumber = 1;
    if (lastTransferencia?.numeroComprobante) {
      const lastNumber = Number.parseInt(lastTransferencia.numeroComprobante.replace(/\D/g, ''), 10);
      nextNumber = lastNumber + 1;
    }
    const numeroComprobante = `TRF-${nextNumber.toString().padStart(6, '0')}`;

    const transferencia = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaOrigenId },
        data: { saldo: { decrement: parsed.montoOrigen } },
      });
      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaDestinoId },
        data: { saldo: { increment: montoDestino } },
      });

      return tx.transferenciaBancaria.create({
        data: {
          numeroComprobante,
          cuentaOrigen: { connect: { cuentaId: parsed.cuentaOrigenId } },
          cuentaDestino: { connect: { cuentaId: parsed.cuentaDestinoId } },
          tenant: { connect: { tenantId } },
          montoOrigen: parsed.montoOrigen,
          monedaOrigen: cuentaOrigen.moneda,
          montoDestino,
          monedaDestino: cuentaDestino.moneda,
          tasaCambio: tasaCambioFinal,
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
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'TRANSFERENCIA',
      entidadId: transferencia.transferenciaId,
      usuarioId: user.userId,
      detalles: {
        numeroComprobante: transferencia.numeroComprobante,
        cuentaOrigen: transferencia.cuentaOrigen.nombreBanco,
        cuentaDestino: transferencia.cuentaDestino.nombreBanco,
        montoOrigen: Number(transferencia.montoOrigen),
        monedaOrigen: transferencia.monedaOrigen,
        montoDestino: Number(transferencia.montoDestino),
        monedaDestino: transferencia.monedaDestino,
        motivo: transferencia.motivo,
      },
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
    const idempotencyKey = parsed.idempotencyKey?.trim() || null;
    const payloadFingerprint = idempotencyKey
      ? bankAdjustmentPayloadFingerprint(parsed)
      : null;
    const fechaOperacion = parsed.fechaOperacion ?? new Date();
    const montoAjuste = parsed.tipo === 'ingreso'
      ? new Prisma.Decimal(parsed.monto)
      : new Prisma.Decimal(parsed.monto).neg();

    const resultado = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      if (idempotencyKey) {
        const existing = await tx.ajusteBancario.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        });
        if (existing) {
          if (!matchesBankAdjustmentReplay(existing as Record<string, unknown>, parsed)) {
            throw idempotencyConflict();
          }
          const currentAccount = await tx.cuentaBancaria.findFirst({
            where: { cuentaId: existing.cuentaId, tenantId },
            select: { saldo: true },
          });
          const saldoNuevo = new Prisma.Decimal(currentAccount?.saldo ?? 0);
          return {
            ajuste: existing,
            saldoAnterior: saldoNuevo.sub(montoAjuste).toNumber(),
            saldoNuevo: saldoNuevo.toNumber(),
            advertenciaSaldoNegativo: saldoNuevo.lt(0),
            message: 'Ajuste bancario ya registrado (reintento idempotente)',
          };
        }
      }

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaId, tenantId },
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

      const saldoAnterior = new Prisma.Decimal(cuenta.saldo);
      const nuevoSaldo = saldoAnterior.add(montoAjuste);
      const monedaCUP = parsed.moneda.toUpperCase() === 'CUP';
      const ajuste = await tx.ajusteBancario.create({
        data: {
          cuentaBancaria: { connect: { cuentaId: parsed.cuentaId } },
          idempotencyKey,
          payloadFingerprint,
          tipo: parsed.tipo,
          monto: new Prisma.Decimal(parsed.monto),
          moneda: parsed.moneda,
          tasaCambio: monedaCUP ? new Prisma.Decimal(1) : parsed.tasaCambio,
          montoConvertido: monedaCUP
            ? new Prisma.Decimal(parsed.monto)
            : parsed.tasaCambio
              ? new Prisma.Decimal(parsed.monto).mul(parsed.tasaCambio)
              : null,
          descripcion: parsed.descripcion,
          motivo: parsed.motivo,
          realizadoPor: user.userId,
          fechaOperacion,
          tenant: { connect: { tenantId } },
        },
      });

      const saldoActualizado = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: parsed.cuentaId, tenantId, isActive: true },
        data: { saldo: { increment: montoAjuste } },
      });
      if (saldoActualizado.count !== 1) {
        throw new ActionError('Cuenta bancaria no encontrada', 'CUENTA_NO_ENCONTRADA');
      }

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
          saldoAnterior: saldoAnterior.toNumber(),
          saldoNuevo: nuevoSaldo.toNumber(),
        },
      }, tx);

      return {
        ajuste,
        saldoAnterior: saldoAnterior.toNumber(),
        saldoNuevo: nuevoSaldo.toNumber(),
        advertenciaSaldoNegativo: nuevoSaldo.lt(0),
        message: nuevoSaldo.lt(0)
        ? 'Ajuste creado exitosamente. ADVERTENCIA: El saldo de la cuenta es negativo.'
        : 'Ajuste bancario creado exitosamente',
      };
    });

    return resultado;
  },

  /**
   * @description Resolves an exact keyed adjustment before the period-write guard.
   * @param {Object} params - Adjustment request and authenticated user.
   * @returns {Promise<unknown | null>} Existing adjustment result or null when unused.
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
    const idempotencyKey = parsed.idempotencyKey?.trim();
    if (!idempotencyKey) return null;

    return prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const existing = await tx.ajusteBancario.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (!existing) return null;
      if (!matchesBankAdjustmentReplay(existing as Record<string, unknown>, parsed)) {
        throw idempotencyConflict();
      }
      const account = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: existing.cuentaId, tenantId },
        select: { saldo: true },
      });
      const saldoNuevo = new Prisma.Decimal(account?.saldo ?? 0);
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
    const payloadFingerprint = capitalInjectionPayloadFingerprint(parsed);
    const idempotencyKey = parsed.idempotencyKey;

    const inyeccion = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      const existing = await tx.inyeccionCapital.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (existing) {
        assertCapitalInjectionReplayMatches(
          existing as Record<string, unknown>,
          parsed,
          payloadFingerprint,
        );
        return existing;
      }

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaId, tenantId },
        select: {
          cuentaId: true,
          saldo: true,
          moneda: true,
          isActive: true,
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

      const isDebt = parsed.tipo === 'DEUDA_EXTERNA';
      const montoRecibido = new Prisma.Decimal(parsed.montoRecibido);
      const montoInteres = isDebt
        ? montoRecibido
            .mul(new Prisma.Decimal(parsed.tasaInteres ?? 0).div(100))
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : null;
      const montoTotalDeuda = isDebt
        ? montoRecibido.add(montoInteres as Prisma.Decimal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : null;

      const created = await tx.inyeccionCapital.create({
        data: {
          tenantId,
          idempotencyKey,
          payloadFingerprint,
          montoRecibido,
          moneda: parsed.moneda,
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
          fechaRegistro: parsed.fechaOperacion ?? new Date(),
          estado: isDebt ? 'ACTIVA' : null,
        },
      });

      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaId },
          data: { saldo: { increment: montoRecibido } },
      });

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
      if (!isCapitalIdempotencyUniqueViolation(error)) throw error;
      const existing = await prisma.inyeccionCapital.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (!existing) throw error;
      assertCapitalInjectionReplayMatches(
        existing as unknown as Record<string, unknown>,
        parsed,
        payloadFingerprint,
      );
      return existing;
    });

    return inyeccion;
  },

  /**
   * @description Resolves an exact existing capital retry before the period-write guard.
   * @param {Object} params - Request and authenticated user.
   * @returns {Promise<unknown | null>} Existing injection or null when unused.
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
    const fingerprint = capitalInjectionPayloadFingerprint(parsed);
    const existing = await prisma.inyeccionCapital.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey: parsed.idempotencyKey },
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

    const pago = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      // InyeccionCapital tiene tenantId propio (AS-05 ola 3); se busca también por cuenta bancaria como defensa.
      const inyeccion = await tx.inyeccionCapital.findFirst({
        where: { id: parsed.inyeccionId, cuentaBancaria: { tenantId } },
        select: { id: true, tipo: true, saldoPendiente: true, pagos: { select: { id: true } } },
      });

      if (!inyeccion) {
        throw new ActionError('Inyección de capital no encontrada', 'NOT_FOUND');
      }
      if (inyeccion.tipo !== 'DEUDA_EXTERNA') {
        throw new ActionError('Solo las deudas externas admiten pagos', 'VALIDATION_ERROR');
      }

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaBancariaId, tenantId },
        select: { cuentaId: true, isActive: true },
      });
      if (!cuenta) {
        throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
      }
      if (!cuenta.isActive) {
        throw new ActionError('La cuenta bancaria está inactiva', 'VALIDATION_ERROR');
      }

      const saldoPendiente = Number(inyeccion.saldoPendiente ?? 0);
      if (parsed.monto > saldoPendiente) {
        throw new ActionError('El pago excede el saldo pendiente de la deuda', 'VALIDATION_ERROR');
      }

      // PagoDeuda no tiene columna de tipo de pago: se acepta `tipoPagoId` para
      // mantener el contrato web/móvil, pero sólo se persisten las columnas reales.
      const created = await tx.pagoDeuda.create({
        data: {
          tenantId,
          inyeccionId: parsed.inyeccionId,
          montoPagado: parsed.monto,
          cuentaId: parsed.cuentaBancariaId,
          numeroCuota: inyeccion.pagos.length + 1,
          observaciones: parsed.observaciones,
        },
      });

      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaBancariaId },
        data: { saldo: { decrement: parsed.monto } },
      });

      await tx.inyeccionCapital.update({
        where: { id: parsed.inyeccionId },
        data: {
          saldoPendiente: { decrement: parsed.monto },
          ...(parsed.monto >= saldoPendiente ? { estado: 'PAGADA' as const } : {}),
        },
      });

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
