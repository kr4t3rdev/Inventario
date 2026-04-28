import prisma from '@/lib/prisma';

import { ESTADO_PERIODO, TIPO_PERIODO } from '@/lib/services/periodo-contable-service';

interface PersistedAperturaLike {
  aperturaId: string;
  createdAt: Date;
}

interface PersistedSnapshotLike {
  snapshotId: string;
  version: number;
  createdAt: Date;
}

interface PersistedAuditoriaLike {
  auditoriaId: string;
  accion: string;
  createdAt: Date;
}

interface PersistedSubperiodoLike {
  periodoId: string;
  codigo: string;
  estado: string;
}

interface PersistedPeriodoListItem {
  periodoId: string;
  codigo: string;
  tipo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  estado: string;
  fechaInicio: Date;
  fechaFin: Date;
  periodoPadreId: string | null;
  fechaApertura: Date | null;
  fechaCierre: Date | null;
  fechaAprobacion: Date | null;
  fechaReapertura: Date | null;
  apertura: PersistedAperturaLike | null;
  snapshots: PersistedSnapshotLike[];
  subperiodos: PersistedSubperiodoLike[];
  auditorias: PersistedAuditoriaLike[];
}

interface PeriodoContableListModel {
  findMany: (args: Record<string, unknown>) => Promise<PersistedPeriodoListItem[]>;
}

export interface ListPeriodosFilters {
  tipo?: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  estado?: 'BORRADOR' | 'ABIERTO' | 'EN_CIERRE' | 'CERRADO' | 'APROBADO' | 'REABIERTO';
  fechaDesde?: Date;
  fechaHasta?: Date;
}

export interface PeriodoListadoItem {
  periodoId: string;
  codigo: string;
  tipo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  estado: string;
  fechaInicio: Date;
  fechaFin: Date;
  periodoPadreId: string | null;
  fechaApertura: Date | null;
  fechaCierre: Date | null;
  fechaAprobacion: Date | null;
  fechaReapertura: Date | null;
  tieneApertura: boolean;
  aperturaId: string | null;
  tieneSnapshot: boolean;
  versionSnapshotActual: number | null;
  totalSnapshots: number;
  totalSubperiodos: number;
  subperiodosCerrados: number;
  subperiodosAbiertos: number;
  blockers: string[];
  ultimaAuditoria: { accion: string; fecha: string } | null;
}

export interface ListPeriodosResult {
  items: PeriodoListadoItem[];
  meta: {
    total: number;
    filtros: {
      tipo: ListPeriodosFilters['tipo'] | null;
      estado: ListPeriodosFilters['estado'] | null;
      fechaDesde: string | null;
      fechaHasta: string | null;
    };
  };
}

export class ListadoPeriodosPersistenceUnavailableError extends Error {
  status: number;
  code: string;

  constructor() {
    super('El runtime Prisma actual no expone PeriodoContable. Ejecutá migrate/generate antes de listar períodos.');
    this.name = 'ListadoPeriodosPersistenceUnavailableError';
    this.status = 503;
    this.code = 'LISTADO_PERIODOS_PERSISTENCE_UNAVAILABLE';
  }
}

function resolvePeriodoModel(client: unknown): PeriodoContableListModel {
  const candidate = client as Record<string, unknown>;
  const periodoContable = candidate.periodoContable as PeriodoContableListModel | undefined;

  if (!periodoContable?.findMany) {
    throw new ListadoPeriodosPersistenceUnavailableError();
  }

  return periodoContable;
}

function buildWhere(filters: ListPeriodosFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (filters.tipo) {
    where.tipo = filters.tipo;
  }

  if (filters.estado) {
    where.estado = filters.estado;
  }

  if (filters.fechaDesde) {
    where.fechaInicio = { gte: filters.fechaDesde };
  }

  if (filters.fechaHasta) {
    where.fechaFin = { lte: filters.fechaHasta };
  }

  return where;
}

function resolveBlockers(periodo: PersistedPeriodoListItem): string[] {
  const blockers: string[] = [];
  const snapshotActual = periodo.snapshots[0] ?? null;
  const subperiodosAbiertos = periodo.subperiodos.filter(
    (subperiodo) =>
      subperiodo.estado !== ESTADO_PERIODO.CERRADO &&
      subperiodo.estado !== ESTADO_PERIODO.APROBADO
  );

  if (
    periodo.estado !== ESTADO_PERIODO.BORRADOR &&
    !periodo.apertura &&
    periodo.tipo === TIPO_PERIODO.DIARIO
  ) {
    blockers.push('Falta apertura persistida para este período diario.');
  }

  if (
    (periodo.estado === ESTADO_PERIODO.CERRADO ||
      periodo.estado === ESTADO_PERIODO.APROBADO) &&
    !snapshotActual
  ) {
    blockers.push('El período está cerrado/aprobado pero no tiene snapshot.');
  }

  if (subperiodosAbiertos.length > 0) {
    blockers.push(
      `Subperíodos abiertos: ${subperiodosAbiertos
        .map((subperiodo) => subperiodo.codigo)
        .join(', ')}`
    );
  }

  return blockers;
}

function mapPeriodo(periodo: PersistedPeriodoListItem): PeriodoListadoItem {
  const snapshotActual = periodo.snapshots[0] ?? null;
  const subperiodosCerrados = periodo.subperiodos.filter(
    (subperiodo) =>
      subperiodo.estado === ESTADO_PERIODO.CERRADO ||
      subperiodo.estado === ESTADO_PERIODO.APROBADO
  ).length;
  const ultimaAuditoria = (periodo.auditorias ?? [])[0] ?? null;

  return {
    periodoId: periodo.periodoId,
    codigo: periodo.codigo,
    tipo: periodo.tipo,
    estado: periodo.estado,
    fechaInicio: periodo.fechaInicio,
    fechaFin: periodo.fechaFin,
    periodoPadreId: periodo.periodoPadreId,
    fechaApertura: periodo.fechaApertura,
    fechaCierre: periodo.fechaCierre,
    fechaAprobacion: periodo.fechaAprobacion,
    fechaReapertura: periodo.fechaReapertura,
    tieneApertura: Boolean(periodo.apertura),
    aperturaId: periodo.apertura?.aperturaId ?? null,
    tieneSnapshot: Boolean(snapshotActual),
    versionSnapshotActual: snapshotActual?.version ?? null,
    totalSnapshots: periodo.snapshots.length,
    totalSubperiodos: periodo.subperiodos.length,
    subperiodosCerrados,
    subperiodosAbiertos: periodo.subperiodos.length - subperiodosCerrados,
    blockers: resolveBlockers(periodo),
    ultimaAuditoria: ultimaAuditoria
      ? { accion: ultimaAuditoria.accion, fecha: ultimaAuditoria.createdAt.toISOString() }
      : null,
  };
}

/**
 * @description Lista períodos contables persistidos con un resumen operativo para administrar aperturas, snapshots y dependencias.
 * @param {ListPeriodosFilters} filters - Filtros opcionales por tipo, estado y rango temporal.
 * @returns {Promise<ListPeriodosResult>} Resultado serializable con items y metadatos de filtros.
 */
export async function listPeriodos(
  filters: ListPeriodosFilters
): Promise<ListPeriodosResult> {
  const models = resolvePeriodoModel(prisma);

  const periodos = await models.findMany({
    where: buildWhere(filters),
    orderBy: [{ fechaInicio: 'desc' }],
    select: {
      periodoId: true,
      codigo: true,
      tipo: true,
      estado: true,
      fechaInicio: true,
      fechaFin: true,
      periodoPadreId: true,
      fechaApertura: true,
      fechaCierre: true,
      fechaAprobacion: true,
      fechaReapertura: true,
      apertura: {
        select: {
          aperturaId: true,
          createdAt: true,
        },
      },
      snapshots: {
        take: 1,
        orderBy: [{ version: 'desc' }],
        select: {
          snapshotId: true,
          version: true,
          createdAt: true,
        },
      },
      subperiodos: {
        select: {
          periodoId: true,
          codigo: true,
          estado: true,
        },
      },
      auditorias: {
        take: 1,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          auditoriaId: true,
          accion: true,
          createdAt: true,
        },
      },
    },
  });

  return {
    items: periodos.map(mapPeriodo),
    meta: {
      total: periodos.length,
      filtros: {
        tipo: filters.tipo ?? null,
        estado: filters.estado ?? null,
        fechaDesde: filters.fechaDesde?.toISOString() ?? null,
        fechaHasta: filters.fechaHasta?.toISOString() ?? null,
      },
    },
  };
}

export function isListadoPeriodosPersistenceUnavailableError(
  error: unknown
): error is ListadoPeriodosPersistenceUnavailableError {
  return error instanceof ListadoPeriodosPersistenceUnavailableError;
}
