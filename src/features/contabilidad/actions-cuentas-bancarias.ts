/**
 * @description Server Actions para Cuentas Bancarias.
 * Reemplazan el uso de contabilidadApi (RTK Query) para operaciones CRUD.
 *
 * @module features/contabilidad/actions-cuentas-bancarias
 */
'use server';

import { revalidatePath } from 'next/cache';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import { BankAccountReadService } from '@/features/contabilidad/services/bank-account-read-service';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { emitirInyeccionCapital } from '@/features/contabilidad-formal/services/capital-adjustment-posting-service';
import { registrarMovimientoEfectivoAnticipo } from '@/lib/services/anticipos-workflow';
import { initializationContract } from '@/features/contabilidad/services/initialization-contract';
import { runIdempotentInitialization } from '@/features/contabilidad/services/initialization-idempotency';
import { assertInitializationAccess, computeInitializationPayloadHash } from './services/initialization-idempotency';
import { acquireAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service';
import { valueOpeningAccounts } from './services/initialization-valuation';
import { buildOpeningEntryLines } from './services/initialization-opening-lines';
import { ensureCutoffPeriod } from './services/initialization-period';
import { persistInitialInventory } from './services/initial-inventory-persistence';
import { reconcileInitialInventory } from './services/initial-inventory-reconciliation';
import {
  createInitializationApertura,
  parseCutoffDate,
  postOpeningEntry,
  resolveRoleAccountId,
  verifyInitializationReplay,
  type OpeningAsientoRef,
} from './services/initialization-coordinator';
import { Prisma } from '@/generated/prisma';
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
  nombreCuenta: z.string().trim().max(200).optional(),
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
  nombreCuenta: z.string().trim().max(200).optional(),
  nombreBanco: z.string().optional(),
  numeroCuenta: z.string().optional(),
  tipoCuenta: z.string().optional(),
  moneda: z.string().optional(),
  isActive: z.boolean().optional(),
}).strict();

// ─── Select ────────────────────────────────────────────────

const CUENTA_SELECT = {
  cuentaId: true,
  nombreCuenta: true,
  nombreBanco: true,
  numeroCuenta: true,
  tipoCuenta: true,
  saldo: true,
  moneda: true,
  cuentaContableInicialId: true,
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
  async (input: z.input<typeof createSchema>, user: AuthenticatedUser) => {
  requireFeature(user, 'contabilidad', 'crear cuentas bancarias');
  const parsed = createSchema.parse(input);
  const tenantId = requireTenant(user);
  const cuenta = await prisma.$transaction(async (tx) => {
    await acquireAccountingTenantLock(tx, tenantId);
    const created = await tx.cuentaBancaria.create({
      data: {
        nombreCuenta: parsed.nombreCuenta ?? null,
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
      await emitirInyeccionCapital(tx, { tenantId, userId: user.userId }, {
        inyeccionId: counterpart.id,
        fecha: counterpart.fechaRegistro,
        monto: parsed.saldo,
        moneda: parsed.moneda,
        descripcion: 'Contrapartida del saldo inicial de la cuenta bancaria',
        tipo: parsed.fuenteSaldoInicial,
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

/**
 * @description Inicializa varias cuentas y sus saldos en una transacción idempotente.
 * @param input - Cuentas normalizadas, origen contable y clave de reintento del onboarding.
 * @param user - Usuario autenticado que inicia la configuración del tenant.
 * @returns Identificadores de cuentas y movimientos creados, o resultado del replay.
 */
export const initializeBankAccountsAction = withAction(
  async (input: z.input<typeof initializationContract>, user: AuthenticatedUser) => {
    assertInitializationAccess(user);
    const parsed = initializationContract.parse(input);
    const tenantId = requireTenant(user);
    const { idempotencyKey, ...payload } = parsed;
    const payloadHash = computeInitializationPayloadHash(payload);
    const hasAdvance = parsed.cuentas.some((cuenta) => cuenta.origen?.tipo === 'ANTICIPO');
    if (hasAdvance) {
      throw new ActionError(
        'Los saldos iniciales por anticipo aún no están coordinados a fecha de corte; llegan con la tarea 5',
        'INITIALIZATION_ANTICIPO_NO_DISPONIBLE',
      );
    }

    const result = await runIdempotentInitialization({
      tenantId,
      idempotencyKey: parsed.idempotencyKey,
      payloadHash,
    }, async (tx, inicializacionId) => {
      const fechaCorteDate = parseCutoffDate(parsed.fechaCorte);
      const policy = await tx.tenantAccountingPolicy.findUnique({
        where: { tenantId },
        select: { functionalCurrencyCode: true },
      });
      const functionalCurrency = parsed.monedaFuncional;
      if (policy?.functionalCurrencyCode && policy.functionalCurrencyCode.trim().toUpperCase() !== functionalCurrency) {
        throw new ActionError(
          `La moneda funcional de la carga (${functionalCurrency}) no coincide con la política del tenant (${policy.functionalCurrencyCode.trim().toUpperCase()})`,
          'MONEDA_FUNCIONAL_NO_COINCIDE',
        );
      }
      const subledgerChecks: Array<{ label: string; count: number }> = [
        { label: 'cuentas bancarias', count: await tx.cuentaBancaria.count({ where: { tenantId } }) },
        { label: 'asientos', count: await tx.asiento.count({ where: { tenantId } }) },
        { label: 'aperturas', count: await tx.aperturaPeriodo.count({ where: { tenantId } }) },
        { label: 'cuentas por cobrar', count: await tx.cuentaPorCobrar.count({ where: { tenantId } }) },
        { label: 'cuentas por pagar', count: await tx.cuentaPorPagar.count({ where: { tenantId } }) },
        { label: 'existencias', count: await tx.stockUbicacion.count({ where: { tenantId } }) },
        { label: 'anticipos', count: await tx.anticipo.count({ where: { tenantId } }) },
        { label: 'inyecciones de capital', count: await tx.inyeccionCapital.count({ where: { tenantId } }) },
        { label: 'deudas', count: await tx.deudaCash.count({ where: { tenantId } }) },
        { label: 'préstamos', count: await tx.prestamoCash.count({ where: { tenantId } }) },
      ];
      const existingSubledger = subledgerChecks.find((check) => check.count > 0);
      if (existingSubledger) {
        throw new ActionError(
          `Ya existen ${existingSubledger.label}; usa la apertura contable de empresa existente`,
          'INITIALIZATION_NOT_EMPTY',
        );
      }
      const valued = valueOpeningAccounts(parsed);
      const inventory = parsed.inventario?.length
        ? await persistInitialInventory(tx, {
          tenantId,
          inicializacionId,
          fechaCorte: parsed.fechaCorte,
          monedaFuncional: functionalCurrency,
          tasas: parsed.tasas,
          inventario: parsed.inventario,
        })
        : { count: 0, totalFuncional: '0', fuentes: [], filas: [] };
      const entryLines = buildOpeningEntryLines({
        cuentas: parsed.cuentas,
        valued,
        monedaFuncional: functionalCurrency,
        initialInventoryTotalFuncional: inventory.totalFuncional,
      });
      const periodo = await ensureCutoffPeriod(tx, { tenantId, fechaCorte: parsed.fechaCorte, actor: user.userId });
      const bancosCuentaId = await resolveRoleAccountId(tx, tenantId, 'BANCOS').catch(() => null);
      const createdAccounts: Array<{ cuentaId: string; nombreCuenta: string; saldo: number; moneda: string; cuentaContableInicialId: string | null }> = [];
      const asientos: OpeningAsientoRef[] = [];
      for (const [index, item] of parsed.cuentas.entries()) {
        const openingBalance = Number(item.saldoInicial);
        const isAdvance = item.origen?.tipo === 'ANTICIPO';
        const created = await tx.cuentaBancaria.create({
          data: {
            nombreCuenta: item.nombreCuenta,
            nombreBanco: item.nombreBanco,
            numeroCuenta: item.numeroCuenta,
            tipoCuenta: item.tipoCuenta,
            saldo: isAdvance ? 0 : openingBalance,
            moneda: item.moneda,
            isActive: true,
            tenantId,
            cuentaContableInicialId: bancosCuentaId,
          },
          select: CUENTA_SELECT,
        });

        if (openingBalance > 0 && item.origen) {
          // Bloqueado hasta la tarea 5: el rechazo temprano de ANTICIPO impide llegar aquí.
          if (item.origen.tipo === 'ANTICIPO') {
            if (!item.origen.tipoPagoId) {
              throw new ActionError('Selecciona el tipo de pago para registrar el anticipo', 'TIPO_PAGO_REQUERIDO');
            }
            const anticipo = await tx.anticipo.create({
              data: {
                tenantId,
                tipo: 'COBRO',
                estado: 'RESERVADO',
                montoOriginal: openingBalance,
                montoFinanciado: 0,
                saldoDisponible: 0,
                moneda: item.moneda,
                cuentaOrigenId: created.cuentaId,
                referenciaExterna: `SALDO_INICIAL:${parsed.idempotencyKey}:${index}`,
                createdById: user.userId,
              },
              select: { anticipoId: true },
            });
            await tx.anticipoMovimiento.create({
              data: {
                anticipoId: anticipo.anticipoId,
                tipoMovimiento: 'CREACION_RESERVA',
                monto: openingBalance,
                moneda: item.moneda,
                saldoAntes: 0,
                saldoDespues: 0,
                usuarioId: user.userId,
              },
            });
            const movementKey = `init:${createHash('sha256')
              .update(`${parsed.idempotencyKey}:${index}`).digest('hex').slice(0, 48)}`;
            const movement = await registrarMovimientoEfectivoAnticipo(tx, {
              anticipoId: anticipo.anticipoId,
              tenantId,
              cuentaId: created.cuentaId,
              tipoPagoId: item.origen.tipoPagoId,
              monto: openingBalance,
              idempotencyKey: movementKey,
              usuarioId: user.userId,
              observaciones: `Saldo inicial recibido de ${item.origen.tercero}`,
            });
            asientos.push({ tipo: 'ANTICIPO', asientoId: null, estado: movement.idempotentReplay ? 'YA_EXISTENTE' : 'EMITIDO_POR_FLUJO', referencia: movementKey });
            await AuditLogService.logStrict({
              accion: 'CREATE', entidad: 'ANTICIPO', entidadId: anticipo.anticipoId,
              usuarioId: user.userId,
              detalles: { origen: 'INICIALIZACION_CONTABLE', cuentaId: created.cuentaId, monto: openingBalance, moneda: item.moneda },
            }, tx);
          } else {
            const isCapital = item.origen.tipo === 'CAPITAL_SOCIAL';
            const resolvedRate = valued[index].tasaCambio;
            const counterpart = await tx.inyeccionCapital.create({
              data: {
                tenantId,
                tipo: isCapital ? 'CAPITAL_SOCIAL' : 'DEUDA_EXTERNA',
                montoRecibido: openingBalance,
                moneda: item.moneda,
                tasaCambio: resolvedRate,
                cuentaId: created.cuentaId,
                socio: isCapital ? item.origen.tercero : null,
                entidadPrestamista: isCapital ? null : item.origen.tercero,
                montoTotalDeuda: isCapital ? null : openingBalance,
                saldoPendiente: isCapital ? null : openingBalance,
                estado: isCapital ? null : 'ACTIVA',
                idempotencyKey: movementKeyFor(parsed.idempotencyKey, index),
                descripcion: 'Contrapartida del saldo inicial de la cuenta bancaria',
                fechaRegistro: fechaCorteDate,
              },
              select: { id: true, fechaRegistro: true },
            });
            const posting = await emitirInyeccionCapital(tx, { tenantId, userId: user.userId }, {
              inyeccionId: counterpart.id,
              fecha: fechaCorteDate,
              monto: openingBalance,
              moneda: item.moneda,
              tasaCambio: resolvedRate,
              referencia: movementKeyFor(parsed.idempotencyKey, index),
              descripcion: 'Contrapartida del saldo inicial de la cuenta bancaria',
              tipo: isCapital ? 'CAPITAL_SOCIAL' : 'DEUDA_EXTERNA',
            });
            if (posting.estado !== 'CONTABILIZADO' && posting.estado !== 'YA_EXISTENTE') {
              throw new ActionError(
                `La contrapartida de ${isCapital ? 'capital social' : 'préstamo'} no se contabilizó (estado ${posting.estado}); la apertura no puede completarse sin su asiento formal`,
                'INITIALIZATION_POSTING_NO_CONFIRMADO',
              );
            }
            asientos.push({ tipo: 'INYECCION_CAPITAL', asientoId: posting.asientoId ?? null, estado: posting.estado, referencia: movementKeyFor(parsed.idempotencyKey, index) });
            await AuditLogService.logStrict({
              accion: 'CREATE', entidad: 'INYECCION_CAPITAL', entidadId: counterpart.id,
              usuarioId: user.userId,
              detalles: {
                origen: 'INICIALIZACION_CONTABLE', cuentaId: created.cuentaId,
                tipo: isCapital ? 'CAPITAL_SOCIAL' : 'DEUDA_EXTERNA', monto: openingBalance, moneda: item.moneda,
              },
            }, tx);
          }
        }

        await AuditLogService.logStrict({
          accion: 'CREATE',
          entidad: 'CUENTA_BANCARIA',
          entidadId: created.cuentaId,
          usuarioId: user.userId,
          detalles: {
            origen: 'INICIALIZACION_CONTABLE',
            nombreCuenta: item.nombreCuenta,
            moneda: item.moneda,
            saldoInicial: openingBalance,
            fuenteSaldoInicial: item.origen?.tipo ?? null,
          },
        }, tx);
        createdAccounts.push({ cuentaId: created.cuentaId, nombreCuenta: item.nombreCuenta, saldo: openingBalance, moneda: item.moneda, cuentaContableInicialId: bancosCuentaId });
      }
      const openingEntry = await postOpeningEntry(tx, {
        tenantId, userId: user.userId, periodoId: periodo.periodoId,
        fechaCorte: parsed.fechaCorte, idempotencyKey: parsed.idempotencyKey, lines: entryLines.lines,
      });
      if (openingEntry) {
        asientos.unshift({ tipo: 'APERTURA', asientoId: openingEntry.asientoId, estado: 'CONTABILIZADO', referencia: parsed.idempotencyKey });
      }
      if (inventory.count > 0) {
        const postedInventoryLines = (openingEntry?.postedLines ?? [])
          .filter((line) => line.rolCuenta === 'INVENTARIOS' && line.lado === 'DEBE');
        const postedInventoryTotal = postedInventoryLines.reduce(
          (total, line) => total.add(new Prisma.Decimal(line.montoFuncional)),
          new Prisma.Decimal(0),
        );
        if (!openingEntry || postedInventoryLines.length === 0 ||
          !postedInventoryTotal.equals(new Prisma.Decimal(inventory.totalFuncional))) {
          throw new ActionError(
            'La valoración del inventario no coincide con el débito del asiento de apertura',
            'INITIALIZATION_INCOMPLETE',
          );
        }

        const functionalRows = (parsed.inventario ?? [])
          .filter((row) => row.moneda === functionalCurrency);
        if (functionalRows.length > 0) {
          const inventoryAccountId = postedInventoryLines[0].cuentaContableId;
          const functionalTotal = inventory.filas
            .filter((row) => row.moneda === functionalCurrency)
            .reduce(
              (total, row) => total.add(new Prisma.Decimal(row.montoFuncional)),
              new Prisma.Decimal(0),
            );
          const linesForReconciliation = functionalRows.length === parsed.inventario?.length
            ? postedInventoryLines.map((line) => ({
              cuentaContableId: line.cuentaContableId,
              moneda: line.moneda,
              debito: line.montoFuncional,
              credito: '0',
            }))
            : [{
              cuentaContableId: inventoryAccountId,
              moneda: functionalCurrency,
              debito: functionalTotal.toString(),
              credito: '0',
            }];
          try {
            reconcileInitialInventory(
              functionalRows.map((row) => ({
                cuentaContableId: inventoryAccountId,
                moneda: row.moneda,
                cantidad: row.cantidad,
                costoUnitario: row.costoUnitario,
              })),
              linesForReconciliation,
            );
          } catch {
            throw new ActionError(
              'El inventario no coincide con las líneas de apertura',
              'INITIALIZATION_INCOMPLETE',
            );
          }
        }
      }
      const filasByReferencia = new Map(inventory.filas.map((fila) => [fila.referenciaFila, fila]));
      const detalleInventario = {
        count: inventory.count,
        totalFuncional: inventory.totalFuncional,
        fuentes: inventory.fuentes.map((fuente) => {
          const fila = filasByReferencia.get(fuente.referenciaFila);
          const row = (parsed.inventario ?? []).find((r) => r.referenciaFila === fuente.referenciaFila);
          return {
            referenciaFila: fuente.referenciaFila,
            fuenteId: fuente.fuenteId,
            loteId: fuente.loteId,
            productoId: row?.productoId ?? '',
            cantidad: row?.cantidad ?? '',
            costoUnitario: row?.costoUnitario ?? '',
            moneda: fila?.moneda ?? row?.moneda ?? '',
            montoFuncional: fila?.montoFuncional ?? '0',
          };
        }),
      };
      await createInitializationApertura(tx, {
        periodoId: periodo.periodoId, tenantId, actor: user.userId,
        idempotencyKey: parsed.idempotencyKey, payloadHash,
        fechaCorte: parsed.fechaCorte, monedaFuncional: functionalCurrency,
        asientoId: openingEntry?.asientoId ?? null, asientos,
        lines: openingEntry?.postedLines ?? [],
        fxFingerprints: [...new Set(valued.map((v) => v.fxEvidenceFingerprint).filter((f): f is string => f !== null))],
        cuentas: createdAccounts.map((cuenta, i) => ({
          cuentaBancariaId: cuenta.cuentaId,
          numeroCuenta: parsed.cuentas[i].numeroCuenta,
          moneda: cuenta.moneda,
          saldoOriginal: parsed.cuentas[i].saldoInicial,
          montoFuncional: new Prisma.Decimal(valued[i].montoFuncional).toString(),
          cuentaContableInicialId: cuenta.cuentaContableInicialId,
        })),
        inventario: detalleInventario,
        totalDebeFuncional: entryLines.totalDebeFuncional,
        totalHaberFuncional: entryLines.totalHaberFuncional,
      });
      return {
        cuentas: createdAccounts,
        periodoId: periodo.periodoId,
        asientoId: openingEntry?.asientoId ?? null,
        asientos,
        lineas: openingEntry?.postedLines ?? [],
        totalDebeFuncional: entryLines.totalDebeFuncional,
        totalHaberFuncional: entryLines.totalHaberFuncional,
        fechaCorte: parsed.fechaCorte,
        monedaFuncional: functionalCurrency,
        inventario: inventory,
      };
    });

    if (result.replayed) {
      await verifyInitializationReplay({ tenantId, idempotencyKey: parsed.idempotencyKey, payloadHash });
    }
    revalidatePath('/busy/contabilidad/cuentas');
    revalidatePath('/busy/contabilidad/anticipos');
    return result;
  },
);

/**
 * @description Genera una referencia determinista y acotada por origen del onboarding.
 * @param idempotencyKey - Clave principal de la inicialización.
 * @param index - Posición estable de la cuenta en la solicitud normalizada.
 * @returns Referencia SHA-256 compatible con los límites de almacenamiento.
 */
function movementKeyFor(idempotencyKey: string, index: number): string {
  return `init:${createHash('sha256').update(`${idempotencyKey}:${index}`).digest('hex').slice(0, 48)}`;
}

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
      ...(data.nombreCuenta !== undefined && { nombreCuenta: data.nombreCuenta || null }),
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
