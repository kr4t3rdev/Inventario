import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma';

/**
 * @description Payload canónico de una renovación de licencia, usado para
 * derivar la huella inmutable del evento idempotente.
 */
export interface RenewalPayloadFingerprintInput {
  tenantLicenseId: string;
  planId: string;
  registerPayment: boolean;
  /** Monto explícito en USD (2 decimales) o null cuando el admin no lo fijó. */
  amountPaidUsd: number | null;
  /** Override de duración en días (mobile) o null cuando se usa la del plan. */
  durationDays: number | null;
}

/**
 * @description Resultado comprometido de una renovación, persistido en el
 * recibo para responder replays con el outcome original.
 */
export interface RenewalOutcomeSnapshot {
  tenantLicenseId: string;
  newPlanId: string;
  previousPlanId: string | null;
  /** ISO string de la nueva expiración. */
  newExpiracion: string;
  /** ISO string de la expiración previa. */
  previousExpiracion: string;
  registeredPaymentId: string | null;
  commissionCredited: boolean;
}

/**
 * @description Genera el hash unidireccional de la clave de idempotencia
 * antes de persistirla (nunca se guarda la clave en claro).
 * @param {string} key - Clave provista por el cliente.
 * @returns {string} SHA-256 en hex.
 */
export function hashRenewalKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * @description Reconoce únicamente la violación del unique compuesto
 * tenantId+keyHash del recibo de renovación.
 * @param {unknown} error - Error lanzado por Prisma.
 * @returns {boolean} True solo para el índice exacto del recibo.
 */
export function isRenewalReceiptUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.length === 2 && target.includes('tenantId') && target.includes('keyHash');
  }
  return target === 'license_renewal_operations_tenantId_keyHash_key' || target === 'tenantId_keyHash';
}

/**
 * @description Produce la huella estable del payload validado de renovación.
 * @param {RenewalPayloadFingerprintInput} payload - Payload canónico.
 * @returns {string} SHA-256 del JSON canónico.
 */
export function fingerprintRenewalPayload(
  payload: RenewalPayloadFingerprintInput,
): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

/**
 * @description Captura el resultado de la renovación en JSON compatible con
 * Prisma para persistirlo como snapshot inmutable.
 * @param {RenewalOutcomeSnapshot} outcome - Resultado comprometido.
 * @returns {Prisma.InputJsonObject} Snapshot serializable.
 */
export function snapshotRenewalOutcome(
  outcome: RenewalOutcomeSnapshot,
): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(outcome)) as Prisma.InputJsonObject;
}

/**
 * @description Restaura el outcome original desde el snapshot persistido,
 * reviviendo las fechas ISO a Date nativos.
 * @param {Prisma.JsonValue} snapshot - Snapshot almacenado en el recibo.
 * @returns {RenewalOutcomeSnapshot} Outcome original validado.
 * @throws {Error} Si el snapshot no tiene la forma esperada.
 */
export function reviveRenewalOutcome(
  snapshot: Prisma.JsonValue,
): RenewalOutcomeSnapshot {
  if (snapshot === null || Array.isArray(snapshot) || typeof snapshot !== 'object') {
    throw new Error('Invalid license renewal response snapshot');
  }
  const response = snapshot as Record<string, unknown>;
  const requiredStrings = [
    'tenantLicenseId',
    'newPlanId',
    'newExpiracion',
    'previousExpiracion',
  ] as const;
  for (const field of requiredStrings) {
    if (typeof response[field] !== 'string') {
      throw new Error('Invalid license renewal response snapshot');
    }
  }
  if (Number.isNaN(Date.parse(response.newExpiracion as string))) {
    throw new Error('Invalid license renewal response snapshot');
  }
  if (Number.isNaN(Date.parse(response.previousExpiracion as string))) {
    throw new Error('Invalid license renewal response snapshot');
  }
  if (
    response.previousPlanId !== null &&
    typeof response.previousPlanId !== 'string'
  ) {
    throw new Error('Invalid license renewal response snapshot');
  }
  if (
    response.registeredPaymentId !== null &&
    typeof response.registeredPaymentId !== 'string'
  ) {
    throw new Error('Invalid license renewal response snapshot');
  }
  if (typeof response.commissionCredited !== 'boolean') {
    throw new Error('Invalid license renewal response snapshot');
  }
  return {
    tenantLicenseId: response.tenantLicenseId as string,
    newPlanId: response.newPlanId as string,
    previousPlanId: (response.previousPlanId as string | null) ?? null,
    newExpiracion: response.newExpiracion as string,
    previousExpiracion: response.previousExpiracion as string,
    registeredPaymentId: (response.registeredPaymentId as string | null) ?? null,
    commissionCredited: response.commissionCredited as boolean,
  };
}

/**
 * @description Serializa valores JSON de forma determinística preservando el
 * orden de los arrays.
 * @param {unknown} value - Valor del payload.
 * @returns {string} Representación JSON canónica.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const sortedEntries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${sortedEntries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Renewal payload contains a non-JSON value');
  return encoded;
}
