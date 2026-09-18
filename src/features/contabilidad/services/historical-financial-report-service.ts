import { getYearRangeInTimeZone } from '@/features/contabilidad/domain/reconciled-result-calculator';
import type { CurrentBalanceResult } from '@/features/contabilidad/domain/balance-calculator';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import {
  ACCOUNTING_TIME_ZONE,
  getAccountingYear,
} from '@/lib/services/fecha-operacion-registry';
import { findFinancialAuxiliaryCheckpoint } from './financial-auxiliary-checkpoint-service';
import {
  hashFinancialSnapshotV3,
  validateFinancialSnapshotV3Payload,
} from './financial-snapshot-v3-service';
import { hashImmutableFinancialEvidence } from './immutable-financial-evidence';

export interface FinancialSnapshotPayload<TResult = unknown> {
  version: 2;
  cutoffAt: string;
  resultThrough: string;
  capturedAt: string;
  functionalCurrency: string;
  balance: CurrentBalanceResult;
  result: TResult;
  coverage: {
    balanceComplete: boolean;
    balanceUnresolvedCount: number;
    resultIncidentCount: number;
    resultEstimateCount: number;
  };
  sources: Record<string, number>;
}

interface CreateFinancialSnapshotParams<TResult> {
  /** Corte del balance: corresponde al momento en que se congela la captura. */
  cutoffAt: Date;
  /** Fin temporal del resultado reconciliado, que puede diferir del corte del balance. */
  resultThrough?: Date;
  capturedAt: Date;
  balance: CurrentBalanceResult;
  result: TResult;
  sources: Record<string, number>;
}

interface ResolveFinancialReportParams<TLive> {
  tenantId: string;
  year: number;
  now: Date;
  requestedCutoffAt?: Date;
  calculateLive: (cutoffAt: Date) => Promise<TLive>;
}

export type FinancialReportResolution<TLive = unknown> =
  | ({
      status: 'AVAILABLE';
      origin: 'LIVE';
      provisional: true;
      cutoffAt: string;
      resultThrough: string;
      periodId: string | null;
    } & TLive)
  | {
      status: 'AVAILABLE';
      origin: 'SNAPSHOT';
      provisional: false;
      cutoffAt: string;
      resultThrough: string;
      periodId: string;
      snapshotId: string;
      snapshotVersion: 2 | 3;
      integrity: 'VALID';
      balance: CurrentBalanceResult;
      result: unknown;
      coverage: FinancialSnapshotPayload['coverage'] | Record<string, unknown>;
      sources: Record<string, number> | Record<string, string>;
    }
  | {
      status: 'AVAILABLE';
      origin: 'CHECKPOINT';
      provisional: false;
      cutoffAt: string;
      resultThrough: string;
      periodId: null;
      checkpointId: string;
      integrity: 'VALID';
      balance: CurrentBalanceResult;
      result: unknown;
    }
  | {
      status: 'UNAVAILABLE';
      reason:
        | 'NO_HISTORICAL_EVIDENCE'
        | 'PERIOD_NOT_APPROVED'
        | 'LEGACY_INCOMPLETE'
        | 'INTEGRITY_FAILED';
      periodId: string | null;
      snapshotVersion?: number;
    };

interface PersistedSnapshot {
  snapshotId: string;
  version: number;
  tenantId?: string | null;
  schemaVersion?: number | null;
  status?: string | null;
  resumenJson: unknown;
  hashIntegridad: string | null;
  createdAt: Date;
}

const LIVE_PERIOD_STATES = new Set(['ABIERTO', 'REABIERTO']);

/**
 * @description Calcula el SHA256 canónico de un payload de snapshot.
 * @param {unknown} payload - Payload persistido que se verificará.
 * @returns {string} Hash hexadecimal SHA256.
 */
export function hashFinancialSnapshot(payload: unknown): string {
  return hashImmutableFinancialEvidence(payload);
}

/**
 * @description Comprueba la forma mínima del snapshot financiero v2.
 * @param {unknown} value - JSON leído desde Prisma.
 * @returns {boolean} Indica si contiene el contrato financiero completo.
 */
function isFinancialSnapshotV2(value: unknown): value is FinancialSnapshotPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return payload.version === 2 &&
    typeof payload.cutoffAt === 'string' &&
    typeof payload.resultThrough === 'string' &&
    typeof payload.capturedAt === 'string' &&
    typeof payload.functionalCurrency === 'string' &&
    Boolean(payload.balance) && typeof payload.balance === 'object' &&
    Boolean(payload.result) && typeof payload.result === 'object' &&
    Boolean(payload.coverage) && typeof payload.coverage === 'object' &&
    Boolean(payload.sources) && typeof payload.sources === 'object';
}

/**
 * @description Construye y firma un snapshot financiero v2 inmutable.
 * @param {CreateFinancialSnapshotParams<TResult>} params - Balance, resultado y fuentes agregadas.
 * @returns {object} Payload versionado y hash de integridad.
 */
export async function createFinancialSnapshot<TResult>(
  params: CreateFinancialSnapshotParams<TResult>,
): Promise<{ payload: FinancialSnapshotPayload<TResult>; hash: string }> {
  const resultRecord = params.result as Record<string, unknown>;
  const incidents = Array.isArray(resultRecord.incidents) ? resultRecord.incidents.length : 0;
  const estimates = Array.isArray(resultRecord.estimates) ? resultRecord.estimates.length : 0;
  const payload: FinancialSnapshotPayload<TResult> = {
    version: 2,
    cutoffAt: params.cutoffAt.toISOString(),
    resultThrough: (params.resultThrough ?? params.cutoffAt).toISOString(),
    capturedAt: params.capturedAt.toISOString(),
    functionalCurrency: params.balance.functionalCurrency,
    balance: params.balance,
    result: params.result,
    coverage: {
      balanceComplete: params.balance.coverage.complete,
      balanceUnresolvedCount: params.balance.coverage.unresolvedCount,
      resultIncidentCount: incidents,
      resultEstimateCount: estimates,
    },
    sources: params.sources,
  };
  return { payload, hash: hashFinancialSnapshot(payload) };
}

/**
 * @description Verifica y presenta un snapshot aprobado sin consultar saldos actuales.
 * @param {string} periodId - Período propietario del snapshot.
 * @param {PersistedSnapshot | undefined} snapshot - Última versión persistida.
 * @returns {FinancialReportResolution} Reporte disponible o causa explícita de indisponibilidad.
 */
function resolveApprovedSnapshot(
  periodId: string,
  snapshot: PersistedSnapshot | undefined,
  periodHashIntegridad: string | null,
  tenantId: string,
): FinancialReportResolution {
  if (!snapshot) {
    return { status: 'UNAVAILABLE', reason: 'NO_HISTORICAL_EVIDENCE', periodId };
  }
  if (snapshot.schemaVersion === 3) {
    return resolveApprovedSnapshotV3(periodId, snapshot, periodHashIntegridad, tenantId);
  }
  if (!isFinancialSnapshotV2(snapshot.resumenJson)) {
    return {
      status: 'UNAVAILABLE',
      reason: 'LEGACY_INCOMPLETE',
      periodId,
      snapshotVersion: snapshot.version,
    };
  }
  if (
    !snapshot.hashIntegridad ||
    hashFinancialSnapshot(snapshot.resumenJson) !== snapshot.hashIntegridad ||
    !periodHashIntegridad ||
    hashFinancialSnapshot(snapshot.resumenJson) !== periodHashIntegridad
  ) {
    return {
      status: 'UNAVAILABLE',
      reason: 'INTEGRITY_FAILED',
      periodId,
      snapshotVersion: 2,
    };
  }
  const payload = snapshot.resumenJson;
  return {
    status: 'AVAILABLE',
    origin: 'SNAPSHOT',
    provisional: false,
    cutoffAt: payload.cutoffAt,
    resultThrough: payload.resultThrough,
    periodId,
    snapshotId: snapshot.snapshotId,
    snapshotVersion: 2,
    integrity: 'VALID',
    balance: payload.balance,
    result: payload.result,
    coverage: payload.coverage,
    sources: payload.sources,
  };
}

/**
 * @description Verifica y presenta un snapshot financiero v3 aprobado.
 * @param {string} periodId - Período propietario del snapshot.
 * @param {PersistedSnapshot} snapshot - Fila v3 persistida.
 * @param {string | null} periodHashIntegridad - Hash copiado al período aprobado.
 * @param {string} tenantId - Tenant esperado para reforzar aislamiento.
 * @returns {FinancialReportResolution} Reporte disponible o causa explícita.
 */
function resolveApprovedSnapshotV3(
  periodId: string,
  snapshot: PersistedSnapshot,
  periodHashIntegridad: string | null,
  tenantId: string,
): FinancialReportResolution {
  if (snapshot.status !== 'APPROVED' || snapshot.tenantId !== tenantId) {
    return {
      status: 'UNAVAILABLE',
      reason: 'NO_HISTORICAL_EVIDENCE',
      periodId,
      snapshotVersion: 3,
    };
  }

  try {
    const payload = validateFinancialSnapshotV3Payload(snapshot.resumenJson, tenantId);
    const hash = hashFinancialSnapshotV3(payload);
    if (
      !snapshot.hashIntegridad ||
      hash !== snapshot.hashIntegridad ||
      !periodHashIntegridad ||
      hash !== periodHashIntegridad
    ) {
      return {
        status: 'UNAVAILABLE',
        reason: 'INTEGRITY_FAILED',
        periodId,
        snapshotVersion: 3,
      };
    }

    return {
      status: 'AVAILABLE',
      origin: 'SNAPSHOT',
      provisional: false,
      cutoffAt: payload.cutoffAt,
      resultThrough: payload.cutoffAt,
      periodId,
      snapshotId: snapshot.snapshotId,
      snapshotVersion: 3,
      integrity: 'VALID',
      balance: payload.balance as unknown as CurrentBalanceResult,
      result: payload.result,
      coverage: payload.coverage,
      sources: payload.provenance.sourceFingerprints,
    };
  } catch {
    return {
      status: 'UNAVAILABLE',
      reason: 'INTEGRITY_FAILED',
      periodId,
      snapshotVersion: 3,
    };
  }
}

/**
 * @description Resuelve un reporte actual provisional o un snapshot histórico aprobado.
 * @param {ResolveFinancialReportParams<TLive>} params - Tenant, año, corte y cálculo live diferido.
 * @returns {Promise<FinancialReportResolution<TLive>>} Resolución discriminada del reporte.
 */
export async function resolveFinancialReport<TLive extends object>(
  params: ResolveFinancialReportParams<TLive>,
): Promise<FinancialReportResolution<TLive>> {
  if (params.requestedCutoffAt) {
    const checkpoint = await findFinancialAuxiliaryCheckpoint({
      tenantId: params.tenantId,
      cutoffAt: params.requestedCutoffAt,
    });
    if (checkpoint) {
      return {
        status: 'AVAILABLE',
        origin: 'CHECKPOINT',
        provisional: false,
        cutoffAt: checkpoint.payload.cutoffAt,
        resultThrough: checkpoint.payload.resultThrough,
        periodId: null,
        checkpointId: checkpoint.checkpointId,
        integrity: 'VALID',
        balance: checkpoint.payload.balance as CurrentBalanceResult,
        result: checkpoint.payload.result,
      };
    }
  }
  const range = getYearRangeInTimeZone(params.year, ACCOUNTING_TIME_ZONE);
  // Periodos legacy suelen guardar el fin a precisión de segundos.
  const endInclusive = new Date(range.lt.getTime() - 1_000);
  const period = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    return tx.periodoContable.findFirst({
      where: {
        tenantId: params.tenantId,
        tipo: 'ANUAL',
        fechaInicio: { lte: range.gte },
        fechaFin: { gte: endInclusive },
      },
      orderBy: { fechaInicio: 'desc' },
      select: {
        periodoId: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        hashIntegridad: true,
        snapshotPeriodos: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            snapshotId: true,
            version: true,
            tenantId: true,
            schemaVersion: true,
            status: true,
            resumenJson: true,
            hashIntegridad: true,
            createdAt: true,
          },
        },
      },
    });
  }, { isolationLevel: 'Serializable' });

  if (period?.estado === 'APROBADO') {
    const resolution = resolveApprovedSnapshot(
      period.periodoId,
      period.snapshotPeriodos[0],
      period.hashIntegridad,
      params.tenantId,
    ) as FinancialReportResolution<TLive>;
    if (
      !params.requestedCutoffAt ||
      (resolution.status === 'AVAILABLE' &&
        resolution.cutoffAt === params.requestedCutoffAt.toISOString())
    ) {
      return resolution;
    }
  }

  if (params.requestedCutoffAt) {
    return {
      status: 'UNAVAILABLE',
      reason: 'NO_HISTORICAL_EVIDENCE',
      periodId: period?.periodoId ?? null,
    };
  }

  const canCalculateLive = !period || LIVE_PERIOD_STATES.has(period.estado);
  if (params.year === getAccountingYear(params.now) && canCalculateLive) {
    const live = await params.calculateLive(params.now);
    return {
      status: 'AVAILABLE',
      origin: 'LIVE',
      provisional: true,
      cutoffAt: params.now.toISOString(),
      resultThrough: params.now.toISOString(),
      periodId: period?.periodoId ?? null,
      ...live,
    };
  }

  return {
    status: 'UNAVAILABLE',
    reason: period ? 'PERIOD_NOT_APPROVED' : 'NO_HISTORICAL_EVIDENCE',
    periodId: period?.periodoId ?? null,
  };
}

/**
 * @description Lista solo períodos anuales aprobados con snapshot v2 o v3 íntegro.
 * @param {string} tenantId - Empresa propietaria de los períodos.
 * @returns {Promise<object[]>} Años que pueden consultarse sin recalcular datos actuales.
 */
export async function listAvailableFinancialPeriods(tenantId: string): Promise<Array<{
  periodId: string;
  code: string | null;
  year: number;
  cutoffAt: string;
  snapshotVersion: 2 | 3;
}>> {
  const periods = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    return tx.periodoContable.findMany({
      where: {
        tenantId,
        tipo: 'ANUAL',
        estado: 'APROBADO',
        snapshotPeriodos: { some: {} },
      },
      orderBy: { fechaInicio: 'desc' },
      select: {
        periodoId: true,
        codigo: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        hashIntegridad: true,
        snapshotPeriodos: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            snapshotId: true,
            version: true,
            tenantId: true,
            schemaVersion: true,
            status: true,
            resumenJson: true,
            hashIntegridad: true,
            createdAt: true,
          },
        },
      },
    });
  }, { isolationLevel: 'Serializable' });

  return periods.flatMap((period) => {
    const resolution = resolveApprovedSnapshot(
      period.periodoId,
      period.snapshotPeriodos[0],
      period.hashIntegridad,
      tenantId,
    );
    if (resolution.status !== 'AVAILABLE' || resolution.origin !== 'SNAPSHOT') return [];
    return [{
      periodId: period.periodoId,
      code: period.codigo,
      year: getAccountingYear(period.fechaInicio),
      cutoffAt: resolution.cutoffAt,
      snapshotVersion: resolution.snapshotVersion,
    }];
  });
}
