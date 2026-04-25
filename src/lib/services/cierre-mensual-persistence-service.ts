import prisma from '@/lib/prisma';

import { buildPeriodCode, TIPO_PERIODO } from '@/lib/services/periodo-contable-service';

interface PersistedPeriodoLike {
  periodoId: string;
  codigo: string;
  tipo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
}

interface PersistedSnapshotLike {
  snapshotId: string;
  periodoId: string;
  version: number;
  resumenJson?: unknown;
}

interface MonthlyPersistenceModels {
  periodoContable: {
    findFirst: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike | null>;
    findMany: (args: Record<string, unknown>) => Promise<Array<PersistedPeriodoLike & { snapshots?: PersistedSnapshotLike[] }>>;
    update: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike>;
  };
  snapshotPeriodo: {
    findFirst: (args: Record<string, unknown>) => Promise<PersistedSnapshotLike | null>;
    create: (args: Record<string, unknown>) => Promise<PersistedSnapshotLike>;
  };
}

export class CierreMensualPersistenceUnavailableError extends Error {
  status: number;
  code: string;

  constructor() {
    super(
      'El runtime Prisma actual no expone PeriodoContable/SnapshotPeriodo. Ejecutá migrate/generate antes de persistir cierres mensuales.'
    );
    this.name = 'CierreMensualPersistenceUnavailableError';
    this.status = 503;
    this.code = 'CIERRE_MENSUAL_PERSISTENCE_UNAVAILABLE';
  }
}

export class MonthlyPeriodNotFoundError extends Error {
  status: number;
  code: string;

  constructor(code: string) {
    super(`No existe un período mensual abierto para ${code}.`);
    this.name = 'MonthlyPeriodNotFoundError';
    this.status = 404;
    this.code = 'PERIODO_MENSUAL_NO_ENCONTRADO';
  }
}

export class MonthlyPeriodDependencyError extends Error {
  status: number;
  code: string;
  blockers: string[];

  constructor(blockers: string[]) {
    super('El cierre mensual tiene diarios dependientes abiertos o sin snapshot.');
    this.name = 'MonthlyPeriodDependencyError';
    this.status = 409;
    this.code = 'CIERRE_MENSUAL_DEPENDENCIAS_ABIERTAS';
    this.blockers = blockers;
  }
}

export interface MonthlyCloseSummary {
  periodo: string;
  diariosConsolidados: number;
  totalVentas: number;
  totalServicios: number;
  totalIngresos: number;
  totalGastosDE: number;
  totalGastosCompra: number;
  totalGastosSalarios: number;
  totalGastos: number;
  diferencia: number;
  ingresosCaja: number;
  egresosCaja: number;
  saldoCajaFinal: number;
  saldoBancoFinal: number;
  saldoCuentasCobrarFinal: number;
  saldoCuentasPagarFinal: number;
  saldoInventarioFinal: number;
  saldoCapitalFinal: number;
  saldoResultadoAcumFinal: number;
}

export interface PersistMonthlyCloseParams {
  fecha: Date;
  usuarioId: string;
}

export interface PersistMonthlyCloseResult {
  periodo: PersistedPeriodoLike;
  snapshot: PersistedSnapshotLike;
  resumen: MonthlyCloseSummary;
  wasCreated: boolean;
}

function normalizeNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolvePersistenceModels(client: unknown): MonthlyPersistenceModels {
  const candidate = client as Record<string, unknown>;
  const periodoContable = candidate.periodoContable as MonthlyPersistenceModels['periodoContable'] | undefined;
  const snapshotPeriodo = candidate.snapshotPeriodo as MonthlyPersistenceModels['snapshotPeriodo'] | undefined;

  if (
    !periodoContable?.findFirst ||
    !periodoContable?.findMany ||
    !periodoContable?.update ||
    !snapshotPeriodo?.findFirst ||
    !snapshotPeriodo?.create
  ) {
    throw new CierreMensualPersistenceUnavailableError();
  }

  return {
    periodoContable,
    snapshotPeriodo,
  };
}

function normalizeDailySummary(summary: unknown): MonthlyCloseSummary | null {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  const candidate = summary as Record<string, unknown>;

  return {
    periodo: String(candidate.fecha ?? ''),
    diariosConsolidados: 1,
    totalVentas: normalizeNumber(candidate.totalVentas),
    totalServicios: normalizeNumber(candidate.totalServicios),
    totalIngresos: normalizeNumber(candidate.totalIngresos),
    totalGastosDE: normalizeNumber(candidate.totalGastosDE),
    totalGastosCompra: normalizeNumber(candidate.totalGastosCompra),
    totalGastosSalarios: normalizeNumber(candidate.totalGastosSalarios),
    totalGastos: normalizeNumber(candidate.totalGastos),
    diferencia: normalizeNumber(candidate.diferencia),
    ingresosCaja: normalizeNumber(candidate.ingresosCaja),
    egresosCaja: normalizeNumber(candidate.egresosCaja),
    saldoCajaFinal: normalizeNumber(candidate.saldoCajaFinal),
    saldoBancoFinal: normalizeNumber(candidate.saldoBancoFinal),
    saldoCuentasCobrarFinal: normalizeNumber(candidate.saldoCuentasCobrarFinal),
    saldoCuentasPagarFinal: normalizeNumber(candidate.saldoCuentasPagarFinal),
    saldoInventarioFinal: normalizeNumber(candidate.saldoInventarioFinal),
    saldoCapitalFinal: normalizeNumber(candidate.saldoCapitalFinal),
    saldoResultadoAcumFinal: normalizeNumber(candidate.saldoResultadoAcumFinal),
  };
}

function consolidateDailySnapshots(
  snapshots: PersistedSnapshotLike[]
): MonthlyCloseSummary {
  const summaries = snapshots
    .map((snapshot) => normalizeDailySummary(snapshot.resumenJson))
    .filter((value): value is MonthlyCloseSummary => value !== null);

  return summaries.reduce<MonthlyCloseSummary>(
    (acc, item) => ({
      periodo: acc.periodo,
      diariosConsolidados: acc.diariosConsolidados + 1,
      totalVentas: acc.totalVentas + item.totalVentas,
      totalServicios: acc.totalServicios + item.totalServicios,
      totalIngresos: acc.totalIngresos + item.totalIngresos,
      totalGastosDE: acc.totalGastosDE + item.totalGastosDE,
      totalGastosCompra: acc.totalGastosCompra + item.totalGastosCompra,
      totalGastosSalarios: acc.totalGastosSalarios + item.totalGastosSalarios,
      totalGastos: acc.totalGastos + item.totalGastos,
      diferencia: acc.diferencia + item.diferencia,
      ingresosCaja: acc.ingresosCaja + item.ingresosCaja,
      egresosCaja: acc.egresosCaja + item.egresosCaja,
      saldoCajaFinal: item.saldoCajaFinal,
      saldoBancoFinal: item.saldoBancoFinal,
      saldoCuentasCobrarFinal: item.saldoCuentasCobrarFinal,
      saldoCuentasPagarFinal: item.saldoCuentasPagarFinal,
      saldoInventarioFinal: item.saldoInventarioFinal,
      saldoCapitalFinal: item.saldoCapitalFinal,
      saldoResultadoAcumFinal: item.saldoResultadoAcumFinal,
    }),
    {
      periodo: '',
      diariosConsolidados: 0,
      totalVentas: 0,
      totalServicios: 0,
      totalIngresos: 0,
      totalGastosDE: 0,
      totalGastosCompra: 0,
      totalGastosSalarios: 0,
      totalGastos: 0,
      diferencia: 0,
      ingresosCaja: 0,
      egresosCaja: 0,
      saldoCajaFinal: 0,
      saldoBancoFinal: 0,
      saldoCuentasCobrarFinal: 0,
      saldoCuentasPagarFinal: 0,
      saldoInventarioFinal: 0,
      saldoCapitalFinal: 0,
      saldoResultadoAcumFinal: 0,
    }
  );
}

export async function persistMonthlyClose(
  params: PersistMonthlyCloseParams
): Promise<PersistMonthlyCloseResult> {
  const txFactory = (prisma as Record<string, unknown>).$transaction as
    | ((callback: (tx: unknown) => Promise<PersistMonthlyCloseResult>) => Promise<PersistMonthlyCloseResult>)
    | undefined;

  if (!txFactory) {
    throw new CierreMensualPersistenceUnavailableError();
  }

  const monthlyCode = buildPeriodCode(TIPO_PERIODO.MENSUAL, params.fecha);

  return txFactory(async (tx: unknown) => {
    const models = resolvePersistenceModels(tx);

    const periodoMensual = await models.periodoContable.findFirst({
      where: { codigo: monthlyCode, tipo: 'MENSUAL' },
    });

    if (!periodoMensual) {
      throw new MonthlyPeriodNotFoundError(monthlyCode);
    }

    const existingSnapshot = await models.snapshotPeriodo.findFirst({
      where: { periodoId: periodoMensual.periodoId },
      orderBy: { version: 'desc' },
    });

    const dailyPeriods = await models.periodoContable.findMany({
      where: {
        tipo: 'DIARIO',
        fechaInicio: { gte: periodoMensual.fechaInicio },
        fechaFin: { lte: periodoMensual.fechaFin },
      },
      orderBy: [{ fechaInicio: 'asc' }],
      select: {
        periodoId: true,
        codigo: true,
        tipo: true,
        fechaInicio: true,
        fechaFin: true,
        estado: true,
        snapshots: {
          take: 1,
          orderBy: { version: 'desc' },
          select: {
            snapshotId: true,
            periodoId: true,
            version: true,
            resumenJson: true,
          },
        },
      },
    });

    const blockers = dailyPeriods.flatMap((periodo) => {
      const issues: string[] = [];
      if (!['CERRADO', 'APROBADO'].includes(periodo.estado)) {
        issues.push(`${periodo.codigo} sigue en estado ${periodo.estado}`);
      }
      if (!periodo.snapshots?.length) {
        issues.push(`${periodo.codigo} no tiene snapshot diario`);
      }
      return issues;
    });

    if (blockers.length > 0) {
      throw new MonthlyPeriodDependencyError(blockers);
    }

    const resumen = consolidateDailySnapshots(
      dailyPeriods.flatMap((periodo) => periodo.snapshots ?? [])
    );
    resumen.periodo = monthlyCode;

    if (existingSnapshot) {
      return {
        periodo: periodoMensual,
        snapshot: existingSnapshot,
        resumen,
        wasCreated: false,
      };
    }

    const snapshot = await models.snapshotPeriodo.create({
      data: {
        periodoId: periodoMensual.periodoId,
        version: 1,
        baseCajaJson: {
          ingresosCaja: resumen.ingresosCaja,
          egresosCaja: resumen.egresosCaja,
          saldoCajaFinal: resumen.saldoCajaFinal,
          saldoBancoFinal: resumen.saldoBancoFinal,
        },
        baseDevengoJson: {
          totalVentas: resumen.totalVentas,
          totalServicios: resumen.totalServicios,
          totalIngresos: resumen.totalIngresos,
          totalGastosDE: resumen.totalGastosDE,
          totalGastosCompra: resumen.totalGastosCompra,
          totalGastosSalarios: resumen.totalGastosSalarios,
          totalGastos: resumen.totalGastos,
          diferencia: resumen.diferencia,
        },
        inconsistenciasJson: [],
        resumenJson: resumen,
      },
    });

    const periodoActualizado = await models.periodoContable.update({
      where: { periodoId: periodoMensual.periodoId },
      data: {
        estado: 'CERRADO',
        fechaCierre: new Date(),
        cerradoPorId: params.usuarioId,
      },
    });

    return {
      periodo: periodoActualizado,
      snapshot,
      resumen,
      wasCreated: true,
    };
  });
}

export function isCierreMensualPersistenceUnavailableError(
  error: unknown
): error is CierreMensualPersistenceUnavailableError {
  return error instanceof CierreMensualPersistenceUnavailableError;
}

export function isMonthlyPeriodNotFoundError(
  error: unknown
): error is MonthlyPeriodNotFoundError {
  return error instanceof MonthlyPeriodNotFoundError;
}

export function isMonthlyPeriodDependencyError(
  error: unknown
): error is MonthlyPeriodDependencyError {
  return error instanceof MonthlyPeriodDependencyError;
}
