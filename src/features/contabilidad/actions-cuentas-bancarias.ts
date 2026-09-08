/**
 * @description Server Actions para Cuentas Bancarias.
 * Reemplazan el uso de contabilidadApi (RTK Query) para operaciones CRUD.
 *
 * @module features/contabilidad/actions-cuentas-bancarias
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { BankAccountReadService } from '@/features/contabilidad/services/bank-account-read-service';
import { AuditLogService } from '@/lib/services/audit-log-service';
import type { Prisma } from '@/generated/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Types ─────────────────────────────────────────────────

interface HistorialTransaccion {
  transaccionId: string
  fecha: Date
  tipoMovimiento: string
  descripcion: string
  montoOriginal: number
  monedaOriginal: string
  tasaCambio: number | null
  montoConvertido: number
  observaciones?: string
}

interface HistorialResumen {
  saldoActual: number
  totalIngresos: number
  totalEgresos: number
  totalMovimientos: number
}

interface HistorialPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ─── Schemas ───────────────────────────────────────────────

const createSchema = z.object({
  nombreBanco: z.string().min(1, 'El nombre del banco es requerido'),
  numeroCuenta: z.string().min(1, 'El número de cuenta es requerido'),
  tipoCuenta: z.string().min(1, 'El tipo de cuenta es requerido'),
  saldo: z.coerce.number().nonnegative('El saldo inicial no puede ser negativo').default(0),
  moneda: z.string().min(1, 'La moneda es requerida'),
  fuenteSaldoInicial: z.enum(['CAPITAL_SOCIAL', 'DEUDA_EXTERNA']).optional(),
  socio: z.string().trim().optional(),
  entidadPrestamista: z.string().trim().optional(),
}).superRefine((data, context) => {
  if (data.saldo <= 0) return;
  if (!data.fuenteSaldoInicial) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fuenteSaldoInicial'],
      message: 'Debe indicar el origen contable del saldo inicial',
    });
  }
  if (data.fuenteSaldoInicial === 'CAPITAL_SOCIAL' && !data.socio) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['socio'],
      message: 'Debe indicar el socio que aporta el capital',
    });
  }
  if (data.fuenteSaldoInicial === 'DEUDA_EXTERNA' && !data.entidadPrestamista) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['entidadPrestamista'],
      message: 'Debe indicar la entidad prestamista',
    });
  }
});

const updateSchema = z.object({
  cuentaId: z.string().min(1),
  nombreBanco: z.string().optional(),
  numeroCuenta: z.string().optional(),
  tipoCuenta: z.string().optional(),
  moneda: z.string().optional(),
  isActive: z.boolean().optional(),
}).strict();

// ─── Select ────────────────────────────────────────────────

const CUENTA_SELECT = {
  cuentaId: true,
  nombreBanco: true,
  numeroCuenta: true,
  tipoCuenta: true,
  saldo: true,
  moneda: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ACCOUNTING_HISTORY_FILTERS: Prisma.CuentaBancariaWhereInput[] = [
  { ajustes: { some: {} } },
  { inyeccionesCapital: { some: {} } },
  { pagosDeuda: { some: {} } },
  { reconciliacionesGasto: { some: {} } },
  { reconciliacionesServicio: { some: {} } },
  { reconciliacionesVenta: { some: {} } },
  { transferenciasDestino: { some: {} } },
  { transferenciasOrigen: { some: {} } },
  { facturas: { some: {} } },
];

/**
 * @description Busca evidencia contable histórica sin cargar las colecciones relacionadas.
 * @param tenantId - Tenant propietario de la cuenta.
 * @param cuentaId - Cuenta bancaria consultada.
 * @returns Verdadero cuando existe al menos un movimiento monetario relacionado.
 */
async function hasAccountingHistory(tenantId: string, cuentaId: string): Promise<boolean> {
  const evidence = await prisma.cuentaBancaria.findFirst({
    where: {
      cuentaId,
      tenantId,
      OR: ACCOUNTING_HISTORY_FILTERS,
    },
    select: { cuentaId: true },
  });
  return evidence !== null;
}

// ─── Server Actions ────────────────────────────────────────

export const getCuentasBancariasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'contabilidad', 'gestionar cuentas bancarias');
  const tenantId = requireTenant(user);
  return BankAccountReadService.list(tenantId);
});

export const getCuentaBancariaByIdAction = withAction(async (cuentaId: string, user: AuthenticatedUser) => {
  requireFeature(user, 'contabilidad', 'consultar cuentas bancarias');
  const tenantId = requireTenant(user);
  return BankAccountReadService.getById({ tenantId, cuentaId });
});

export const createCuentaBancariaAction = withAction(withPeriodValidation(
  (input: z.input<typeof createSchema>) => Number(input.saldo ?? 0) > 0 ? new Date() : null,
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  requireFeature(user, 'contabilidad', 'crear cuentas bancarias');
  const parsed = createSchema.parse(input);
  const tenantId = requireTenant(user);
  const cuenta = await prisma.$transaction(async (tx) => {
    const created = await tx.cuentaBancaria.create({
      data: {
        nombreBanco: parsed.nombreBanco,
        numeroCuenta: parsed.numeroCuenta,
        tipoCuenta: parsed.tipoCuenta,
        saldo: parsed.saldo,
        moneda: parsed.moneda,
        isActive: true,
        tenantId,
      },
      select: CUENTA_SELECT,
    });

    if (parsed.saldo > 0 && parsed.fuenteSaldoInicial) {
      const isDebt = parsed.fuenteSaldoInicial === 'DEUDA_EXTERNA';
      const counterpart = await tx.inyeccionCapital.create({
        data: {
          tenantId,
          tipo: parsed.fuenteSaldoInicial,
          montoRecibido: parsed.saldo,
          moneda: parsed.moneda,
          cuentaId: created.cuentaId,
          socio: isDebt ? null : parsed.socio,
          entidadPrestamista: isDebt ? parsed.entidadPrestamista : null,
          montoTotalDeuda: isDebt ? parsed.saldo : null,
          saldoPendiente: isDebt ? parsed.saldo : null,
          estado: isDebt ? 'ACTIVA' : null,
          descripcion: 'Contrapartida del saldo inicial de la cuenta bancaria',
        },
      });
      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'INYECCION_CAPITAL',
        entidadId: counterpart.id,
        usuarioId: user.userId,
        detalles: {
          origen: 'SALDO_INICIAL_CUENTA_BANCARIA',
          cuentaId: created.cuentaId,
          tipo: parsed.fuenteSaldoInicial,
          monto: parsed.saldo,
          moneda: parsed.moneda,
        },
      }, tx);
    }

    await AuditLogService.logStrict({
      accion: 'CREATE',
      entidad: 'CUENTA_BANCARIA',
      entidadId: created.cuentaId,
      usuarioId: user.userId,
      detalles: {
        nombreBanco: parsed.nombreBanco,
        numeroCuenta: parsed.numeroCuenta,
        tipoCuenta: parsed.tipoCuenta,
        moneda: parsed.moneda,
        saldoInicial: parsed.saldo,
        fuenteSaldoInicial: parsed.fuenteSaldoInicial ?? null,
      },
    }, tx);

    return created;
  });

  revalidatePath('/busy/contabilidad/cuentas');
  return cuenta;
}));

export const updateCuentaBancariaAction = withAction(async (input: z.infer<typeof updateSchema>, user: AuthenticatedUser) => {
  requireFeature(user, 'contabilidad', 'editar cuentas bancarias');
  const parsed = updateSchema.parse(input);
  const { cuentaId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.cuentaBancaria.findFirst({
    where: { cuentaId, tenantId },
    select: {
      cuentaId: true,
      saldo: true,
      moneda: true,
    },
  });
  if (!existing) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
  const changesCurrency = data.moneda !== undefined && data.moneda !== existing.moneda;
  const hasCurrencyLock = changesCurrency
    && (Number(existing.saldo) !== 0 || await hasAccountingHistory(tenantId, cuentaId));
  if (hasCurrencyLock) {
    throw new ActionError(
      'No se puede cambiar la moneda de una cuenta con saldo o movimientos contables',
      'VALIDATION_ERROR',
    );
  }

  const cuenta = await prisma.cuentaBancaria.update({
    where: { cuentaId },
    data: {
      ...(data.nombreBanco !== undefined && { nombreBanco: data.nombreBanco }),
      ...(data.numeroCuenta !== undefined && { numeroCuenta: data.numeroCuenta }),
      ...(data.tipoCuenta !== undefined && { tipoCuenta: data.tipoCuenta }),
      ...(data.moneda !== undefined && { moneda: data.moneda }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: CUENTA_SELECT,
  });

  AuditLogService.log({
    accion: 'UPDATE',
    entidad: 'CUENTA_BANCARIA',
    entidadId: cuentaId,
    usuarioId: user.userId,
    detalles: { cambios: data },
  }).catch((err) => console.error('[AuditLog] Error logging cuenta bancaria update:', err));

  revalidatePath('/busy/contabilidad/cuentas');
  return cuenta;
});

export const deleteCuentaBancariaAction = withAction(async (cuentaId: string, user: AuthenticatedUser) => {
  requireFeature(user, 'contabilidad', 'eliminar cuentas bancarias');
  const tenantId = requireTenant(user);
  const existing = await prisma.cuentaBancaria.findFirst({
    where: { cuentaId, tenantId },
    select: { cuentaId: true },
  });
  if (!existing) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');

  await prisma.cuentaBancaria.delete({ where: { cuentaId } });

  AuditLogService.log({
    accion: 'DELETE',
    entidad: 'CUENTA_BANCARIA',
    entidadId: cuentaId,
    usuarioId: user.userId,
    detalles: {},
  }).catch((err) => console.error('[AuditLog] Error logging cuenta bancaria delete:', err));

  revalidatePath('/busy/contabilidad/cuentas');
  return { id: cuentaId, eliminado: true };
});

export const getCuentaHistorialAction = withAction(async (params: { cuentaId: string; fechaInicio?: string; fechaFin?: string; tipoMovimiento?: string; page?: number; limit?: number }, _user: AuthenticatedUser) => {
  requireFeature(_user, 'contabilidad', 'consultar el historial de cuentas bancarias');
  const tenantId = requireTenant(_user);
  return BankAccountReadService.getHistory({
    tenantId,
    cuentaId: params.cuentaId,
    fechaInicio: params.fechaInicio,
    fechaFin: params.fechaFin,
    tipoMovimiento: params.tipoMovimiento,
    page: params.page,
    limit: params.limit,
  });
});
