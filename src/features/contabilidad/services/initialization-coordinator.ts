import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { insertarAsientoConNumeracion } from '@/features/contabilidad-formal/services/posting-engine';
import { PeriodoError } from '@/lib/services/periodo-contable-types';
import type { RolCuenta } from '@/generated/prisma';
import type { OpeningEntryLine } from './initialization-opening-lines';

export type PostedOpeningLine = OpeningEntryLine & {
  cuentaContableId: string;
};

export type OpeningAsientoRef = {
  tipo: 'APERTURA' | 'INYECCION_CAPITAL' | 'ANTICIPO';
  asientoId: string | null;
  estado: string;
  referencia: string;
};

export type InitializationResult = {
  cuentas: Array<{ cuentaId: string; nombreCuenta: string; saldo: number; moneda: string; cuentaContableInicialId: string | null }>;
  periodoId: string;
  asientoId: string | null;
  asientos: OpeningAsientoRef[];
  lineas: PostedOpeningLine[];
  totalDebeFuncional: string;
  totalHaberFuncional: string;
  fechaCorte: string;
  monedaFuncional: string;
};

export function parseCutoffDate(fechaCorte: string): Date {
  const [year, month, day] = fechaCorte.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * @description Resuelve la cuenta contable del tenant para un rol del plan.
 * Falla cerrado si el rol no está configurado.
 */
export async function resolveRoleAccountId(
  tx: Prisma.TransactionClient,
  tenantId: string,
  rol: RolCuenta,
): Promise<string> {
  const mapping = await tx.cuentaRolTenant.findUnique({
    where: { tenantId_rol: { tenantId, rol } },
    select: { cuentaId: true },
  });
  if (!mapping) {
    throw new ActionError(
      `El plan de cuentas no tiene configurado el rol ${rol}`,
      'CUENTA_ROL_NO_CONFIGURADA',
    );
  }
  return mapping.cuentaId;
}

/**
 * @description Contabiliza el asiento de apertura con las líneas de saldos no
 * documentados (débito a Bancos, crédito a Resultados acumulados). Las líneas
 * de capital, deuda y anticipo las contabilizan sus propios flujos y no se
 * repiten aquí. Sin líneas no documentadas no hay asiento.
 */
export async function postOpeningEntry(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    userId: string;
    periodoId: string;
    fechaCorte: string;
    idempotencyKey: string;
    lines: OpeningEntryLine[];
  },
): Promise<{ asientoId: string; postedLines: PostedOpeningLine[] } | null> {
  const undocumentedIndexes = new Set(
    input.lines.filter((line) => line.rolCuenta === 'RESULTADOS_ACUMULADOS').map((line) => line.index),
  );
  const lines = input.lines.filter((line) => undocumentedIndexes.has(line.index));
  if (lines.length === 0) return null;
  const diario = await tx.diario.findFirst({
    where: { tenantId: input.tenantId, tipo: 'APERTURA_CIERRE', activo: true },
    select: { diarioId: true },
  });
  if (!diario) {
    throw new ActionError('No existe un diario de apertura/cierre activo', 'DIARIO_NO_ENCONTRADO');
  }
  const [bancosId, resultadosId] = await Promise.all([
    resolveRoleAccountId(tx, input.tenantId, 'BANCOS'),
    resolveRoleAccountId(tx, input.tenantId, 'RESULTADOS_ACUMULADOS'),
  ]);
  const postedLines: PostedOpeningLine[] = lines.map((line) => ({
    ...line,
    cuentaContableId: line.rolCuenta === 'BANCOS' ? bancosId : resultadosId,
  }));
  const { asientoId } = await insertarAsientoConNumeracion(tx, { tenantId: input.tenantId, userId: input.userId }, {
    diarioId: diario.diarioId,
    periodoId: input.periodoId,
    fecha: parseCutoffDate(input.fechaCorte),
    descripcion: 'Asiento de apertura de inicialización',
    origenTipo: 'inicializacion_contable',
    origenId: input.idempotencyKey,
    createdBy: input.userId,
    lineas: postedLines.map((line, order) => ({
      orden: order + 1,
      cuentaId: line.cuentaContableId,
      debe: new Prisma.Decimal(line.lado === 'DEBE' ? line.montoFuncional : 0),
      haber: new Prisma.Decimal(line.lado === 'HABER' ? line.montoFuncional : 0),
      monedaOriginal: line.moneda,
      montoOriginal: new Prisma.Decimal(line.montoOriginal),
      tasaCambio: line.tasaCambio === null ? null : new Prisma.Decimal(line.tasaCambio),
      fxEvidenceFingerprint: line.fxEvidenceFingerprint,
      referencia: `Apertura ${line.numeroCuenta}`,
    })),
  });
  return { asientoId, postedLines };
}

export interface InitializationAperturaInput {
  periodoId: string;
  tenantId: string;
  actor: string;
  idempotencyKey: string;
  payloadHash: string;
  fechaCorte: string;
  monedaFuncional: string;
  asientoId: string | null;
  asientos: OpeningAsientoRef[];
  lines: PostedOpeningLine[];
  fxFingerprints: string[];
  cuentas: Array<{
    cuentaBancariaId: string;
    numeroCuenta: string;
    moneda: string;
    saldoOriginal: string;
    montoFuncional: string;
    cuentaContableInicialId: string | null;
  }>;
  totalDebeFuncional: string;
  totalHaberFuncional: string;
}

/**
 * @description Persiste la apertura de la inicialización con su evidencia:
 * clave y hash del payload, asiento de apertura, asientos de cada pierna y
 * líneas valoradas. Es el equivalente coordinado de createManualApertura.
 */
export async function createInitializationApertura(
  tx: Prisma.TransactionClient,
  input: InitializationAperturaInput,
) {
  const periodo = await tx.periodoContable.findFirst({
    where: { periodoId: input.periodoId, tenantId: input.tenantId },
    select: { periodoId: true },
  });
  if (!periodo) {
    throw new PeriodoError('Período no encontrado para crear apertura.', 'PERIODO_NO_EXISTE');
  }
  const exists = await tx.aperturaPeriodo.findUnique({ where: { periodoId: input.periodoId } });
  if (exists) {
    throw new PeriodoError('El período ya tiene una apertura.', 'PERIODO_YA_ABIERTO');
  }
  return tx.aperturaPeriodo.create({
    data: {
      periodoId: input.periodoId,
      tenantId: input.tenantId,
      detalleJson: {
        version: 1,
        origen: 'INICIALIZACION_CONTABLE',
        idempotencyKey: input.idempotencyKey,
        payloadHash: input.payloadHash,
        fechaCorte: input.fechaCorte,
        monedaFuncional: input.monedaFuncional,
        asientoId: input.asientoId,
        asientos: input.asientos,
        lineas: input.lines,
        fxFingerprints: input.fxFingerprints,
        cuentas: input.cuentas,
        totalDebeFuncional: input.totalDebeFuncional,
        totalHaberFuncional: input.totalHaberFuncional,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

const incompleteError = () =>
  new ActionError(
    'La inicialización anterior no tiene evidencia verificable de sus cuentas y asientos',
    'INITIALIZATION_INCOMPLETE',
  );

function decimalEquals(left: unknown, right: unknown): boolean {
  if (left === null || left === undefined) return right === null || right === undefined;
  if (right === null || right === undefined) return false;
  try {
    return new Prisma.Decimal(String(left)).equals(new Prisma.Decimal(String(right)));
  } catch {
    return false;
  }
}

/**
 * @description Re-verifica en solo lectura una inicialización completada: fila
 * y hash, período, apertura con su detalle, asiento de apertura línea a línea
 * y cuentas con su saldo y su cuenta contable inicial. Cualquier diferencia
 * rechaza el replay como incompleto, sin escribir nada.
 */
export async function verifyInitializationReplay(input: {
  tenantId: string;
  idempotencyKey: string;
  payloadHash: string;
}): Promise<void> {
  const row = await prisma.inicializacionContable.findFirst({ where: { tenantId: input.tenantId } });
  if (!row || row.idempotencyKey !== input.idempotencyKey || row.payloadHash !== input.payloadHash ||
    row.estado !== 'COMPLETADA' || !row.resultado || typeof row.resultado !== 'object' || Array.isArray(row.resultado)) {
    throw incompleteError();
  }
  const stored = row.resultado as Record<string, unknown>;
  if (typeof stored.periodoId !== 'string' || !Array.isArray(stored.cuentas) || !Array.isArray(stored.asientos)) {
    throw incompleteError();
  }
  const periodo = await prisma.periodoContable.findUnique({ where: { periodoId: stored.periodoId as string } });
  if (!periodo || periodo.tenantId !== input.tenantId) throw incompleteError();
  const apertura = await prisma.aperturaPeriodo.findUnique({ where: { periodoId: stored.periodoId as string } });
  const detalle = apertura?.detalleJson as Record<string, unknown> | null;
  if (!apertura || apertura.tenantId !== input.tenantId || !detalle || detalle.origen !== 'INICIALIZACION_CONTABLE' ||
    detalle.idempotencyKey !== input.idempotencyKey || detalle.payloadHash !== input.payloadHash) {
    throw incompleteError();
  }
  const storedLines = (stored.lineas ?? detalle!.lineas) as PostedOpeningLine[] | undefined;
  if (typeof stored.asientoId === 'string' && stored.asientoId) {
    const asiento = await prisma.asiento.findUnique({
      where: { asientoId: stored.asientoId as string },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    if (!asiento || asiento.tenantId !== input.tenantId || asiento.origenTipo !== 'inicializacion_contable' ||
      asiento.origenId !== input.idempotencyKey || !Array.isArray(storedLines) || asiento.lineas.length !== storedLines.length) {
      throw incompleteError();
    }
    for (const [order, line] of (storedLines as PostedOpeningLine[]).entries()) {
      const persisted = asiento.lineas[order];
      const expectedDebe = line.lado === 'DEBE' ? line.montoFuncional : '0';
      const expectedHaber = line.lado === 'HABER' ? line.montoFuncional : '0';
      if (persisted.cuentaId !== line.cuentaContableId ||
        !decimalEquals(persisted.debe, expectedDebe) || !decimalEquals(persisted.haber, expectedHaber) ||
        persisted.monedaOriginal !== line.moneda || !decimalEquals(persisted.montoOriginal, line.montoOriginal) ||
        !decimalEquals(persisted.tasaCambio, line.tasaCambio) ||
        persisted.fxEvidenceFingerprint !== line.fxEvidenceFingerprint) {
        throw incompleteError();
      }
    }
  }
  for (const cuenta of stored.cuentas as Array<Record<string, unknown>>) {
    if (typeof cuenta.cuentaId !== 'string') throw incompleteError();
    const persisted = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: cuenta.cuentaId as string } });
    if (!persisted || persisted.tenantId !== input.tenantId || Number(persisted.saldo) !== Number(cuenta.saldo) ||
      persisted.moneda !== cuenta.moneda ||
      (cuenta.cuentaContableInicialId != null && persisted.cuentaContableInicialId !== cuenta.cuentaContableInicialId)) {
      throw incompleteError();
    }
  }
  for (const ref of stored.asientos as OpeningAsientoRef[]) {
    if (ref.estado === 'CONTABILIZADO' && ref.asientoId) {
      const asiento = await prisma.asiento.findUnique({ where: { asientoId: ref.asientoId } });
      if (!asiento || asiento.tenantId !== input.tenantId) throw incompleteError();
    }
    if (ref.tipo === 'INYECCION_CAPITAL' && ref.estado === 'CONTABILIZADO') {
      const inyeccion = await prisma.inyeccionCapital.findFirst({ where: { tenantId: input.tenantId, idempotencyKey: ref.referencia } });
      if (!inyeccion) throw incompleteError();
    }
    if (ref.tipo === 'ANTICIPO') {
      const movimiento = await prisma.anticipoMovimiento.findFirst({ where: { idempotencyKey: ref.referencia } });
      if (!movimiento) throw incompleteError();
    }
  }
}
