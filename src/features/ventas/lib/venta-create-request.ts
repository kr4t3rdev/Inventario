import { z } from 'zod';
import { ActionError } from '@/lib/server-actions';

const idempotencyKeySchema = z.string().trim().min(1).max(64);

/**
 * @description Applies body-first idempotency key precedence for sale adapters.
 * @param {unknown} body - Parsed JSON request body.
 * @param {string | null} headerKey - Optional Idempotency-Key header.
 * @returns {unknown} Body with the validated selected key, if present.
 */
export function withVentaCreateIdempotencyKey(
  body: unknown,
  headerKey: string | null,
): unknown {
  const record = body !== null && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
  const bodyHasKey = record !== null && Object.prototype.hasOwnProperty.call(record, 'idempotencyKey');
  const selectedKey = bodyHasKey ? record.idempotencyKey : headerKey;
  if (selectedKey === undefined || selectedKey === null) return body;

  const parsed = idempotencyKeySchema.safeParse(selectedKey);
  if (!parsed.success) {
    throw new ActionError('La clave de idempotencia no es válida.', 'VALIDATION_ERROR');
  }
  return { ...record, idempotencyKey: parsed.data };
}
