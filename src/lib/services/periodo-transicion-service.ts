import prisma from '@/lib/prisma';

import { AuditLogService } from '@/lib/services/audit-log-service';
import { ESTADO_PERIODO } from '@/lib/services/periodo-contable-service';

interface PersistedPeriodoLike {
  periodoId: string;
  codigo: string;
  tipo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  estado: string;
  periodoPadreId: string | null;
  fechaInicio: Date;
  fechaFin: Date;
}

interface PersistedSubperiodoLike {
  periodoId: string;
  codigo: string;
  estado: string;
}

interface PersistedSnapshotLike {
  snapshotId: string;
  periodoId: string;
  version: number;
}

interface TransicionPersistenceModels {
  periodoContable: {
    findFirst: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike | null>;
    findUnique: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike | null>;
    update: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike>;
  };
  snapshotPeriodo: {
    findFirst: (args: Record<string, unknown>) => Promise<PersistedSnapshotLike | null>;
  };
}

export class TransicionPersistenceUnavailableError extends Error {
  status: number;
  code: string;

  constructor() {
    super(
      'El runtime Prisma actual no expone PeriodoContable. Ejecutá migrate/generate antes de transicionar períodos.'
    );
    this.name = 'TransicionPersistenceUnavailableError';
    this.status = 503;
    this.code = 'TRANSICION_PERSISTENCE_UNAVAILABLE';
  }
}

export class PeriodoNotFoundError extends Error {
  status: number;
  code: string;

  constructor(periodoId: string) {
    super(`No existe un período con ID ${periodoId}.`);
    this.name = 'PeriodoNotFoundError';
    this.status = 404;
    this.code = 'PERIODO_NO_ENCONTRADO';
  }
}

export class AprobacionBlockerError extends Error {
  status: number;
  code: string;
  blockers: string[];

  constructor(blockers: string[]) {
    super(`No se puede aprobar el período. Blockers: ${blockers.join('; ')}`);
    this.name = 'AprobacionBlockerError';
    this.status = 409;
    this.code = 'APROBACION_BLOCKED';
    this.blockers = blockers;
  }
}

export class ReaperturaBlockerError extends Error {
  status: number;
  code: string;
  blockers: string[];

  constructor(blockers: string[]) {
    super(`No se puede reabrir el período. Blockers: ${blockers.join('; ')}`);
    this.name = 'ReaperturaBlockerError';
    this.status = 409;
    this.code = 'REAPERTURA_BLOCKED';
    this.blockers = blockers;
  }
}

export interface AprobarParams {
  periodoId: string;
  usuarioId: string;
  motivo?: string;
}

export interface ReabrirParams {
  periodoId: string;
  usuarioId: string;
  motivo: string;
  regenerarSnapshot?: boolean;
}

export interface TransicionResult {
  periodo: PersistedPeriodoLike;
  estadoAnterior: string;
  estadoNuevo: string;
  auditado: boolean;
}

function resolvePersistenceModels(client: unknown): TransicionPersistenceModels {
  const candidate = client as unknown as Record<string, unknown>;
  const periodoContable = candidate.periodoContable as TransicionPersistenceModels['periodoContable'] | undefined;
  const snapshotPeriodo = candidate.snapshotPeriodo as TransicionPersistenceModels['snapshotPeriodo'] | undefined;

  if (
    !periodoContable?.findFirst ||
    !periodoContable?.findUnique ||
    !periodoContable?.update ||
    !snapshotPeriodo?.findFirst
  ) {
    throw new TransicionPersistenceUnavailableError();
  }

  return { periodoContable, snapshotPeriodo };
}

function validateAprobacionEstado(estado: string, codigo: string): string | null {
  if (estado === ESTADO_PERIODO.APROBADO) {
    return `El período ${codigo} ya está aprobado.`;
  }

  if (estado !== ESTADO_PERIODO.CERRADO) {
    return `El período ${codigo} no puede aprobarse desde estado ${estado}. Solo se puede aprobar desde CERRADO.`;
  }

  return null;
}

function validateReaperturaEstado(estado: string, codigo: string): string | null {
  if (estado === ESTADO_PERIODO.ABIERTO || estado === ESTADO_PERIODO.REABIERTO) {
    return `El período ${codigo} ya está abierto (${estado}).`;
  }

  if (estado !== ESTADO_PERIODO.CERRADO && estado !== ESTADO_PERIODO.APROBADO) {
    return `El período ${codigo} no puede reabrirse desde estado ${estado}. Solo se puede reabrir desde CERRADO o APROBADO.`;
  }

  return null;
}

async function validateParentNotClosed(
  models: TransicionPersistenceModels,
  periodo: PersistedPeriodoLike
): Promise<string | null> {
  if (!periodo.periodoPadreId) {
    return null;
  }

  const parent = await models.periodoContable.findUnique({
    where: { periodoId: periodo.periodoPadreId },
  });

  if (!parent) {
    return null;
  }

  if (
    parent.estado === ESTADO_PERIODO.CERRADO ||
    parent.estado === ESTADO_PERIODO.APROBADO
  ) {
    return `El período padre ${parent.codigo} está ${parent.estado}. No se puede modificar un hijo de un período cerrado/aprobado.`;
  }

  return null;
}

async function validateAprobacionSubperiodos(
  models: TransicionPersistenceModels,
  periodo: PersistedPeriodoLike
): Promise<string[]> {
  let subperiodos: PersistedSubperiodoLike[] = [];

  try {
    const candidate = prisma as unknown as Record<string, unknown>;
    const periodoContable = candidate.periodoContable as
      | { findMany?: (args: Record<string, unknown>) => Promise<PersistedSubperiodoLike[]> }
      | undefined;

    if (periodoContable?.findMany) {
      subperiodos = await periodoContable.findMany({
        where: { periodoPadreId: periodo.periodoId },
        select: { periodoId: true, codigo: true, estado: true },
      });
    }
  } catch {
    // Si no hay subperíodos, no hay blockers
  }

  return subperiodos
    .filter(
      (sp) =>
        sp.estado !== ESTADO_PERIODO.CERRADO &&
        sp.estado !== ESTADO_PERIODO.APROBADO
    )
    .map((sp) => `El subperíodo ${sp.codigo} está en estado ${sp.estado}. Debe estar CERRADO o APROBADO.`);
}

export async function aprobarPeriodo(params: AprobarParams): Promise<TransicionResult> {
  const txFactory = (prisma as unknown as Record<string, unknown>).$transaction as
    | ((callback: (tx: unknown) => Promise<TransicionResult>) => Promise<TransicionResult>)
    | undefined;

  if (!txFactory) {
    throw new TransicionPersistenceUnavailableError();
  }

  return txFactory(async (tx: unknown) => {
    const models = resolvePersistenceModels(tx);

    const periodo = await models.periodoContable.findUnique({
      where: { periodoId: params.periodoId },
    });

    if (!periodo) {
      throw new PeriodoNotFoundError(params.periodoId);
    }

    const estadoBlocker = validateAprobacionEstado(periodo.estado, periodo.codigo);
    const blockers: string[] = [];

    if (estadoBlocker) {
      blockers.push(estadoBlocker);
    }

    const parentBlocker = await validateParentNotClosed(models, periodo);
    if (parentBlocker) {
      blockers.push(parentBlocker);
    }

    const subperiodoBlockers = await validateAprobacionSubperiodos(models, periodo);
    blockers.push(...subperiodoBlockers);

    if (blockers.length > 0) {
      throw new AprobacionBlockerError(blockers);
    }

    const snapshot = await models.snapshotPeriodo.findFirst({
      where: { periodoId: periodo.periodoId },
      orderBy: { version: 'desc' },
    });

    if (!snapshot) {
      blockers.push(`El período ${periodo.codigo} no tiene snapshot. No se puede aprobar sin snapshot.`);
      throw new AprobacionBlockerError(blockers);
    }

    const estadoAnterior = periodo.estado;
    const updatedPeriodo = await models.periodoContable.update({
      where: { periodoId: params.periodoId },
      data: {
        estado: ESTADO_PERIODO.APROBADO,
        fechaAprobacion: new Date(),
        aprobadoPorId: params.usuarioId,
      },
    });

    await AuditLogService.log({
      accion: 'VALIDATE',
      entidad: 'PERIODO_CONTABLE',
      entidadId: params.periodoId,
      usuarioId: params.usuarioId,
      detalles: {
        accionEspecifica: 'APROBACION',
        codigo: periodo.codigo,
        tipo: periodo.tipo,
        estadoAnterior,
        estadoNuevo: ESTADO_PERIODO.APROBADO,
        snapshotVersion: snapshot.version,
        motivo: params.motivo ?? null,
      },
    });

    return {
      periodo: updatedPeriodo,
      estadoAnterior,
      estadoNuevo: ESTADO_PERIODO.APROBADO,
      auditado: true,
    };
  });
}

export async function reabrirPeriodo(params: ReabrirParams): Promise<TransicionResult> {
  const txFactory = (prisma as unknown as Record<string, unknown>).$transaction as
    | ((callback: (tx: unknown) => Promise<TransicionResult>) => Promise<TransicionResult>)
    | undefined;

  if (!txFactory) {
    throw new TransicionPersistenceUnavailableError();
  }

  return txFactory(async (tx: unknown) => {
    const models = resolvePersistenceModels(tx);

    const periodo = await models.periodoContable.findUnique({
      where: { periodoId: params.periodoId },
    });

    if (!periodo) {
      throw new PeriodoNotFoundError(params.periodoId);
    }

    const estadoBlocker = validateReaperturaEstado(periodo.estado, periodo.codigo);
    const blockers: string[] = [];

    if (estadoBlocker) {
      blockers.push(estadoBlocker);
    }

    const parentBlocker = await validateParentNotClosed(models, periodo);
    if (parentBlocker) {
      blockers.push(parentBlocker);
    }

    if (!params.motivo || params.motivo.trim().length === 0) {
      blockers.push('La reapertura requiere un motivo obligatorio.');
    }

    if (blockers.length > 0) {
      throw new ReaperturaBlockerError(blockers);
    }

    const estadoAnterior = periodo.estado;
    const updatedPeriodo = await models.periodoContable.update({
      where: { periodoId: params.periodoId },
      data: {
        estado: ESTADO_PERIODO.REABIERTO,
        fechaReapertura: new Date(),
        reabiertoPorId: params.usuarioId,
      },
    });

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'PERIODO_CONTABLE',
      entidadId: params.periodoId,
      usuarioId: params.usuarioId,
      detalles: {
        accionEspecifica: 'REAPERTURA',
        codigo: periodo.codigo,
        tipo: periodo.tipo,
        estadoAnterior,
        estadoNuevo: ESTADO_PERIODO.REABIERTO,
        motivo: params.motivo,
      },
    });

    if (params.regenerarSnapshot) {
      const snapshotModel = models.snapshotPeriodo as
        | { deleteMany: (args: Record<string, unknown>) => Promise<void>; create: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }
        | undefined

      if (snapshotModel?.deleteMany) {
        await snapshotModel.deleteMany({ where: { periodoId: params.periodoId } })
        await snapshotModel.create({
          data: {
            periodoId: params.periodoId,
            version: 1,
            baseCajaJson: {},
            baseDevengoJson: {},
            resumenJson: { regeneradoEnReapertura: true, reaperturaMotivo: params.motivo },
            hashIntegridad: null,
          },
        } as Record<string, unknown>)
      }
    }

    return {
      periodo: updatedPeriodo,
      estadoAnterior,
      estadoNuevo: ESTADO_PERIODO.REABIERTO,
      auditado: true,
    };
  });
}

export function isTransicionPersistenceUnavailableError(
  error: unknown
): error is TransicionPersistenceUnavailableError {
  return error instanceof TransicionPersistenceUnavailableError;
}

export function isPeriodoNotFoundError(
  error: unknown
): error is PeriodoNotFoundError {
  return error instanceof PeriodoNotFoundError;
}

export function isAprobacionBlockerError(
  error: unknown
): error is AprobacionBlockerError {
  return error instanceof AprobacionBlockerError;
}

export function isReaperturaBlockerError(
  error: unknown
): error is ReaperturaBlockerError {
  return error instanceof ReaperturaBlockerError;
}