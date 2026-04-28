import prisma from '@/lib/prisma';

import { ESTADO_PERIODO } from '@/lib/services/periodo-contable-service';

interface PersistedPeriodoLike {
  periodoId: string;
  codigo: string;
  tipo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  estado: string;
  fechaInicio: Date;
  fechaFin: Date;
  periodoPadreId: string | null;
  aperturaAutomatica: boolean;
  cierreAutomatico: boolean;
  abiertoPorId: string | null;
  cerradoPorId: string | null;
  aprobadoPorId: string | null;
  segundoAprobadorId: string | null;
  reabiertoPorId: string | null;
  fechaApertura: Date | null;
  fechaCierre: Date | null;
  fechaAprobacion: Date | null;
  fechaReapertura: Date | null;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PersistedAperturaLike {
  aperturaId: string;
  periodoId: string;
  origenPeriodoId: string | null;
  saldoCajaInicial: number;
  saldoBancoInicial: number;
  saldoCuentasCobrarInicial: number;
  saldoCuentasPagarInicial: number;
  saldoInventarioInicial: number;
  saldoCapitalInicial: number;
  saldoResultadoAcumInicial: number;
  detalleJson: unknown;
  createdAt: Date;
}

interface PersistedSnapshotLike {
  snapshotId: string;
  periodoId: string;
  version: number;
  baseCajaJson: unknown;
  baseDevengoJson: unknown;
  inconsistenciasJson: unknown;
  resumenJson: unknown;
  hashIntegridad: string | null;
  createdAt: Date;
}

interface PersistedSubperiodoLike {
  periodoId: string;
  codigo: string;
  estado: string;
}

interface PersistedAuditoriaLike {
  auditoriaId: string;
  periodoId: string;
  accion: string;
  usuarioId: string;
  motivo: string | null;
  payloadJson: unknown;
  createdAt: Date;
}

interface PeriodoDetailModels {
  periodoContable: {
    findUnique: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike | null>;
  };
}

export class PeriodoDetailUnavailableError extends Error {
  status: number;
  code: string;

  constructor() {
    super('El runtime Prisma actual no expone PeriodoContable. Ejecutá migrate/generate antes de consultar períodos.');
    this.name = 'PeriodoDetailUnavailableError';
    this.status = 503;
    this.code = 'PERIODO_DETAIL_UNAVAILABLE';
  }
}

export class PeriodoByIdNotFoundError extends Error {
  status: number;
  code: string;

  constructor(id: string) {
    super(`No existe un período con ID ${id}.`);
    this.name = 'PeriodoByIdNotFoundError';
    this.status = 404;
    this.code = 'PERIODO_NO_ENCONTRADO';
  }
}

export interface PeriodoDetail {
  periodoId: string;
  codigo: string;
  tipo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  periodoPadreId: string | null;
  aperturaAutomatica: boolean;
  cierreAutomatico: boolean;
  abiertoPorId: string | null;
  cerradoPorId: string | null;
  aprobadoPorId: string | null;
  segundoAprobadorId: string | null;
  reabiertoPorId: string | null;
  fechaApertura: string | null;
  fechaCierre: string | null;
  fechaAprobacion: string | null;
  fechaReapertura: string | null;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
  apertura: {
    aperturaId: string;
    origenPeriodoId: string | null;
    saldoCajaInicial: number;
    saldoBancoInicial: number;
    saldoCuentasCobrarInicial: number;
    saldoCuentasPagarInicial: number;
    saldoInventarioInicial: number;
    saldoCapitalInicial: number;
    saldoResultadoAcumInicial: number;
    detalleJson: unknown;
    createdAt: string;
  } | null;
  snapshots: {
    snapshotId: string;
    version: number;
    baseCajaJson: unknown;
    baseDevengoJson: unknown;
    inconsistenciasJson: unknown;
    resumenJson: unknown;
    hashIntegridad: string | null;
    createdAt: string;
  }[];
  subperiodos: {
    periodoId: string;
    codigo: string;
    estado: string;
  }[];
  auditorias: {
    auditoriaId: string;
    accion: string;
    usuarioId: string;
    motivo: string | null;
    payloadJson: unknown;
    createdAt: string;
  }[];
  puedeOperar: boolean;
  puedeCerrar: boolean;
  puedeAprobar: boolean;
  puedeReabrir: boolean;
  blockers: string[];
}

function canOperate(estado: string): boolean {
  return estado === ESTADO_PERIODO.ABIERTO || estado === ESTADO_PERIODO.REABIERTO;
}

function canClose(estado: string, subperiodos: PersistedSubperiodoLike[]): boolean {
  if (estado !== ESTADO_PERIODO.ABIERTO && estado !== ESTADO_PERIODO.REABIERTO && estado !== ESTADO_PERIODO.EN_CIERRE) {
    return false;
  }

  return subperiodos.every(
    (sp) => sp.estado === ESTADO_PERIODO.CERRADO || sp.estado === ESTADO_PERIODO.APROBADO
  );
}

function canApprove(estado: string): boolean {
  return estado === ESTADO_PERIODO.CERRADO;
}

function canReopen(estado: string): boolean {
  return estado === ESTADO_PERIODO.CERRADO || estado === ESTADO_PERIODO.APROBADO;
}

function resolveBlockers(
  periodo: PersistedPeriodoLike,
  subperiodos: PersistedSubperiodoLike[],
  apertura: PersistedAperturaLike | null,
  snapshot: PersistedSnapshotLike | null
): string[] {
  const blockers: string[] = [];

  if (
    periodo.tipo === 'DIARIO' &&
    periodo.estado !== ESTADO_PERIODO.BORRADOR &&
    !apertura
  ) {
    blockers.push('Falta apertura persistida para este período diario.');
  }

  if (
    (periodo.estado === ESTADO_PERIODO.CERRADO || periodo.estado === ESTADO_PERIODO.APROBADO) &&
    !snapshot
  ) {
    blockers.push('El período está cerrado/aprobado pero no tiene snapshot.');
  }

  const subperiodosAbiertos = subperiodos.filter(
    (sp) => sp.estado !== ESTADO_PERIODO.CERRADO && sp.estado !== ESTADO_PERIODO.APROBADO
  );

  if (subperiodosAbiertos.length > 0) {
    blockers.push(
      `Subperíodos abiertos: ${subperiodosAbiertos.map((sp) => sp.codigo).join(', ')}`
    );
  }

  return blockers;
}

/**
 * @description Obtiene el detalle completo de un período contable por su ID incluyendo apertura, snapshots, subperíodos, auditorías y acciones disponibles.
 * @param {string} periodoId - ID del período a consultar.
 * @returns {Promise<PeriodoDetail>} Detalle completo del período.
 */
export async function getPeriodoDetail(periodoId: string): Promise<PeriodoDetail> {
  const client = prisma as unknown as Record<string, unknown>;
  const periodoContable = client.periodoContable as PeriodoDetailModels['periodoContable'] | undefined;

  if (!periodoContable?.findUnique) {
    throw new PeriodoDetailUnavailableError();
  }

  const periodo = (await periodoContable.findUnique({
    where: { periodoId },
    include: {
      apertura: true,
      snapshots: { orderBy: { version: 'desc' } },
      subperiodos: {
        select: { periodoId: true, codigo: true, estado: true },
      },
      auditorias: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })) as (PersistedPeriodoLike & {
    apertura: PersistedAperturaLike | null;
    snapshots: PersistedSnapshotLike[];
    subperiodos: PersistedSubperiodoLike[];
    auditorias: PersistedAuditoriaLike[];
  }) | null;

  if (!periodo) {
    throw new PeriodoByIdNotFoundError(periodoId);
  }

  const apertura = periodo.apertura;
  const snapshot = periodo.snapshots?.[0] ?? null;
  const subperiodos = periodo.subperiodos ?? [];
  const auditorias = periodo.auditorias ?? [];
  const blockers = resolveBlockers(periodo, subperiodos, apertura, snapshot);

  return {
    periodoId: periodo.periodoId,
    codigo: periodo.codigo,
    tipo: periodo.tipo,
    estado: periodo.estado,
    fechaInicio: periodo.fechaInicio.toISOString(),
    fechaFin: periodo.fechaFin.toISOString(),
    periodoPadreId: periodo.periodoPadreId,
    aperturaAutomatica: periodo.aperturaAutomatica,
    cierreAutomatico: periodo.cierreAutomatico,
    abiertoPorId: periodo.abiertoPorId,
    cerradoPorId: periodo.cerradoPorId,
    aprobadoPorId: periodo.aprobadoPorId,
    segundoAprobadorId: periodo.segundoAprobadorId,
    reabiertoPorId: periodo.reabiertoPorId,
    fechaApertura: periodo.fechaApertura?.toISOString() ?? null,
    fechaCierre: periodo.fechaCierre?.toISOString() ?? null,
    fechaAprobacion: periodo.fechaAprobacion?.toISOString() ?? null,
    fechaReapertura: periodo.fechaReapertura?.toISOString() ?? null,
    observaciones: periodo.observaciones,
    createdAt: periodo.createdAt.toISOString(),
    updatedAt: periodo.updatedAt.toISOString(),
    apertura: apertura
      ? {
          aperturaId: apertura.aperturaId,
          origenPeriodoId: apertura.origenPeriodoId,
          saldoCajaInicial: Number(apertura.saldoCajaInicial),
          saldoBancoInicial: Number(apertura.saldoBancoInicial),
          saldoCuentasCobrarInicial: Number(apertura.saldoCuentasCobrarInicial),
          saldoCuentasPagarInicial: Number(apertura.saldoCuentasPagarInicial),
          saldoInventarioInicial: Number(apertura.saldoInventarioInicial),
          saldoCapitalInicial: Number(apertura.saldoCapitalInicial),
          saldoResultadoAcumInicial: Number(apertura.saldoResultadoAcumInicial),
          detalleJson: apertura.detalleJson,
          createdAt: apertura.createdAt.toISOString(),
        }
      : null,
    snapshots: (periodo.snapshots ?? []).map((s) => ({
      snapshotId: s.snapshotId,
      version: s.version,
      baseCajaJson: s.baseCajaJson,
      baseDevengoJson: s.baseDevengoJson,
      inconsistenciasJson: s.inconsistenciasJson,
      resumenJson: s.resumenJson,
      hashIntegridad: s.hashIntegridad,
      createdAt: s.createdAt.toISOString(),
    })),
    subperiodos: subperiodos.map((sp) => ({
      periodoId: sp.periodoId,
      codigo: sp.codigo,
      estado: sp.estado,
    })),
    auditorias: auditorias.map((a) => ({
      auditoriaId: a.auditoriaId,
      accion: a.accion,
      usuarioId: a.usuarioId,
      motivo: a.motivo,
      payloadJson: a.payloadJson,
      createdAt: a.createdAt.toISOString(),
    })),
    puedeOperar: canOperate(periodo.estado),
    puedeCerrar: canClose(periodo.estado, subperiodos),
    puedeAprobar: canApprove(periodo.estado),
    puedeReabrir: canReopen(periodo.estado),
    blockers,
  };
}

export function isPeriodoByIdNotFoundError(error: unknown): error is PeriodoByIdNotFoundError {
  return error instanceof PeriodoByIdNotFoundError;
}

export function isPeriodoDetailUnavailableError(error: unknown): error is PeriodoDetailUnavailableError {
  return error instanceof PeriodoDetailUnavailableError;
}