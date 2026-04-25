import prisma from '@/lib/prisma';

import {
  createOpeningSeed,
  type LiveBalancesSource,
  type OpeningSeed,
  type PreviousPeriodSnapshotLike,
} from '@/lib/services/apertura-periodo-service';
import { AuditLogService } from '@/lib/services/audit-log-service';

interface PersistedPeriodoLike {
  periodoId: string;
  codigo: string;
  tipo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
}

interface PersistedAperturaLike {
  aperturaId: string;
  periodoId: string;
}

interface PeriodoPersistenceModels {
  periodoContable: {
    findFirst: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike | null>;
    create: (args: Record<string, unknown>) => Promise<PersistedPeriodoLike>;
  };
  aperturaPeriodo: {
    create: (args: Record<string, unknown>) => Promise<PersistedAperturaLike>;
  };
}

export class PeriodoPersistenceUnavailableError extends Error {
  status: number;
  code: string;

  /**
   * @description Error para indicar que el runtime actual todavía no expone los modelos nuevos de período.
   */
  constructor() {
    super(
      'El runtime Prisma actual no expone PeriodoContable/AperturaPeriodo. Ejecutá migrate/generate antes de persistir aperturas.'
    );
    this.name = 'PeriodoPersistenceUnavailableError';
    this.status = 503;
    this.code = 'PERIODO_PERSISTENCE_UNAVAILABLE';
  }
}

export interface PersistOpeningParams {
  tipoPeriodo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  referencia: Date;
  usuarioId: string;
  previousPeriod?: PreviousPeriodSnapshotLike | null;
  liveBalances?: LiveBalancesSource | null;
  observaciones?: string;
}

export interface PersistOpeningResult {
  periodo: PersistedPeriodoLike;
  apertura: PersistedAperturaLike;
  seed: OpeningSeed;
  wasCreated: boolean;
}

/**
 * @description Verifica que el cliente Prisma actual exponga los modelos nuevos de períodos.
 * @param {unknown} client - Cliente Prisma o transaction client.
 * @returns {PeriodoPersistenceModels} Modelos tipados mínimos.
 */
function resolvePersistenceModels(client: unknown): PeriodoPersistenceModels {
  const candidate = client as unknown as Record<string, unknown>;
  const periodoContable = candidate.periodoContable as PeriodoPersistenceModels['periodoContable'] | undefined;
  const aperturaPeriodo = candidate.aperturaPeriodo as PeriodoPersistenceModels['aperturaPeriodo'] | undefined;

  if (
    !periodoContable?.findFirst ||
    !periodoContable?.create ||
    !aperturaPeriodo?.create
  ) {
    throw new PeriodoPersistenceUnavailableError();
  }

  return {
    periodoContable,
    aperturaPeriodo,
  };
}

/**
 * @description Persiste período contable y apertura inicial de manera transaccional e idempotente por código.
 * @param {PersistOpeningParams} params - Parámetros de apertura.
 * @returns {Promise<PersistOpeningResult>} Resultado persistido o existente.
 */
export async function persistOpeningPeriod(
  params: PersistOpeningParams
): Promise<PersistOpeningResult> {
  // Verify prisma client has $transaction method
  const prismaClient = prisma as unknown as Record<string, unknown>;
  if (typeof prismaClient.$transaction !== 'function') {
    throw new PeriodoPersistenceUnavailableError();
  }

  const seed = createOpeningSeed(
    params.tipoPeriodo,
    params.referencia,
    params.previousPeriod,
    params.liveBalances
  );

  const result = await prisma.$transaction(async (tx: unknown) => {
    const models = resolvePersistenceModels(tx);

    const existing = await models.periodoContable.findFirst({
      where: { codigo: seed.codigoPeriodo },
    });

    if (existing) {
      return {
        periodo: existing,
        apertura: {
          aperturaId: 'existing-opening',
          periodoId: existing.periodoId,
        },
        seed,
        wasCreated: false,
      };
    }

    const periodo = await models.periodoContable.create({
      data: {
        tipo: seed.tipoPeriodo,
        codigo: seed.codigoPeriodo,
        fechaInicio: seed.fechaInicio,
        fechaFin: seed.fechaFin,
        estado: seed.estado,
        aperturaAutomatica: seed.aperturaAutomatica,
        observaciones: params.observaciones ?? null,
      },
    });

    const apertura = await models.aperturaPeriodo.create({
      data: {
        periodoId: periodo.periodoId,
        origenPeriodoId: seed.origenPeriodoId,
        saldoCajaInicial: seed.saldoCajaInicial,
        saldoBancoInicial: seed.saldoBancoInicial,
        saldoCuentasCobrarInicial: seed.saldoCuentasCobrarInicial,
        saldoCuentasPagarInicial: seed.saldoCuentasPagarInicial,
        saldoInventarioInicial: seed.saldoInventarioInicial,
        saldoCapitalInicial: seed.saldoCapitalInicial,
        saldoResultadoAcumInicial: seed.saldoResultadoAcumInicial,
        detalleJson: seed.detalleJson,
      },
    });

    return {
      periodo,
      apertura,
      seed,
      wasCreated: true,
    };
  });

  await AuditLogService.log({
    accion: 'CREATE',
    entidad: 'PERIODO_CONTABLE',
    entidadId: result.periodo.periodoId,
    usuarioId: params.usuarioId,
    detalles: {
      codigo: result.periodo.codigo,
      tipo: result.periodo.tipo,
      aperturaId: result.apertura.aperturaId,
      wasCreated: result.wasCreated,
      origenPeriodoId: result.seed.origenPeriodoId ?? null,
    },
  });

  return result;
}

/**
 * @description Indica si un error corresponde a falta de soporte runtime para persistencia de períodos.
 * @param {unknown} error - Error a validar.
 * @returns {boolean} Verdadero si el error es de persistencia no disponible.
 */
export function isPeriodoPersistenceUnavailableError(
  error: unknown
): error is PeriodoPersistenceUnavailableError {
  return error instanceof PeriodoPersistenceUnavailableError;
}
