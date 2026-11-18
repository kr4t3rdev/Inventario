import { hashInitialInventoryEvidence } from './initial-inventory-evidence';
import { verifyAppliedFxEvidence } from '../domain/fx-evidence';
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
 * @description Contabiliza el asiento de apertura con líneas de saldos no
 * documentados y activos operativos iniciales. Las líneas de capital, deuda y
 * anticipo las contabilizan sus propios flujos y no se repiten aquí.
 * Sin líneas coordinadas no hay asiento.
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
  const requiredRoles = new Set(lines.map((line) => line.rolCuenta));
  const roleAccountIds = new Map<RolCuenta, string>();
  await Promise.all([...requiredRoles].map(async (role) => {
    roleAccountIds.set(role, await resolveRoleAccountId(tx, input.tenantId, role));
  }));
  const postedLines: PostedOpeningLine[] = lines.map((line) => ({
    ...line,
    cuentaContableId: roleAccountIds.get(line.rolCuenta) as string,
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

export interface InitialInventoryDetailSource {
  referenciaFila: string;
  fuenteId: string;
  loteId: string;
  productoId: string;
  cantidad: string;
  costoUnitario: string;
  moneda: string;
  montoFuncional: string;
}

export interface InitialInventoryDetail {
  count: number;
  totalFuncional: string;
  fuentes: InitialInventoryDetailSource[];
}

export interface InitialSubledgerDetailRow {
  referenciaFila: string;
  clienteId?: string;
  proveedorId?: string;
  moneda: string;
  montoOriginal: string;
  montoFuncional: string;
  fxEvidenceFingerprint: string | null;
}

export interface InitialSubledgerDetailSection {
  count: number;
  totalFuncional: string;
  filas: InitialSubledgerDetailRow[];
}

export interface InitialSubledgerDetail {
  cuentasPorCobrar: InitialSubledgerDetailSection;
  cuentasPorPagar: InitialSubledgerDetailSection;
}

export type InitialDebtDetail = {
  cuentaPorPagarId: string;
  deudaCashId: string;
  inyeccionId: string;
  proveedorId: string;
  moneda: string;
  montoOriginal: string;
  montoFuncional: string;
};

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
  inventario?: InitialInventoryDetail;
  subledger?: InitialSubledgerDetail;
  deudas?: InitialDebtDetail[];
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
        inventario: input.inventario ?? null,
        subledger: input.subledger ?? null,
        deudas: input.deudas ?? null,
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
 * y hash, período, apertura con su detalle, asiento de apertura línea a línea,
 * identidad de las cuentas contra el detalle (número, moneda, cuenta contable
 * inicial) y totales por moneda contra la evidencia inmutable (líneas DEBE del
 * asiento + inyecciones). El saldo operativo vivo no se compara: un cobro o pago
 * posterior no invalida el replay. Cualquier diferencia rechaza el replay como
 * incompleto, sin escribir nada.
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
  const detalleCuentas = detalle.cuentas as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(detalleCuentas)) throw incompleteError();
  const detalleByCuentaId = new Map(
    detalleCuentas
      .filter((cuenta) => typeof cuenta.cuentaBancariaId === 'string')
      .map((cuenta) => [cuenta.cuentaBancariaId as string, cuenta]),
  );
  const postedByCurrency = new Map<string, Prisma.Decimal>();
  for (const line of (storedLines ?? []) as PostedOpeningLine[]) {
    if (line.lado !== 'DEBE') continue;
    const moneda = String(line.moneda);
    const current = postedByCurrency.get(moneda) ?? new Prisma.Decimal(0);
    postedByCurrency.set(moneda, current.add(new Prisma.Decimal(String(line.montoOriginal))));
  }
  for (const cuenta of stored.cuentas as Array<Record<string, unknown>>) {
    if (typeof cuenta.cuentaId !== 'string') throw incompleteError();
    const persisted = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: cuenta.cuentaId as string } });
    if (!persisted || persisted.tenantId !== input.tenantId || persisted.moneda !== cuenta.moneda ||
      (cuenta.nombreCuenta != null && persisted.nombreCuenta !== cuenta.nombreCuenta) ||
      (cuenta.cuentaContableInicialId != null && persisted.cuentaContableInicialId !== cuenta.cuentaContableInicialId)) {
      throw incompleteError();
    }
    const detalleCuenta = detalleByCuentaId.get(cuenta.cuentaId as string);
    if (!detalleCuenta || detalleCuenta.numeroCuenta !== persisted.numeroCuenta ||
      !decimalEquals(detalleCuenta.saldoOriginal, cuenta.saldo)) {
      throw incompleteError();
    }
  }
  const storedInventory = stored.inventario;
  if (storedInventory !== undefined) {
    if (!storedInventory || typeof storedInventory !== 'object' || Array.isArray(storedInventory)) {
      throw incompleteError();
    }
    const inventory = storedInventory as Record<string, unknown>;
    if (typeof inventory.count !== 'number' || typeof inventory.totalFuncional !== 'string') {
      throw incompleteError();
    }
    const sources = await prisma.inventarioInicialFuente.findMany({
      where: { tenantId: input.tenantId, inicializacionId: row.inicializacionId },
      select: { id: true, loteId: true, productoId: true, montoFuncional: true, evidencia: true, evidenciaHash: true },
    });
    const total = sources.reduce(
      (sum, source) => sum.plus(source.montoFuncional),
      new Prisma.Decimal(0),
    );
    if (sources.length !== inventory.count ||
      !total.equals(new Prisma.Decimal(inventory.totalFuncional))) {
      throw incompleteError();
    }
    for (const source of sources) {
      // Hash canónico: jsonb reordena las claves al leer, así que el hash
      // se calcula sobre la representación ordenada, igual que al crear.
      const evidenceHash = hashInitialInventoryEvidence(source.evidencia as Record<string, unknown>);
      if (evidenceHash !== source.evidenciaHash) throw incompleteError();
    }
    // El detalle ancla la identidad de cada fuente (producto, lote, cantidad,
    // costo, moneda, fecha de corte) contra una copia independiente de la
    // evidencia viva: si una fuente se manipula tras la apertura, el replay
    // lo detecta aunque el total y el hash sigan intactos.
    const detalleInventory = detalle.inventario as
      | { count?: unknown; totalFuncional?: unknown; fuentes?: unknown }
      | null
      | undefined;
    if (detalleInventory != null) {
      if (typeof detalleInventory !== 'object' || Array.isArray(detalleInventory) ||
        typeof detalleInventory.count !== 'number' ||
        typeof detalleInventory.totalFuncional !== 'string' ||
        !Array.isArray(detalleInventory.fuentes)) {
        throw incompleteError();
      }
      const detalleFuentes = detalleInventory.fuentes as Array<Record<string, unknown>>;
      if (detalleFuentes.length !== detalleInventory.count || sources.length !== detalleInventory.count) {
        throw incompleteError();
      }
      const totalDetalle = sources.reduce(
        (sum, source) => sum.plus(source.montoFuncional),
        new Prisma.Decimal(0),
      );
      if (!totalDetalle.equals(new Prisma.Decimal(detalleInventory.totalFuncional))) {
        throw incompleteError();
      }
      const sourceById = new Map(sources.map((source) => [source.id, source]));
      for (const fuente of detalleFuentes) {
        if (typeof fuente.fuenteId !== 'string') throw incompleteError();
        const source = sourceById.get(fuente.fuenteId);
        if (!source) throw incompleteError();
        const evidencia = source.evidencia as Record<string, unknown> | null;
        if (!evidencia || typeof evidencia !== 'object' || Array.isArray(evidencia) ||
          source.loteId !== fuente.loteId || source.productoId !== fuente.productoId ||
          evidencia.referenciaFila !== fuente.referenciaFila ||
          evidencia.cantidad !== fuente.cantidad ||
          evidencia.costoUnitario !== fuente.costoUnitario ||
          evidencia.monedaOriginal !== fuente.moneda ||
          !decimalEquals(evidencia.montoFuncional, fuente.montoFuncional) ||
          evidencia.fechaCorte !== detalle.fechaCorte) {
          throw incompleteError();
        }
      }
    }
  }
  const storedSubledger = stored.subledger as Record<string, unknown> | undefined;
  if (storedSubledger !== undefined) {
    if (!storedSubledger || typeof storedSubledger !== 'object' || Array.isArray(storedSubledger)) {
      throw incompleteError();
    }
    const sections = [
      { key: 'cuentasPorCobrar', model: 'receivable' },
      { key: 'cuentasPorPagar', model: 'payable' },
    ] as const;
    for (const { key, model } of sections) {
      const section = storedSubledger[key] as Record<string, unknown> | undefined;
      if (!section || typeof section !== 'object' || Array.isArray(section) ||
        typeof section.count !== 'number' || typeof section.totalFuncional !== 'string' ||
        !Array.isArray(section.filas)) {
        throw incompleteError();
      }
      const live = model === 'receivable'
        ? await prisma.cuentaPorCobrar.findMany({
          where: { tenantId: input.tenantId, inicializacionId: row.inicializacionId },
          select: {
            referenciaInicial: true, clienteId: true, monedaOriginal: true, monedaFuncional: true,
            montoDeuda: true, montoDeudaFuncional: true, tasaCambio: true, rateEffectiveAt: true,
            fxProvenanceKind: true, fxProvenanceSource: true, fxCatalogRateId: true,
            fxEvidenceFingerprint: true, fxEvidenceVersion: true,
          },
        })
        : await prisma.cuentaPorPagar.findMany({
          where: { tenantId: input.tenantId, inicializacionId: row.inicializacionId, deudaCash: { is: null } },
          select: {
            referenciaInicial: true, proveedorId: true, monedaOriginal: true, monedaFuncional: true,
            montoDeuda: true, montoDeudaFuncional: true, tasaCambio: true, rateEffectiveAt: true,
            fxProvenanceKind: true, fxProvenanceSource: true, fxCatalogRateId: true,
            fxEvidenceFingerprint: true, fxEvidenceVersion: true,
          },
        });
      const total = live.reduce(
        (sum, item) => sum.plus(new Prisma.Decimal(item.montoDeudaFuncional?.toString() ?? 0)),
        new Prisma.Decimal(0),
      );
      if (live.length !== section.count ||
        !total.equals(new Prisma.Decimal(String(section.totalFuncional)))) {
        throw incompleteError();
      }
      // La identidad de cada fila (tercero, moneda, montos, huella FX) se
      // ancla en el detalle; el saldo vivo no se compara: un cobro o pago
      // posterior no invalida el replay.
      const detalleSubledger = detalle.subledger as
        | { cuentasPorCobrar?: unknown; cuentasPorPagar?: unknown }
        | null
        | undefined;
      const detalleSection = detalleSubledger?.[key] as
        | { count?: unknown; totalFuncional?: unknown; filas?: unknown }
        | null
        | undefined;
      if (detalleSection != null) {
        if (typeof detalleSection !== 'object' || Array.isArray(detalleSection) ||
          typeof detalleSection.count !== 'number' ||
          typeof detalleSection.totalFuncional !== 'string' ||
          !Array.isArray(detalleSection.filas)) {
          throw incompleteError();
        }
        const detalleFilas = detalleSection.filas as Array<Record<string, unknown>>;
        if (detalleFilas.length !== detalleSection.count || live.length !== detalleSection.count ||
          !total.equals(new Prisma.Decimal(String(detalleSection.totalFuncional)))) {
          throw incompleteError();
        }
        const liveByReferencia = new Map(live.map((item) => [item.referenciaInicial, item]));
        for (const fila of detalleFilas) {
          if (typeof fila.referenciaFila !== 'string') throw incompleteError();
          const item = liveByReferencia.get(fila.referenciaFila);
          if (!item) throw incompleteError();
          const tercero = model === 'receivable'
            ? (item as { clienteId: string }).clienteId
            : (item as { proveedorId: string }).proveedorId;
          const terceroDetalle = model === 'receivable' ? fila.clienteId : fila.proveedorId;
          if (tercero !== terceroDetalle || item.monedaOriginal !== fila.moneda ||
            !decimalEquals(item.montoDeuda, fila.montoOriginal) ||
            !decimalEquals(item.montoDeudaFuncional, fila.montoFuncional) ||
            item.fxEvidenceFingerprint !== fila.fxEvidenceFingerprint) {
            throw incompleteError();
          }
          if (!verifyAppliedFxEvidence({
            originalAmount: Number(item.montoDeuda),
            originalCurrency: item.monedaOriginal ?? '',
            functionalCurrency: item.monedaFuncional ?? '',
            convertedAmount: Number(item.montoDeudaFuncional ?? 0),
            exchangeRate: item.tasaCambio === null ? null : Number(item.tasaCambio),
            rateEffectiveAt: item.rateEffectiveAt,
            fxProvenanceKind: item.fxProvenanceKind,
            fxProvenanceSource: item.fxProvenanceSource,
            fxCatalogRateId: item.fxCatalogRateId,
            fxEvidenceFingerprint: item.fxEvidenceFingerprint,
            fxEvidenceVersion: item.fxEvidenceVersion,
          })) {
            throw incompleteError();
          }
        }
      }
    }
  }
  const storedDeudas = stored.deudas as Array<Record<string, unknown>> | undefined;
  if (storedDeudas !== undefined) {
    if (!Array.isArray(storedDeudas)) throw incompleteError();
    const detalleDeudas = detalle.deudas as Array<Record<string, unknown>> | null | undefined;
    if (detalleDeudas == null || !Array.isArray(detalleDeudas) || detalleDeudas.length !== storedDeudas.length) {
      throw incompleteError();
    }
    for (const deuda of detalleDeudas) {
      if (typeof deuda.cuentaPorPagarId !== 'string' || typeof deuda.deudaCashId !== 'string' ||
        typeof deuda.inyeccionId !== 'string' || typeof deuda.proveedorId !== 'string' ||
        typeof deuda.moneda !== 'string' || typeof deuda.montoOriginal !== 'string' ||
        typeof deuda.montoFuncional !== 'string') {
        throw incompleteError();
      }
      const cxp = await prisma.cuentaPorPagar.findFirst({
        where: { cuentaPorPagarId: deuda.cuentaPorPagarId, tenantId: input.tenantId },
        select: { proveedorId: true, monedaOriginal: true, montoDeuda: true, montoDeudaFuncional: true, inicializacionId: true },
      });
      if (!cxp || cxp.proveedorId !== deuda.proveedorId || cxp.monedaOriginal !== deuda.moneda ||
        !decimalEquals(cxp.montoDeuda, deuda.montoOriginal) ||
        !decimalEquals(cxp.montoDeudaFuncional, deuda.montoFuncional) ||
        cxp.inicializacionId !== row.inicializacionId) {
        throw incompleteError();
      }
      const wrapper = await prisma.deudaCash.findFirst({
        where: { id: deuda.deudaCashId, tenantId: input.tenantId },
        select: { inyeccionId: true, cuentaPorPagarId: true },
      });
      if (!wrapper || wrapper.inyeccionId !== deuda.inyeccionId ||
        wrapper.cuentaPorPagarId !== deuda.cuentaPorPagarId) {
        throw incompleteError();
      }
      const inyeccion = await prisma.inyeccionCapital.findFirst({
        where: { id: deuda.inyeccionId, tenantId: input.tenantId },
        select: { tipo: true },
      });
      if (!inyeccion || inyeccion.tipo !== 'DEUDA_EXTERNA') throw incompleteError();
    }
  }
  const injectedByCurrency = new Map<string, Prisma.Decimal>();
  const anticipoByCurrency = new Map<string, Prisma.Decimal>();
  for (const ref of stored.asientos as OpeningAsientoRef[]) {
    if (ref.asientoId) {
      const asiento = await prisma.asiento.findUnique({ where: { asientoId: ref.asientoId } });
      if (!asiento || asiento.tenantId !== input.tenantId) throw incompleteError();
    }
    if (ref.tipo === 'INYECCION_CAPITAL' && (ref.estado === 'CONTABILIZADO' || ref.estado === 'YA_EXISTENTE')) {
      const inyeccion = await prisma.inyeccionCapital.findFirst({ where: { tenantId: input.tenantId, idempotencyKey: ref.referencia } });
      if (!inyeccion) throw incompleteError();
      const current = injectedByCurrency.get(inyeccion.moneda) ?? new Prisma.Decimal(0);
      injectedByCurrency.set(inyeccion.moneda, current.add(new Prisma.Decimal(inyeccion.montoRecibido.toString())));
    }
    if (ref.tipo === 'ANTICIPO') {
      const movimiento = await prisma.anticipoMovimiento.findFirst({ where: { idempotencyKey: ref.referencia } });
      if (!movimiento) throw incompleteError();
      // El asiento de apertura excluye los índices de anticipo: su pierna de
      // banco la aporta el evento formal del movimiento, así que su importe
      // suma aquí igual que las inyecciones de capital.
      const currentAnticipo = anticipoByCurrency.get(movimiento.moneda) ?? new Prisma.Decimal(0);
      anticipoByCurrency.set(movimiento.moneda, currentAnticipo.add(new Prisma.Decimal(movimiento.monto.toString())));
    }
  }
  const storedByCurrency = new Map<string, Prisma.Decimal>();
  for (const cuenta of detalleCuentas) {
    const moneda = String(cuenta.moneda);
    const current = storedByCurrency.get(moneda) ?? new Prisma.Decimal(0);
    storedByCurrency.set(moneda, current.add(new Prisma.Decimal(String(cuenta.saldoOriginal))));
  }
  if (storedInventory !== undefined) {
    const monedaFuncional = String(detalle.monedaFuncional);
    const current = storedByCurrency.get(monedaFuncional) ?? new Prisma.Decimal(0);
    storedByCurrency.set(
      monedaFuncional,
      current.add(new Prisma.Decimal(String((storedInventory as Record<string, unknown>).totalFuncional))),
    );
  }
  if (storedSubledger !== undefined) {
    // Cada fila de submayor aporta una pierna DEBE por su importe original:
    // CxC debita CxC y CxP debita Resultados acumulados, ambas en la moneda
    // de la fila. Sin este ajuste el replay rechazaría cualquier carga con
    // submayor por exceso del DEBE contabilizado frente al detalle.
    for (const key of ['cuentasPorCobrar', 'cuentasPorPagar'] as const) {
      const section = storedSubledger[key] as { filas?: Array<Record<string, unknown>> } | undefined;
      for (const fila of section?.filas ?? []) {
        const moneda = String(fila.moneda);
        const current = storedByCurrency.get(moneda) ?? new Prisma.Decimal(0);
        storedByCurrency.set(moneda, current.add(new Prisma.Decimal(String(fila.montoOriginal))));
      }
    }
  }
  for (const [moneda, total] of storedByCurrency) {
    const posted = (postedByCurrency.get(moneda) ?? new Prisma.Decimal(0))
      .add(injectedByCurrency.get(moneda) ?? new Prisma.Decimal(0))
      .add(anticipoByCurrency.get(moneda) ?? new Prisma.Decimal(0));
    if (!total.equals(posted)) throw incompleteError();
  }
}
