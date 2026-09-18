import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';

import {
  hashImmutableFinancialEvidence,
} from './immutable-financial-evidence';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

export const FINANCIAL_SNAPSHOT_V3_VERSION = 3 as const;
export const FINANCIAL_SNAPSHOT_V3_WARNING =
  'Este reporte usa evidencia heredada v2 y puede no incluir la procedencia y cobertura completas disponibles en v3.';

type SnapshotErrorCode =
  | 'INVALID_SNAPSHOT_PAYLOAD'
  | 'SNAPSHOT_IMMUTABLE'
  | 'RESOURCE_NOT_ACCESSIBLE'
  | 'SNAPSHOT_INTEGRITY_FAILED'
  | 'SNAPSHOT_APPROVAL_CONFLICT';

export class FinancialSnapshotV3Error extends Error {
  /**
   * @description Crea un error seguro y tipado del ciclo de vida v3.
   * @param {string} message - Mensaje no sensible para la operación.
   * @param {SnapshotErrorCode} code - Código estable para el consumidor.
   * @returns {FinancialSnapshotV3Error} Error de dominio.
   */
  constructor(message: string, public readonly code: SnapshotErrorCode) {
    super(message);
    this.name = 'FinancialSnapshotV3Error';
  }
}

type JsonRecord = Record<string, unknown>;

export interface FinancialSnapshotV3Input {
  tenantId: string;
  periodoId: string;
  version: number;
  cutoffAt: Date;
  capturedAt: Date;
  canonicalContractVersion: string;
  range: { gte: string; lt: string };
  functionalCurrency: string;
  balance: JsonRecord;
  result: JsonRecord;
  cashFlow: JsonRecord;
  coverage: JsonRecord;
  provenance: {
    appliedFxEvidence: unknown[];
    sourceFingerprints: Record<string, string>;
  };
  comparison?: JsonRecord;
}

export interface FinancialSnapshotV3Payload {
  version: typeof FINANCIAL_SNAPSHOT_V3_VERSION;
  tenantId: string;
  cutoffAt: string;
  capturedAt: string;
  range: { gte: string; lt: string };
  functionalCurrency: string;
  canonicalContractVersion: string;
  balance: JsonRecord;
  result: JsonRecord;
  cashFlow: JsonRecord;
  coverage: JsonRecord;
  provenance: {
    appliedFxEvidence: unknown[];
    sourceFingerprints: Record<string, string>;
  };
  comparison?: JsonRecord;
  approvedAt?: string;
}

interface PersistedFinancialSnapshotV3 {
  snapshotId: string;
  tenantId: string | null;
  schemaVersion: number | null;
  status: string | null;
  cutoffAt: Date | null;
  capturedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  resumenJson: unknown;
  hashIntegridad: string | null;
}

/**
 * @description Valida una fecha ISO con precisión canónica de milisegundos.
 * @param {string} value - Fecha candidata.
 * @returns {boolean} Si es una fecha ISO que no pierde precisión.
 */
function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

/**
 * @description Comprueba que el payload v3 contiene evidencia canónica completa.
 * @param {unknown} value - Payload leído o recibido.
 * @param {string} [tenantId] - Tenant esperado para reforzar aislamiento.
 * @returns {value is FinancialSnapshotV3Payload} Resultado de validación.
 */
export function isFinancialSnapshotV3Payload(
  value: unknown,
  tenantId?: string,
): value is FinancialSnapshotV3Payload {
  try {
    validateFinancialSnapshotV3Payload(value, tenantId);
    return true;
  } catch {
    return false;
  }
}

/**
 * @description Valida los invariantes de evidencia y devuelve el payload tipado.
 * @param {unknown} value - Payload a validar.
 * @param {string} [tenantId] - Tenant que debe coincidir con el payload.
 * @returns {FinancialSnapshotV3Payload} Payload validado.
 */
export function validateFinancialSnapshotV3Payload(
  value: unknown,
  tenantId?: string,
): FinancialSnapshotV3Payload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidPayload();
  }
  const payload = value as JsonRecord;
  const requiredObjects = ['balance', 'result', 'cashFlow', 'coverage', 'provenance'];
  if (
    payload.version !== FINANCIAL_SNAPSHOT_V3_VERSION ||
    typeof payload.tenantId !== 'string' ||
    (tenantId !== undefined && payload.tenantId !== tenantId) ||
    !isCanonicalIsoDate(payload.cutoffAt) ||
    !isCanonicalIsoDate(payload.capturedAt) ||
    !isCanonicalIsoDate(payload.range && (payload.range as JsonRecord).gte) ||
    !isCanonicalIsoDate(payload.range && (payload.range as JsonRecord).lt) ||
    typeof payload.functionalCurrency !== 'string' ||
    payload.functionalCurrency.trim() !== payload.functionalCurrency ||
    payload.functionalCurrency !== payload.functionalCurrency.toUpperCase() ||
    typeof payload.canonicalContractVersion !== 'string' ||
    !requiredObjects.every((key) => isObject(payload[key]))
  ) {
    throw invalidPayload();
  }

  const range = payload.range as JsonRecord;
  if (
    range.lt !== payload.cutoffAt ||
    new Date(range.gte as string).getTime() >= new Date(range.lt as string).getTime() ||
    new Date(payload.cutoffAt as string).getTime() > new Date(payload.capturedAt as string).getTime()
  ) {
    throw invalidPayload();
  }

  const provenance = payload.provenance as JsonRecord;
  const fingerprints = provenance.sourceFingerprints;
  if (
    !Array.isArray(provenance.appliedFxEvidence) ||
    !isStringRecord(fingerprints)
  ) {
    throw invalidPayload();
  }
  validateCoverageInvariant(payload.coverage as JsonRecord);
  if (payload.approvedAt !== undefined) {
    if (
      !isCanonicalIsoDate(payload.approvedAt) ||
      new Date(payload.capturedAt as string).getTime() >
        new Date(payload.approvedAt as string).getTime()
    ) {
      throw invalidPayload();
    }
  }

  return payload as unknown as FinancialSnapshotV3Payload;
}

/**
 * @description Construye y firma el payload v3 sin consultar ni recalcular fuentes.
 * @param {FinancialSnapshotV3Input} input - Salidas canónicas ya calculadas.
 * @returns {{payload: FinancialSnapshotV3Payload; hash: string}} JSON final y hash.
 */
export function createFinancialSnapshotV3(input: FinancialSnapshotV3Input): {
  payload: FinancialSnapshotV3Payload;
  hash: string;
} {
  const payload: FinancialSnapshotV3Payload = {
    version: FINANCIAL_SNAPSHOT_V3_VERSION,
    tenantId: input.tenantId,
    cutoffAt: input.cutoffAt.toISOString(),
    capturedAt: input.capturedAt.toISOString(),
    range: input.range,
    functionalCurrency: input.functionalCurrency.trim().toUpperCase(),
    canonicalContractVersion: input.canonicalContractVersion,
    balance: input.balance,
    result: input.result,
    cashFlow: input.cashFlow,
    coverage: input.coverage,
    provenance: input.provenance,
    ...(input.comparison ? { comparison: input.comparison } : {}),
  };
  validateFinancialSnapshotV3Payload(payload, input.tenantId);
  return { payload, hash: hashFinancialSnapshotV3(payload) };
}

/**
 * @description Calcula el SHA-256 determinista de un payload v3 completo.
 * @param {unknown} payload - Evidencia v3.
 * @returns {string} Huella hexadecimal.
 */
export function hashFinancialSnapshotV3(payload: unknown): string {
  validateFinancialSnapshotV3Payload(payload);
  return hashImmutableFinancialEvidence(payload);
}

/**
 * @description Captura un snapshot v3 como fila CAPTURED, sin activar writers de períodos.
 * @param {FinancialSnapshotV3Input} input - Evidencia canónica tenant-scoped.
 * @param {Prisma.TransactionClient} [client] - Transacción común existente.
 * @returns {Promise<PersistedFinancialSnapshotV3>} Fila capturada.
 */
export async function captureFinancialSnapshotV3(
  input: FinancialSnapshotV3Input,
  client?: Prisma.TransactionClient,
): Promise<PersistedFinancialSnapshotV3> {
  const { payload, hash } = createFinancialSnapshotV3(input);
  const capture = async (tx: Prisma.TransactionClient): Promise<PersistedFinancialSnapshotV3> => {
    await acquireAccountingTenantLock(tx, input.tenantId);
    const existing = await tx.snapshotPeriodo.findFirst({
      where: {
        tenantId: input.tenantId,
        periodoId: input.periodoId,
        schemaVersion: FINANCIAL_SNAPSHOT_V3_VERSION,
        cutoffAt: new Date(payload.cutoffAt),
      },
    });
    if (existing) return existing as unknown as PersistedFinancialSnapshotV3;
    const latest = await tx.snapshotPeriodo.findFirst({
      where: { periodoId: input.periodoId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return tx.snapshotPeriodo.create({
      data: {
        periodoId: input.periodoId,
        version: Math.max(input.version, (latest?.version ?? 0) + 1),
        tenantId: input.tenantId,
        schemaVersion: FINANCIAL_SNAPSHOT_V3_VERSION,
        status: 'CAPTURED',
        cutoffAt: new Date(payload.cutoffAt),
        capturedAt: new Date(payload.capturedAt),
        canonicalContractVersion: payload.canonicalContractVersion,
        resumenJson: payload as unknown as Prisma.InputJsonValue,
        hashIntegridad: hash,
      },
    }) as unknown as PersistedFinancialSnapshotV3;
  };
  return client
    ? capture(client)
    : prisma.$transaction(capture, { isolationLevel: 'Serializable' });
}

/**
 * @description Aprueba exactamente una vez un snapshot CAPTURED y finaliza su JSON.
 * @param {{tenantId: string; snapshotId: string; approvedAt: Date; approvedBy: string}} params - Aprobación.
 * @param {Prisma.TransactionClient} [client] - Transacción común existente.
 * @returns {Promise<PersistedFinancialSnapshotV3>} Snapshot aprobado.
 */
export async function approveFinancialSnapshotV3(
  params: {
    tenantId: string;
    snapshotId: string;
    approvedAt: Date;
    approvedBy: string;
  },
  client?: Prisma.TransactionClient,
): Promise<PersistedFinancialSnapshotV3> {
  const approve = async (tx: Prisma.TransactionClient): Promise<PersistedFinancialSnapshotV3> => {
    await acquireAccountingTenantLock(tx, params.tenantId);
    const current = await tx.snapshotPeriodo.findFirst({
      where: {
        snapshotId: params.snapshotId,
        tenantId: params.tenantId,
        schemaVersion: FINANCIAL_SNAPSHOT_V3_VERSION,
      },
    });
    if (!current) throw new FinancialSnapshotV3Error(
      'El snapshot no está disponible para este tenant',
      'RESOURCE_NOT_ACCESSIBLE',
    );
    if (current.status === 'APPROVED') {
      if (
        current.approvedBy !== params.approvedBy ||
        !current.approvedAt ||
        current.approvedAt.getTime() !== params.approvedAt.getTime()
      ) {
        throw new FinancialSnapshotV3Error(
          'El snapshot aprobado es inmutable',
          'SNAPSHOT_IMMUTABLE',
        );
      }
      return verifyPersistedSnapshot(current, params.tenantId);
    }
    if (current.status !== 'CAPTURED' || !current.capturedAt ||
      params.approvedAt.getTime() < current.capturedAt.getTime()) {
      throw new FinancialSnapshotV3Error(
        'La cronología de aprobación no es válida',
        'SNAPSHOT_APPROVAL_CONFLICT',
      );
    }
    const capturedPayload = validateFinancialSnapshotV3Payload(
      current.resumenJson,
      params.tenantId,
    );
    const finalPayload: FinancialSnapshotV3Payload = {
      ...capturedPayload,
      approvedAt: params.approvedAt.toISOString(),
    };
    const finalHash = hashFinancialSnapshotV3(finalPayload);
    const updated = await tx.snapshotPeriodo.updateMany({
      where: {
        snapshotId: params.snapshotId,
        tenantId: params.tenantId,
        schemaVersion: FINANCIAL_SNAPSHOT_V3_VERSION,
        status: 'CAPTURED',
      },
      data: {
        status: 'APPROVED',
        approvedAt: params.approvedAt,
        approvedBy: params.approvedBy,
        resumenJson: finalPayload as unknown as Prisma.InputJsonValue,
        hashIntegridad: finalHash,
      },
    });
    if (updated.count === 0) {
      throw new FinancialSnapshotV3Error(
        'La aprobación fue modificada por otra operación',
        'SNAPSHOT_APPROVAL_CONFLICT',
      );
    }
    const approved = await tx.snapshotPeriodo.findFirst({
      where: {
        snapshotId: params.snapshotId,
        tenantId: params.tenantId,
        schemaVersion: FINANCIAL_SNAPSHOT_V3_VERSION,
        status: 'APPROVED',
      },
    });
    if (!approved) throw new FinancialSnapshotV3Error(
      'No se pudo confirmar la aprobación del snapshot',
      'SNAPSHOT_APPROVAL_CONFLICT',
    );
    return verifyPersistedSnapshot(approved, params.tenantId);
  };
  return client
    ? approve(client)
    : prisma.$transaction(approve, { isolationLevel: 'Serializable' });
}

/**
 * @description Lee exclusivamente un snapshot v3 aprobado y del tenant indicado.
 * @param {{tenantId: string; snapshotId: string}} params - Identidad segura.
 * @returns {Promise<PersistedFinancialSnapshotV3 | null>} Snapshot íntegro o null.
 */
export async function findFinancialSnapshotV3(params: {
  tenantId: string;
  snapshotId: string;
}): Promise<PersistedFinancialSnapshotV3 | null> {
  const snapshot = await prisma.snapshotPeriodo.findFirst({
    where: {
      snapshotId: params.snapshotId,
      tenantId: params.tenantId,
      schemaVersion: FINANCIAL_SNAPSHOT_V3_VERSION,
      status: 'APPROVED',
    },
  });
  return snapshot ? verifyPersistedSnapshot(snapshot, params.tenantId) : null;
}

function verifyPersistedSnapshot(
  snapshot: PersistedFinancialSnapshotV3,
  tenantId: string,
): PersistedFinancialSnapshotV3 {
  const payload = validateFinancialSnapshotV3Payload(snapshot.resumenJson, tenantId);
  if (!snapshot.hashIntegridad || hashImmutableFinancialEvidence(payload) !== snapshot.hashIntegridad) {
    throw new FinancialSnapshotV3Error(
      'La integridad del snapshot no es válida',
      'SNAPSHOT_INTEGRITY_FAILED',
    );
  }
  return snapshot;
}

function isObject(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isObject(value) && Object.values(value).every((item) => typeof item === 'string');
}

function validateCoverageInvariant(value: JsonRecord): void {
  const candidates = value.candidates;
  if (candidates === undefined) return;
  if (!isObject(candidates)) throw invalidPayload();

  const dispositions = ['included', 'unresolved', 'excluded']
    .map((key) => candidates[key]);
  if (!dispositions.every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0)) {
    throw invalidPayload();
  }
  const total = candidates.total;
  const sum = (dispositions as number[]).reduce((result, item) => result + item, 0);
  if (total !== undefined && (typeof total !== 'number' || total !== sum)) {
    throw invalidPayload();
  }
}

function invalidPayload(): FinancialSnapshotV3Error {
  return new FinancialSnapshotV3Error(
    'La evidencia canónica del snapshot v3 está incompleta',
    'INVALID_SNAPSHOT_PAYLOAD',
  );
}
