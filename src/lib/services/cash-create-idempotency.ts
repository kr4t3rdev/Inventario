import { createHash } from 'node:crypto';

type CashCreatePayload = Record<string, unknown>;

interface CashCreateReplayOptions<TResult> {
  findReplay: () => Promise<TResult | null>;
  validatePeriod: () => Promise<void>;
  write: () => Promise<TResult>;
  canRecover: (error: unknown) => boolean;
}

function canonicalize(value: unknown): string {
  if (value == null) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === 'number') return JSON.stringify(Number.isFinite(value) ? value : null);
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

/**
 * @description Validates and normalizes an optional cash-create retry key.
 * @param {unknown} value - Untrusted action payload value.
 * @returns {string | null} Normalized key or null when omitted.
 */
export function normalizeCashCreateIdempotencyKey(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') throw new TypeError('Invalid idempotency key');
  const key = value.trim();
  if (!key || key.length > 64) throw new TypeError('Invalid idempotency key');
  return key;
}

/**
 * @description Hashes the canonical, business-relevant create payload.
 * @param {CashCreatePayload} payload - Payload excluding the retry key itself.
 * @returns {string} SHA-256 fingerprint for replay comparison.
 */
export function cashCreatePayloadHash(payload: CashCreatePayload): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

/**
 * @description Identifies only the tenant-scoped idempotency unique-index violation.
 * @param {unknown} error - Prisma error caught at the create-action boundary.
 * @returns {boolean} Whether a replay lookup may safely recover the error.
 */
export function isCashCreateIdempotencyUniqueConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate.code !== 'P2002') return false;
  const target = candidate.meta?.target;
  const targetFields = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return targetFields.includes('tenantId') && targetFields.includes('idempotencyKey');
}

/**
 * @description Resolves an existing result before period validation and after recoverable races.
 * @param {CashCreateReplayOptions<TResult>} options - Replay lookup and write callbacks.
 * @returns {Promise<TResult>} Previously committed or newly created result.
 */
export async function runCashCreateWithReplay<TResult>({
  findReplay,
  validatePeriod,
  write,
  canRecover,
}: CashCreateReplayOptions<TResult>): Promise<TResult> {
  const existing = await findReplay();
  if (existing) return existing;

  try {
    await validatePeriod();
  } catch (error) {
    if (!canRecover(error)) throw error;
    const confirmed = await findReplay();
    if (confirmed) return confirmed;
    throw error;
  }

  try {
    return await write();
  } catch (error) {
    if (!canRecover(error)) throw error;
    const confirmed = await findReplay();
    if (confirmed) return confirmed;
    throw error;
  }
}
